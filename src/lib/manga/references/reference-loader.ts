import crypto from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import zlib from "zlib";
import { StorageService } from "@/lib/storage/storage-service";

const execFileAsync = promisify(execFile);

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const ARCHIVE_EXTENSIONS = new Set([".zip", ".cbz"]);
const PDF_EXTENSIONS = new Set([".pdf"]);

export interface DiscoveredReferencePage {
  chapterId: string;
  pageId: string;
  pageNumber: number;
  sourceFilePath: string;
  resolvedImagePath: string;
  relativeSourcePath: string;
}

export interface DiscoveredReferenceCorpus {
  referencesDir: string;
  exists: boolean;
  isEmpty: boolean;
  fingerprintHash: string;
  chapterIds: string[];
  pages: DiscoveredReferencePage[];
}

function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export class ReferenceLoader {
  static getReferencesDirectory(): string {
    if (process.env.MANGA_REFERENCES_DIR) {
      return path.resolve(process.cwd(), process.env.MANGA_REFERENCES_DIR);
    }
    return path.join(StorageService.getBaseDir(), "manga_refs");
  }

  static getExtractionCacheDir(): string {
    return path.join(
      StorageService.getBaseDir(),
      "reference_cache",
      "extracted"
    );
  }

  private static async hashFileSha256(filePath: string): Promise<string> {
    const buf = await fs.readFile(filePath);
    return crypto.createHash("sha256").update(buf).digest("hex");
  }

  /**
   * Safely extracts image pages from a `.zip` or `.cbz` archive natively in
   * Node.js using `zlib` (no external binary required; immune to zip-slip).
   */
  private static async extractArchiveImages(
    archivePath: string,
    destDir: string
  ): Promise<string[]> {
    await fs.mkdir(destDir, { recursive: true });
    const absDest = path.resolve(destDir);
    const outPaths: string[] = [];

    try {
      const buf = await fs.readFile(archivePath);
      // Locate End of Central Directory (EOCD) signature 0x06054b50 from tail
      let eocdOffset = -1;
      for (
        let i = buf.length - 22;
        i >= Math.max(0, buf.length - 65557);
        i--
      ) {
        if (buf.readUInt32LE(i) === 0x06054b50) {
          eocdOffset = i;
          break;
        }
      }
      if (eocdOffset === -1) return [];

      const totalEntries = buf.readUInt16LE(eocdOffset + 10);
      let cdOffset = buf.readUInt32LE(eocdOffset + 16);

      const entries: Array<{
        fileName: string;
        compressionMethod: number;
        compressedSize: number;
        localHeaderOffset: number;
      }> = [];

      for (let idx = 0; idx < totalEntries; idx++) {
        if (cdOffset + 46 > buf.length) break;
        if (buf.readUInt32LE(cdOffset) !== 0x02014b50) break;

        const compressionMethod = buf.readUInt16LE(cdOffset + 10);
        const compressedSize = buf.readUInt32LE(cdOffset + 20);
        const nameLen = buf.readUInt16LE(cdOffset + 28);
        const extraLen = buf.readUInt16LE(cdOffset + 30);
        const commentLen = buf.readUInt16LE(cdOffset + 32);
        const localHeaderOffset = buf.readUInt32LE(cdOffset + 42);
        const fileName = buf
          .subarray(cdOffset + 46, cdOffset + 46 + nameLen)
          .toString("utf-8");

        entries.push({
          fileName,
          compressionMethod,
          compressedSize,
          localHeaderOffset,
        });
        cdOffset += 46 + nameLen + extraLen + commentLen;
      }

      entries.sort((a, b) => naturalCompare(a.fileName, b.fileName));

      let pageCounter = 1;
      for (const entry of entries) {
        if (entry.fileName.endsWith("/")) continue;
        const base = path.basename(entry.fileName);
        if (base.startsWith(".") || entry.fileName.includes("__MACOSX")) {
          continue;
        }
        const ext = path.extname(base).toLowerCase();
        if (!IMAGE_EXTENSIONS.has(ext)) continue;

        const lh = entry.localHeaderOffset;
        if (lh + 30 > buf.length || buf.readUInt32LE(lh) !== 0x04034b50) {
          continue;
        }
        const lhNameLen = buf.readUInt16LE(lh + 26);
        const lhExtraLen = buf.readUInt16LE(lh + 28);
        const dataStart = lh + 30 + lhNameLen + lhExtraLen;
        const compSlice = buf.subarray(
          dataStart,
          dataStart + entry.compressedSize
        );

        let rawBytes: Buffer;
        if (entry.compressionMethod === 0) {
          rawBytes = compSlice;
        } else if (entry.compressionMethod === 8) {
          rawBytes = zlib.inflateRawSync(compSlice);
        } else {
          continue;
        }

        const safeName = `page_${String(pageCounter++).padStart(
          4,
          "0"
        )}_${base.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const target = path.resolve(absDest, safeName);
        if (!target.startsWith(absDest + path.sep)) continue;

        await fs.writeFile(target, rawBytes);
        outPaths.push(target);
      }
      return outPaths.sort(naturalCompare);
    } catch {
      return [];
    }
  }

  /**
   * Renders pages of a `.pdf` reference chapter into PNG images using macOS
   * PDFKit via `/usr/bin/swift` (falling back to `sips` if Swift is unavailable).
   */
  private static async extractPdfPages(
    pdfPath: string,
    destDir: string
  ): Promise<string[]> {
    await fs.mkdir(destDir, { recursive: true });

    const swiftScript = `
import Foundation
import PDFKit
import AppKit

let args = CommandLine.arguments
guard args.count >= 3 else { exit(1) }
let pdfURL = URL(fileURLWithPath: args[1])
let outDir = URL(fileURLWithPath: args[2])
guard let doc = PDFDocument(url: pdfURL) else { exit(1) }
let maxPages = min(doc.pageCount, 60)
for i in 0..<maxPages {
  guard let page = doc.page(at: i) else { continue }
  let bounds = page.bounds(for: .mediaBox)
  let scale: CGFloat = min(2.0, 1400.0 / max(1.0, max(bounds.width, bounds.height)))
  let size = NSSize(width: max(64, bounds.width * scale), height: max(64, bounds.height * scale))
  let img = page.thumbnail(of: size, for: .mediaBox)
  guard let tiff = img.tiffRepresentation,
        let rep = NSBitmapImageRep(data: tiff),
        let png = rep.representation(using: .png, properties: [:]) else { continue }
  let fileURL = outDir.appendingPathComponent(String(format: "page_%03d.png", i + 1))
  try? png.write(to: fileURL)
  print(fileURL.path)
}
`;

    try {
      const { stdout } = await execFileAsync("swift", [
        "-e",
        swiftScript,
        pdfPath,
        destDir,
      ]);
      const files = stdout
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
        .sort(naturalCompare);
      if (files.length > 0) return files;
    } catch {
      // Fallback to sips single-page rasterization
    }

    try {
      const fallbackPng = path.join(destDir, "page_001.png");
      await execFileAsync("sips", [
        "-s",
        "format",
        "png",
        pdfPath,
        "--out",
        fallbackPng,
      ]);
      const exists = await fs
        .stat(fallbackPng)
        .then(() => true)
        .catch(() => false);
      return exists ? [fallbackPng] : [];
    } catch {
      return [];
    }
  }

  /**
   * Recursively walks `data/manga_refs/`, discovers all supported image,
   * PDF, and ZIP/CBZ files in deterministic chapter/page order, and calculates
   * a SHA-256 content fingerprint for cache invalidation.
   */
  static async discoverReferences(
    customDir?: string
  ): Promise<DiscoveredReferenceCorpus> {
    const referencesDir = customDir
      ? path.resolve(customDir)
      : this.getReferencesDirectory();

    const dirStat = await fs.stat(referencesDir).catch(() => null);
    if (!dirStat || !dirStat.isDirectory()) {
      return {
        referencesDir,
        exists: false,
        isEmpty: true,
        fingerprintHash: "empty_missing_directory",
        chapterIds: [],
        pages: [],
      };
    }

    // Collect all candidate source files recursively (ignoring hidden files & README.md)
    const rawFiles: string[] = [];
    async function walk(currentDir: string): Promise<void> {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      const sorted = [...entries].sort((a, b) =>
        naturalCompare(a.name, b.name)
      );
      for (const entry of sorted) {
        if (entry.name.startsWith(".")) continue;
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (
            IMAGE_EXTENSIONS.has(ext) ||
            ARCHIVE_EXTENSIONS.has(ext) ||
            PDF_EXTENSIONS.has(ext)
          ) {
            rawFiles.push(fullPath);
          }
        }
      }
    }

    await walk(referencesDir);

    if (rawFiles.length === 0) {
      return {
        referencesDir,
        exists: true,
        isEmpty: true,
        fingerprintHash: "empty_no_reference_files",
        chapterIds: [],
        pages: [],
      };
    }

    // Compute deterministic SHA-256 content fingerprint over all discovered source files
    const hash = crypto.createHash("sha256");
    for (const fPath of rawFiles) {
      const rel = path
        .relative(referencesDir, fPath)
        .split(path.sep)
        .join("/");
      const fileDigest = await this.hashFileSha256(fPath);
      hash.update(`${rel}:${fileDigest}\n`);
    }
    const fingerprintHash = hash.digest("hex").slice(0, 32);

    // Group & expand files into ordered chapter pages
    const chapterPagesMap = new Map<
      string,
      Array<{ sourceFilePath: string; resolvedImagePath: string; rel: string }>
    >();

    for (const fPath of rawFiles) {
      const rel = path
        .relative(referencesDir, fPath)
        .split(path.sep)
        .join("/");
      const parts = rel.split("/");
      const ext = path.extname(fPath).toLowerCase();
      const baseNoExt = path.basename(fPath, ext);

      const chapterId =
        parts.length > 1
          ? parts[0].replace(/[^a-zA-Z0-9_-]/g, "_")
          : baseNoExt.replace(/[^a-zA-Z0-9_-]/g, "_") || "chapter_01";

      if (!chapterPagesMap.has(chapterId)) {
        chapterPagesMap.set(chapterId, []);
      }
      const list = chapterPagesMap.get(chapterId)!;

      if (IMAGE_EXTENSIONS.has(ext)) {
        list.push({
          sourceFilePath: fPath,
          resolvedImagePath: fPath,
          rel,
        });
      } else if (ARCHIVE_EXTENSIONS.has(ext)) {
        const fileHash = (await this.hashFileSha256(fPath)).slice(0, 12);
        const dest = path.join(
          this.getExtractionCacheDir(),
          `${chapterId}_${fileHash}`
        );
        const extracted = await this.extractArchiveImages(fPath, dest);
        for (const imgPath of extracted) {
          list.push({
            sourceFilePath: fPath,
            resolvedImagePath: imgPath,
            rel: `${rel}#${path.basename(imgPath)}`,
          });
        }
      } else if (PDF_EXTENSIONS.has(ext)) {
        const fileHash = (await this.hashFileSha256(fPath)).slice(0, 12);
        const dest = path.join(
          this.getExtractionCacheDir(),
          `${chapterId}_pdf_${fileHash}`
        );
        const extracted = await this.extractPdfPages(fPath, dest);
        for (const imgPath of extracted) {
          list.push({
            sourceFilePath: fPath,
            resolvedImagePath: imgPath,
            rel: `${rel}#${path.basename(imgPath)}`,
          });
        }
      }
    }

    const chapterIds = Array.from(chapterPagesMap.keys()).sort(naturalCompare);
    const pages: DiscoveredReferencePage[] = [];

    for (const chId of chapterIds) {
      const rawList = chapterPagesMap.get(chId) || [];
      rawList.sort((a, b) => naturalCompare(a.rel, b.rel));
      rawList.forEach((item, idx) => {
        pages.push({
          chapterId: chId,
          pageId: `${chId}_p${String(idx + 1).padStart(3, "0")}`,
          pageNumber: idx + 1,
          sourceFilePath: item.sourceFilePath,
          resolvedImagePath: item.resolvedImagePath,
          relativeSourcePath: item.rel,
        });
      });
    }

    return {
      referencesDir,
      exists: true,
      isEmpty: pages.length === 0,
      fingerprintHash,
      chapterIds: pages.length > 0 ? chapterIds : [],
      pages,
    };
  }
}
