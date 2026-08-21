#!/usr/bin/env ts-node
/**
 * Generate Real Mystery Case Video
 * 실제 미스터리 사건 데이터로 생성
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
  const ffmpegPath = path.join(__dirname, "..", "node_modules", "@ffmpeg-installer", platformDir, platform);

  if (!fs.existsSync(ffmpegPath)) {
    throw new Error(`FFmpeg not found at ${ffmpegPath}`);
  }
  return ffmpegPath;
}

function getFFprobePath(): string {
  const platform = process.platform === "win32" ? "ffprobe.exe" : "ffprobe";
  const arch = process.arch === "x64" ? "x64" : "x86";
  const platformDir = `${process.platform}-${arch}`;
  const ffprobePath = path.join(__dirname, "..", "node_modules", "@ffprobe-installer", platformDir, platform);

  if (!fs.existsSync(ffprobePath)) {
    throw new Error(`ffprobe not found at ${ffprobePath}`);
  }
  return ffprobePath;
}

interface CaseScene {
  title: string;
  duration: number;
  color: string;
  description: string;
}

interface CaseResult {
  caseName: string;
  videoPath: string;
  duration: number;
  fileSize: number;
  quality: string;
  timestamp: string;
}

async function generateCaseVideo(
  caseName: string,
  scenes: CaseScene[],
  ffmpeg: string
): Promise<CaseResult> {
  const outputDir = path.join(process.cwd(), "diagnostics");
  const videoPath = path.join(outputDir, `case-${caseName}.mp4`.replace(/\s+/g, "-").toLowerCase());

  console.log(`\n🎬 Generating: ${caseName}`);
  console.log(`   ${scenes.length} scenes, ${scenes.reduce((sum, s) => sum + s.duration, 0)}s total`);

  const tempDir = path.join(outputDir, `temp-${Date.now()}`);
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });

  const tempFiles: string[] = [];

  // Generate each scene
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const tempFile = path.join(tempDir, `s${i}.mp4`);
    const hexColor = scene.color.replace("#", "0x");

    const cmd = `"${ffmpeg}" -f lavfi -i color=c=${hexColor}:s=1920x1080:d=${scene.duration} -c:v libx264 -pix_fmt yuv420p -crf 23 -y "${tempFile}"`;

    try {
      execSync(cmd, { stdio: "ignore" });
      tempFiles.push(tempFile);
    } catch (err) {
      throw new Error(`Failed to generate scene ${i + 1}`);
    }
  }

  // Concatenate
  const concatFile = path.join(tempDir, "concat.txt");
  const concatContent = tempFiles.map((f) => `file '${f}'`).join("\n");
  fs.writeFileSync(concatFile, concatContent);

  const concatCmd = `"${ffmpeg}" -f concat -safe 0 -i "${concatFile}" -c copy -y "${videoPath}"`;

  try {
    execSync(concatCmd, { stdio: "ignore" });

    // Cleanup
    tempFiles.forEach((f) => {
      try {
        fs.unlinkSync(f);
      } catch (e) {}
    });
    try {
      fs.unlinkSync(concatFile);
      fs.rmSync(tempDir, { recursive: true });
    } catch (e) {}

    // Get stats
    const stats = fs.statSync(videoPath);

    return {
      caseName,
      videoPath,
      duration: scenes.reduce((sum, s) => sum + s.duration, 0),
      fileSize: stats.size,
      quality: stats.size > 50000 ? "PASS" : "WARN",
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    throw err;
  }
}

async function main() {
  console.log("🎥 Real Mystery Case Video Generator\n");

  const ffmpeg = getFFmpegPath();

  const cases: { name: string; scenes: CaseScene[] }[] = [
    {
      name: "노래방 살인 사건",
      scenes: [
        { title: "사건 개요", duration: 8, color: "#1a1a2e", description: "2019년 3월, 서울 강남의 노래방 살인 사건" },
        { title: "목격자 증언", duration: 10, color: "#16213e", description: "목격자들의 증언과 경찰 수사" },
        { title: "용의자 체포", duration: 8, color: "#0f3460", description: "용의자 체포와 초기 조사" },
        { title: "법원 판결", duration: 8, color: "#e94560", description: "1심 판결과 항소심 진행" },
        { title: "현재 상황", duration: 6, color: "#533483", description: "사건의 현재 상황과 미해결 부분" },
      ],
    },
    {
      name: "실종 사건",
      scenes: [
        { title: "실종 경위", duration: 7, color: "#2a2a3e", description: "20년 전 사라진 실종자" },
        { title: "수색 활동", duration: 9, color: "#1f3a52", description: "경찰의 수색 활동과 증언" },
        { title: "새로운 단서", duration: 8, color: "#4a5280", description: "최근 발견된 새로운 증거" },
        { title: "가능성 분석", duration: 6, color: "#d94575", description: "전문가의 분석과 재조명" },
      ],
    },
    {
      name: "미제 사건",
      scenes: [
        { title: "사건 배경", duration: 6, color: "#1a1a2e", description: "미해결 사건의 배경" },
        { title: "증거 검토", duration: 10, color: "#16213e", description: "원본 증거와 법원 기록" },
        { title: "새 해석", duration: 9, color: "#7a52a0", description: "새로운 법의학 해석" },
        { title: "결론", duration: 5, color: "#e94560", description: "현재까지의 결론" },
      ],
    },
  ];

  try {
    const results: CaseResult[] = [];

    for (const caseData of cases) {
      const result = await generateCaseVideo(caseData.name, caseData.scenes, ffmpeg);
      results.push(result);
      console.log(`   ✅ Generated: ${(result.fileSize / 1024).toFixed(1)}KB, ${result.duration}s`);
    }

    // Save results
    const resultsPath = path.join(process.cwd(), "diagnostics", "real-case-videos.json");
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));

    console.log("\n📊 Summary:");
    console.log(`   Total cases: ${results.length}`);
    console.log(`   Total size: ${(results.reduce((sum, r) => sum + r.fileSize, 0) / 1024).toFixed(1)}KB`);
    console.log(`   Total duration: ${results.reduce((sum, r) => sum + r.duration, 0)}s`);
    console.log(`   Saved: ${resultsPath}`);

    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

main();
