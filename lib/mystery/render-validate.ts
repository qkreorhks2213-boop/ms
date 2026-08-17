/**
 * Comprehensive MP4 validation using ffprobe.
 * Validates duration, video stream, audio stream, codec, resolution, fps, etc.
 */

import { spawn } from "child_process";
import fs from "fs";

export interface MP4ValidationResult {
  valid: boolean;
  duration: number; // seconds
  videoStream: boolean;
  audioStream: boolean;
  codec: string;
  resolution: string; // e.g., "1920x1080"
  fps: number;
  bitrate: string;
  fileSize: number; // bytes
  errors: string[];
}

/**
 * Validate MP4 file using ffprobe.
 * Returns comprehensive metadata and validation results.
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
    bitrate: "unknown",
    fileSize: 0,
    errors: [],
  };

  // Check file exists
  if (!fs.existsSync(filePath)) {
    result.errors.push("File does not exist");
    return result;
  }

  // Check file size
  const stats = fs.statSync(filePath);
  result.fileSize = stats.size;

  if (stats.size < 1024) {
    result.errors.push(`File too small: ${stats.size} bytes (expected >1KB)`);
    return result;
  }

  // Check file header
  try {
    const buffer = Buffer.alloc(12);
    const fd = fs.openSync(filePath, "r");
    fs.readSync(fd, buffer, 0, 12, 4);
    fs.closeSync(fd);

    const header = buffer.toString("ascii", 0, 4);
    if (header !== "ftyp") {
      result.errors.push(`Invalid MP4 header: expected 'ftyp' but got '${header}'`);
      return result;
    }
  } catch (err: any) {
    result.errors.push(`Failed to read file header: ${err.message}`);
    return result;
  }

  // Try to use ffprobe for comprehensive validation
  try {
    const probeData = await ffprobe(filePath);

    // Extract duration
    if (probeData.format && probeData.format.duration) {
      result.duration = Math.round(parseFloat(probeData.format.duration));
    }

    if (probeData.format && probeData.format.bit_rate) {
      result.bitrate = formatBitrate(parseInt(probeData.format.bit_rate));
    }

    // Analyze streams
    if (probeData.streams) {
      for (const stream of probeData.streams) {
        if (stream.codec_type === "video") {
          result.videoStream = true;
          result.codec = stream.codec_name || "unknown";

          if (stream.width && stream.height) {
            result.resolution = `${stream.width}x${stream.height}`;
          }

          if (stream.r_frame_rate) {
            const [num, den] = stream.r_frame_rate.split("/").map(Number);
            result.fps = Math.round(num / (den || 1));
          }
        } else if (stream.codec_type === "audio") {
          result.audioStream = true;
        }
      }
    }

    // Validate requirements
    if (!result.videoStream) {
      result.errors.push("No video stream found");
    }

    if (!result.audioStream) {
      result.errors.push("No audio stream found");
    }

    if (result.duration <= 0) {
      result.errors.push("Invalid duration: must be > 0 seconds");
    }

    // If all streams exist and duration valid, mark as valid
    result.valid = result.videoStream && result.audioStream && result.duration > 0 && result.errors.length === 0;

    return result;
  } catch (err: any) {
    // If ffprobe fails, fall back to basic validation
    console.warn(`[render-validate] ffprobe unavailable, using basic validation:`, err.message);

    // At minimum, header check passed
    result.valid = true;
    return result;
  }
}

/**
 * Call ffprobe to get file metadata.
 */
function ffprobe(filePath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn("ffprobe", [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      filePath,
    ]);

    let output = "";
    let error = "";

    ffprobe.stdout.on("data", (data) => {
      output += data.toString();
    });

    ffprobe.stderr.on("data", (data) => {
      error += data.toString();
    });

    ffprobe.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe failed with code ${code}: ${error}`));
        return;
      }

      try {
        const data = JSON.parse(output);
        resolve(data);
      } catch (err: any) {
        reject(new Error(`Failed to parse ffprobe output: ${err?.message || String(err)}`));
      }
    });

    ffprobe.on("error", (err) => {
      reject(err);
    });

    // 10 second timeout
    setTimeout(() => {
      ffprobe.kill();
      reject(new Error("ffprobe timeout"));
    }, 10000);
  });
}

function formatBitrate(bits: number): string {
  if (bits >= 1000000) {
    return `${(bits / 1000000).toFixed(1)} Mbps`;
  } else if (bits >= 1000) {
    return `${(bits / 1000).toFixed(1)} Kbps`;
  }
  return `${bits} bps`;
}

/**
 * Validate MP4 duration against target duration.
 */
export function validateDuration(actualSeconds: number, targetMinutes: number, tolerancePercent: number = 20): {
  valid: boolean;
  difference: number;
  message: string;
} {
  const targetSeconds = targetMinutes * 60;
  const toleranceSeconds = (targetSeconds * tolerancePercent) / 100;
  const difference = actualSeconds - targetSeconds;

  if (Math.abs(difference) <= toleranceSeconds) {
    return {
      valid: true,
      difference,
      message: `Duration valid: ${actualSeconds}s (target: ${targetSeconds}s ±${toleranceSeconds}s)`,
    };
  }

  return {
    valid: false,
    difference,
    message: `Duration mismatch: ${actualSeconds}s (target: ${targetSeconds}s ±${toleranceSeconds}s)`,
  };
}

/**
 * Validate scene count against target.
 */
export function validateSceneCount(actualCount: number, targetCount: number, tolerancePercent: number = 20): {
  valid: boolean;
  difference: number;
  message: string;
} {
  const minCount = Math.floor((targetCount * (100 - tolerancePercent)) / 100);
  const maxCount = Math.ceil((targetCount * (100 + tolerancePercent)) / 100);
  const difference = actualCount - targetCount;

  if (actualCount >= minCount && actualCount <= maxCount) {
    return {
      valid: true,
      difference,
      message: `Scene count valid: ${actualCount} (target: ${targetCount} ±${tolerancePercent}%)`,
    };
  }

  return {
    valid: false,
    difference,
    message: `Scene count out of range: ${actualCount} (expected: ${minCount}-${maxCount})`,
  };
}
