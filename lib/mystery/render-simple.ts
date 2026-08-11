/**
 * Simplified rendering for E2E testing
 * Creates a real MP4 file from script sections
 */

import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { readProject, updateProject, publicGeneratedDir } from "./store";
import type { MysteryProject } from "./types";

const TARGET_WIDTH = 640;
const TARGET_HEIGHT = 360;
const TARGET_FPS = 24;

async function generateTestVideo(projectId: string, project: MysteryProject): Promise<void> {
  const sections = project.script?.sections || [];
  if (sections.length === 0) {
    throw new Error("No script sections to render");
  }

  const projectDir = path.join(process.cwd(), "data", "mystery-projects", projectId);
  const outputPath = path.join(projectDir, "output.mp4");

  console.log(`[render] Generating MP4 with ${sections.length} sections...`);

  // Calculate total duration (assuming ~60 chars per second)
  const totalChars = sections.reduce((sum, s) => sum + s.charCount, 0);
  const totalSeconds = Math.ceil(totalChars / 60);
  const sectionDuration = totalSeconds / sections.length;

  // Create a simple black background video with text overlay
  const filterComplex = sections
    .map((section, idx) => {
      const startTime = idx * sectionDuration;
      const endTime = startTime + sectionDuration;
      const displayText = section.text.replace(/'/g, "\\'").slice(0, 150);
      return `drawtext=text='${displayText}':fontsize=16:fontcolor=white:x=20:y=20:w=600:h=320:enable='between(t,${startTime},${endTime})'`;
    })
    .join(",");

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-f", "lavfi",
      "-i", `color=c=black:s=${TARGET_WIDTH}x${TARGET_HEIGHT}:d=${totalSeconds}`,
      "-vf", filterComplex,
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-pix_fmt", "yuv420p",
      "-y",
      outputPath,
    ]);

    let stderr = "";
    ffmpeg.stderr.on("data", (data) => {
      stderr += data;
    });

    ffmpeg.on("close", (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        console.log(`[render] MP4 created successfully: ${outputPath}`);
        resolve();
      } else {
        reject(new Error(`FFmpeg failed: ${stderr.slice(-500)}`));
      }
    });
  });
}

export async function renderMysteryVideo(projectId: string, project: MysteryProject): Promise<void> {
  try {
    await generateTestVideo(projectId, project);

    updateProject(projectId, (p) => {
      p.stage = "done";
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
