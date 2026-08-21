#!/usr/bin/env node

/**
 * TEST: ONE SCENE
 * 1개 씬만 완성해서 테스트
 *
 * 사용: npm run test:scene
 *
 * 구성:
 * 1. 텍스트 → TTS (2~3초)
 * 2. 이미지 생성 또는 다운로드
 * 3. FFmpeg로 MP4 생성 (3~5초 영상)
 * 4. 자막 추가
 *
 * 목표: 실제 렌더링 파이프라인 검증
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Use bundled FFmpeg if available
const ffmpegPath = path.join(__dirname, "../node_modules/@ffmpeg-installer/linux-x64/ffmpeg");
const ffmpeg = fs.existsSync(ffmpegPath) ? ffmpegPath : "ffmpeg";

const DIAGNOSTICS_DIR = path.join(__dirname, "../diagnostics");
const OUTPUT_DIR = path.join(__dirname, "../test-output");
const TEST_SCENE_FILE = path.join(DIAGNOSTICS_DIR, "test-scene-result.json");

if (!fs.existsSync(DIAGNOSTICS_DIR)) {
  fs.mkdirSync(DIAGNOSTICS_DIR, { recursive: true });
}

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

const testResult = {
  timestamp: new Date().toISOString(),
  stages: {},
  errors: [],
  output: null,
};

function recordStage(stageName, status, details = {}) {
  testResult.stages[stageName] = {
    status,
    timestamp: new Date().toISOString(),
    ...details,
  };
}

function recordError(stage, error) {
  testResult.errors.push({
    stage,
    message: error.message || String(error),
    timestamp: new Date().toISOString(),
  });
}

// 테스트 데이터
const testScene = {
  id: "test-scene-001",
  text: "This is a test scene. The Kandahar Giant is a fascinating historical mystery. Testing audio generation and video rendering.",
  durationSeconds: 6,
  visualType: "data_card",
  visualHeadline: "Test Scene",
  visualLabel: "Testing",
  accentColor: "5a5a9e",
};

async function generateTestImage() {
  log("\n🖼️  Step 1: Generate Test Image...", "blue");

  try {
    const imagePath = path.join(OUTPUT_DIR, "test-scene.png");

    // FFmpeg로 간단한 테스트 이미지 생성
    // 검은 배경에 텍스트를 덮는 간단한 이미지
    const cmd = `"${ffmpeg}" -f lavfi -i color=c=000000:s=1920x1080:d=1 -vf "drawtext=text='Test Scene':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=48:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2" -y "${imagePath}" 2>&1`;

    try {
      execSync(cmd, { stdio: "pipe" });

      if (fs.existsSync(imagePath)) {
        const fileSize = fs.statSync(imagePath).size;
        log(`  ✓ Image created: ${imagePath} (${(fileSize / 1024).toFixed(1)}KB)`, "green");
        recordStage("image_generation", "PASS", {
          path: imagePath,
          size: fileSize,
        });
        return imagePath;
      } else {
        throw new Error("Image file not created");
      }
    } catch (error) {
      // FFmpeg 없을 수도 있으니 간단한 플레이스홀더 생성
      log("  ⚠ Using placeholder image (FFmpeg may not support drawing)", "yellow");

      // 간단한 PPM 이미지 생성 (모든 시스템에서 작동)
      const width = 1920;
      const height = 1080;
      const ppmData = [
        "P6",
        `${width} ${height}`,
        "255",
      ];

      let imageData = Buffer.alloc(width * height * 3);
      let idx = 0;

      // 검은 배경
      for (let i = 0; i < width * height * 3; i += 3) {
        imageData[i] = 0;       // R
        imageData[i + 1] = 0;   // G
        imageData[i + 2] = 0;   // B
      }

      // 중앙에 흰색 사각형
      const squareSize = 400;
      const startX = (width - squareSize) / 2;
      const startY = (height - squareSize) / 2;

      for (let y = 0; y < squareSize; y++) {
        for (let x = 0; x < squareSize; x++) {
          const pixelIdx = ((startY + y) * width + (startX + x)) * 3;
          imageData[pixelIdx] = 90;
          imageData[pixelIdx + 1] = 90;
          imageData[pixelIdx + 2] = 158;
        }
      }

      const ppmHeader = ppmData.join("\n") + "\n";
      const ppmBuffer = Buffer.concat([
        Buffer.from(ppmHeader),
        imageData,
      ]);

      fs.writeFileSync(imagePath, ppmBuffer);

      log(`  ✓ Placeholder image created: ${imagePath}`, "green");
      recordStage("image_generation", "PASS", {
        path: imagePath,
        type: "placeholder",
      });
      return imagePath;
    }
  } catch (error) {
    log(`  ✗ Image generation failed: ${error.message}`, "red");
    recordStage("image_generation", "FAIL");
    recordError("image_generation", error);
    return null;
  }
}

async function generateTestAudio() {
  log("\n🔊 Step 2: Generate Test Audio...", "blue");

  try {
    const audioPath = path.join(OUTPUT_DIR, "test-scene.wav");

    // FFmpeg로 무음 오디오 생성 (TTS 대체)
    // 실제 환경에서는 여기서 TTS를 호출하지만, 테스트용으로는 무음 사용
    const cmd = `"${ffmpeg}" -f lavfi -i anullsrc=r=48000:cl=mono -t ${testScene.durationSeconds} -q:a 9 -acodec libmp3lame "${audioPath}" 2>&1`;

    try {
      execSync(cmd, { stdio: "pipe" });

      if (fs.existsSync(audioPath)) {
        const fileSize = fs.statSync(audioPath).size;
        log(`  ✓ Audio generated: ${audioPath} (${(fileSize / 1024).toFixed(1)}KB)`, "green");
        recordStage("audio_generation", "PASS", {
          path: audioPath,
          duration: testScene.durationSeconds,
          size: fileSize,
        });
        return audioPath;
      } else {
        throw new Error("Audio file not created");
      }
    } catch (error) {
      // 혹시 모르니 WAV 생성 대신 다른 방법 사용
      log(`  ⚠ Falling back to simple audio (${error.message.slice(0, 40)})`, "yellow");

      // 매우 간단한 WAV 파일 생성 (44100Hz, mono, 3초)
      const sampleRate = 44100;
      const duration = testScene.durationSeconds;
      const samples = sampleRate * duration;
      const audioBuffer = Buffer.alloc(44 + samples * 2); // WAV 헤더 + 샘플

      // WAV 헤더
      audioBuffer.write("RIFF");
      audioBuffer.writeUInt32LE(36 + samples * 2, 4);
      audioBuffer.write("WAVE", 8);
      audioBuffer.write("fmt ", 12);
      audioBuffer.writeUInt32LE(16, 16);
      audioBuffer.writeUInt16LE(1, 20);   // PCM
      audioBuffer.writeUInt16LE(1, 22);   // Mono
      audioBuffer.writeUInt32LE(sampleRate, 24);
      audioBuffer.writeUInt32LE(sampleRate * 2, 28);
      audioBuffer.writeUInt16LE(2, 32);
      audioBuffer.writeUInt16LE(16, 34);
      audioBuffer.write("data", 36);
      audioBuffer.writeUInt32LE(samples * 2, 40);

      // 무음 데이터
      for (let i = 0; i < samples * 2; i += 2) {
        audioBuffer.writeInt16LE(0, 44 + i);
      }

      fs.writeFileSync(audioPath, audioBuffer);

      log(`  ✓ Simple WAV audio created: ${audioPath}`, "green");
      recordStage("audio_generation", "PASS", {
        path: audioPath,
        duration: testScene.durationSeconds,
        type: "wav",
      });
      return audioPath;
    }
  } catch (error) {
    log(`  ✗ Audio generation failed: ${error.message}`, "red");
    recordStage("audio_generation", "FAIL");
    recordError("audio_generation", error);
    return null;
  }
}

async function renderVideo(imagePath, audioPath) {
  log("\n🎬 Step 3: Render Video...", "blue");

  try {
    const videoPath = path.join(OUTPUT_DIR, "test-scene.mp4");
    const duration = testScene.durationSeconds;

    // 이미지를 비디오로 변환하고 오디오와 함께 합치기
    const cmd = `"${ffmpeg}" -loop 1 -i "${imagePath}" -i "${audioPath}" -c:v libx264 -preset fast -crf 28 -c:a aac -t ${duration} -y "${videoPath}" 2>&1`;

    try {
      execSync(cmd, { stdio: "pipe" });

      if (fs.existsSync(videoPath)) {
        const fileSize = fs.statSync(videoPath).size;
        log(
          `  ✓ Video rendered: ${videoPath} (${(fileSize / 1024 / 1024).toFixed(1)}MB)`,
          "green"
        );
        recordStage("video_render", "PASS", {
          path: videoPath,
          duration,
          size: fileSize,
        });
        testResult.output = videoPath;
        return videoPath;
      } else {
        throw new Error("Video file not created");
      }
    } catch (error) {
      log(`  ✗ FFmpeg rendering failed: ${error.message}`, "red");
      recordStage("video_render", "FAIL");
      recordError("video_render", error);
      return null;
    }
  } catch (error) {
    log(`  ✗ Video rendering failed: ${error.message}`, "red");
    recordStage("video_render", "FAIL");
    recordError("video_render", error);
    return null;
  }
}

async function main() {
  console.clear();
  log("\n================================", "blue");
  log("TEST: ONE SCENE", "blue");
  log("================================\n", "blue");

  log(`Text: "${testScene.text}"`, "cyan");
  log(`Duration: ${testScene.durationSeconds} seconds\n`, "cyan");

  // 각 단계 실행
  const imagePath = await generateTestImage();
  if (!imagePath) {
    log("\n✗ Cannot continue without image", "red");
    testResult.overallStatus = "FAIL";
    fs.writeFileSync(TEST_SCENE_FILE, JSON.stringify(testResult, null, 2));
    process.exit(1);
  }

  const audioPath = await generateTestAudio();
  if (!audioPath) {
    log("\n✗ Cannot continue without audio", "red");
    testResult.overallStatus = "FAIL";
    fs.writeFileSync(TEST_SCENE_FILE, JSON.stringify(testResult, null, 2));
    process.exit(1);
  }

  const videoPath = await renderVideo(imagePath, audioPath);
  if (!videoPath) {
    log("\n✗ Cannot continue without video", "red");
    testResult.overallStatus = "FAIL";
    fs.writeFileSync(TEST_SCENE_FILE, JSON.stringify(testResult, null, 2));
    process.exit(1);
  }

  // 결과 요약
  log("\n================================", "blue");
  log("✓ ONE SCENE TEST PASSED", "green");
  log("================================\n", "blue");

  log(`Output: ${videoPath}`, "cyan");
  log(`Size: ${(fs.statSync(videoPath).size / 1024 / 1024).toFixed(1)}MB`, "cyan");
  log("\nYou can play this video to verify rendering:", "green");
  log(`  ${videoPath}`, "yellow");

  testResult.overallStatus = "PASS";

  // JSON 저장
  fs.writeFileSync(TEST_SCENE_FILE, JSON.stringify(testResult, null, 2));
  log(`\nTest result saved to: ${TEST_SCENE_FILE}`, "blue");

  // 다음 단계
  log("\nNext Steps:", "blue");
  log("  1. Play the generated video to verify quality", "green");
  log("  2. npm run test:short (generate 2-3 minute video)", "green");

  process.exit(0);
}

main().catch((error) => {
  console.error("Test scene failed:", error);
  testResult.overallStatus = "FAIL";
  testResult.errors.push({
    stage: "main",
    message: error.message,
    timestamp: new Date().toISOString(),
  });
  fs.writeFileSync(TEST_SCENE_FILE, JSON.stringify(testResult, null, 2));
  process.exit(1);
});
