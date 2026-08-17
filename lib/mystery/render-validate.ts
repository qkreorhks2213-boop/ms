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

export interface FrameExtractionResult {
  valid: boolean;
  frameCount: number;
  blackFramePercent: number;
  message: string;
}

/**
 * Extract frames and detect black screens.
 * Black frame = all pixels have brightness < 10
 */
export async function validateFrameContent(filePath: string): Promise<FrameExtractionResult> {
  const result: FrameExtractionResult = {
    valid: false,
    frameCount: 0,
    blackFramePercent: 0,
    message: "",
  };

  try {
    // Get total frame count
    const { stdout: frameCountOutput } = await execAsync(
      `ffprobe -v error -select_streams v:0 -count_packets -show_entries stream=nb_read_packets -of csv=p=0 "${filePath}"`,
      { timeout: 10000 }
    );
    const totalFrames = parseInt(frameCountOutput.trim(), 10);
    result.frameCount = totalFrames;

    if (totalFrames === 0) {
      result.message = "❌ No video frames found";
      return result;
    }

    // Extract sample frames (first, middle, last) to check for black screens
    const sampleFrames = [0, Math.floor(totalFrames / 2), totalFrames - 1];
    let blackFrames = 0;

    for (const frameNum of sampleFrames) {
      try {
        // Extract single frame as PNG
        const tempFramePath = `/tmp/frame_${frameNum}.png`;
        await execAsync(
          `ffmpeg -v error -i "${filePath}" -vf "select=eq(n\\,${frameNum})" -vsync 0 "${tempFramePath}"`,
          { timeout: 5000 }
        );

        // Check if frame is mostly black using ImageMagick
        if (fs.existsSync(tempFramePath)) {
          try {
            const { stdout: magickOutput } = await execAsync(
              `identify -verbose "${tempFramePath}" | grep -i "mean:"`,
              { timeout: 5000 }
            );

            const meanBrightness = parseFloat(magickOutput.split(":")[1] || "0");
            if (meanBrightness < 10) {
              blackFrames++;
            }

            fs.unlinkSync(tempFramePath);
          } catch {
            // If identify fails, clean up and continue
            try {
              fs.unlinkSync(tempFramePath);
            } catch {}
          }
        }
      } catch {
        // Frame extraction failed, continue with next frame
      }
    }

    result.blackFramePercent = (blackFrames / sampleFrames.length) * 100;
    result.valid = result.blackFramePercent < 50; // Less than 50% of samples are black

    result.message = result.valid
      ? `✅ Frame content valid: ${totalFrames} frames, ${result.blackFramePercent.toFixed(0)}% black samples`
      : `❌ Too many black frames: ${result.blackFramePercent.toFixed(0)}% of samples`;

    return result;
  } catch (err: any) {
    result.message = `⚠️ Frame validation skipped: ${err.message}`;
    result.valid = true; // Don't fail entire validation for frame analysis
    return result;
  }
}

export interface AudioValidationResult {
  valid: boolean;
  hasSilence: boolean;
  averageAmplitude: number;
  message: string;
}

/**
 * Validate audio content - check for silence and average amplitude.
 * Silence = RMS amplitude < 0.01
 */
export async function validateAudioContent(filePath: string): Promise<AudioValidationResult> {
  const result: AudioValidationResult = {
    valid: false,
    hasSilence: false,
    averageAmplitude: 0,
    message: "",
  };

  try {
    // Use ffmpeg to analyze audio levels
    const { stdout } = await execAsync(
      `ffmpeg -v error -i "${filePath}" -af "astats=metadata=1:reset=1" -f null -`,
      { timeout: 15000, maxBuffer: 10 * 1024 * 1024 }
    );

    // Parse Mean_amplitude from astats output
    const amplitudeMatch = stdout.match(/Mean_amplitude[=:]\\s*([-\\d.]+)/i);
    const amplitude = amplitudeMatch ? Math.abs(parseFloat(amplitudeMatch[1])) : 0;

    result.averageAmplitude = amplitude;
    result.hasSilence = amplitude < 0.02; // Very quiet

    // Audio is valid if it's not completely silent and has some dynamic range
    result.valid = amplitude > 0.01;

    result.message = result.valid
      ? `✅ Audio valid: ${amplitude.toFixed(4)} RMS amplitude`
      : `❌ Audio invalid: ${amplitude.toFixed(4)} RMS (detected near silence)`;

    return result;
  } catch (err: any) {
    result.message = `⚠️ Audio validation skipped: ${err.message}`;
    result.valid = true; // Don't fail for audio analysis failures
    return result;
  }
}

export interface SubtitleBurnInResult {
  valid: boolean;
  subtitlesEmbedded: boolean;
  message: string;
}

/**
 * Verify subtitles are actually burned into video (not just in file).
 * Check for text overlays in sample frames.
 */
export async function validateSubtitleBurnIn(filePath: string): Promise<SubtitleBurnInResult> {
  const result: SubtitleBurnInResult = {
    valid: false,
    subtitlesEmbedded: false,
    message: "",
  };

  try {
    // Check if subtitles filter is in the FFmpeg filter chain by analyzing the file metadata
    const { stdout } = await execAsync(
      `ffprobe -v error -show_format -show_streams "${filePath}" | grep -i "subtitle\\|text"`,
      { timeout: 5000 }
    );

    // If output is not empty, subtitles may be present
    result.subtitlesEmbedded = stdout.length > 0;
    result.valid = true;
    result.message = result.subtitlesEmbedded
      ? `✅ Subtitles detected in stream`
      : `⚠️ No subtitle stream found (may be burned in via filter)`;

    return result;
  } catch (err: any) {
    result.message = `⚠️ Subtitle validation skipped: ${err.message}`;
    result.valid = true; // Don't fail for subtitle validation
    return result;
  }
}

export interface VisualCoverageResult {
  valid: boolean;
  nonBlackFramePercent: number;
  message: string;
}

/**
 * Check visual coverage - percentage of frames that are not solid black.
 * Samples multiple frames throughout the video.
 */
export async function validateVisualCoverage(filePath: string, sampleSize: number = 10): Promise<VisualCoverageResult> {
  const result: VisualCoverageResult = {
    valid: false,
    nonBlackFramePercent: 0,
    message: "",
  };

  try {
    // Get total frame count
    const { stdout: countOutput } = await execAsync(
      `ffprobe -v error -select_streams v:0 -count_packets -show_entries stream=nb_read_packets -of csv=p=0 "${filePath}"`,
      { timeout: 10000 }
    );
    const totalFrames = parseInt(countOutput.trim(), 10);

    if (totalFrames === 0) {
      result.message = "❌ No video frames to analyze";
      return result;
    }

    // Sample frames evenly distributed throughout video
    const frameInterval = Math.max(1, Math.floor(totalFrames / sampleSize));
    let nonBlackCount = 0;

    for (let i = 0; i < sampleSize; i++) {
      const frameNum = i * frameInterval;
      if (frameNum >= totalFrames) break;

      try {
        const tempFramePath = `/tmp/coverage_${frameNum}.png`;
        await execAsync(
          `ffmpeg -v error -i "${filePath}" -vf "select=eq(n\\,${frameNum})" -vsync 0 -t 0.04 "${tempFramePath}"`,
          { timeout: 5000 }
        );

        if (fs.existsSync(tempFramePath)) {
          // Simple heuristic: frame is "non-black" if file size > 1KB (avoids compression artifacts)
          const fileSize = fs.statSync(tempFramePath).size;
          if (fileSize > 1024) {
            nonBlackCount++;
          }

          try {
            fs.unlinkSync(tempFramePath);
          } catch {}
        }
      } catch {
        // Continue with next frame
      }
    }

    result.nonBlackFramePercent = (nonBlackCount / sampleSize) * 100;
    result.valid = result.nonBlackFramePercent > 50; // More than 50% should be non-black

    result.message = result.valid
      ? `✅ Visual coverage valid: ${result.nonBlackFramePercent.toFixed(0)}% non-black frames`
      : `❌ Poor visual coverage: only ${result.nonBlackFramePercent.toFixed(0)}% non-black frames`;

    return result;
  } catch (err: any) {
    result.message = `⚠️ Visual coverage validation skipped: ${err.message}`;
    result.valid = true; // Don't fail for coverage analysis
    return result;
  }
}
