import { NextRequest, NextResponse } from "next/server";
import { readProject, updateProject, appendErrorLog } from "@/lib/mystery/store";
import { researchTopic } from "@/lib/mystery/research";
import { generateScript } from "@/lib/mystery/script";
import { generateScenes } from "@/lib/mystery/scenes";
import { detectBoringScenes, optimizeBoringScenes, generateBoredumReport } from "@/lib/mystery/boredumDetector";

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
        await generateScenes(projectId, updated5);

        // 6. Visual research
        console.log(`[test] Step 6: Visual research & AI`);
        updateProject(projectId, (p) => {
          p.stage = "visuals";
        });

        // 7. Boredom detection
        console.log(`[test] Step 7: Scene optimization`);
        const updated7 = readProject(projectId)!;
        if (updated7.scenes) {
          const analyses = detectBoringScenes(updated7.scenes);
          const report = generateBoredumReport(analyses);
          console.log(`[test] ${report}`);
          if (analyses.length > 0) {
            const optimized = optimizeBoringScenes(updated7.scenes, analyses);
            updateProject(projectId, (p) => {
              p.scenes = optimized;
            });
          }
        }

        // 8. Narration
        console.log(`[test] Step 8: Narration & audio`);
        updateProject(projectId, (p) => {
          p.stage = "narration";
        });

        // 9. QA
        console.log(`[test] Step 9: QA checks`);
        const updated9 = readProject(projectId)!;
        const checks = {
          hasResearch: !!updated9.research && updated9.research.length > 0,
          hasScript: !!updated9.script && updated9.script.sections.length > 0,
          hasScenes: !!updated9.scenes && updated9.scenes.length > 0,
        };
        console.log("[test] QA checks:", checks);

        // 10. Render
        console.log(`[test] Step 10: Video rendering`);
        updateProject(projectId, (p) => {
          p.stage = "render";
        });

        // 11. Done
        console.log(`[test] Step 11: Complete`);
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
