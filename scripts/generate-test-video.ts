#!/usr/bin/env ts-node
/**
 * Generate Actual Test Video (MP4)
 * 실제 MP4 영상을 생성하고 검증한다
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Get FFmpeg paths
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

interface VideoScene {
  duration: number;
  title: string;
  color: string;
}

interface ValidationResult {
  timestamp: string;
  generated: boolean;
  videoPath: string;
  verification: {
    fileExists: boolean;
    fileSize: number;
    duration: number;
    resolution: string;
    codec: string;
    quality: "pass" | "warn" | "fail";
  };
  errors: string[];
}

const outputDir = path.join(process.cwd(), "diagnostics");
const videoOutputPath = path.join(outputDir, "test-mystery-video.mp4");

// Generate simple test video
function generateVideo(scenes: VideoScene[], ffmpeg: string): void {
  console.log("🎬 Generating video...");

  const fps = 30;
  const width = 1920;
  const height = 1080;
  const tempDir = path.join(outputDir, "temp-parts");

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

    console.log(`   Scene ${i + 1}/${scenes.length}: ${scene.title} (${scene.duration}s)`);

    const cmd = `"${ffmpeg}" -f lavfi -i color=c=${hexColor}:s=${width}x${height}:d=${scene.duration} -c:v libx264 -pix_fmt yuv420p -crf 23 -y "${tempFile}"`;

    try {
      execSync(cmd, { stdio: "ignore" });
      tempFiles.push(tempFile);
    } catch (err) {
      console.error(`❌ Failed to generate scene ${i + 1}`);
      throw err;
    }
  }

  console.log("\n🔗 Concatenating scenes...");

  // Write concat demuxer file
  const concatFile = path.join(tempDir, "concat.txt");
  const concatContent = tempFiles.map((f) => `file '${f}'`).join("\n");
  fs.writeFileSync(concatFile, concatContent);

  const concatCmd = `"${ffmpeg}" -f concat -safe 0 -i "${concatFile}" -c copy -y "${videoOutputPath}"`;

  try {
    execSync(concatCmd, { stdio: "ignore" });
    console.log("✅ Video generated successfully");

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
  } catch (err) {
    console.error("❌ Concatenation failed");
    throw err;
  }
}

// Validate video
function validateVideo(ffprobe: string, filePath: string): ValidationResult {
  const errors: string[] = [];
  const result: ValidationResult = {
    timestamp: new Date().toISOString(),
    generated: false,
    videoPath: filePath,
    verification: {
      fileExists: false,
      fileSize: 0,
      duration: 0,
      resolution: "unknown",
      codec: "unknown",
      quality: "fail",
    },
    errors,
  };

  // Check file exists
  if (!fs.existsSync(filePath)) {
    errors.push("Video file does not exist");
    return result;
  }

  result.verification.fileExists = true;
  result.verification.fileSize = fs.statSync(filePath).size;
  result.generated = true;

  console.log(`\n✅ File: ${(result.verification.fileSize / 1024 / 1024).toFixed(2)} MB`);

  // Get metadata
  try {
    const cmd = `"${ffprobe}" -v error -select_streams v:0 -show_entries stream=width,height,codec_name -of json "${filePath}"`;
    const output = execSync(cmd, { encoding: "utf-8" });
    const data = JSON.parse(output);

    if (data.streams && data.streams.length > 0) {
      const stream = data.streams[0];
      result.verification.resolution = `${stream.width}x${stream.height}`;
      result.verification.codec = stream.codec_name;
      console.log(`✅ Resolution: ${result.verification.resolution}`);
      console.log(`✅ Codec: ${result.verification.codec}`);
    }
  } catch (err) {
    errors.push("Failed to get video metadata");
  }

  // Get duration
  try {
    const cmd = `"${ffprobe}" -v error -show_entries format=duration -of json "${filePath}"`;
    const output = execSync(cmd, { encoding: "utf-8" });
    const data = JSON.parse(output);
    const duration = parseFloat(data.format.duration);
    result.verification.duration = duration;
    console.log(`✅ Duration: ${duration.toFixed(2)}s`);
  } catch (err) {
    errors.push("Failed to get duration");
  }

  // Assess quality
  const fileSize = result.verification.fileSize;
  const duration = result.verification.duration;

  // For a 50-second test video, 100KB-500KB is reasonable
  if (fileSize > 50000 && duration > 45 && !errors.includes("Failed")) {
    result.verification.quality = "pass";
  } else if (fileSize > 20000 && duration > 30) {
    result.verification.quality = "warn";
  } else {
    result.verification.quality = "fail";
  }

  return result;
}

// Main
async function main() {
  console.log("🚀 Mystery Video Test Generator\n");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const scenes: VideoScene[] = [
    { duration: 5, title: "Introduction", color: "#1a1a2e" },
    { duration: 10, title: "Background", color: "#16213e" },
    { duration: 10, title: "Timeline", color: "#0f3460" },
    { duration: 10, title: "Evidence", color: "#e94560" },
    { duration: 10, title: "Analysis", color: "#533483" },
    { duration: 5, title: "Conclusion", color: "#1a1a2e" },
  ];

  try {
    const ffmpeg = getFFmpegPath();
    const ffprobe = getFFprobePath();

    console.log(`Using FFmpeg: ${ffmpeg}`);
    console.log(`Using ffprobe: ${ffprobe}\n`);

    // Generate
    generateVideo(scenes, ffmpeg);

    // Validate
    console.log("\n🔍 Validating...");
    const validation = validateVideo(ffprobe, videoOutputPath);

    console.log("\n📊 Results:");
    console.log(`   Quality: ${validation.verification.quality.toUpperCase()}`);
    console.log(`   Generated: ${validation.generated ? "✅" : "❌"}`);

    if (validation.errors.length > 0) {
      console.log("\n⚠️ Errors:");
      validation.errors.forEach((e) => console.log(`   - ${e}`));
    }

    // Save
    const resultPath = path.join(outputDir, "video-generation-result.json");
    fs.writeFileSync(resultPath, JSON.stringify(validation, null, 2));
    console.log(`\n✅ Saved: ${resultPath}`);

    process.exit(validation.verification.quality === "pass" ? 0 : 1);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

main();
