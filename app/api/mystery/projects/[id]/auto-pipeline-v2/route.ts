import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { readProject, updateProject, appendErrorLog, projectDir } from "../../../../../../lib/mystery/store";
import { checkOwnership, requireUserId } from "../../../../../../lib/economic/authGuard";
import { PipelineStepId, StepStatus, STEP_ORDER, STEP_LABELS, type StepProgress } from "../../../../../../lib/mystery/types";
import { researchTopic } from "../../../../../../lib/mystery/research";
import { generateScript } from "../../../../../../lib/mystery/script";
import { generateScenes } from "../../../../../../lib/mystery/scenes";
import { detectBoringScenes, optimizeBoringScenes, generateBoredumReport } from "../../../../../../lib/mystery/boredumDetector";
import { generateNarrationForScenes } from "../../../../../../lib/mystery/narration";
import { renderMysteryVideo } from "../../../../../../lib/mystery/render-simple";
import { integrateAssetsWithScenes } from "../../../../../../lib/mystery/assets";
import { generateSubtitles } from "../../../../../../lib/mystery/subtitles";
import { analyzeResearchClaims } from "../../../../../../lib/mystery/factcheck";
import { generateTimeline } from "../../../../../../lib/mystery/timeline";
import { acquirePipelineLock, releasePipelineLock, getPipelineElapsedSeconds } from "../../../../../../lib/mystery/pipeline-lock";
import { validateMP4WithFFprobe } from "../../../../../../lib/mystery/render-validate";

export const runtime = "nodejs";

interface ExecuteStepFn {
  (projectId: string, project: any): Promise<{ success: boolean; error?: string }>;
}

/**
 * Step 실행 헬퍼
 * - Input validation
 * - Status 업데이트
 * - Execute
 * - Output validation
 * - Error handling
 */
async function executeStep(
  projectId: string,
  stepId: PipelineStepId,
  stepFn: ExecuteStepFn
): Promise<{ success: boolean; error?: string }> {
  try {
    // Initialize step state if not exists
    const project = readProject(projectId);
    if (!project) throw new Error("Project not found");

    let steps = project.steps || [];
    let stepIndex = steps.findIndex((s) => s.stepId === stepId);

    if (stepIndex === -1) {
      const newStep: StepProgress = {
        stepId,
        status: "pending",
        retryCount: 0,
      };
      steps.push(newStep);
      stepIndex = steps.length - 1;
    }

    // Update to running
    updateProject(projectId, (p) => {
      if (!p.steps) p.steps = [];
      const idx = p.steps.findIndex((s) => s.stepId === stepId);
      if (idx >= 0) {
        p.steps[idx].status = "running";
        p.steps[idx].startedAt = new Date().toISOString();
      }
    });

    console.log(`[mystery:auto] ▶️ ${stepId}: ${STEP_LABELS[stepId]} starting...`);

    // Execute step
    const result = await stepFn(projectId, project);

    if (!result.success) {
      throw new Error(result.error || "Step execution failed");
    }

    // Validate output
    const updatedProject = readProject(projectId);
    if (!updatedProject) throw new Error("Project lost during execution");

    // Mark as completed
    updateProject(projectId, (p) => {
      if (!p.steps) p.steps = [];
      const idx = p.steps.findIndex((s) => s.stepId === stepId);
      if (idx >= 0) {
        p.steps[idx].status = "completed";
        p.steps[idx].completedAt = new Date().toISOString();
      }
    });

    console.log(`[mystery:auto] ✅ ${stepId}: ${STEP_LABELS[stepId]} completed`);
    return { success: true };
  } catch (err: any) {
    const errorMessage = err?.message || String(err);
    console.error(`[mystery:auto] ❌ ${stepId}: ${STEP_LABELS[stepId]} failed`);
    console.error(`[mystery:auto] Error: ${errorMessage}`);

    // Mark as failed and update retry count
    updateProject(projectId, (p) => {
      if (!p.steps) p.steps = [];
      const idx = p.steps.findIndex((s) => s.stepId === stepId);
      if (idx >= 0) {
        p.steps[idx].status = "failed";
        p.steps[idx].error = errorMessage;
        p.steps[idx].retryCount = (p.steps[idx].retryCount || 0) + 1;
      }
      p.stage = "failed";
      p.pipelineError = `${stepId} failed: ${errorMessage}`;
    });

    appendErrorLog(projectId, {
      stage: "render",
      message: `${stepId} failed: ${errorMessage}`,
      retryable: !errorMessage.includes("[CRITICAL]"),
    });

    return { success: false, error: errorMessage };
  }
}

/**
 * 14-Step Auto Pipeline
 * 공식 STEP_01 ~ STEP_14
 */
async function runAutoPipeline(projectId: string, project: any): Promise<void> {
  console.log(`[mystery:auto] 🚀 Starting 14-Step pipeline for project ${projectId}`);

  // Initialize steps array
  updateProject(projectId, (p) => {
    p.steps = STEP_ORDER.map((stepId) => ({
      stepId,
      status: "pending" as StepStatus,
      retryCount: 0,
    }));
  });

  // STEP_01: Research Investigation
  const step01 = await executeStep(projectId, PipelineStepId.STEP_01, async (pid, proj) => {
    await researchTopic(pid, proj);
    const updated = readProject(pid);
    return {
      success: !!updated?.research && updated.research.length > 0,
      error: updated?.research ? undefined : "No research findings",
    };
  });
  if (!step01.success) return;

  // STEP_02: Fact-Checking & Analysis
  const step02 = await executeStep(projectId, PipelineStepId.STEP_02, async (pid, proj) => {
    const updated = readProject(pid);
    if (!updated?.research) return { success: false, error: "Research missing" };

    const factcheckReport = analyzeResearchClaims(updated.research);
    updateProject(pid, (p) => {
      p.factcheckResults = factcheckReport;
    });
    return { success: true };
  });
  if (!step02.success) return;

  // STEP_03: Timeline Generation
  const step03 = await executeStep(projectId, PipelineStepId.STEP_03, async (pid, proj) => {
    const updated = readProject(pid);
    if (!updated?.research) return { success: false, error: "Research missing" };

    const timeline = generateTimeline(updated.research);
    if (timeline.length === 0) return { success: false, error: "No timeline events" };

    updateProject(pid, (p) => {
      p.timeline = timeline;
    });
    return { success: true };
  });
  if (!step03.success) return;

  // STEP_04: Script Generation
  const step04 = await executeStep(projectId, PipelineStepId.STEP_04, async (pid, proj) => {
    const updated = readProject(pid);
    if (!updated?.research) return { success: false, error: "Research missing" };

    await generateScript(pid, updated);
    const final = readProject(pid);
    return {
      success: !!final?.script && final.script.sections.length > 0,
      error: final?.script ? undefined : "Script generation failed",
    };
  });
  if (!step04.success) return;

  // STEP_05: Scene Composition
  const step05 = await executeStep(projectId, PipelineStepId.STEP_05, async (pid, proj) => {
    const updated = readProject(pid);
    if (!updated?.script) return { success: false, error: "Script missing" };

    await generateScenes(pid, updated);
    const final = readProject(pid);
    return {
      success: !!final?.scenes && final.scenes.length > 0,
      error: final?.scenes ? undefined : "Scene generation failed",
    };
  });
  if (!step05.success) return;

  // STEP_06: Visual Discovery & Asset Integration
  const step06 = await executeStep(projectId, PipelineStepId.STEP_06, async (pid, proj) => {
    const updated = readProject(pid);
    if (!updated?.scenes) return { success: false, error: "Scenes missing" };

    const topic = updated.name || "unknown";
    const { scenes, assets } = integrateAssetsWithScenes(topic, updated.scenes);
    updateProject(pid, (p) => {
      p.scenes = scenes;
      p.sceneAssets = assets as any;
    });
    return {
      success: assets && assets.length > 0,
      error: assets && assets.length > 0 ? undefined : "No assets found",
    };
  });
  if (!step06.success) return;

  // STEP_07: Visual Generation (Real+AI)
  const step07 = await executeStep(projectId, PipelineStepId.STEP_07, async (pid, proj) => {
    const updated = readProject(pid);
    if (!updated?.scenes) return { success: false, error: "Scenes missing" };

    const { generateAllSceneVisuals } = await import("../../../../../../lib/mystery/visuals");
    await generateAllSceneVisuals(pid, updated, updated.input);

    const final = readProject(pid);
    const successCount = (final?.scenes || []).filter((s) => s.visualStatus === "done").length;
    const totalScenes = final?.scenes?.length || 0;

    // CRITICAL: All scenes must have visuals
    if (successCount === 0) {
      return { success: false, error: `[CRITICAL] No visuals generated (0/${totalScenes})` };
    }

    if (successCount < totalScenes) {
      return {
        success: false,
        error: `[CRITICAL] Incomplete visuals: ${successCount}/${totalScenes} (need 100%)`,
      };
    }

    return { success: true };
  });
  if (!step07.success) return;

  // STEP_08: Scene Optimization
  const step08 = await executeStep(projectId, PipelineStepId.STEP_08, async (pid, proj) => {
    const updated = readProject(pid);
    if (!updated?.scenes) return { success: false, error: "Scenes missing" };

    const analyses = detectBoringScenes(updated.scenes);
    if (analyses.length > 0) {
      const optimized = optimizeBoringScenes(updated.scenes, analyses);
      updateProject(pid, (p) => {
        p.scenes = optimized;
      });
    }
    return { success: true };
  });
  if (!step08.success) return;

  // STEP_09: Narration Generation
  const step09 = await executeStep(projectId, PipelineStepId.STEP_09, async (pid, proj) => {
    const updated = readProject(pid);
    if (!updated?.scenes) return { success: false, error: "Scenes missing" };

    const narrationResult = await generateNarrationForScenes(pid, updated);
    if (!narrationResult.success) {
      return { success: false, error: narrationResult.error };
    }

    // Update scenes with narration metadata
    updateProject(pid, (p) => {
      p.narrationSegments = narrationResult.segments as any;
      if (!p.scenes || !p.script?.sections || !p.narrationSegments) return;

      for (const scene of p.scenes) {
        const sectionIndex = p.script.sections.findIndex((s) => s.id === scene.sectionId);
        if (sectionIndex >= 0 && sectionIndex < p.narrationSegments.length) {
          const narrationSegment = p.narrationSegments[sectionIndex];
          scene.narrationSegmentId = narrationSegment.id;
          scene.durationSeconds = narrationSegment.durationSeconds;
        }
      }
    });

    return { success: true };
  });
  if (!step09.success) return;

  // STEP_10: Subtitle Generation
  const step10 = await executeStep(projectId, PipelineStepId.STEP_10, async (pid, proj) => {
    const updated = readProject(pid);
    if (!updated?.narrationSegments) {
      return { success: false, error: "Narration missing" };
    }

    const sceneNarrationMap = new Map<string, string>();
    if (updated.scenes && updated.script?.sections) {
      for (const scene of updated.scenes) {
        const sectionIndex = updated.script.sections.findIndex((s) => s.id === scene.sectionId);
        if (sectionIndex >= 0 && sectionIndex < updated.narrationSegments.length) {
          sceneNarrationMap.set(scene.id, updated.narrationSegments[sectionIndex].id);
        }
      }
    }

    const sceneIds = updated.scenes?.map((s) => s.id) || [];
    const subtitleTrack = generateSubtitles(updated.narrationSegments, sceneIds, "ko-KR", sceneNarrationMap);
    updateProject(pid, (p) => {
      p.subtitleTracks = [subtitleTrack] as any;
    });

    return { success: true };
  });
  if (!step10.success) return;

  // STEP_11: Quality Verification
  const step11 = await executeStep(projectId, PipelineStepId.STEP_11, async (pid, proj) => {
    const updated = readProject(pid);
    if (!updated) return { success: false, error: "Project not found" };

    const checks = {
      hasResearch: !!updated.research && updated.research.length > 0,
      hasScript: !!updated.script && updated.script.sections && updated.script.sections.length > 0,
      hasScenes: !!updated.scenes && updated.scenes.length > 0,
      hasNarration: !!updated.narrationSegments && updated.narrationSegments.length > 0,
      hasSubtitles: !!updated.subtitleTracks && updated.subtitleTracks.length > 0,
    };

    const failed = Object.entries(checks)
      .filter(([_, passed]) => !passed)
      .map(([name]) => name);

    if (failed.length > 0) {
      return { success: false, error: `Quality checks failed: ${failed.join(", ")}` };
    }

    return { success: true };
  });
  if (!step11.success) return;

  // STEP_12: Video Rendering
  const step12 = await executeStep(projectId, PipelineStepId.STEP_12, async (pid, proj) => {
    const updated = readProject(pid);
    if (!updated) return { success: false, error: "Project not found" };

    await renderMysteryVideo(pid, updated);
    const final = readProject(pid);

    if (!final?.output?.mp4) {
      return { success: false, error: "MP4 file not created" };
    }

    return { success: true };
  });
  if (!step12.success) return;

  // STEP_13: Final MP4 Validation
  const step13 = await executeStep(projectId, PipelineStepId.STEP_13, async (pid, proj) => {
    const updated = readProject(pid);
    if (!updated?.output?.mp4) {
      return { success: false, error: "MP4 file not found" };
    }

    const mp4Path = path.join(projectDir(pid), "output.mp4");
    const validation = await validateMP4WithFFprobe(mp4Path);

    if (!validation.valid) {
      return { success: false, error: `MP4 validation failed: ${validation.errors.join("; ")}` };
    }

    console.log(
      `[mystery:auto] MP4 validated: ${validation.duration}s, ${validation.resolution}, ${validation.fps}fps`
    );

    return { success: true };
  });
  if (!step13.success) return;

  // STEP_14: Completion & Archival
  const step14 = await executeStep(projectId, PipelineStepId.STEP_14, async (pid, proj) => {
    const updated = readProject(pid);
    if (!updated) return { success: false, error: "Project not found" };

    // Verify all steps completed
    const allStepsCompleted = (updated.steps || []).every((s) => s.status === "completed");
    if (!allStepsCompleted) {
      return { success: false, error: "Not all steps completed" };
    }

    // Final state update
    updateProject(pid, (p) => {
      p.stage = "done";
      p.completedAt = new Date().toISOString();
    });

    console.log(`[mystery:auto] 🎉 Pipeline completed successfully`);
    return { success: true };
  });
  if (!step14.success) return;

  console.log(`[mystery:auto] ✅ All 14 steps completed successfully`);
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;

  const project = readProject(params.id);
  const ownershipError = checkOwnership(project, auth.userId);
  if (ownershipError) return ownershipError;

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (!acquirePipelineLock(params.id)) {
    const elapsedSeconds = getPipelineElapsedSeconds(params.id);
    return NextResponse.json(
      {
        error: "Pipeline already running",
        message: `Pipeline started ${Math.round(elapsedSeconds)} seconds ago.`,
        pipelineRunning: true,
        elapsedSeconds: Math.round(elapsedSeconds),
      },
      { status: 409 }
    );
  }

  // Start pipeline in background
  runAutoPipeline(params.id, project)
    .catch((err) => {
      console.error(`[mystery:auto] Pipeline error:`, err);
      updateProject(params.id, (p) => {
        p.stage = "failed";
        p.pipelineError = err?.message || String(err);
      });
    })
    .finally(() => {
      releasePipelineLock(params.id);
    });

  return NextResponse.json({
    status: "pipeline-started",
    message: "14-Step auto-pipeline initiated",
  });
}
