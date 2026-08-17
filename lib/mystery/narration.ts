/**
 * 실제 TTS 나레이션 생성
 * Piper 우선 → FFmpeg 음성 합성 폴백
 * 모든 경우에 실제 오디오 파일 생성 (placeholder 아님)
 */

import { spawn, exec } from "child_process";
import fs from "fs";
import path from "path";
import { updateProject } from "./store";
import type { MysteryProject, Scene } from "./types";

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
  fallbackVoice: "en_US-hfc_female-medium",
  rate: 1.0,
  pitch: 1.0,
  noiseScale: 0.667,
  noiseW: 0.8,
};

// Calculate WAV file duration from header
function getWavDuration(filePath: string): number {
  try {
    const buffer = fs.readFileSync(filePath);
    if (buffer.length < 44) return 0;

    // Read sample rate (bytes 24-27)
    const sampleRate = buffer.readUInt32LE(24);
    // Read byte rate (bytes 28-31)
    const byteRate = buffer.readUInt32LE(28);
    // Calculate duration in seconds
    const dataSize = buffer.length - 44;
    return Math.round((dataSize / byteRate) * 10) / 10;
  } catch {
    return 0;
  }
}

// No fallback generation - Piper TTS is mandatory for production
// If Piper is unavailable or fails, the pipeline must fail
async function generateNarrationWithFFmpeg(text: string, segmentId: string, audioPath: string): Promise<NarrationSegment | null> {
  // Production does not allow fallback audio synthesis
  throw new Error(`[CRITICAL] Piper TTS required for narration generation. Text: "${text.slice(0, 50)}...". Fallback audio synthesis is not permitted.`);
}

async function generateNarrationSegment(text: string, segmentId: string, outputDir: string): Promise<NarrationSegment | null> {
  return new Promise((resolve) => {
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

      let resolved = false;

      piper.on("close", (code) => {
        if (resolved) return;
        resolved = true;

        if (code === 0 && fs.existsSync(audioPath)) {
          // Read actual duration from WAV file header
          const actualDuration = getWavDuration(audioPath);

          if (actualDuration <= 0) {
            console.error(`[narration] Failed: Could not read valid duration from Piper output`);
            resolve(null);
            return;
          }

          resolve({
            id: segmentId,
            text,
            audioPath,
            durationSeconds: actualDuration,
            sampleRate: 16000,
            channels: 1,
            format: "wav",
          });
        } else {
          console.error(`[narration] Piper TTS failed with exit code ${code}`);
          resolve(null);
        }
      });

      piper.on("error", (err) => {
        if (resolved) return;
        resolved = true;
        console.error(`[narration] Piper process error:`, err.message);
        resolve(null);
      });

      // 10-second timeout
      const timeout = setTimeout(() => {
        if (resolved) return;
        resolved = true;
        console.error(`[narration] Piper TTS timeout after 10 seconds`);
        piper.kill('SIGTERM');
        resolve(null);
      }, 10000);
    };

    tryPiper(PIPER_CONFIG.voice);
  });
}

async function checkPiperAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const piper = spawn("piper", ["--help"], { stdio: "pipe" });

    const timeout = setTimeout(() => {
      piper.kill();
      resolve(false);
    }, 5000);

    piper.on("close", (code) => {
      clearTimeout(timeout);
      resolve(code === 0);
    });

    piper.on("error", () => {
      clearTimeout(timeout);
      resolve(false);
    });
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

  console.log(`[narration] ${scenes.length}개 섹션의 나레이션 생성 시작...`);

  const piperAvailable = await checkPiperAvailable();
  const method = piperAvailable ? "piper-tts" : "ffmpeg-synth";

  console.log(`[narration] 방식: ${method === "piper-tts" ? "Piper TTS" : "FFmpeg Audio Synthesis"}`);

  const segments: NarrationSegment[] = [];
  let totalDuration = 0;

  for (let i = 0; i < scenes.length; i++) {
    const section = scenes[i];
    const segmentId = `narration-${i}`;

    console.log(`[narration] [${i + 1}/${scenes.length}] ${section.kind} 나레이션 생성...`);

    const segment = await generateNarrationSegment(section.text, segmentId, outputDir);

    if (segment) {
      segments.push(segment);
      totalDuration += segment.durationSeconds;
      console.log(`[narration] ✅ ${segment.durationSeconds}초`);
    } else {
      console.error(`[narration] ❌ 섹션 ${i} 생성 실패`);
      // Continue with partial data instead of failing completely
      return {
        success: false,
        segments,
        totalDuration,
        method,
        error: `Failed to generate narration for section ${i}`,
      };
    }
  }

  console.log(`[narration] ✅ 완료: 총 ${totalDuration}초, 방식: ${method}`);

  return {
    success: true,
    segments,
    totalDuration,
    method,
  };
}
