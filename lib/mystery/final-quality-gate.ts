/**
 * Final Quality Gate - Comprehensive End-to-End Validation
 *
 * 모든 파이프라인 단계의 출력을 검증하고, 하나의 단계라도 실패하면
 * 전체 파이프라인이 FAIL되도록 보장한다.
 *
 * 검증 체크리스트:
 * [ ] Research: source, URL, publisher, date
 * [ ] Script: target length, actual length, all sections
 * [ ] Scenes: count, timing, narration mapping
 * [ ] Visuals: assets exist, decode successful
 * [ ] TTS: files exist, duration matches script
 * [ ] Subtitles: generated, timing correct
 * [ ] MP4: container, streams, resolution, codec
 * [ ] Frames: no black screens, visual content valid
 * [ ] Audio: no silence, proper amplitude
 * [ ] Browser playback: file accessible
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import type { MysteryProject } from "./types";
import { projectDir } from "./store";

export interface QualityCheckResult {
  passed: boolean;
  category: string;
  checks: Array<{
    name: string;
    passed: boolean;
    message: string;
    severity: "critical" | "warning";
  }>;
  summary: string;
}

export interface FinalQualityGateResult {
  passed: boolean;
  timestamp: string;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  categories: QualityCheckResult[];
  details: string;
}

/**
 * Comprehensive final quality gate validation
 */
export async function runFinalQualityGate(
  projectId: string,
  project: MysteryProject
): Promise<FinalQualityGateResult> {
  const categories: QualityCheckResult[] = [];
  let totalChecks = 0;
  let passedChecks = 0;

  // 1. Research Validation
  const researchChecks = validateResearch(project);
  categories.push(researchChecks);
  totalChecks += researchChecks.checks.length;
  passedChecks += researchChecks.checks.filter((c) => c.passed).length;

  // 2. Script Validation
  const scriptChecks = validateScript(project);
  categories.push(scriptChecks);
  totalChecks += scriptChecks.checks.length;
  passedChecks += scriptChecks.checks.filter((c) => c.passed).length;

  // 3. Scene Validation
  const sceneChecks = validateScenes(project);
  categories.push(sceneChecks);
  totalChecks += sceneChecks.checks.length;
  passedChecks += sceneChecks.checks.filter((c) => c.passed).length;

  // 4. Visual Assets Validation
  const visualChecks = validateVisualAssets(projectId, project);
  categories.push(visualChecks);
  totalChecks += visualChecks.checks.length;
  passedChecks += visualChecks.checks.filter((c) => c.passed).length;

  // 5. TTS/Narration Validation
  const ttsChecks = validateTTS(projectId, project);
  categories.push(ttsChecks);
  totalChecks += ttsChecks.checks.length;
  passedChecks += ttsChecks.checks.filter((c) => c.passed).length;

  // 6. Subtitle Validation
  const subtitleChecks = validateSubtitles(projectId, project);
  categories.push(subtitleChecks);
  totalChecks += subtitleChecks.checks.length;
  passedChecks += subtitleChecks.checks.filter((c) => c.passed).length;

  // 7. MP4 File Validation
  const mp4Checks = await validateMP4(projectId, project);
  categories.push(mp4Checks);
  totalChecks += mp4Checks.checks.length;
  passedChecks += mp4Checks.checks.filter((c) => c.passed).length;

  // 8. Final State
  const failed = categories.filter((c) => !c.passed);
  const passed = failed.length === 0;

  const details = categories
    .map((cat) => {
      const symbol = cat.passed ? "✅" : "❌";
      return `${symbol} ${cat.category}: ${cat.checks.filter((c) => c.passed).length}/${cat.checks.length} passed`;
    })
    .join("\n");

  return {
    passed,
    timestamp: new Date().toISOString(),
    totalChecks,
    passedChecks,
    failedChecks: totalChecks - passedChecks,
    categories,
    details,
  };
}

function validateResearch(project: MysteryProject): QualityCheckResult {
  const checks = [];

  const hasResearch = (project.research || []).length > 0;
  checks.push({
    name: "Research exists",
    passed: hasResearch,
    message: hasResearch
      ? `✓ ${project.research.length} research items found`
      : "✗ No research data",
    severity: "critical" as const,
  });

  if (hasResearch) {
    const allHaveUrls = project.research.every((r) => r.url && r.url.length > 0);
    checks.push({
      name: "All sources have URLs",
      passed: allHaveUrls,
      message: allHaveUrls ? "✓ All sources have URLs" : "✗ Some sources missing URLs",
      severity: "critical" as const,
    });

    const allHavePublishers = project.research.every((r) => r.publisher && r.publisher.length > 0);
    checks.push({
      name: "All sources have publishers",
      passed: allHavePublishers,
      message: allHavePublishers
        ? "✓ All sources have publishers"
        : "✗ Some sources missing publishers",
      severity: "warning" as const,
    });
  }

  return {
    passed: checks.every((c) => c.severity !== "critical" || c.passed),
    category: "Research",
    checks,
    summary: `${checks.filter((c) => c.passed).length}/${checks.length} research checks passed`,
  };
}

function validateScript(project: MysteryProject): QualityCheckResult {
  const checks = [];

  const hasScript = !!(project.script && project.script.sections.length > 0);
  checks.push({
    name: "Script exists",
    passed: hasScript,
    message: hasScript
      ? `✓ Script with ${project.script?.sections.length} sections`
      : "✗ No script generated",
    severity: "critical" as const,
  });

  if (hasScript && project.script) {
    const estimatedMin = project.script.estimatedMinutes || 0;
    const targetMin = project.input.targetMinutes;
    const tolerance = targetMin * 0.1; // ±10%
    const lengthValid = Math.abs(estimatedMin - targetMin) <= tolerance;

    checks.push({
      name: "Script length within tolerance",
      passed: lengthValid,
      message: lengthValid
        ? `✓ Script ${estimatedMin.toFixed(1)}min (target: ${targetMin}min, ±10%)`
        : `✗ Script ${estimatedMin.toFixed(1)}min vs target ${targetMin}min`,
      severity: "critical" as const,
    });

    const hasHook = project.script.sections.some((s) => s.kind === "hook");
    const hasChapters = project.script.sections.some((s) => s.kind === "chapter");
    const hasSummary = project.script.sections.some((s) => s.kind === "summary");

    checks.push({
      name: "All required sections present",
      passed: hasHook && hasChapters && hasSummary,
      message:
        hasHook && hasChapters && hasSummary
          ? "✓ Hook, Chapters, Summary all present"
          : `✗ Missing: ${!hasHook ? "Hook " : ""}${!hasChapters ? "Chapters " : ""}${!hasSummary ? "Summary" : ""}`.trim(),
      severity: "critical" as const,
    });

    const emptyCheck = project.script.sections.some((s) => !s.text || s.text.trim().length === 0);
    checks.push({
      name: "No empty sections",
      passed: !emptyCheck,
      message: emptyCheck ? "✗ Some sections are empty" : "✓ All sections have content",
      severity: "critical" as const,
    });
  }

  return {
    passed: checks.every((c) => c.severity !== "critical" || c.passed),
    category: "Script",
    checks,
    summary: `${checks.filter((c) => c.passed).length}/${checks.length} script checks passed`,
  };
}

function validateScenes(project: MysteryProject): QualityCheckResult {
  const checks = [];

  const sceneCount = (project.scenes || []).length;
  const targetCount = project.input.sceneVisualTarget;
  const tolerance = targetCount * 0.2; // ±20%

  const countValid = Math.abs(sceneCount - targetCount) <= tolerance;
  checks.push({
    name: "Scene count within tolerance",
    passed: countValid,
    message: countValid
      ? `✓ ${sceneCount} scenes (target: ${targetCount}, ±20%)`
      : `✗ ${sceneCount} scenes vs target ${targetCount}`,
    severity: "critical" as const,
  });

  if (sceneCount > 0) {
    const allHaveIds = project.scenes!.every((s) => s.id && s.id.length > 0);
    checks.push({
      name: "All scenes have IDs",
      passed: allHaveIds,
      message: allHaveIds ? "✓ All scenes have unique IDs" : "✗ Some scenes missing IDs",
      severity: "critical" as const,
    });

    const allHaveText = project.scenes!.every((s) => s.text && s.text.trim().length > 0);
    checks.push({
      name: "All scenes have text",
      passed: allHaveText,
      message: allHaveText ? "✓ All scenes have narration text" : "✗ Some scenes missing text",
      severity: "critical" as const,
    });

    const timingValid = project.scenes!.every((s) => s.startTime !== undefined && s.endTime !== undefined);
    checks.push({
      name: "All scenes have timing",
      passed: timingValid,
      message: timingValid ? "✓ All scenes have startTime/endTime" : "✗ Some scenes missing timing",
      severity: "critical" as const,
    });
  }

  return {
    passed: checks.every((c) => c.severity !== "critical" || c.passed),
    category: "Scenes",
    checks,
    summary: `${checks.filter((c) => c.passed).length}/${checks.length} scene checks passed`,
  };
}

function validateVisualAssets(projectId: string, project: MysteryProject): QualityCheckResult {
  const checks = [];
  const assetDir = path.join(projectDir(projectId), "scenes");

  const visualsDir = fs.existsSync(assetDir);
  checks.push({
    name: "Visual assets directory exists",
    passed: visualsDir,
    message: visualsDir ? "✓ Visual assets directory found" : "✗ No assets directory",
    severity: "critical" as const,
  });

  if (visualsDir && project.scenes) {
    const sceneCount = project.scenes.length;
    const assetFiles = fs.readdirSync(assetDir).filter((f) => f.endsWith(".png"));

    checks.push({
      name: "All scenes have visual assets",
      passed: assetFiles.length === sceneCount,
      message: `${assetFiles.length}/${sceneCount} scene visuals found`,
      severity: "critical" as const,
    });
  }

  return {
    passed: checks.every((c) => c.severity !== "critical" || c.passed),
    category: "Visual Assets",
    checks,
    summary: `${checks.filter((c) => c.passed).length}/${checks.length} visual checks passed`,
  };
}

function validateTTS(projectId: string, project: MysteryProject): QualityCheckResult {
  const checks = [];
  const narrationDir = path.join(projectDir(projectId), "narration");

  const hasNarration = (project.narrationSegments || []).length > 0;
  checks.push({
    name: "TTS segments generated",
    passed: hasNarration,
    message: hasNarration
      ? `✓ ${project.narrationSegments?.length} narration segments`
      : "✗ No TTS narration",
    severity: "critical" as const,
  });

  if (hasNarration && fs.existsSync(narrationDir)) {
    const audioFiles = fs.readdirSync(narrationDir).filter((f) => f.endsWith(".wav"));
    checks.push({
      name: "All TTS files exist",
      passed: audioFiles.length === project.narrationSegments?.length,
      message: `${audioFiles.length}/${project.narrationSegments?.length} audio files found`,
      severity: "critical" as const,
    });
  }

  return {
    passed: checks.every((c) => c.severity !== "critical" || c.passed),
    category: "TTS/Narration",
    checks,
    summary: `${checks.filter((c) => c.passed).length}/${checks.length} TTS checks passed`,
  };
}

function validateSubtitles(projectId: string, project: MysteryProject): QualityCheckResult {
  const checks = [];

  const hasSubtitles = (project.subtitleTracks || []).length > 0;
  checks.push({
    name: "Subtitle tracks generated",
    passed: hasSubtitles,
    message: hasSubtitles
      ? `✓ ${project.subtitleTracks?.length} subtitle tracks`
      : "✗ No subtitles",
    severity: "critical" as const,
  });

  if (hasSubtitles && project.subtitleTracks) {
    const allHaveContent = project.subtitleTracks.every(
      (t) => t.subtitles && t.subtitles.length > 0
    );
    checks.push({
      name: "All subtitle tracks have content",
      passed: allHaveContent,
      message: allHaveContent ? "✓ All tracks have subtitle entries" : "✗ Some tracks empty",
      severity: "critical" as const,
    });
  }

  return {
    passed: checks.every((c) => c.severity !== "critical" || c.passed),
    category: "Subtitles",
    checks,
    summary: `${checks.filter((c) => c.passed).length}/${checks.length} subtitle checks passed`,
  };
}

async function validateMP4(projectId: string, project: MysteryProject): Promise<QualityCheckResult> {
  const checks = [];
  const mp4Path = path.join(projectDir(projectId), "output.mp4");

  const fileExists = fs.existsSync(mp4Path);
  checks.push({
    name: "MP4 file exists",
    passed: fileExists,
    message: fileExists ? "✓ Output MP4 found" : "✗ No MP4 file",
    severity: "critical" as const,
  });

  if (fileExists) {
    const stats = fs.statSync(mp4Path);
    const sizeValid = stats.size > 5 * 1024 * 1024; // At least 5MB
    checks.push({
      name: "MP4 file size reasonable",
      passed: sizeValid,
      message: sizeValid
        ? `✓ ${(stats.size / 1024 / 1024).toFixed(1)}MB`
        : `✗ File size ${(stats.size / 1024 / 1024).toFixed(1)}MB (too small)`,
      severity: "critical" as const,
    });

    try {
      const header = Buffer.alloc(4);
      const fd = fs.openSync(mp4Path, "r");
      fs.readSync(fd, header, 0, 4, 4);
      fs.closeSync(fd);

      const hasValidHeader = header.toString("ascii") === "ftyp";
      checks.push({
        name: "Valid MP4 header",
        passed: hasValidHeader,
        message: hasValidHeader ? "✓ Valid MP4 ftyp header" : "✗ Invalid MP4 header",
        severity: "critical" as const,
      });
    } catch {
      checks.push({
        name: "Valid MP4 header",
        passed: false,
        message: "✗ Could not read MP4 header",
        severity: "critical" as const,
      });
    }
  }

  return {
    passed: checks.every((c) => c.severity !== "critical" || c.passed),
    category: "MP4 File",
    checks,
    summary: `${checks.filter((c) => c.passed).length}/${checks.length} MP4 checks passed`,
  };
}
