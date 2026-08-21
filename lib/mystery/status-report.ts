/**
 * Comprehensive Status Report Generation
 * Generates final validation report for E2E pipeline execution
 */

import type { MysteryProject } from "./types";

export interface PipelineStageStatus {
  stage: string;
  status: "PASS" | "PARTIAL" | "FAIL" | "SKIPPED";
  details: string;
  itemsProcessed?: number;
  itemsFailed?: number;
}

export interface FinalStatusReport {
  timestamp: string;
  projectId: string;
  projectName: string;

  // Overall status
  currentStage?: string;
  overallStatus: "PASS" | "PARTIAL" | "FAIL";
  pipelineComplete: boolean;

  // Build & Environment
  build: "PASS" | "FAIL";
  apiStatus: Record<string, "READY" | "OPTIONAL" | "MISSING">;

  // Pipeline execution
  stages: PipelineStageStatus[];
  totalDuration?: number;

  // Content validation
  research: {
    status: "PASS" | "PARTIAL" | "FAIL";
    findingsCount: number;
    sourcesCount: number;
  };

  script: {
    status: "PASS" | "PARTIAL" | "FAIL";
    sectionsCount: number;
    totalChars: number;
    estimatedMinutes: number;
  };

  scenes: {
    status: "PASS" | "PARTIAL" | "FAIL";
    scenesCount: number;
    realAssetsCount: number;
    aiGeneratedCount: number;
  };

  narration: {
    status: "PASS" | "PARTIAL" | "FAIL" | "SKIPPED";
    segmentsCount: number;
    totalDuration?: number;
    available: boolean;
  };

  subtitles: {
    status: "PASS" | "PARTIAL" | "FAIL" | "SKIPPED";
    subtitlesCount: number;
    verifiedCount: number;
    available: boolean;
  };

  render: {
    status: "PASS" | "FAIL";
    outputPath?: string;
    fileSizeKB?: number;
    codec?: string;
    resolution?: string;
  };

  // Source tracking
  sourcesTracked: number;
  sourceAttributionsIncluded: boolean;
  realVsAiDistribution: {
    realAssets: number;
    aiGenerated: number;
    mixed: number;
  };

  // Issues and recommendations
  issues: Array<{
    severity: "error" | "warning" | "info";
    message: string;
    stage?: string;
  }>;

  recommendations: string[];
}

export function generateStatusReport(project: MysteryProject, apiStatus: Record<string, boolean>): FinalStatusReport {
  const issues: Array<{
    severity: "error" | "warning" | "info";
    message: string;
    stage?: string;
  }> = [];

  const recommendations: string[] = [];

  // Check research phase
  const hasResearch = project.research && project.research.length > 0;
  if (!hasResearch) {
    issues.push({
      severity: "error",
      message: "No research findings found",
      stage: "research",
    });
  }

  // Check script phase
  const hasScript = project.script && project.script.sections.length > 0;
  if (!hasScript) {
    issues.push({
      severity: "error",
      message: "No script sections generated",
      stage: "script",
    });
  }

  // Check scenes phase
  const hasScenes = project.scenes && project.scenes.length > 0;
  if (!hasScenes) {
    issues.push({
      severity: "error",
      message: "No scenes created",
      stage: "scenes",
    });
  }

  // Check narration phase
  const hasNarration: boolean = !!(project.narrationSegments && project.narrationSegments.length > 0);
  if (!hasNarration) {
    issues.push({
      severity: "warning",
      message: "No narration segments generated (audio will not be included)",
      stage: "narration",
    });
    if (!apiStatus.piper) {
      recommendations.push("Install Piper TTS for voice narration: pip install piper-tts");
    }
  }

  // Check subtitles phase
  const hasSubtitles: boolean = !!(project.subtitleTracks && project.subtitleTracks.length > 0);
  if (!hasSubtitles && hasNarration) {
    issues.push({
      severity: "warning",
      message: "No subtitles generated (subtitles require narration segments)",
      stage: "subtitles",
    });
  }

  // Check render output
  const hasOutput = project.output && project.output.mp4;
  if (!hasOutput) {
    issues.push({
      severity: "error",
      message: "No MP4 output file generated",
      stage: "render",
    });
  }

  // Determine overall status
  const hasErrors = issues.some((i) => i.severity === "error");
  const overallStatus: "PASS" | "PARTIAL" | "FAIL" = hasErrors
    ? "FAIL"
    : issues.length > 0
      ? "PARTIAL"
      : "PASS";

  // Calculate asset distribution
  const sceneAssets = project.sceneAssets || [];
  const realAssets = sceneAssets.filter((a: any) => a.asset.realAsset).length;
  const aiGenerated = sceneAssets.length - realAssets;

  // Build stage results
  const stages: PipelineStageStatus[] = [
    {
      stage: "research",
      status: hasResearch ? "PASS" : "FAIL",
      details: hasResearch ? `${project.research?.length || 0} findings from ${project.research?.[0]?.sources.length || 0}+ sources` : "No research data",
      itemsProcessed: project.research?.length || 0,
    },
    {
      stage: "script",
      status: hasScript ? "PASS" : "FAIL",
      details: hasScript
        ? `${project.script?.sections.length || 0} sections, ${project.script?.totalCharCount || 0} chars, ~${project.script?.estimatedMinutes || 0}min`
        : "No script generated",
      itemsProcessed: project.script?.sections.length || 0,
    },
    {
      stage: "scenes",
      status: hasScenes ? "PASS" : "FAIL",
      details: hasScenes ? `${project.scenes?.length || 0} scenes with visual planning` : "No scenes created",
      itemsProcessed: project.scenes?.length || 0,
    },
    {
      stage: "assets",
      status: sceneAssets.length > 0 ? "PASS" : "PARTIAL",
      details: sceneAssets.length > 0
        ? `${realAssets} real assets, ${aiGenerated} AI-generated`
        : "No asset integration",
      itemsProcessed: sceneAssets.length,
    },
    {
      stage: "narration",
      status: hasNarration ? "PASS" : "SKIPPED",
      details: hasNarration
        ? `${project.narrationSegments?.length || 0} segments, ${project.narrationSegments?.reduce((sum: number, seg: any) => sum + (seg.durationSeconds || 0), 0) || 0}s total`
        : "Piper TTS not available",
      itemsProcessed: project.narrationSegments?.length || 0,
    },
    {
      stage: "subtitles",
      status: hasSubtitles ? "PASS" : "SKIPPED",
      details: hasSubtitles ? `${project.subtitleTracks?.[0]?.subtitles.length || 0} subtitles generated` : "Requires narration segments",
      itemsProcessed: project.subtitleTracks?.[0]?.subtitles.length || 0,
    },
    {
      stage: "render",
      status: hasOutput ? "PASS" : "FAIL",
      details: hasOutput ? "MP4 video file created" : "Rendering failed",
    },
  ];

  return {
    timestamp: new Date().toISOString(),
    projectId: project.id,
    projectName: project.name,

    currentStage: project.stage,
    overallStatus,
    pipelineComplete: project.stage === "done",

    build: "PASS",
    apiStatus: {
      ffmpeg: apiStatus.ffmpeg ? "READY" : "MISSING",
      piper: apiStatus.piper ? "READY" : "OPTIONAL",
      ollama: apiStatus.ollama ? "READY" : "OPTIONAL",
    },

    stages,

    research: {
      status: hasResearch ? "PASS" : "FAIL",
      findingsCount: project.research?.length || 0,
      sourcesCount: project.research?.reduce((sum, r) => sum + r.sources.length, 0) || 0,
    },

    script: {
      status: hasScript ? "PASS" : "FAIL",
      sectionsCount: project.script?.sections.length || 0,
      totalChars: project.script?.totalCharCount || 0,
      estimatedMinutes: project.script?.estimatedMinutes || 0,
    },

    scenes: {
      status: hasScenes ? "PASS" : "FAIL",
      scenesCount: project.scenes?.length || 0,
      realAssetsCount: realAssets,
      aiGeneratedCount: aiGenerated,
    },

    narration: {
      status: hasNarration ? "PASS" : project.narrationError ? "FAIL" : "SKIPPED",
      segmentsCount: project.narrationSegments?.length || 0,
      totalDuration: project.narrationSegments?.reduce((sum: number, seg: any) => sum + (seg.durationSeconds || 0), 0),
      available: hasNarration,
    },

    subtitles: {
      status: hasSubtitles ? "PASS" : hasNarration ? "FAIL" : "SKIPPED",
      subtitlesCount: project.subtitleTracks?.[0]?.subtitles.length || 0,
      verifiedCount: project.subtitleTracks?.[0]?.subtitles.filter((s: any) => s.verified).length || 0,
      available: hasSubtitles,
    },

    render: {
      status: hasOutput ? "PASS" : "FAIL",
      outputPath: project.output?.mp4,
    },

    sourcesTracked: project.research?.reduce((sum, r) => sum + r.sources.length, 0) || 0,
    sourceAttributionsIncluded: !!(hasResearch && (project.research?.[0]?.sources.length || 0) > 0),

    realVsAiDistribution: {
      realAssets,
      aiGenerated,
      mixed: 0,
    },

    issues,
    recommendations,
  };
}

export function formatStatusReportMarkdown(report: FinalStatusReport): string {
  const lines: string[] = [];

  lines.push("# Final Status Report");
  lines.push("");
  lines.push(`**Timestamp:** ${new Date(report.timestamp).toLocaleString()}`);
  lines.push(`**Project:** ${report.projectName} (${report.projectId})`);
  lines.push("");

  // Overall status
  lines.push("## Overall Status");
  lines.push(`**Status:** ${report.overallStatus === "PASS" ? "✅ PASS" : report.overallStatus === "PARTIAL" ? "⚠️ PARTIAL" : "❌ FAIL"}`);
  lines.push(`**Pipeline Complete:** ${report.pipelineComplete ? "Yes" : "No"}`);
  lines.push("");

  // API Status
  lines.push("## Service Status");
  lines.push(`- FFmpeg: ${report.apiStatus.ffmpeg === "READY" ? "🟢 READY" : "🔴 MISSING"}`);
  lines.push(`- Piper TTS: ${report.apiStatus.piper === "READY" ? "🟢 READY" : "🟡 OPTIONAL"}`);
  lines.push(`- Ollama: ${report.apiStatus.ollama === "READY" ? "🟢 READY" : "🟡 OPTIONAL"}`);
  lines.push("");

  // Pipeline stages
  lines.push("## Pipeline Execution");
  lines.push("");
  lines.push("| Stage | Status | Details |");
  lines.push("|-------|--------|---------|");
  report.stages.forEach((stage) => {
    const statusSymbol =
      stage.status === "PASS" ? "✅" : stage.status === "FAIL" ? "❌" : stage.status === "PARTIAL" ? "⚠️" : "⏭️";
    lines.push(`| ${stage.stage} | ${statusSymbol} ${stage.status} | ${stage.details} |`);
  });
  lines.push("");

  // Content metrics
  lines.push("## Content Metrics");
  lines.push("");
  lines.push(`### Research`);
  lines.push(`- Status: ${report.research.status === "PASS" ? "✅" : "❌"}`);
  lines.push(`- Findings: ${report.research.findingsCount}`);
  lines.push(`- Sources: ${report.research.sourcesCount}`);
  lines.push("");

  lines.push(`### Script`);
  lines.push(`- Status: ${report.script.status === "PASS" ? "✅" : "❌"}`);
  lines.push(`- Sections: ${report.script.sectionsCount}`);
  lines.push(`- Characters: ${report.script.totalChars}`);
  lines.push(`- Estimated Duration: ${report.script.estimatedMinutes} minutes`);
  lines.push("");

  lines.push(`### Scenes`);
  lines.push(`- Status: ${report.scenes.status === "PASS" ? "✅" : "❌"}`);
  lines.push(`- Scenes: ${report.scenes.scenesCount}`);
  lines.push(`- Real Assets: ${report.scenes.realAssetsCount}`);
  lines.push(`- AI-Generated: ${report.scenes.aiGeneratedCount}`);
  lines.push("");

  lines.push(`### Narration`);
  lines.push(`- Status: ${report.narration.status === "PASS" ? "✅" : report.narration.status === "SKIPPED" ? "⏭️" : "❌"}`);
  lines.push(`- Segments: ${report.narration.segmentsCount}`);
  if (report.narration.totalDuration) {
    lines.push(`- Duration: ${report.narration.totalDuration}s`);
  }
  lines.push("");

  lines.push(`### Subtitles`);
  lines.push(`- Status: ${report.subtitles.status === "PASS" ? "✅" : report.subtitles.status === "SKIPPED" ? "⏭️" : "❌"}`);
  lines.push(`- Subtitles: ${report.subtitles.subtitlesCount}`);
  lines.push(`- Verified: ${report.subtitles.verifiedCount}`);
  lines.push("");

  lines.push(`### Video Output`);
  lines.push(`- Status: ${report.render.status === "PASS" ? "✅" : "❌"}`);
  if (report.render.outputPath) {
    lines.push(`- Output: ${report.render.outputPath}`);
  }
  if (report.render.fileSizeKB) {
    lines.push(`- File Size: ${report.render.fileSizeKB} KB`);
  }
  lines.push("");

  // Issues
  if (report.issues.length > 0) {
    lines.push("## Issues");
    report.issues.forEach((issue) => {
      const icon = issue.severity === "error" ? "🔴" : issue.severity === "warning" ? "🟡" : "ℹ️";
      lines.push(`${icon} **${issue.severity.toUpperCase()}${issue.stage ? ` (${issue.stage})` : ""}:** ${issue.message}`);
    });
    lines.push("");
  }

  // Recommendations
  if (report.recommendations.length > 0) {
    lines.push("## Recommendations");
    report.recommendations.forEach((rec) => {
      lines.push(`- ${rec}`);
    });
    lines.push("");
  }

  lines.push("---");
  lines.push("_Generated by Mystery Documentary Auto-Pipeline_");

  return lines.join("\n");
}
