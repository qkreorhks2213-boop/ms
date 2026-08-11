/**
 * 실제 TTS 나레이션 생성
 * Piper 사용 - 로컬 음성 합성
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
  format: "wav" | "mp3";
}

const PIPER_CONFIG = {
  // Try Korean voice first, fallback to English
  voice: process.env.PIPER_VOICE || process.env.PIPER_VOICE_KO || "ko_KR-narae-medium",
  fallbackVoice: "en_US-hfc_female-medium",
  rate: 1.0,
  pitch: 1.0,
  noiseScale: 0.667,
  noiseW: 0.8,
};

async function generateNarrationSegment(text: string, segmentId: string, outputDir: string): Promise<NarrationSegment | null> {
  return new Promise((resolve) => {
    const audioPath = path.join(outputDir, `${segmentId}.wav`);

    // Piper를 spawn으로 실행
    const piper = spawn("piper", [
      "--model",
      PIPER_CONFIG.voice,
      "--output-file",
      audioPath,
      "--rate",
      String(PIPER_CONFIG.rate),
      "--pitch",
      String(PIPER_CONFIG.pitch),
      "--noise-scale",
      String(PIPER_CONFIG.noiseScale),
      "--noise-w",
      String(PIPER_CONFIG.noiseW),
    ]);

    // 텍스트를 stdin으로 전달
    piper.stdin.write(text);
    piper.stdin.end();

    let stderrOutput = "";

    piper.stderr.on("data", (data) => {
      stderrOutput += data.toString();
    });

    piper.on("close", (code) => {
      if (code === 0 && fs.existsSync(audioPath)) {
        // WAV 파일 분석 (duration 계산)
        const stats = fs.statSync(audioPath);
        const durationSeconds = Math.ceil(stats.size / (16000 * 2)); // 16kHz, 16-bit mono 기준

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
        console.error(`[narration] Piper 오류: ${stderrOutput}`);
        resolve(null);
      }
    });
  });
}

async function checkPiperAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const piper = spawn("piper", ["--help"]);

    piper.on("close", (code) => {
      resolve(code === 0);
    });

    piper.on("error", () => {
      resolve(false);
    });

    setTimeout(() => resolve(false), 5000);
  });
}

export async function generateNarrationForScenes(
  projectId: string,
  project: MysteryProject,
): Promise<{
  success: boolean;
  segments: NarrationSegment[];
  totalDuration: number;
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

  console.log(`[narration] Piper TTS 확인 중...`);

  const piperAvailable = await checkPiperAvailable();
  if (!piperAvailable) {
    return {
      success: false,
      segments: [],
      totalDuration: 0,
      error: "Piper TTS not available. Install with: pip install piper-tts",
    };
  }

  const outputDir = path.join(process.cwd(), "data", "mystery-projects", projectId, "narration");

  // narration 디렉토리 생성
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`[narration] ${scenes.length}개 섹션의 나레이션 생성 중...`);

  const segments: NarrationSegment[] = [];
  let totalDuration = 0;

  for (let i = 0; i < scenes.length; i++) {
    const section = scenes[i];
    const segmentId = `narration-${i}`;

    console.log(`[narration] [${i + 1}/${scenes.length}] ${section.kind} 생성...`);

    const segment = await generateNarrationSegment(section.text, segmentId, outputDir);

    if (segment) {
      segments.push(segment);
      totalDuration += segment.durationSeconds;
      console.log(`[narration] ✅ ${segment.durationSeconds}초`);
    } else {
      console.warn(`[narration] ⚠️ 섹션 ${i} 생성 실패`);
      return {
        success: false,
        segments,
        totalDuration,
        error: `Failed to generate narration for section ${i}`,
      };
    }
  }

  console.log(`[narration] 완료: 총 ${totalDuration}초`);

  return {
    success: true,
    segments,
    totalDuration,
  };
}
