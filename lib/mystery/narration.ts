/**
 * 실제 TTS 나레이션 생성
 * Piper 우선 → 실패하면 CRITICAL error (no fallback)
 * 모든 경우에 실제 오디오 파일 생성 + FFprobe로 정확한 duration 검증
 */

import { spawn, exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { updateProject } from "./store";
import type { MysteryProject, Scene } from "./types";

const execAsync = promisify(exec);

export interface NarrationSegment {
  id: string;
  text: string;
  audioPath: string;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  format: "wav";
}

const PIPER_CONFIG = {
  voice: process.env.PIPER_VOICE || "ko_KR-narae-medium",
  rate: 1.0,
  pitch: 1.0,
  noiseScale: 0.667,
  noiseW: 0.8,
};

/**
 * Get actual audio duration using FFprobe (not file size estimation)
 */
async function getAudioDuration(audioPath: string): Promise<number> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1:noprint_wrappers=1 "${audioPath}"`,
      { timeout: 5000 }
    );
    const duration = parseFloat(stdout.trim());
    if (duration > 0) {
      return Math.round(duration);
    }
  } catch (err: any) {
    throw new Error(`[CRITICAL] Cannot get audio duration via FFprobe: ${err.message}`);
  }
  throw new Error(`[CRITICAL] Invalid audio duration: ${audioPath}`);
}

async function generateNarrationSegment(text: string, segmentId: string, outputDir: string): Promise<NarrationSegment> {
  return new Promise((resolve, reject) => {
    const audioPath = path.join(outputDir, `${segmentId}.wav`);

    // Try Piper with Korean voice first
    const tryPiper = (voice: string) => {
      const piper = spawn("piper", [
        "--model",
        voice,
        "--output-file",
        audioPath,
        "--rate",
        String(PIPER_CONFIG.rate),
      ], { stdio: ["pipe", "pipe", "pipe"] });

      piper.stdin.write(text);
      piper.stdin.end();

      let stderrOutput = "";
      piper.stderr.on("data", (data) => {
        stderrOutput += data.toString();
      });

      piper.on("close", async (code) => {
        if (code === 0 && fs.existsSync(audioPath)) {
          try {
            // Get ACTUAL duration from audio file, not file size estimation
            const durationSeconds = await getAudioDuration(audioPath);

            resolve({
              id: segmentId,
              text,
              audioPath,
              durationSeconds,
              sampleRate: 16000,
              channels: 1,
              format: "wav",
            });
          } catch (err: any) {
            reject(new Error(`[CRITICAL] Failed to validate audio duration: ${err.message}`));
          }
        } else {
          reject(new Error(`[CRITICAL] Piper TTS failed for segment ${segmentId}: ${stderrOutput || "Unknown error"}`));
        }
      });

      piper.on("error", (err) => {
        reject(new Error(`[CRITICAL] Piper TTS not available: ${err.message}. Install Piper TTS to generate narration.`));
      });

      setTimeout(() => {
        if (!fs.existsSync(audioPath)) {
          piper.kill();
          reject(new Error(`[CRITICAL] Piper TTS timeout for segment ${segmentId}`));
        }
      }, 10000);
    };

    tryPiper(PIPER_CONFIG.voice);
  });
}


export async function generateNarrationForScenes(
  projectId: string,
  project: MysteryProject,
): Promise<{
  success: boolean;
  segments: NarrationSegment[];
  totalDuration: number;
  method?: string;
  error?: string;
}> {
  const scenes = project.script?.sections || [];

  if (scenes.length === 0) {
    return {
      success: false,
      segments: [],
      totalDuration: 0,
      error: "No script sections found",
    };
  }

  const outputDir = path.join(process.cwd(), "data", "mystery-projects", projectId, "narration");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`[narration] ${scenes.length}개 섹션의 나레이션 생성 시작 (Piper TTS)...`);

  const segments: NarrationSegment[] = [];
  let totalDuration = 0;

  for (let i = 0; i < scenes.length; i++) {
    const section = scenes[i];
    const segmentId = `narration-${i}`;

    console.log(`[narration] [${i + 1}/${scenes.length}] ${section.kind} 나레이션 생성...`);

    const segment = await generateNarrationSegment(section.text, segmentId, outputDir);
    segments.push(segment);
    totalDuration += segment.durationSeconds;
    console.log(`[narration] ✅ ${segment.durationSeconds}초`);
  }

  console.log(`[narration] ✅ 완료: 총 ${totalDuration}초 (Piper TTS)`);

  return {
    success: true,
    segments,
    totalDuration,
    method: "piper-tts",
  };
}
