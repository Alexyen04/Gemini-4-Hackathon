import fs from "fs/promises";
import { GoogleGenAI, ThinkingLevel, Part } from "@google/genai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ALLOWED_GEMINI_MODELS, AllowedGeminiModel } from "@/types/manga";

export type AgentModelRole = "argon" | "carbon" | "hydrogen" | "neon";

const GEMINI_UNSUPPORTED_SCHEMA_KEYS = new Set([
  "$schema",
  "additionalProperties",
  "default",
  "description",
  "examples",
  "exclusiveMaximum",
  "exclusiveMinimum",
  "format",
  "maximum",
  "maxItems",
  "maxLength",
  "minimum",
  "minItems",
  "minLength",
  "multipleOf",
  "pattern",
  "title",
]);

/**
 * Keeps the response's object/array/type shape while removing constraints that
 * can make Gemini's constrained decoder exceed its serving-state limit.
 * Full enum/range/length validation still happens locally through Zod.
 */
export function buildGeminiServingSchema(
  schema: Record<string, unknown>
): Record<string, unknown> {
  const simplify = (source: Record<string, unknown>): Record<string, unknown> => {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(source)) {
      if (GEMINI_UNSUPPORTED_SCHEMA_KEYS.has(key)) continue;
      // Enums multiply constrained-decoding states substantially. Their base
      // JSON type is enough for serving; Zod enforces exact values afterward.
      if (key === "enum" || key === "const") continue;
      if (key === "properties" && child && typeof child === "object") {
        // Property names are application data, not schema keywords. In
        // particular, a required "title" field must never be stripped.
        result[key] = Object.fromEntries(
          Object.entries(child as Record<string, Record<string, unknown>>).map(
            ([field, fieldSchema]) => [field, simplify(fieldSchema)]
          )
        );
      } else if (key === "items" && child && typeof child === "object") {
        result[key] = simplify(child as Record<string, unknown>);
      } else {
        result[key] = child;
      }
    }
    return result;
  };

  return simplify(schema);
}

export class GeminiConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiConfigurationError";
  }
}

/**
 * Enforces the strict hackathon constraint: ONLY Gemini 4 Argon, Carbon,
 * Neon, and Hydrogen are permitted across the entire application.
 */
export function assertAllowedGeminiModel(modelId: string): AllowedGeminiModel {
  const normalized = modelId.trim() as AllowedGeminiModel;
  if (!ALLOWED_GEMINI_MODELS.includes(normalized)) {
    throw new GeminiConfigurationError(
      `Disallowed AI model "${modelId}". Only ${ALLOWED_GEMINI_MODELS.join(
        ", "
      )} are permitted.`
    );
  }
  return normalized;
}

export function resolveRoleModel(role: AgentModelRole): AllowedGeminiModel {
  const map: Record<AgentModelRole, string> = {
    argon: process.env.GEMINI_MODEL_ARGON || "gemini-4-argon",
    carbon: process.env.GEMINI_MODEL_CARBON || "gemini-4-carbon",
    hydrogen: process.env.GEMINI_MODEL_HYDROGEN || "gemini-4-hydrogen",
    neon: process.env.GEMINI_MODEL_NEON || "gemini-4-neon",
  };
  return assertAllowedGeminiModel(map[role]);
}

export function getConfiguredApiKey(): string | null {
  const key = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();
  if (!key || key === "your_gemini_api_key_here") {
    return null;
  }
  return key;
}

export function hasConfiguredApiKey(): boolean {
  return Boolean(getConfiguredApiKey());
}

/**
 * Bounded concurrency mapper so clip understanding and panel illustration
 * parallelize safely without triggering rate-limit bursts.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const limit = Math.max(1, Math.min(16, concurrency));
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function runLane(): Promise<void> {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) break;
      results[idx] = await worker(items[idx], idx);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => runLane())
  );
  return results;
}

export class GeminiClientService {
  private static instance: GoogleGenAI | null = null;
  private static lastKey = "";

  static getClient(): GoogleGenAI {
    const apiKey = (
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      ""
    ).trim();
    if (!apiKey || apiKey === "your_gemini_api_key_here") {
      throw new GeminiConfigurationError(
        "GEMINI_API_KEY is not configured. Set GEMINI_API_KEY in .env.local to run Real AI Mode, or switch to clearly labeled Development Demo Mode."
      );
    }
    if (!this.instance || this.lastKey !== apiKey) {
      this.instance = new GoogleGenAI({ apiKey });
      this.lastKey = apiKey;
    }
    return this.instance;
  }

  static async imagePathToInlinePart(
    filePath: string,
    mimeType = "image/png"
  ): Promise<Part> {
    const bytes = await fs.readFile(filePath);
    return {
      inlineData: {
        mimeType,
        data: bytes.toString("base64"),
      },
    };
  }

  /**
   * Uploads a basketball highlight video to the Gemini Files API and waits
   * until its state transitions to `ACTIVE`. Falls back cleanly if upload
   * exceeds timeout so keyframe parts can still ground the analysis.
   */
  static async uploadVideoPartIfPractical(
    filePath: string,
    mimeType = "video/mp4"
  ): Promise<Part | null> {
    try {
      const stat = await fs.stat(filePath);
      // For compact clips (< 14MB), inlineData avoids extra Files API polling latency
      if (stat.size <= 14 * 1024 * 1024) {
        const buf = await fs.readFile(filePath);
        return {
          inlineData: {
            mimeType,
            data: buf.toString("base64"),
          },
        };
      }

      const ai = this.getClient();
      const uploaded = await ai.files.upload({
        file: filePath,
        config: { mimeType },
      });

      if (!uploaded.name || !uploaded.uri) return null;

      let fileInfo = await ai.files.get({ name: uploaded.name });
      let attempts = 0;
      while (fileInfo.state === "PROCESSING" && attempts < 18) {
        await new Promise((r) => setTimeout(r, 1500));
        fileInfo = await ai.files.get({ name: uploaded.name });
        attempts++;
      }

      if (fileInfo.state === "ACTIVE" && fileInfo.uri) {
        return {
          fileData: {
            fileUri: fileInfo.uri,
            mimeType: fileInfo.mimeType || mimeType,
          },
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Calls an allowed Gemini 4 model with structured JSON output, thinking level
   * configuration, exponential backoff retry, and strict Zod validation.
   */
  static async generateStructuredJson<T>(params: {
    role: AgentModelRole;
    systemInstruction: string;
    contents: Array<Part | string>;
    zodSchema: z.ZodType<T, z.ZodTypeDef, unknown>;
    jsonSchema?: Record<string, unknown>;
    thinkingLevel?: "LOW" | "MEDIUM" | "HIGH";
    temperature?: number;
    maxRetries?: number;
  }): Promise<{ data: T; modelUsed: AllowedGeminiModel }> {
    const {
      role,
      systemInstruction,
      contents,
      zodSchema,
      jsonSchema,
      thinkingLevel = "MEDIUM",
      temperature = 0.35,
      maxRetries = 2,
    } = params;

    const model = resolveRoleModel(role);
    const ai = this.getClient();
    let effectiveJsonSchema = jsonSchema;
    if (!effectiveJsonSchema) {
      const generatedSchema = zodToJsonSchema(
        zodSchema as z.ZodTypeAny,
        { $refStrategy: "none" }
      ) as Record<string, unknown>;
      effectiveJsonSchema = buildGeminiServingSchema(generatedSchema);
    }

    const requestParts: Part[] = contents.map((item) =>
      typeof item === "string" ? { text: item } : item
    );

    const sdkThinkingLevel =
      thinkingLevel === "HIGH"
        ? ThinkingLevel.HIGH
        : thinkingLevel === "LOW"
        ? ThinkingLevel.LOW
        : ThinkingLevel.MEDIUM;

    let lastError: unknown = null;
    let useResponseSchema = true;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const startedAt = Date.now();
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [{ role: "user", parts: requestParts }],
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            ...(useResponseSchema
              ? { responseJsonSchema: effectiveJsonSchema }
              : {}),
            thinkingConfig: {
              thinkingLevel: sdkThinkingLevel,
            },
            temperature,
          },
        });

        const rawText = response.text?.trim();
        if (!rawText) {
          throw new Error(`Empty response text from ${model}`);
        }

        const cleanedJson = rawText
          .replace(/^```json\s*/i, "")
          .replace(/```\s*$/i, "")
          .trim();

        const parsedObj = JSON.parse(cleanedJson);
        const validated = zodSchema.parse(parsedObj);
        console.info(`[Gemini ${role}] ${model} structured call attempt ${attempt + 1} succeeded in ${Date.now() - startedAt}ms`);
        return { data: validated, modelUsed: model };
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[Gemini ${role}] ${model} structured call attempt ${attempt + 1} failed in ${Date.now() - startedAt}ms: ${msg.slice(0, 500)}`);
        // Do not retry auth or configuration errors
        if (
          err instanceof GeminiConfigurationError ||
          msg.includes("API_KEY_INVALID") ||
          msg.includes("401") ||
          msg.includes("403")
        ) {
          throw err;
        }
        if (attempt < maxRetries) {
          const schemaRejected =
            msg.includes("schema produces a constraint that has too many states") ||
            msg.includes("too many states for serving") ||
            msg.includes("schema at top-level requires unspecified property");
          if (schemaRejected && useResponseSchema) {
            useResponseSchema = false;
            requestParts.push({
              text:
                "The API could not apply constrained decoding to this large schema. " +
                "Still return one complete JSON object with exactly the requested structure and value types. " +
                `Use this shape-only schema as guidance: ${JSON.stringify(
                  effectiveJsonSchema
                )}`,
            });
            continue;
          }

          const validationFeedback =
            err instanceof z.ZodError
              ? JSON.stringify(
                  err.issues.map(({ path, code, message }) => ({
                    path,
                    code,
                    message,
                  }))
                )
              : msg;
          requestParts.push({
            text:
              "CORRECTION REQUIRED: The previous JSON response was invalid. " +
              "Return a complete replacement JSON object that follows the supplied response schema exactly. " +
              `Validation errors: ${validationFeedback}`,
          });
          const backoffMs = 900 * Math.pow(2, attempt);
          await new Promise((r) => setTimeout(r, backoffMs));
        }
      }
    }

    throw new Error(
      `Gemini 4 (${model}) structured generation failed after ${
        maxRetries + 1
      } attempts: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`
    );
  }
}
