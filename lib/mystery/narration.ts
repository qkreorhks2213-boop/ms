/**
 * 실제 TTS 나레이션 생성
 * Piper TTS ONLY - 절대 sine-wave 폴백 금지
 * 실패 시 명확한 에러로 파이프라인 중단
 */

import { spawn } from "child_process";
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
  voices: [
    process.env.PIPER_VOICE || "ko_KR-narae-medium",
    "en_US-hfc_female-medium",
    "en_US-ljspeech-high",
  ],
  rate: 1.0,
};

async function tryPiperWithVoice(
  text: string,
  segmentId: string,
  audioPath: string,
  voice: string,
  attemptNumber: number = 0
): Promise<NarrationSegment | null> {
  return new Promise((resolve, reject) => {
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

    piper.on("close", (code) => {
      if (code === 0 && fs.existsSync(audioPath)) {
        const stats = fs.statSync(audioPath);
        const durationSeconds = Math.ceil(stats.size / (16000 * 2));

        resolve({
          id: segmentId,
          text,
          audioPath,
          durationSeconds,
          sampleRate: 16000,
          channels: 1,
          format: "wav",
        });
      } else {
        reject(new Error(stderrOutput || "Unknown error"));
      }
    });

    piper.on("error", (err) => {
      reject(new Error(err.message));
    });

    setTimeout(() => {
      if (!fs.existsSync(audioPath)) {
        piper.kill();
        reject(new Error("Piper TTS timeout"));
      }
    }, 30000);
  });
}

async function generateNarrationSegment(text: string, segmentId: string, outputDir: string): Promise<NarrationSegment | null> {
  const audioPath = path.join(outputDir, `${segmentId}.wav`);
  const errors: string[] = [];

  for (let i = 0; i < PIPER_CONFIG.voices.length; i++) {
    const voice = PIPER_CONFIG.voices[i];
    try {
      return await tryPiperWithVoice(text, segmentId, audioPath, voice, i);
    } catch (err: any) {
      errors.push(`Voice '${voice}': ${err.message}`);
      if (fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
      }
    }
  }

  throw new Error(
    `[CRITICAL] Piper TTS failed for segment ${segmentId}. Tried voices: ${errors.join("; ")}`
  );
}

async function checkPiperAvailable(): Promise<string | null> {
  for (const voice of PIPER_CONFIG.voices) {
    try {
      const testResult = await new Promise<boolean>((resolve) => {
        const piper = spawn("piper", [
          "--model",
          voice,
        ], { stdio: "pipe" });

        piper.stdin.end();

        let output = "";
        piper.stderr.on("data", (data) => {
          output += data.toString();
        });

        const timeout = setTimeout(() => {
          piper.kill();
          resolve(false);
        }, 5000);

        piper.on("close", (code) => {
          clearTimeout(timeout);
          const available = code === 0 || !output.includes("Unable to find voice");
          resolve(available);
        });

        piper.on("error", () => {
          clearTimeout(timeout);
          resolve(false);
        });
      });

      if (testResult) {
        return voice;
      }
    } catch (err) {
      continue;
    }
  }

  return null;
}

export async function generateNarrationForScenes(
  projectId: string,
  project: MysteryProject,
): Promise<{
  success: boolean;
  segments: NarrationSegment[];
  totalDuration: number;
  voiceUsed?: string;
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

  console.log(`[narration] ${scenes.length}개 섹션의 나레이션 생성 시작 (Piper TTS)`);

  // Check if Piper is available BEFORE starting
  const availableVoice = await checkPiperAvailable();
  if (!availableVoice) {
    return {
      success: false,
      segments: [],
      totalDuration: 0,
      error: "[CRITICAL] Piper TTS not available. No voice models found. Tried: " + PIPER_CONFIG.voices.join(", "),
    };
  }

  console.log(`[narration] Piper voice available: ${availableVoice}`);

  const segments: NarrationSegment[] = [];
  let totalDuration = 0;

  for (let i = 0; i < scenes.length; i++) {
    const section = scenes[i];
    const segmentId = `narration-${i}`;

    console.log(`[narration] [${i + 1}/${scenes.length}] ${section.kind} 나레이션 생성 (${availableVoice})`);

    try {
      const segment = await generateNarrationSegment(section.text, segmentId, outputDir);
      if (segment) {
        segments.push(segment);
        totalDuration += segment.durationSeconds;
        console.log(`[narration] ✅ ${segment.durationSeconds}초`);
      }
    } catch (err: any) {
      console.error(`[narration] ❌ 섹션 ${i} 생성 실패:`, err.message);
      return {
        success: false,
        segments,
        totalDuration,
        voiceUsed: availableVoice,
        error: err.message,
      };
    }
  }

  console.log(`[narration] ✅ 완료: 총 ${totalDuration}초, voice: ${availableVoice}`);

  return {
    success: true,
    segments,
    totalDuration,
    voiceUsed: availableVoice,
  };
}
