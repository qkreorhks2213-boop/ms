import { NextRequest, NextResponse } from "next/server";
import { readProject, updateProject, appendErrorLog } from "@/lib/mystery/store";
import { researchTopic } from "@/lib/mystery/research";
import { generateScript } from "@/lib/mystery/script";
import { generateScenes } from "@/lib/mystery/scenes";
import { detectBoringScenes, optimizeBoringScenes, generateBoredumReport } from "@/lib/mystery/boredumDetector";
import { renderMysteryVideo } from "@/lib/mystery/render-simple";
import { generateNarrationForScenes } from "@/lib/mystery/narration";
import { generateSubtitles } from "@/lib/mystery/subtitles";
import { integrateAssetsWithScenes, validateAssetSources } from "@/lib/mystery/assets";
import type { Scene } from "@/lib/mystery/types";

/**
 * Test endpoint for starting the auto-pipeline without authentication.
 * Only available in development mode.
 *
 * POST /api/mystery/test/start-pipeline
 * Body: { projectId: string }
 *
 * Returns: { status: "pipeline-started", ... }
 */
export async function POST(req: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { projectId } = body;

    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const project = readProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    console.log(`[test:start-pipeline] Starting pipeline for project ${projectId}`);

    // Start pipeline in background
    (async () => {
      try {
        // 1. Research
        console.log(`[test] Step 1: Research`);
        updateProject(projectId, (p) => {
          p.stage = "research";
        });
        const updated1 = readProject(projectId)!;
        await researchTopic(projectId, updated1);

        // 2. Fact-checking
        console.log(`[test] Step 2: Fact-checking`);
        updateProject(projectId, (p) => {
          p.factcheckResults = p.factcheckResults || {};
        });

        // 3. Timeline (embedded in script)
        console.log(`[test] Step 3: Timeline`);
        console.log("[test] Timeline generation embedded in script step");

        // 4. Script generation
        console.log(`[test] Step 4: Script generation`);
        updateProject(projectId, (p) => {
          p.stage = "script";
        });
        const updated4 = readProject(projectId)!;
        await generateScript(projectId, updated4);

        // 5. Scene composition
        console.log(`[test] Step 5: Scene composition`);
        updateProject(projectId, (p) => {
          p.stage = "scenes";
        });
        const updated5 = readProject(projectId)!;
        try {
          await generateScenes(projectId, updated5);
        } catch (err: any) {
          console.warn(`[test] Scene composition failed, continuing:`, err?.message);
          // Create minimal fallback scenes from script sections
          const sections = updated5.script?.sections || [];
          const fallbackScenes = sections.flatMap((section, sectionIdx) => {
            const sentences = section.text.match(/[^.!?…]+(?:[.!?…]+|$)/g) || [section.text];
            return sentences.map((sentence, sentenceIdx) => ({
              id: `scene-${sectionIdx}-${sentenceIdx}`,
              sectionId: section.id,
              order: sentenceIdx,
              text: sentence.trim(),
              visualType: "ai_reconstruction" as const,
              visualQuery: sentence.trim().slice(0, 120),
              visualStatus: "pending" as const,
              narration: [],
              visualOrigin: section.visualOrigin,
              factStatus: section.factStatus,
              sources: section.sources || [],
              aiReconstructionExplained: section.needsDisclaimer,
            }));
          });
          updateProject(projectId, (p) => {
            p.scenes = fallbackScenes;
          });
        }

        // 6. Asset integration
        console.log(`[test] Step 6: Real visual asset integration`);
        const updated6 = readProject(projectId)!;
        if (updated6.scenes) {
          const { scenes: scenesWithAssets, assets: sceneAssets } = integrateAssetsWithScenes(
            updated6.input.topic,
            updated6.scenes
          );
          const assetValidation = validateAssetSources(sceneAssets);
          console.log(
            `[test] Assets integrated: ${assetValidation.summary.realAssets} real, ${assetValidation.summary.aiGenerated} AI`
          );
          updateProject(projectId, (p) => {
            p.scenes = scenesWithAssets;
            p.sceneAssets = sceneAssets as any;
          });
        }

        // 7. Visual research
        console.log(`[test] Step 7: Visual research & AI`);
        updateProject(projectId, (p) => {
          p.stage = "visuals";
        });

        // 8. Boredom detection
        console.log(`[test] Step 8: Scene optimization`);
        const updated8 = readProject(projectId)!;
        if (updated8.scenes) {
          const analyses = detectBoringScenes(updated8.scenes);
          const report = generateBoredumReport(analyses);
          console.log(`[test] ${report}`);
          if (analyses.length > 0) {
            const optimized = optimizeBoringScenes(updated8.scenes, analyses);
            updateProject(projectId, (p) => {
              p.scenes = optimized;
            });
          }
        }

        // 9. Narration (Piper TTS)
        console.log(`[test] Step 9: Narration & audio`);
        updateProject(projectId, (p) => {
          p.stage = "narration";
        });
        const updated9 = readProject(projectId)!;
        try {
          const narrationResult = await generateNarrationForScenes(projectId, updated9);
          if (narrationResult.success) {
            console.log(`[test] ✅ Narration generated: ${narrationResult.segments.length} segments, ${narrationResult.totalDuration}s total`);
            updateProject(projectId, (p) => {
              p.narrationSegments = narrationResult.segments as any;
            });
          } else {
            console.warn(`[test] ⚠️ Narration failed: ${narrationResult.error}`);
            updateProject(projectId, (p) => {
              p.narrationError = narrationResult.error;
            });
          }
        } catch (err: any) {
          console.warn(`[test] Narration generation error:`, err?.message);
        }

        // 10. Subtitles
        console.log(`[test] Step 10: Subtitle generation`);
        const updated10 = readProject(projectId)!;
        try {
          if (updated10.narrationSegments && updated10.script?.sections) {
            const sceneIds = updated10.scenes?.map((s) => s.id) || [];
            const subtitleTrack = generateSubtitles(
              updated10.narrationSegments,
              sceneIds,
              "ko-KR"
            );
            const verifiedCount = subtitleTrack.subtitles.filter((s: any) => s.verified).length;
            console.log(
              `[test] ✅ Subtitles generated: ${subtitleTrack.subtitles.length} subtitles (${verifiedCount} verified)`
            );
            updateProject(projectId, (p) => {
              p.subtitleTracks = [subtitleTrack] as any;
            });
          }
        } catch (err: any) {
          console.warn(`[test] Subtitle generation error:`, err?.message);
        }

        // 11. QA
        console.log(`[test] Step 11: QA checks`);
        const updated11 = readProject(projectId)!;
        const checks = {
          hasResearch: !!updated11.research && updated11.research.length > 0,
          hasScript: !!updated11.script && updated11.script.sections.length > 0,
          hasScenes: !!updated11.scenes && updated11.scenes.length > 0,
          hasNarration: !!updated11.narrationSegments && updated11.narrationSegments.length > 0,
          hasSubtitles: !!updated11.subtitleTracks && updated11.subtitleTracks.length > 0,
        };
        console.log("[test] QA checks:", checks);

        // 12. Render
        console.log(`[test] Step 12: Video rendering`);
        updateProject(projectId, (p) => {
          p.stage = "render";
        });
        try {
          const updated12 = readProject(projectId)!;
          await renderMysteryVideo(projectId, updated12);
          console.log(`[test] Step 12 complete: MP4 rendered`);
        } catch (err: any) {
          console.warn(`[test] Video rendering failed:`, err?.message);
          // Don't fail the pipeline, just log the error
          appendErrorLog(projectId, {
            stage: "render",
            message: `Rendering failed: ${err?.message}`,
            retryable: false,
          });
        }

        // 13. Done
        console.log(`[test] Step 13: Complete`);
        updateProject(projectId, (p) => {
          p.stage = "done";
        });

        console.log(`[test:start-pipeline] ✅ Pipeline completed for project ${projectId}`);
      } catch (err: any) {
        console.error(`[test:start-pipeline] Error:`, err);
        appendErrorLog(projectId, {
          stage: "research",
          message: `Test pipeline failed: ${err?.message || String(err)}`,
          retryable: true,
        });
        updateProject(projectId, (p) => {
          p.pipelineError = err?.message || String(err);
        });
      }
    })().catch(console.error);

    return NextResponse.json({
      status: "pipeline-started",
      projectId,
      message: "Test pipeline initiated - will process in background",
    });
  } catch (err: any) {
    console.error("[test:start-pipeline] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to start pipeline" },
      { status: 500 }
    );
  }
}
