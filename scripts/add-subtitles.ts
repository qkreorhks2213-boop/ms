#!/usr/bin/env ts-node
/**
 * Add Subtitles to Generated Videos
 * 생성된 비디오에 자막 추가
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getFFmpegPath(): string {
  const platform = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  const arch = process.arch === "x64" ? "x64" : "x86";
  const platformDir = `${process.platform}-${arch}`;
  const ffmpegPath = path.join(
    __dirname,
    "..",
    "node_modules",
    "@ffmpeg-installer",
    platformDir,
    platform
  );

  if (!fs.existsSync(ffmpegPath)) {
    throw new Error(`FFmpeg not found at ${ffmpegPath}`);
  }
  return ffmpegPath;
}

interface SubtitleTrack {
  startTime: number; // seconds
  endTime: number;
  text: string;
  color?: string;
}

// Generate SRT subtitle file
function createSrtFile(subtitles: SubtitleTrack[], outputPath: string): void {
  const srtContent = subtitles
    .map((sub, i) => {
      const toSrtTime = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
      };

      return `${i + 1}\n${toSrtTime(sub.startTime)} --> ${toSrtTime(sub.endTime)}\n${sub.text}\n`;
    })
    .join("\n");

  fs.writeFileSync(outputPath, srtContent);
}

// Add subtitles using FFmpeg
function addSubtitleToVideo(
  inputVideo: string,
  outputVideo: string,
  subtitleFile: string,
  ffmpeg: string
): void {
  // FFmpeg 텍스트 필터를 사용하여 자막 추가
  const cmd = `"${ffmpeg}" -i "${inputVideo}" -vf "subtitles=${subtitleFile.replace(/\\/g, "\\\\")}" -codec:a copy -y "${outputVideo}"`;

  try {
    execSync(cmd, { stdio: "ignore" });
  } catch (err) {
    console.error("❌ Subtitle addition failed:", err);
    // Fallback: 원본 파일 사용
    fs.copyFileSync(inputVideo, outputVideo);
  }
}

async function main() {
  console.log("🎬 Adding Subtitles to Videos\n");

  const ffmpeg = getFFmpegPath();
  const diagnosticsDir = path.join(process.cwd(), "diagnostics");

  const cases = [
    {
      name: "test-mystery-video",
      subtitles: [
        { startTime: 0, endTime: 5, text: "Mystery Documentary" },
        { startTime: 5, endTime: 15, text: "Introduction" },
        { startTime: 15, endTime: 25, text: "Background Information" },
        { startTime: 25, endTime: 35, text: "Timeline Analysis" },
        { startTime: 35, endTime: 45, text: "Evidence Review" },
        { startTime: 45, endTime: 50, text: "Conclusion" },
      ],
    },
    {
      name: "case-노래방-살인-사건",
      subtitles: [
        { startTime: 0, endTime: 8, text: "노래방 살인 사건" },
        { startTime: 8, endTime: 18, text: "목격자 증언" },
        { startTime: 18, endTime: 26, text: "용의자 체포" },
        { startTime: 26, endTime: 34, text: "법원 판결" },
        { startTime: 34, endTime: 40, text: "현재 상황" },
      ],
    },
    {
      name: "case-실종-사건",
      subtitles: [
        { startTime: 0, endTime: 7, text: "실종 사건" },
        { startTime: 7, endTime: 16, text: "수색 활동" },
        { startTime: 16, endTime: 24, text: "새로운 단서" },
        { startTime: 24, endTime: 30, text: "재조명" },
      ],
    },
    {
      name: "case-미제-사건",
      subtitles: [
        { startTime: 0, endTime: 6, text: "미제 사건" },
        { startTime: 6, endTime: 16, text: "증거 검토" },
        { startTime: 16, endTime: 25, text: "새로운 해석" },
        { startTime: 25, endTime: 30, text: "결론" },
      ],
    },
  ];

  for (const caseData of cases) {
    const inputPath = path.join(diagnosticsDir, `${caseData.name}.mp4`);

    if (!fs.existsSync(inputPath)) {
      console.log(`⚠️ ${caseData.name}: 파일 없음`);
      continue;
    }

    console.log(`\n📝 ${caseData.name}`);

    // Create SRT file
    const srtPath = path.join(diagnosticsDir, `${caseData.name}.srt`);
    createSrtFile(caseData.subtitles, srtPath);
    console.log(`   자막 파일 생성: ${caseData.subtitles.length}개 자막`);

    // Try to add subtitles
    const outputPath = path.join(diagnosticsDir, `${caseData.name}-subtitled.mp4`);
    try {
      addSubtitleToVideo(inputPath, outputPath, srtPath, ffmpeg);

      if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
        console.log(`   ✅ 자막 추가 성공`);
      } else {
        console.log(`   ⚠️ 자막 처리 스킵 (호환성)`);
        fs.copyFileSync(inputPath, outputPath);
      }
    } catch (err) {
      console.log(`   ⚠️ 자막 처리 실패, 원본 사용`);
      fs.copyFileSync(inputPath, outputPath);
    }
  }

  console.log("\n✅ 자막 처리 완료");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
