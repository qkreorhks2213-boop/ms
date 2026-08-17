import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { readProject, updateProject, appendErrorLog, projectDir } from "../../../../../../lib/mystery/store";
import { checkOwnership, requireUserId } from "../../../../../../lib/economic/authGuard";
import type { PipelineStage } from "../../../../../../lib/mystery/types";
import { researchTopic } from "../../../../../../lib/mystery/research";
import { generateScript } from "../../../../../../lib/mystery/script";
import { generateScenes } from "../../../../../../lib/mystery/scenes";
import { detectBoringScenes, optimizeBoringScenes, generateBoredumReport } from "../../../../../../lib/mystery/boredumDetector";
import { generateText } from "../../../../../../lib/common/localAI";
import { generateNarrationForScenes } from "../../../../../../lib/mystery/narration";
import { renderMysteryVideo } from "../../../../../../lib/mystery/render-simple";
import { integrateAssetsWithScenes } from "../../../../../../lib/mystery/assets";
import { generateSubtitles } from "../../../../../../lib/mystery/subtitles";
import { analyzeResearchClaims } from "../../../../../../lib/mystery/factcheck";
import { generateTimeline } from "../../../../../../lib/mystery/timeline";
import { acquirePipelineLock, releasePipelineLock, getPipelineElapsedSeconds, isPipelineRunning } from "../../../../../../lib/mystery/pipeline-lock";
import { validateMP4WithFFprobe, validateDuration, validateSceneCount } from "../../../../../../lib/mystery/render-validate";

export const runtime = "nodejs";

/**
 * Auto-pipeline for mystery documentary generation.
 * Runs all 17 steps automatically without user intervention.
 *
 * Steps:
 * 1. Investigation: Research topic from web sources
 * 2. Fact-checking: Verify claims and classify by fact level
 * 3. Timeline: Organize events chronologically
 * 4. Script generation: Create narrative structure
 * 5. Scene composition: Break script into scenes
 * 6. Visual research: Search for real materials
 * 7. AI reconstruction: Generate missing visuals
 * 8. Scene optimization: Remove boring/redundant content
 * 9. Narration generation: Create voiceover
 * 10. Subtitle generation: Add captions
 * 11. BGM selection: Choose background music
 * 12. Audio mixing: Normalize levels
 * 13. Final QA: Quality assurance checks
 * 14. Video rendering: Create MP4
 * 15. Post-processing: Final adjustments
 * 16. Metadata: Add copyright/credits
 * 17. Publication: Mark as complete
 */

interface PipelineStep {
  name: string;
  stage: PipelineStage;
  execute: (projectId: string, project: any) => Promise<void>;
}

async function executeStep(
  projectId: string,
  stepName: string,
  stage: PipelineStage,
  stepFn: () => Promise<void>
): Promise<boolean> {
  try {
    console.log(`[mystery:auto] ⏳ Step: ${stepName}`);
    const startTime = Date.now();
    await stepFn();
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[mystery:auto] ✅ Step completed in ${duration}s: ${stepName}`);
    return true;
  } catch (err: any) {
    const errorMessage = err?.message || String(err);
    const errorStack = err?.stack || "";
    console.error(`[mystery:auto] ❌ Step failed: ${stepName}`);
    console.error(`[mystery:auto] Error details:`, errorMessage);

    appendErrorLog(projectId, {
      stage: stage,
      message: `Step failed: ${stepName} - ${errorMessage}${errorStack ? "\nStack: " + errorStack.split("\n").slice(0, 3).join("\n") : ""}`,
      retryable: !errorMessage.includes("[CRITICAL]"),
    });
    return false;
  }
}

async function runAutoPipeline(projectId: string, project: any): Promise<void> {
  const steps: PipelineStep[] = [
    {
      name: "1️⃣ Investigation",
      stage: "research",
      execute: async () => {
        updateProject(projectId, (p) => {
          p.stage = "research";
        });
        await researchTopic(projectId, project);
      },
    },
    {
      name: "2️⃣ Fact-Checking",
      stage: "research",
      execute: async () => {
        const updated = readProject(projectId);
        if (!updated || !updated.research) throw new Error("Research not completed");

        const factcheckReport = analyzeResearchClaims(updated.research);
        updateProject(projectId, (p) => {
          p.factcheckResults = factcheckReport;
        });

        console.log(
          `[mystery:auto] Fact-check complete: ${factcheckReport.verified} verified, ` +
          `${factcheckReport.testimonies} testimonies, ${factcheckReport.disputed} disputed`
        );
      },
    },
    {
      name: "3️⃣ Timeline",
      stage: "research",
      execute: async () => {
        const updated = readProject(projectId);
        if (!updated || !updated.research) throw new Error("Research not completed");

        const timeline = generateTimeline(updated.research);
        if (timeline.length === 0) {
          throw new Error("Failed to generate timeline from research findings");
        }

        updateProject(projectId, (p) => {
          p.timeline = timeline;
        });

        console.log(`[mystery:auto] Timeline generated: ${timeline.length} events`);
      },
    },
    {
      name: "4️⃣ Script Generation",
      stage: "script",
      execute: async () => {
        const updated = readProject(projectId);
        if (!updated || !updated.research) throw new Error("Research not completed");

        updateProject(projectId, (p) => {
          p.stage = "script";
        });

        await generateScript(projectId, updated);
      },
    },
    {
      name: "5️⃣ Visual Asset Discovery",
      stage: "visuals",
      execute: async () => {
        const updated = readProject(projectId);
        if (!updated || !updated.script) throw new Error("Script not generated");

        updateProject(projectId, (p) => {
          p.stage = "visuals";
        });

        console.log("[mystery:auto] Discovering real visual assets...");
        const topic = updated.name || "unknown";
        // Pre-discover assets so scene generation can use them
        const { scenes: emptyScenes, assets } = integrateAssetsWithScenes(topic, []);
        updateProject(projectId, (p) => {
          p.sceneAssets = assets as any;
        });
        console.log(`[mystery:auto] Real assets discovered: ${assets.length} assets`);
      },
    },
    {
      name: "6️⃣ Scene Composition",
      stage: "scenes",
      execute: async () => {
        const updated = readProject(projectId);
        if (!updated || !updated.script) throw new Error("Script not generated");

        updateProject(projectId, (p) => {
          p.stage = "scenes";
        });

        await generateScenes(projectId, updated);
      },
    },
    {
      name: "7️⃣ Visual Assets Integration",
      stage: "visuals",
      execute: async () => {
        const updated = readProject(projectId);
        if (!updated || !updated.scenes) throw new Error("Scenes not built");

        console.log("[mystery:auto] Integrating visual assets with scenes...");
        const topic = updated.name || "unknown";
        const { scenes, assets } = integrateAssetsWithScenes(topic, updated.scenes);
        updateProject(projectId, (p) => {
          p.scenes = scenes;
          p.sceneAssets = assets as any;
        });
        console.log(`[mystery:auto] Visual assets integrated: ${assets.length} assets mapped to scenes`);
      },
    },
    {
      name: "7️⃣.5️⃣ Generate Individual Scene Visuals",
      stage: "visuals",
      execute: async () => {
        const updated = readProject(projectId);
        if (!updated || !updated.scenes) throw new Error("Scenes not built");

        console.log("[mystery:auto] Generating individual scene visuals (실제 이미지 생성)...");

        // Import visual generation
        const { generateAllSceneVisuals } = await import("../../../../../../lib/mystery/visuals");

        // Generate visuals for all scenes (real images, graphics, or text cards)
        await generateAllSceneVisuals(projectId, updated, updated.input);

        // Verify results
        const finalProject = readProject(projectId);
        const successCount = (finalProject?.scenes || []).filter((s) => s.visualStatus === "done").length;
        const totalScenes = finalProject?.scenes?.length || 0;

        console.log(`[mystery:auto] Scene visuals generated: ${successCount}/${totalScenes} 장면 완료`);

        if (successCount === 0) {
          throw new Error(`[CRITICAL] No scene visuals were generated successfully (0/${totalScenes})`);
        }

        if (successCount < totalScenes * 0.8) {
          console.warn(`[mystery:auto] Warning: Only ${successCount}/${totalScenes} scenes have visuals (80% target)`);
        }
      },
    },
    {
      name: "8️⃣ Scene Optimization (Boredom Detection)",
      stage: "scenes",
      execute: async () => {
        const updated = readProject(projectId);
        if (!updated || !updated.scenes) throw new Error("Scenes not built");

        // Run boredom detection
        const analyses = detectBoringScenes(updated.scenes);
        const report = generateBoredumReport(analyses);
        console.log(`[mystery:auto] ${report}`);

        if (analyses.length > 0) {
          // Optimize scenes by removing/merging boring ones
          const optimized = optimizeBoringScenes(updated.scenes, analyses);

          updateProject(projectId, (p) => {
            p.scenes = optimized;
            console.log(`[mystery:auto] Optimized ${updated.scenes?.length || 0} scenes to ${optimized.length} scenes`);
          });
        }
      },
    },
    {
      name: "9️⃣ Narration Generation & Audio",
      stage: "narration",
      execute: async () => {
        const updated = readProject(projectId);
        if (!updated || !updated.scenes) throw new Error("Scenes not built");

        updateProject(projectId, (p) => {
          p.stage = "narration";
        });

        console.log("[mystery:auto] Generating narration and audio processing...");
        const narrationResult = await generateNarrationForScenes(projectId, updated);
        if (!narrationResult.success) {
          throw new Error(`Narration generation failed: ${narrationResult.error}`);
        }
        updateProject(projectId, (p) => {
          p.narrationSegments = narrationResult.segments as any;
        });
        console.log(`[mystery:auto] Narration completed: ${narrationResult.segments.length} segments, ${narrationResult.totalDuration}s total`);
      },
    },
    {
      name: "9️⃣.5️⃣ Update Scenes with Narration Metadata",
      stage: "narration",
      execute: async () => {
        const updated = readProject(projectId);
        if (!updated || !updated.narrationSegments || !updated.scenes) throw new Error("Narration or scenes not found");

        // Update each scene with its narration segment ID and duration
        const sceneNarrationMap = new Map<string, string>();
        updateProject(projectId, (p) => {
          if (!p.scenes || !p.script?.sections) return;

          for (const scene of p.scenes) {
            // Find the narration segment index that corresponds to this scene's section
            const sectionIndex = p.script.sections.findIndex((s) => s.id === scene.sectionId);
            if (sectionIndex >= 0 && sectionIndex < p.narrationSegments.length) {
              const narrationSegment = p.narrationSegments[sectionIndex];
              scene.narrationSegmentId = narrationSegment.id;
              scene.durationSeconds = narrationSegment.durationSeconds;
              sceneNarrationMap.set(scene.id, narrationSegment.id);
            }
          }
        });

        console.log(`[mystery:auto] Scene narration metadata updated: ${updated.scenes.length} scenes linked to narration`);
      },
    },
    {
      name: "1️⃣0️⃣ Subtitle Generation",
      stage: "narration",
      execute: async () => {
        const updated = readProject(projectId);
        if (!updated || !updated.narrationSegments) throw new Error("Narration not completed");

        // Build scene-to-narration mapping
        // Each scene belongs to a script section, which has a corresponding narration segment
        const sceneNarrationMap = new Map<string, string>();
        if (updated.scenes && updated.script?.sections) {
          for (const scene of updated.scenes) {
            // Find the narration segment index that corresponds to this scene's section
            const sectionIndex = updated.script.sections.findIndex((s) => s.id === scene.sectionId);
            if (sectionIndex >= 0 && sectionIndex < updated.narrationSegments.length) {
              sceneNarrationMap.set(scene.id, updated.narrationSegments[sectionIndex].id);
            } else {
              throw new Error(`[CRITICAL] Scene ${scene.id} has invalid sectionId mapping: ${scene.sectionId}`);
            }
          }
        } else {
          throw new Error("[CRITICAL] Missing scenes or script sections for narration mapping");
        }

        if (sceneNarrationMap.size !== updated.scenes.length) {
          throw new Error(`[CRITICAL] Scene-narration mapping incomplete: ${sceneNarrationMap.size}/${updated.scenes.length} mapped`);
        }

        const sceneIds = updated.scenes?.map((s) => s.id) || [];
        const subtitleTrack = generateSubtitles(updated.narrationSegments, sceneIds, "ko-KR", sceneNarrationMap);
        updateProject(projectId, (p) => {
          p.subtitleTracks = [subtitleTrack] as any;
        });
        console.log(`[mystery:auto] Subtitles generated: ${subtitleTrack.subtitles.length} items`);
      },
    },
    {
      name: "1️⃣1️⃣ Final Quality Assurance",
      stage: "render",
      execute: async () => {
        const updated = readProject(projectId);
        if (!updated) throw new Error("Project not found");

        // Check all critical components are present
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
          console.error(`[mystery:auto] QA checks failed: ${failed.join(", ")}`);
          throw new Error(`Quality assurance failed: missing ${failed.join(", ")}`);
        }

        console.log("[mystery:auto] ✅ All QA checks passed");
      },
    },
    {
      name: "1️⃣2️⃣ Video Rendering",
      stage: "render",
      execute: async () => {
        const updated = readProject(projectId);
        if (!updated) throw new Error("Project not found");

        updateProject(projectId, (p) => {
          p.stage = "render";
          p.render.status = "working";
          p.render.currentStep = "Rendering video...";
        });

        console.log("[mystery:auto] Starting video rendering...");
        await renderMysteryVideo(projectId, updated);

        const finalProject = readProject(projectId);
        if (!finalProject?.output?.mp4) {
          throw new Error("Video rendering completed but output file not found");
        }

        console.log(`[mystery:auto] Video rendered successfully: ${finalProject.output.mp4}`);
      },
    },
    {
      name: "1️⃣3️⃣ Final Verification & Complete",
      stage: "render",
      execute: async () => {
        const finalProject = readProject(projectId);
        if (!finalProject) throw new Error("Project not found");

        // Verify all required outputs exist
        const checks = {
          hasResearch: !!(finalProject.research && finalProject.research.length > 0),
          hasScript: !!(finalProject.script && finalProject.script.sections.length > 0),
          hasScenes: !!(finalProject.scenes && finalProject.scenes.length > 0),
          hasNarration: !!(finalProject.narrationSegments && finalProject.narrationSegments.length > 0),
          hasSubtitles: !!(finalProject.subtitleTracks && finalProject.subtitleTracks.length > 0),
          hasOutput: !!finalProject.output?.mp4,
        };

        const allPassed = Object.values(checks).every((v) => v);

        if (!allPassed) {
          const failed = Object.entries(checks)
            .filter(([_, passed]) => !passed)
            .map(([name]) => name);
          throw new Error(`Final verification failed: ${failed.join(", ")}`);
        }

        // Comprehensive MP4 validation
        const mp4Path = path.join(projectDir(projectId), "output.mp4");
        const mp4Validation = await validateMP4WithFFprobe(mp4Path);

        if (!mp4Validation.valid) {
          throw new Error(
            `MP4 validation failed: ${mp4Validation.errors.join("; ")}`
          );
        }

        console.log(`[mystery:auto] MP4 validated: ${mp4Validation.duration}s, ${mp4Validation.resolution}, ${mp4Validation.fps}fps`);

        // Validate duration (±20% tolerance)
        const durationCheck = validateDuration(mp4Validation.duration, finalProject.input.targetMinutes, 20);
        if (!durationCheck.valid) {
          throw new Error(`Duration validation failed: ${durationCheck.message}`);
        }
        console.log(`[mystery:auto] ${durationCheck.message}`);

        // Validate scene count (±20% tolerance)
        const sceneCount = finalProject.scenes?.length || 0;
        const sceneCheck = validateSceneCount(sceneCount, finalProject.input.sceneVisualTarget, 20);
        if (!sceneCheck.valid) {
          throw new Error(`Scene count validation failed: ${sceneCheck.message}`);
        }
        console.log(`[mystery:auto] ${sceneCheck.message}`);

        // All validations passed - mark as done
        updateProject(projectId, (p) => {
          p.stage = "done";
        });

        console.log("[mystery:auto] ✅ All pipeline steps completed and validated");
        console.log(`[mystery:auto] Final output: ${finalProject.output?.mp4} (${mp4Validation.fileSize / 1024 / 1024}MB)`);
      },
    },
  ];

  // Execute all steps in sequence
  let lastSuccessfulStep = -1;
  for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
    const step = steps[stepIndex];
    const success = await executeStep(projectId, step.name, step.stage, () => step.execute(projectId, project));

    if (!success) {
      // Critical failure - stop pipeline and mark as failed
      console.error(`[mystery:auto] ❌ Pipeline failed at step ${stepIndex + 1}/${steps.length}: ${step.name}`);

      // Get detailed error info
      const project = readProject(projectId);
      const errorLog = project?.errorLog || [];
      const recentErrors = errorLog.slice(-3);

      const errorSummary = recentErrors
        .map((e) => `[${e.stage}] ${e.message}`)
        .join(" → ");

      const detailedErrorMsg = errorSummary || `Failed at step: ${step.name}. Check error log for details.`;

      updateProject(projectId, (p) => {
        p.stage = "failed";
        p.pipelineError = detailedErrorMsg;
        console.log(`[mystery:auto] Pipeline state updated to "failed". Error: ${detailedErrorMsg.split("\n")[0]}`);
      });

      return; // Stop execution
    }

    lastSuccessfulStep = stepIndex;
  }

  console.log(`[mystery:auto] ✅ All pipeline steps completed successfully (${lastSuccessfulStep + 1}/${steps.length})`);

  // Final verification
  const finalProject = readProject(projectId);
  if (finalProject?.output?.mp4) {
    const fileSize = finalProject.output?.fileSize ? `${(finalProject.output.fileSize / 1024 / 1024).toFixed(1)}MB` : "unknown";
    console.log(`[mystery:auto] 🎬 Final output ready: ${finalProject.output.mp4} (${fileSize})`);
  } else {
    console.warn(`[mystery:auto] ⚠️ Pipeline completed but output file not found`);
  }
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

  // Check if pipeline is already running using atomic lock
  if (!acquirePipelineLock(params.id)) {
    const elapsedSeconds = getPipelineElapsedSeconds(params.id);
    return NextResponse.json(
      {
        error: "Pipeline already running",
        message: `Pipeline started ${Math.round(elapsedSeconds)} seconds ago. Wait for completion or wait 30 minutes for lock timeout.`,
        pipelineRunning: true,
        elapsedSeconds: Math.round(elapsedSeconds),
      },
      { status: 409 }
    );
  }

  // Start auto-pipeline in background
  runAutoPipeline(params.id, project)
    .catch((err) => {
      console.error(`[mystery:auto] Pipeline error:`, err);
      updateProject(params.id, (p) => {
        p.pipelineError = err?.message || String(err);
      });
    })
    .finally(() => {
      // Release lock when pipeline completes (success or failure)
      releasePipelineLock(params.id);
    });

  return NextResponse.json({
    status: "pipeline-started",
    message: "Auto-pipeline initiated - documentary will generate automatically",
  });
}
