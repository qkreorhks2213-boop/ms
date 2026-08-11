import { NextRequest, NextResponse } from "next/server";
import { createProject } from "@/lib/mystery/store";

/**
 * Test endpoint for quick documentary creation without auth.
 * Only available in development mode.
 *
 * POST /api/mystery/test/quick-create
 * Body: { topic: string }
 *
 * Returns: { project: MysteryProject }
 */
export async function POST(req: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { topic } = body;

    if (!topic || typeof topic !== "string" || !topic.trim()) {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    // Create project with test user
    const testUserId = "test-user-" + Date.now();
    const project = createProject(
      {
        topic: topic.trim(),
        caseType: "unsolved_case",
        targetMinutes: 15,
        angles: ["case_focused", "evidence_focused", "mystery_focused"],
        endingStyle: "compare_hypotheses",
        useRealPhotos: true,
        useAiReconstruction: true,
        useBgm: true,
        sceneVisualTarget: 50,
      },
      testUserId
    );

    console.log(`[test:quick-create] Created project ${project.id} for testing`);

    // Note: Auto-pipeline requires authentication and must be triggered separately
    // Use the auto-pipeline endpoint with proper auth, or use test/start-pipeline endpoint

    return NextResponse.json({
      success: true,
      project,
      testUserId,
      nextStep: "POST to /api/mystery/test/start-pipeline with projectId to start processing",
      exampleCurl: `curl -X POST http://localhost:3000/api/mystery/test/start-pipeline -H "Content-Type: application/json" -d '{"projectId": "${project.id}"}'`,
    });
  } catch (err: any) {
    console.error("[test:quick-create] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to create project" },
      { status: 500 }
    );
  }
}
