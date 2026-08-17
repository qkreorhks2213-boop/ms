import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";

const execAsync = promisify(exec);

export interface MP4ValidationResult {
  valid: boolean;
  duration: number;
  videoStream: boolean;
  audioStream: boolean;
  codec: string;
  resolution: string;
  fps: number;
  bitrate: string;
  fileSize: number;
  errors: string[];
}

/**
 * Comprehensive MP4 validation using ffprobe.
 * NO FALLBACK: If ffprobe fails, validation fails (not silent success).
 */
export async function validateMP4WithFFprobe(filePath: string): Promise<MP4ValidationResult> {
  const result: MP4ValidationResult = {
    valid: false,
    duration: 0,
    videoStream: false,
    audioStream: false,
    codec: "unknown",
    resolution: "unknown",
    fps: 0,
    bitrate: "0k",
    fileSize: 0,
    errors: [],
  };

  // Check file exists
  if (!fs.existsSync(filePath)) {
    result.errors.push("File does not exist");
    return result;
  }

  // Check file size
  const fileSize = fs.statSync(filePath).size;
  result.fileSize = fileSize;
  if (fileSize < 5 * 1024 * 1024) {
    // Less than 5MB is suspicious for a 15-minute video
    result.errors.push(`File size too small: ${(fileSize / 1024 / 1024).toFixed(1)}MB`);
  }

  // Check MP4 header
  const header = Buffer.alloc(4);
  const fd = fs.openSync(filePath, "r");
  fs.readSync(fd, header, 0, 4, 4);
  fs.closeSync(fd);
  if (header.toString("ascii") !== "ftyp") {
    result.errors.push("Missing MP4 ftyp header - not a valid MP4 file");
    return result;
  }

  // Run ffprobe - NO FALLBACK
  let ffprobeOutput: string;
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -select_streams v:0 -select_streams a:0 -show_format -show_streams -print_json "${filePath}"`,
      { timeout: 10000, maxBuffer: 10 * 1024 * 1024 }
    );
    ffprobeOutput = stdout;
  } catch (err: any) {
    result.errors.push(`[CRITICAL] ffprobe execution failed: ${err.message}. No fallback validation available.`);
    return result;
  }

  // Parse ffprobe output
  let parsed: any;
  try {
    parsed = JSON.parse(ffprobeOutput);
  } catch (err: any) {
    result.errors.push(`[CRITICAL] ffprobe output parsing failed: ${err.message}`);
    return result;
  }

  if (!parsed.format) {
    result.errors.push("[CRITICAL] ffprobe format data missing");
    return result;
  }

  // Duration validation
  const duration = parseFloat(parsed.format.duration) || 0;
  if (duration <= 0) {
    result.errors.push("[CRITICAL] Invalid or missing duration");
  } else if (duration < 10) {
    result.errors.push(`[CRITICAL] Video too short: ${duration.toFixed(1)}s (expected ~900s for 15min)`);
  }
  result.duration = duration;

  // Video stream validation
  const videoStream = (parsed.streams || []).find((s: any) => s.codec_type === "video");
  if (!videoStream) {
    result.errors.push("[CRITICAL] No video stream found");
  } else {
    result.videoStream = true;
    result.codec = videoStream.codec_name || "unknown";
    result.resolution = `${videoStream.width}x${videoStream.height}`;
    result.fps = parseFloat(videoStream.r_frame_rate || "0") || 0;

    if (!videoStream.width || !videoStream.height) {
      result.errors.push("[CRITICAL] Video dimensions missing");
    }
    if (result.fps <= 0) {
      result.errors.push("[CRITICAL] Invalid or missing FPS");
    }
  }

  // Audio stream validation
  const audioStream = (parsed.streams || []).find((s: any) => s.codec_type === "audio");
  if (!audioStream) {
    result.errors.push("[CRITICAL] No audio stream found");
  } else {
    result.audioStream = true;
    result.bitrate = audioStream.bit_rate || "unknown";

    if (!audioStream.sample_rate) {
      result.errors.push("[CRITICAL] Audio sample rate missing");
    }
  }

  // Final verdict
  result.valid = result.errors.length === 0 && result.videoStream && result.audioStream && duration > 60;

  return result;
}

export interface DurationCheckResult {
  valid: boolean;
  difference: number;
  percentDiff: number;
  message: string;
}

/**
 * Validate duration within tolerance.
 * targetMinutes=15 means 900 seconds. Tolerance=20% allows 720-1080 seconds.
 */
export function validateDuration(
  actualSeconds: number,
  targetMinutes: number,
  tolerancePercent: number = 20
): DurationCheckResult {
  const targetSeconds = targetMinutes * 60;
  const tolerance = (targetSeconds * tolerancePercent) / 100;
  const difference = actualSeconds - targetSeconds;
  const percentDiff = (difference / targetSeconds) * 100;
  const valid = Math.abs(difference) <= tolerance;

  const message = valid
    ? `✅ Duration valid: ${actualSeconds}s (target: ${targetSeconds}s, tolerance: ±${tolerance}s)`
    : `❌ Duration invalid: ${actualSeconds}s (target: ${targetSeconds}s ±${tolerance}s, got ${percentDiff.toFixed(1)}%)`;

  return { valid, difference, percentDiff, message };
}

export interface SceneCountCheckResult {
  valid: boolean;
  difference: number;
  percentDiff: number;
  message: string;
}

/**
 * Validate scene count within tolerance.
 * targetCount=50 scenes. Tolerance=20% allows 40-60 scenes.
 */
export function validateSceneCount(
  actualCount: number,
  targetCount: number,
  tolerancePercent: number = 20
): SceneCountCheckResult {
  if (targetCount === 0) {
    return {
      valid: false,
      difference: 0,
      percentDiff: 0,
      message: "❌ Target scene count is zero",
    };
  }

  const tolerance = (targetCount * tolerancePercent) / 100;
  const difference = actualCount - targetCount;
  const percentDiff = (difference / targetCount) * 100;
  const valid = Math.abs(difference) <= tolerance;

  const message = valid
    ? `✅ Scene count valid: ${actualCount} (target: ${targetCount}, tolerance: ±${tolerance.toFixed(0)})`
    : `❌ Scene count invalid: ${actualCount} (target: ${targetCount} ±${tolerance.toFixed(0)}, got ${percentDiff.toFixed(1)}%)`;

  return { valid, difference, percentDiff, message };
}

export interface ResolutionCheckResult {
  valid: boolean;
  width: number;
  height: number;
  message: string;
}

/**
 * Production validation: minimum 1280x720 (HD)
 */
export function validateResolution(resolution: string): ResolutionCheckResult {
  const [widthStr, heightStr] = resolution.split("x");
  const width = parseInt(widthStr, 10);
  const height = parseInt(heightStr, 10);

  const valid = width >= 1280 && height >= 720;
  const message = valid
    ? `✅ Resolution valid: ${resolution} (minimum HD: 1280x720)`
    : `❌ Resolution too low: ${resolution} (minimum HD: 1280x720)`;

  return { valid, width, height, message };
}
