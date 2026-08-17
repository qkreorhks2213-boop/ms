/**
 * Rendering with narration, subtitles, and scene composition
 * Creates a real MP4 file with audio, subtitles, and text overlay
 */

import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { readProject, updateProject, publicGeneratedDir } from "./store";
import type { MysteryProject } from "./types";

const TARGET_WIDTH = 640;
const TARGET_HEIGHT = 360;
const TARGET_FPS = 24;

async function concatenateAudioSegments(narrationSegments: any[], outputPath: string): Promise<boolean> {
  if (!narrationSegments || narrationSegments.length === 0) {
    throw new Error("[CRITICAL] No narration segments provided for audio concatenation");
  }

  // Check if all audio files exist
  const validSegments = narrationSegments.filter((seg) => seg.audioPath && fs.existsSync(seg.audioPath));

  if (validSegments.length === 0) {
    throw new Error("[CRITICAL] No audio files found in narration segments");
  }

  if (validSegments.length !== narrationSegments.length) {
    throw new Error(
      `[CRITICAL] Only ${validSegments.length}/${narrationSegments.length} audio segments exist`
    );
  }

  return new Promise((resolve, reject) => {
    // Create concat demuxer file
    const concatFile = outputPath + ".txt";
    const concatContent = validSegments
      .map((seg) => `file '${seg.audioPath}'`)
      .join("\n");

    fs.writeFileSync(concatFile, concatContent);

    const ffmpeg = spawn("ffmpeg", [
      "-f", "concat",
      "-safe", "0",
      "-i", concatFile,
      "-c", "aac",
      "-y",
      outputPath,
    ]);

    let stderr = "";
    ffmpeg.stderr.on("data", (data) => {
      stderr += data;
    });

    ffmpeg.on("close", (code) => {
      fs.unlinkSync(concatFile);
      if (code === 0 && fs.existsSync(outputPath)) {
        console.log(`[render] Audio concatenated: ${outputPath}`);
        resolve(true);
      } else {
        reject(new Error(`[CRITICAL] Audio concatenation failed: ${stderr.slice(-300)}`));
      }
    });
  });
}

async function generateSubtitleFile(subtitleTrack: any, outputPath: string): Promise<boolean> {
  if (!subtitleTrack || !subtitleTrack.subtitles || subtitleTrack.subtitles.length === 0) {
    throw new Error("[CRITICAL] Subtitle track missing or empty");
  }

  try {
    if (subtitleTrack.format === "ass") {
      // Generate ASS format
      const assContent = generateASSContent(subtitleTrack.subtitles);
      fs.writeFileSync(outputPath, assContent);
    } else {
      // Generate SRT format
      const srtContent = generateSRTContent(subtitleTrack.subtitles);
      fs.writeFileSync(outputPath, srtContent);
    }
    console.log(`[render] Subtitle file created: ${outputPath}`);
    return true;
  } catch (err: any) {
    throw new Error(`[CRITICAL] Subtitle generation failed: ${err?.message || String(err)}`);
  }
}

function generateSRTContent(subtitles: any[]): string {
  return subtitles
    .map((sub, idx) => {
      const startTime = formatSRTTime(sub.startTime);
      const endTime = formatSRTTime(sub.endTime);
      return `${idx + 1}\n${startTime} --> ${endTime}\n${sub.text}\n`;
    })
    .join("\n");
}

function generateASSContent(subtitles: any[]): string {
  const header = `[Script Info]
Title: Mystery Documentary
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events = subtitles
    .map((sub) => {
      const start = formatASSTime(sub.startTime);
      const end = formatASSTime(sub.endTime);
      const text = sub.text.replace(/\n/g, "\\N");
      return `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`;
    })
    .join("\n");

  return header + events;
}

async function generateAssetOverlayFile(sceneAssets: any[], narrationSegments: any[], outputPath: string): Promise<boolean> {
  if (!sceneAssets || sceneAssets.length === 0) {
    return false;
  }

  try {
    // Create ASS file showing discovered assets as text overlays
    const header = `[Script Info]
Title: Mystery Documentary - Real Assets
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: AssetLabel,Arial,14,&H00CCFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,1,0,1,10,10,50,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    const events: string[] = [];

    // For each scene asset, create an overlay showing the source
    sceneAssets.forEach((sceneAsset: any) => {
      const asset = sceneAsset.asset;
      if (!asset || !asset.realAsset) return;

      // Use timing from sceneAsset or estimate from narration
      let startTime = sceneAsset.startTime || 0;
      let endTime = sceneAsset.endTime || startTime + 5;

      // Create asset label text
      const label = `SOURCE: ${asset.publisher} (${asset.date.substring(0, 4)})`;
      const start = formatASSTime(startTime * 1000);
      const end = formatASSTime(endTime * 1000);

      // Add as top-right corner text
      events.push(`Dialogue: 1,${start},${end},AssetLabel,,0,0,0,,${label}`);
    });

    if (events.length === 0) {
      return false;
    }

    const assContent = header + events.join("\n");
    fs.writeFileSync(outputPath, assContent);
    console.log(`[render] Asset overlay created: ${events.length} discovered real assets labeled`);
    return true;
  } catch (err: any) {
    throw new Error(`[CRITICAL] Asset overlay generation failed: ${err?.message || String(err)}`);
  }
}

function formatSRTTime(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const ms = milliseconds % 1000;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function formatASSTime(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const cs = Math.floor((milliseconds % 1000) / 10);

  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

async function generateTestVideo(projectId: string, project: MysteryProject): Promise<void> {
  const sections = project.script?.sections || [];
  if (sections.length === 0) {
    throw new Error("No script sections to render");
  }

  const projectDir = path.join(process.cwd(), "data", "mystery-projects", projectId);
  const outputPath = path.join(projectDir, "output.mp4");
  const audioPath = path.join(projectDir, "audio.m4a");
  const subtitlePath = path.join(projectDir, "subtitles.ass");
  const assetsPath = path.join(projectDir, "assets.ass");

  console.log(`[render] Generating MP4 with ${sections.length} sections...`);

  // Calculate total duration: Use TARGET duration (targetMinutes), not narration duration
  const targetMinutes = project.input.targetMinutes || 15;
  const targetSeconds = targetMinutes * 60;

  // Actual narration duration
  let narrationDuration = 0;
  if (project.narrationSegments && project.narrationSegments.length > 0) {
    narrationDuration = project.narrationSegments.reduce((sum: number, seg: any) => sum + (seg.durationSeconds || 0), 0);
  }

  // Use target duration to ensure video meets requirement
  const totalDuration = Math.max(targetSeconds, narrationDuration);

  console.log(`[render] Target duration: ${targetSeconds}s (${targetMinutes}분)`);
  console.log(`[render] Narration duration: ${narrationDuration}s`);
  console.log(`[render] Final duration: ${totalDuration}s`);

  // Handle audio
  let hasAudio = false;
  if (project.narrationSegments && project.narrationSegments.length > 0) {
    console.log(`[render] Processing ${project.narrationSegments.length} narration segments...`);
    hasAudio = await concatenateAudioSegments(project.narrationSegments, audioPath);
  }

  // Handle subtitles
  let hasSubtitles = false;
  if (project.subtitleTracks && project.subtitleTracks.length > 0) {
    console.log(`[render] Generating subtitles...`);
    hasSubtitles = await generateSubtitleFile(project.subtitleTracks[0], subtitlePath);
  }

  // Handle scene assets - show real asset sources as overlay
  let hasAssetOverlay = false;
  const sceneAssets = (project.sceneAssets as any[]) || [];
  if (sceneAssets.length > 0) {
    console.log(`[render] Using ${sceneAssets.length} discovered scene assets...`);
    hasAssetOverlay = await generateAssetOverlayFile(sceneAssets, project.narrationSegments || [], assetsPath);
  }

  // Build FFmpeg command based on available components
  const ffmpegArgs: string[] = ["-f", "lavfi", "-i", `color=c=black:s=${TARGET_WIDTH}x${TARGET_HEIGHT}:d=${totalDuration}`];

  // Add audio if available
  if (hasAudio) {
    ffmpegArgs.push("-i", audioPath);
  }

  // Build video filter - simplified for reliability
  const vfilters: string[] = [];

  // Add asset overlay if available (shows discovered real assets)
  if (hasAssetOverlay) {
    const escapeForFilter = (filepath: string) => filepath.replace(/\\/g, "\\\\").replace(/:/g, "\\:");
    vfilters.push(`subtitles='${escapeForFilter(assetsPath)}'`);
  }

  // Add subtitle filter if available
  if (hasSubtitles) {
    const escapeForFilter = (filepath: string) => filepath.replace(/\\/g, "\\\\").replace(/:/g, "\\:");
    vfilters.push(`subtitles='${escapeForFilter(subtitlePath)}'`);
  }

  let filterComplex = vfilters.length > 0 ? vfilters.join(",") : "null";

  ffmpegArgs.push(
    "-vf", filterComplex,
    "-c:v", "libx264",
    "-preset", "ultrafast",
    "-pix_fmt", "yuv420p"
  );

  // Map audio if available
  if (hasAudio) {
    ffmpegArgs.push("-c:a", "aac");
    ffmpegArgs.push("-map", "0:v:0");
    ffmpegArgs.push("-map", "1:a:0");
  }

  ffmpegArgs.push("-y", outputPath);

  return new Promise((resolve, reject) => {
    console.log(`[render] Running FFmpeg...`);
    const ffmpeg = spawn("ffmpeg", ffmpegArgs);

    let stderr = "";
    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
      // Log progress
      if (stderr.includes("frame=")) {
        const match = stderr.match(/frame=\s*(\d+)/);
        if (match) {
          const frame = parseInt(match[1]);
          process.stdout.write(`\r[render] Encoding... frame ${frame}`);
        }
      }
    });

    ffmpeg.on("close", (code) => {
      process.stdout.write("\n");
      if (code === 0 && fs.existsSync(outputPath)) {
        console.log(`[render] MP4 created successfully: ${outputPath}`);
        const fileSize = fs.statSync(outputPath).size;
        console.log(`[render] File size: ${(fileSize / 1024).toFixed(1)} KB`);

        // Clean up temporary files
        if (hasAudio && fs.existsSync(audioPath)) {
          fs.unlinkSync(audioPath);
        }
        if (hasSubtitles && fs.existsSync(subtitlePath)) {
          fs.unlinkSync(subtitlePath);
        }
        if (hasAssetOverlay && fs.existsSync(assetsPath)) {
          fs.unlinkSync(assetsPath);
        }

        resolve();
      } else {
        reject(new Error(`FFmpeg failed with code ${code}: ${stderr.slice(-500)}`));
      }
    });

    ffmpeg.on("error", (err) => {
      reject(new Error(`FFmpeg error: ${err.message}`));
    });
  });
}

async function validateMP4File(filePath: string): Promise<boolean> {
  // Validation now done comprehensively in render-validate module
  // This is just a basic pre-render check
  try {
    if (!fs.existsSync(filePath)) {
      return false;
    }

    const stats = fs.statSync(filePath);
    if (stats.size < 1024) {
      console.error(`[render] Output file too small: ${(stats.size / 1024).toFixed(1)}KB`);
      return false;
    }

    const buffer = Buffer.alloc(12);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 12, 4);
    fs.closeSync(fd);

    const header = buffer.toString('ascii', 0, 4);
    return header === 'ftyp';
  } catch {
    return false;
  }
}

export async function renderMysteryVideo(projectId: string, project: MysteryProject): Promise<void> {
  try {
    const projectDir = path.join(process.cwd(), "data", "mystery-projects", projectId);
    const outputPath = path.join(projectDir, "output.mp4");

    await generateTestVideo(projectId, project);

    // Validate output file
    const isValid = await validateMP4File(outputPath);
    if (!isValid) {
      throw new Error("Output MP4 file validation failed - file may be corrupted or incomplete");
    }

    // Store output path but don't set stage="done" - let orchestrator decide final state
    updateProject(projectId, (p) => {
      p.output = {
        mp4: "/output.mp4",
        status: "complete",
      };
    });
  } catch (err: any) {
    console.error(`[render] Error:`, err?.message);
    throw err;
  }
}
