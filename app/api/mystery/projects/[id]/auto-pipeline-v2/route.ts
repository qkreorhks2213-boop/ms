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

    // Capture project state before step (input)
    const projectBefore = readProject(projectId);

    // Execute step
    const result = await stepFn(projectId, project);

    if (!result.success) {
      throw new Error(result.error || "Step execution failed");
    }

    // Capture project state after step (output)
    const projectAfter = readProject(projectId);

    // Record input/output
    let validationPassed = true;
    const validationChecks: string[] = [];
    const validationWarnings: string[] = [];

    // Perform step-specific validation
    if (projectAfter) {
      if (stepId === PipelineStepId.STEP_01) {
        validationChecks.push("research_data_exists");
        if (projectAfter.research && projectAfter.research.length > 0) {
          validationPassed = true;
        } else {
          validationPassed = false;
          validationWarnings.push("No research data found");
        }
      } else if (stepId === PipelineStepId.STEP_02) {
        validationChecks.push("factcheck_results_exist");
        validationPassed = !!projectAfter.factcheckResults;
        if (!validationPassed) {
          validationWarnings.push("Factcheck results missing");
        }
      } else if (stepId === PipelineStepId.STEP_03) {
        validationChecks.push("timeline_exists");
        validationPassed = !!(projectAfter.timeline && projectAfter.timeline.length > 0);
        if (!validationPassed) {
          validationWarnings.push("Timeline not generated");
        }
      } else if (stepId === PipelineStepId.STEP_04) {
        validationChecks.push("script_exists");
        validationPassed = !!(projectAfter.script && projectAfter.script.sections.length > 0);
        if (!validationPassed) {
          validationWarnings.push("Script not generated");
        }
      } else if (stepId === PipelineStepId.STEP_05) {
        validationChecks.push("scenes_exist");
        validationPassed = !!(projectAfter.scenes && projectAfter.scenes.length > 0);
        if (!validationPassed) {
          validationWarnings.push("Scenes not created");
        }
      } else if (stepId === PipelineStepId.STEP_06) {
        validationChecks.push("assets_found");
        validationPassed = !!(projectAfter.sceneAssets && projectAfter.sceneAssets.length > 0);
        if (!validationPassed) {
          validationWarnings.push("No assets discovered");
        }
      } else if (stepId === PipelineStepId.STEP_07) {
        validationChecks.push("visuals_complete");
        const visualCount = (projectAfter.scenes || []).filter((s) => s.visualStatus === "done").length;
        const totalScenes = projectAfter.scenes?.length || 0;
        validationPassed = visualCount === totalScenes;
        if (!validationPassed && totalScenes > 0) {
          validationWarnings.push(`Only ${visualCount}/${totalScenes} scenes have visuals`);
        }
      } else if (stepId === PipelineStepId.STEP_08) {
        validationChecks.push("scenes_optimized");
        validationPassed = true;
      } else if (stepId === PipelineStepId.STEP_09) {
        validationChecks.push("narration_segments_exist");
        validationPassed = !!(projectAfter.narrationSegments && projectAfter.narrationSegments.length > 0);
        if (!validationPassed) {
          validationWarnings.push("Narration segments not created");
        }
      } else if (stepId === PipelineStepId.STEP_10) {
        validationChecks.push("subtitles_exist");
        validationPassed = !!(projectAfter.subtitleTracks && projectAfter.subtitleTracks.length > 0);
        if (!validationPassed) {
          validationWarnings.push("Subtitle tracks not created");
        }
      } else if (stepId === PipelineStepId.STEP_11) {
        validationChecks.push("quality_verified");
        validationPassed = true;
      } else if (stepId === PipelineStepId.STEP_12) {
        validationChecks.push("mp4_created");
        validationPassed = !!projectAfter.output?.mp4;
        if (!validationPassed) {
          validationWarnings.push("MP4 file not created");
        }
      } else if (stepId === PipelineStepId.STEP_13) {
        validationChecks.push("mp4_validated");
        validationPassed = true;
      } else if (stepId === PipelineStepId.STEP_14) {
        validationChecks.push("pipeline_complete");
        validationPassed = projectAfter.stage === "done";
        if (!validationPassed) {
          validationWarnings.push("Pipeline not marked as complete");
        }
      }
    }

    // Mark as completed with validation data
    updateProject(projectId, (p) => {
      if (!p.steps) p.steps = [];
      const idx = p.steps.findIndex((s) => s.stepId === stepId);
      if (idx >= 0) {
        p.steps[idx].status = "completed";
        p.steps[idx].completedAt = new Date().toISOString();
        p.steps[idx].validation = {
          passed: validationPassed,
          checks: validationChecks,
          errors: validationWarnings,
        };
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

  // STEP_11: Quality Verification (Real file/media validation)
  const step11 = await executeStep(projectId, PipelineStepId.STEP_11, async (pid, proj) => {
    const updated = readProject(pid);
    if (!updated) return { success: false, error: "Project not found" };

    const fs = await import("fs");
    const path = await import("path");

    // 1. Check data structures exist
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

    // 2. Verify actual audio files exist for narration
    const projectDir_ = path.join(process.cwd(), "data", "mystery-projects", pid);
    const narrationDir = path.join(projectDir_, "narration");

    for (const segment of updated.narrationSegments || []) {
      if (!segment.audioPath) {
        return { success: false, error: `Narration segment ${segment.id} has no audio path` };
      }
      if (!fs.existsSync(segment.audioPath)) {
        return { success: false, error: `Audio file not found: ${segment.audioPath}` };
      }
      const stats = fs.statSync(segment.audioPath);
      if (stats.size < 100) {
        return { success: false, error: `Audio file too small: ${segment.audioPath} (${stats.size} bytes)` };
      }
    }

    // 3. Verify scene visuals status
    const scenesWithVisuals = (updated.scenes || []).filter((s) => s.visualStatus === "done");
    if (scenesWithVisuals.length !== (updated.scenes || []).length) {
      const missingCount = (updated.scenes || []).length - scenesWithVisuals.length;
      return { success: false, error: `${missingCount} scenes missing visuals` };
    }

    // 4. Verify subtitle data
    for (const track of updated.subtitleTracks || []) {
      if (!track.subtitles || track.subtitles.length === 0) {
        return { success: false, error: "Subtitle track is empty" };
      }
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

    // Verify all PREVIOUS steps (01-13) completed - exclude STEP_14 itself
    const previousSteps = (updated.steps || []).filter((s) => s.stepId !== PipelineStepId.STEP_14);
    const allPreviousCompleted = previousSteps.every((s) => s.status === "completed");
    if (!allPreviousCompleted) {
      const failedSteps = previousSteps.filter((s) => s.status !== "completed").map((s) => s.stepId);
      return { success: false, error: `Steps not completed: ${failedSteps.join(", ")}` };
    }

    // Verify final output exists
    if (!updated.output?.mp4) {
      return { success: false, error: "Final MP4 output not found" };
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
