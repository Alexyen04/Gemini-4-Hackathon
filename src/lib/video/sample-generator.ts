import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { NormalizedClip } from "@/types/manga";
import { StorageService } from "@/lib/storage/storage-service";
import { VideoInputService } from "./ffmpeg";
import { KeyframeExtractionService } from "./keyframes";

const execFileAsync = promisify(execFile);

interface SampleClipBlueprint {
  clipId: string;
  title: string;
  quarter: string;
  gameClock: string;
  score: string;
  eventDescription: string;
  originalGameTimestampSec: number;
  highlightRank: number;
  players: string[];
  playType:
    | "tomahawk_dunk"
    | "answer_three"
    | "chasedown_block"
    | "steal_comeback"
    | "buzzer_fadeaway";
}

const SAMPLE_BLUEPRINTS: SampleClipBlueprint[] = [
  {
    clipId: "clip_sample_01",
    title: "Clip 1 — Thunderous Transition Dunk",
    quarter: "Q3",
    gameClock: "04:18",
    score: "VIPERS 78 - TITANS 80",
    eventDescription:
      "Jalen Vance (#23, Crimson Vipers) explodes down the right lane in transition and finishes a one-handed tomahawk dunk over #34.",
    originalGameTimestampSec: 1842,
    highlightRank: 3,
    players: ["Jalen Vance (#23, Vipers)", "Marcus Cole (#34, Titans)"],
    playType: "tomahawk_dunk",
  },
  {
    clipId: "clip_sample_02",
    title: "Clip 2 — Cold-Blooded Answer Three",
    quarter: "Q4",
    gameClock: "06:45",
    score: "VIPERS 89 - TITANS 95",
    eventDescription:
      "Darius Kade (#11, Harbor Titans) creates space with a sharp crossover on the left wing and buries a high-arcing three-pointer to push the Titans lead to six.",
    originalGameTimestampSec: 2475,
    highlightRank: 4,
    players: ["Darius Kade (#11, Titans)", "Jalen Vance (#23, Vipers)"],
    playType: "answer_three",
  },
  {
    clipId: "clip_sample_03",
    title: "Clip 3 — Crucial Rim-Saving Block",
    quarter: "Q4",
    gameClock: "02:11",
    score: "VIPERS 96 - TITANS 99",
    eventDescription:
      "Trailing by three, Kai Sato (#7, Crimson Vipers) sprints back in transition to pin #11's layup attempt cleanly against the glass.",
    originalGameTimestampSec: 2749,
    highlightRank: 2,
    players: ["Kai Sato (#7, Vipers)", "Darius Kade (#11, Titans)"],
    playType: "chasedown_block",
  },
  {
    clipId: "clip_sample_04",
    title: "Clip 4 — Fourth-Quarter Press Steal & Tie",
    quarter: "Q4",
    gameClock: "00:48",
    score: "VIPERS 99 - TITANS 101",
    eventDescription:
      "Jalen Vance (#23) jumps the passing lane at midcourt, races ahead of the defense, and finishes a reverse layup to tie the game at 101-101.",
    originalGameTimestampSec: 2832,
    highlightRank: 2,
    players: ["Jalen Vance (#23, Vipers)", "Kai Sato (#7, Vipers)"],
    playType: "steal_comeback",
  },
  {
    clipId: "clip_sample_05",
    title: "Clip 5 — Buzzer-Beater Baseline Fadeaway",
    quarter: "Q4",
    gameClock: "00:03.4",
    score: "VIPERS 103 - TITANS 101 (FINAL)",
    eventDescription:
      "With 3.4 seconds left, Jalen Vance (#23) rises into ancontested baseline step-back jumper over #11; the shot swishes through as the red backboard LED lights up at 0.0!",
    originalGameTimestampSec: 2876.6,
    highlightRank: 1,
    players: ["Jalen Vance (#23, Vipers)", "Darius Kade (#11, Titans)"],
    playType: "buzzer_fadeaway",
  },
];

function buildAthleteSvg(params: {
  x: number;
  y: number;
  scale?: number;
  jerseyFill: string;
  jerseyStroke: string;
  numeralColor: string;
  number: string;
  armRaise: number; // -1..1
  stride: number; // -1..1
  facing: "right" | "left";
  headband?: boolean;
}): string {
  const {
    x,
    y,
    scale = 1,
    jerseyFill,
    jerseyStroke,
    numeralColor,
    number,
    armRaise,
    stride,
    facing,
    headband = false,
  } = params;
  const dir = facing === "right" ? 1 : -1;
  const armEndX = dir * (42 + armRaise * 18);
  const armEndY = -58 - armRaise * 52;
  const offArmX = -dir * 32;
  const offArmY = -28 + armRaise * 15;
  const legSpread = 22 + Math.abs(stride) * 24;

  return `
    <g transform="translate(${x.toFixed(1)}, ${y.toFixed(1)}) scale(${scale.toFixed(2)})">
      <!-- Floor contact shadow -->
      <ellipse cx="0" cy="96" rx="42" ry="10" fill="rgba(0,0,0,0.32)" />
      <!-- Legs -->
      <path d="M -10 28 L ${(-legSpread * dir).toFixed(1)} 88" stroke="#2c1d16" stroke-width="15" stroke-linecap="round" />
      <path d="M 10 28 L ${(legSpread * dir).toFixed(1)} 84" stroke="#2c1d16" stroke-width="15" stroke-linecap="round" />
      <!-- Sneakers -->
      <rect x="${(-legSpread * dir - 14).toFixed(1)}" y="83" width="28" height="12" rx="4" fill="#f8fafc" stroke="#0f172a" stroke-width="2.5" />
      <rect x="${(legSpread * dir - 12).toFixed(1)}" y="79" width="28" height="12" rx="4" fill="#f8fafc" stroke="#0f172a" stroke-width="2.5" />
      <!-- Shorts -->
      <path d="M -24 2 L 24 2 L 30 36 L 4 34 L 0 18 L -4 34 L -30 36 Z" fill="${jerseyFill}" stroke="${jerseyStroke}" stroke-width="3" />
      <!-- Torso / Jersey -->
      <path d="M -26 -56 L 26 -56 L 24 6 L -24 6 Z" rx="6" fill="${jerseyFill}" stroke="${jerseyStroke}" stroke-width="3.5" />
      <!-- Jersey Number -->
      <text x="0" y="-16" text-anchor="middle" font-family="Impact, Arial Black, sans-serif" font-size="30" font-weight="900" fill="${numeralColor}">${number}</text>
      <!-- Off Arm with subtle arena rim-light -->
      <path d="M ${(-22 * dir).toFixed(1)} -48 Q ${(offArmX * 0.7).toFixed(1)} -35 ${offArmX.toFixed(1)} ${offArmY.toFixed(1)}" stroke="#f8fafc" stroke-width="17" stroke-linecap="round" fill="none" />
      <path d="M ${(-22 * dir).toFixed(1)} -48 Q ${(offArmX * 0.7).toFixed(1)} -35 ${offArmX.toFixed(1)} ${offArmY.toFixed(1)}" stroke="#8c5a3c" stroke-width="13" stroke-linecap="round" fill="none" />
      <!-- Primary Shooting/Blocking Arm -->
      <path d="M ${(22 * dir).toFixed(1)} -50 Q ${(armEndX * 0.55).toFixed(1)} ${(armEndY * 0.65).toFixed(1)} ${armEndX.toFixed(1)} ${armEndY.toFixed(1)}" stroke="#f8fafc" stroke-width="18" stroke-linecap="round" fill="none" />
      <path d="M ${(22 * dir).toFixed(1)} -50 Q ${(armEndX * 0.55).toFixed(1)} ${(armEndY * 0.65).toFixed(1)} ${armEndX.toFixed(1)} ${armEndY.toFixed(1)}" stroke="#8c5a3c" stroke-width="14" stroke-linecap="round" fill="none" />
      <!-- Head & Hair Silhouette with crisp rim highlight -->
      <circle cx="${(dir * 3).toFixed(1)}" cy="-78" r="20.5" fill="#f8fafc" />
      <circle cx="${(dir * 3).toFixed(1)}" cy="-78" r="18" fill="#8c5a3c" stroke="#0f172a" stroke-width="2.5" />
      <path d="M ${(-14 + dir * 3).toFixed(1)} -83 Q ${(dir * 3).toFixed(1)} -102 ${(20 + dir * 3).toFixed(1)} -82 Z" fill="#111827" />
      ${
        headband
          ? `<rect x="${(-15 + dir * 3).toFixed(1)}" y="-86" width="36" height="6" rx="2" fill="#e11d48" stroke="#ffffff" stroke-width="1" />`
          : ""
      }
      <!-- Determined Eyes -->
      <line x1="${(dir * 6).toFixed(1)}" y1="-79" x2="${(dir * 15).toFixed(1)}" y2="-77" stroke="#ffffff" stroke-width="2.5" />
    </g>
  `;
}

function renderHighlightFrameSvg(
  bp: SampleClipBlueprint,
  progress: number // 0..1
): string {
  const hoopRightX = 1090;
  const hoopLeftX = 190;
  const rimY = 255;

  let playersMarkup = "";
  let ballX = 640;
  let ballY = 360;
  let buzzerGlow = false;
  let netStretch = 0;

  if (bp.playType === "tomahawk_dunk") {
    const pX = 360 + progress * 645;
    const jumpArc = Math.sin(Math.min(1, Math.max(0, (progress - 0.25) / 0.65)) * Math.PI);
    const pY = 470 - jumpArc * 175;
    const defX = 640 + progress * 365;
    const defY = 480 - jumpArc * 110;
    ballX = pX + 45;
    ballY = pY - 88 - jumpArc * 35;
    if (progress > 0.78) {
      ballX = hoopRightX - 18;
      ballY = rimY + (progress - 0.78) * 190;
      netStretch = 18;
    }

    playersMarkup =
      buildAthleteSvg({
        x: defX,
        y: defY,
        scale: 1.08,
        jerseyFill: "#1e293b",
        jerseyStroke: "#94a3b8",
        numeralColor: "#f8fafc",
        number: "34",
        armRaise: 0.75 * jumpArc,
        stride: 0.5,
        facing: "left",
      }) +
      buildAthleteSvg({
        x: pX,
        y: pY,
        scale: 1.14,
        jerseyFill: "#fffbeb",
        jerseyStroke: "#be123c",
        numeralColor: "#9f1239",
        number: "23",
        armRaise: 0.35 + jumpArc * 0.8,
        stride: 0.9,
        facing: "right",
        headband: true,
      });
  } else if (bp.playType === "answer_three") {
    const stepBack = progress < 0.4 ? progress * 75 : 30;
    const shooterX = 870 + stepBack;
    const jump = progress > 0.32 && progress < 0.76 ? Math.sin(((progress - 0.32) / 0.44) * Math.PI) * 72 : 0;
    const shooterY = 475 - jump;
    const defX = 825 - progress * 25;

    if (progress < 0.45) {
      ballX = shooterX - 38;
      ballY = shooterY - 82;
    } else {
      const t = Math.min(1, (progress - 0.45) / 0.48);
      ballX = shooterX - 38 - t * (shooterX - 38 - (hoopLeftX + 18));
      ballY = shooterY - 95 - Math.sin(t * Math.PI) * 195 + t * (rimY - (shooterY - 95));
      if (t > 0.92) netStretch = 14;
    }

    playersMarkup =
      buildAthleteSvg({
        x: defX,
        y: 482,
        scale: 1.06,
        jerseyFill: "#fffbeb",
        jerseyStroke: "#be123c",
        numeralColor: "#9f1239",
        number: "23",
        armRaise: 0.7,
        stride: 0.65,
        facing: "right",
        headband: true,
      }) +
      buildAthleteSvg({
        x: shooterX,
        y: shooterY,
        scale: 1.1,
        jerseyFill: "#0f172a",
        jerseyStroke: "#38bdf8",
        numeralColor: "#ffffff",
        number: "11",
        armRaise: progress > 0.3 ? 0.95 : 0.2,
        stride: 0.4,
        facing: "left",
      });
  } else if (bp.playType === "chasedown_block") {
    const runnerX = 560 - progress * 300;
    const jump = Math.sin(Math.min(1, Math.max(0, (progress - 0.25) / 0.65)) * Math.PI);
    const runnerY = 478 - jump * 135;
    const blockerX = 720 - progress * 415;
    const blockerY = 476 - jump * 175;

    if (progress < 0.68) {
      ballX = runnerX - 34;
      ballY = runnerY - 82;
    } else {
      const swatT = (progress - 0.68) / 0.32;
      ballX = hoopLeftX + 65 + swatT * 210;
      ballY = rimY - 15 + swatT * 140;
    }

    playersMarkup =
      buildAthleteSvg({
        x: runnerX,
        y: runnerY,
        scale: 1.08,
        jerseyFill: "#0f172a",
        jerseyStroke: "#38bdf8",
        numeralColor: "#ffffff",
        number: "11",
        armRaise: 0.82,
        stride: 0.75,
        facing: "left",
      }) +
      buildAthleteSvg({
        x: blockerX,
        y: blockerY,
        scale: 1.14,
        jerseyFill: "#fffbeb",
        jerseyStroke: "#be123c",
        numeralColor: "#9f1239",
        number: "7",
        armRaise: 1.05,
        stride: 0.95,
        facing: "left",
      });
  } else if (bp.playType === "steal_comeback") {
    const pX = 320 + progress * 705;
    const jump = progress > 0.55 ? Math.sin(((progress - 0.55) / 0.45) * Math.PI) * 125 : 0;
    const pY = 478 - jump;
    const trailX = 250 + progress * 610;
    ballX = progress < 0.85 ? pX + 42 : hoopRightX - 18;
    ballY =
      progress < 0.55
        ? 455 + Math.sin(progress * 22) * 55
        : progress < 0.85
        ? pY - 88
        : rimY + 22;
    if (progress > 0.85) netStretch = 14;

    playersMarkup =
      buildAthleteSvg({
        x: trailX,
        y: 486,
        scale: 1.04,
        jerseyFill: "#0f172a",
        jerseyStroke: "#38bdf8",
        numeralColor: "#ffffff",
        number: "11",
        armRaise: 0.4,
        stride: 0.85,
        facing: "right",
      }) +
      buildAthleteSvg({
        x: pX,
        y: pY,
        scale: 1.12,
        jerseyFill: "#fffbeb",
        jerseyStroke: "#be123c",
        numeralColor: "#9f1239",
        number: "23",
        armRaise: progress > 0.55 ? 0.95 : 0.25,
        stride: 0.95,
        facing: "right",
        headband: true,
      });
  } else {
    // buzzer_fadeaway
    const fadeOffset = progress > 0.25 ? Math.min(1, (progress - 0.25) / 0.4) * 70 : 0;
    const shooterX = 835 - fadeOffset;
    const jump = progress > 0.22 && progress < 0.72 ? Math.sin(((progress - 0.22) / 0.5) * Math.PI) * 115 : 0;
    const shooterY = 482 - jump;
    const defX = 895 + progress * 30;
    const defJump = progress > 0.26 && progress < 0.7 ? Math.sin(((progress - 0.26) / 0.44) * Math.PI) * 88 : 0;

    if (progress < 0.42) {
      ballX = shooterX + 34;
      ballY = shooterY - 94;
    } else {
      const t = Math.min(1, (progress - 0.42) / 0.5);
      ballX = shooterX + 34 + t * (hoopRightX - 18 - (shooterX + 34));
      ballY = shooterY - 105 - Math.sin(t * Math.PI) * 215 + t * (rimY + 12 - (shooterY - 105));
      if (t > 0.9) {
        netStretch = 20;
        buzzerGlow = true;
      }
    }

    playersMarkup =
      buildAthleteSvg({
        x: defX,
        y: 484 - defJump,
        scale: 1.1,
        jerseyFill: "#0f172a",
        jerseyStroke: "#38bdf8",
        numeralColor: "#ffffff",
        number: "11",
        armRaise: 0.95,
        stride: 0.6,
        facing: "left",
      }) +
      buildAthleteSvg({
        x: shooterX,
        y: shooterY,
        scale: 1.15,
        jerseyFill: "#fffbeb",
        jerseyStroke: "#be123c",
        numeralColor: "#9f1239",
        number: "23",
        armRaise: 1.0,
        stride: 0.5,
        facing: "right",
        headband: true,
      });
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
    <defs>
      <linearGradient id="arenaBg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#334155" />
        <stop offset="58%" stop-color="#64748b" />
        <stop offset="100%" stop-color="#94a3b8" />
      </linearGradient>
      <linearGradient id="hardwood" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#d99b52" />
        <stop offset="100%" stop-color="#b5742f" />
      </linearGradient>
    </defs>

    <!-- Arena upper bowl & spotlights -->
    <rect width="1280" height="430" fill="url(#arenaBg)" />
    <circle cx="260" cy="48" r="95" fill="rgba(255,255,255,0.08)" />
    <circle cx="640" cy="36" r="115" fill="rgba(255,255,255,0.11)" />
    <circle cx="1020" cy="48" r="95" fill="rgba(255,255,255,0.08)" />

    <!-- Crowd silhouettes -->
    <path d="M 0 340 Q 320 315 640 335 T 1280 330 L 1280 430 L 0 430 Z" fill="#090d16" />

    <!-- Hardwood Court -->
    <rect x="0" y="425" width="1280" height="295" fill="url(#hardwood)" />
    <line x1="60" y1="435" x2="1220" y2="435" stroke="#fff7ed" stroke-width="4" />
    <line x1="640" y1="435" x2="640" y2="720" stroke="#fff7ed" stroke-width="4" />
    <circle cx="640" cy="565" r="78" fill="none" stroke="#be123c" stroke-width="5" />
    <path d="M 60 455 Q 360 565 60 695" fill="none" stroke="#fff7ed" stroke-width="4" />
    <path d="M 1220 455 Q 920 565 1220 695" fill="none" stroke="#fff7ed" stroke-width="4" />

    <!-- Left Stanchion, Backboard & Rim -->
    <rect x="92" y="245" width="22" height="205" fill="#1e293b" />
    <rect x="135" y="165" width="14" height="118" fill="#f8fafc" stroke="${
      buzzerGlow ? "#ef4444" : "#334155"
    }" stroke-width="4" />
    <line x1="149" y1="${rimY}" x2="${hoopLeftX}" y2="${rimY}" stroke="#ea580c" stroke-width="7" />
    <path d="M 153 ${rimY + 4} L 161 ${rimY + 42 + netStretch} L 181 ${
    rimY + 42 + netStretch
  } L 188 ${rimY + 4}" fill="none" stroke="#f8fafc" stroke-width="3" stroke-dasharray="5,3" />

    <!-- Right Stanchion, Backboard & Rim -->
    <rect x="1166" y="245" width="22" height="205" fill="#1e293b" />
    <rect x="1131" y="165" width="14" height="118" fill="#f8fafc" stroke="${
      buzzerGlow ? "#ef4444" : "#334155"
    }" stroke-width="${buzzerGlow ? 8 : 4}" />
    <line x1="${hoopRightX}" y1="${rimY}" x2="1131" y2="${rimY}" stroke="#ea580c" stroke-width="7" />
    <path d="M ${hoopRightX + 3} ${rimY + 4} L ${hoopRightX + 10} ${
    rimY + 42 + netStretch
  } L ${hoopRightX + 30} ${rimY + 42 + netStretch} L ${hoopRightX + 38} ${
    rimY + 4
  }" fill="none" stroke="#f8fafc" stroke-width="3" stroke-dasharray="5,3" />

    <!-- Athletes -->
    ${playersMarkup}

    <!-- Basketball -->
    <g transform="translate(${ballX.toFixed(1)}, ${ballY.toFixed(1)})">
      <circle cx="0" cy="0" r="19" fill="#ea580c" stroke="#111827" stroke-width="3" />
      <path d="M -18 0 Q 0 -8 18 0 M 0 -18 Q 7 0 0 18" fill="none" stroke="#111827" stroke-width="2.2" />
    </g>

    <!-- Arena Scorebug -->
    <g transform="translate(390, 648)">
      <rect x="0" y="0" width="500" height="48" rx="6" fill="#09090b" stroke="#f8fafc" stroke-width="2.5" />
      <rect x="0" y="0" width="120" height="48" rx="6" fill="#be123c" />
      <text x="60" y="31" text-anchor="middle" font-family="Impact, sans-serif" font-size="21" fill="#ffffff">${
        bp.quarter
      } ${bp.gameClock}</text>
      <text x="310" y="31" text-anchor="middle" font-family="Arial Black, sans-serif" font-size="19" fill="#f8fafc">${
        bp.score
      }</text>
    </g>
  </svg>`;
}

export class SampleHighlightGenerator {
  /**
   * Generates 5 playable MP4 basketball highlight clips with real keyframes
   * and normalized metadata so users can immediately test the full studio,
   * hybrid Carbon renderer, and interactive video panel playback.
   */
  static async ensureSampleHighlights(): Promise<NormalizedClip[]> {
    await StorageService.ensureDirectories();
    const results: NormalizedClip[] = [];
    const ffmpegBin = VideoInputService.getFfmpegBinary();

    for (let idx = 0; idx < SAMPLE_BLUEPRINTS.length; idx++) {
      const bp = SAMPLE_BLUEPRINTS[idx];
      const existing = await StorageService.getClip(bp.clipId);
      if (existing) {
        const videoExists = await fs
          .stat(existing.filePath)
          .then(() => true)
          .catch(() => false);
        if (videoExists && existing.keyframes.length >= 3) {
          results.push(existing);
          continue;
        }
      }

      const frameDir = path.join(
        StorageService.getSubDir("tmp"),
        `frames_${bp.clipId}`
      );
      await fs.mkdir(frameDir, { recursive: true });

      // Render 36 frames at 12fps => smooth 3.0s MP4 highlight clip
      const totalFrames = 36;
      const fps = 12;
      const durationSec = totalFrames / fps;

      await Promise.all(
        Array.from({ length: totalFrames }, async (_, fIdx) => {
          const progress = fIdx / (totalFrames - 1);
          const svg = renderHighlightFrameSvg(bp, progress);
          const frameOut = path.join(
            frameDir,
            `frame_${String(fIdx + 1).padStart(3, "0")}.png`
          );
          await sharp(Buffer.from(svg)).png().toFile(frameOut);
        })
      );

      const mp4Path = path.join(
        StorageService.getSubDir("clips"),
        `${bp.clipId}.mp4`
      );
      await execFileAsync(ffmpegBin, [
        "-y",
        "-framerate",
        String(fps),
        "-i",
        path.join(frameDir, "frame_%03d.png"),
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        mp4Path,
      ]);

      await fs.rm(frameDir, { recursive: true, force: true });

      const keyframes = await KeyframeExtractionService.extractKeyframesForClip(
        {
          clipId: bp.clipId,
          videoPath: mp4Path,
          durationSec,
          originalGameTimestampSec: bp.originalGameTimestampSec,
          frameCount: 5,
        }
      );

      const clipRecord: NormalizedClip = {
        clipId: bp.clipId,
        title: bp.title,
        orderIndex: idx,
        originalFileName: `${bp.clipId}.mp4`,
        filePath: mp4Path,
        mediaUrl: StorageService.toMediaUrl(mp4Path),
        mimeType: "video/mp4",
        durationSec,
        width: 1280,
        height: 720,
        fps,
        isConsolidatedSegment: false,
        segmentStartOffsetSec: 0,
        metadata: {
          gameId: "NBA_FINAL_SHOWDOWN_G7",
          homeTeam: "Crimson Vipers",
          awayTeam: "Harbor Titans",
          players: bp.players,
          quarter: bp.quarter,
          gameClock: bp.gameClock,
          score: bp.score,
          eventDescription: bp.eventDescription,
          originalGameTimestampSec: bp.originalGameTimestampSec,
          highlightRank: bp.highlightRank,
        },
        keyframes,
        confidence: 0.98,
        createdAt: new Date().toISOString(),
      };

      const saved = await StorageService.saveClip(clipRecord);
      results.push(saved);
    }

    return results;
  }
}
