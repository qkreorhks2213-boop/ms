import { NextRequest, NextResponse } from "next/server";
import { regenerateSceneVisual } from "../../../../../../../../lib/economic/visuals";
import { checkOwnership, requireUserId } from "../../../../../../../../lib/economic/authGuard";
import { readProject, updateProject } from "../../../../../../../../lib/economic/store";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; sceneId: string } }
) {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;
  const project = readProject(params.id);
  const ownershipError = checkOwnership(project, auth.userId);
  if (ownershipError) return ownershipError;

  try {
    await regenerateSceneVisual(params.id, params.sceneId);
    return NextResponse.json({ status: "done" });
  } catch (err: any) {
    updateProject(params.id, (p) => {
      p.pipelineError = err?.message || String(err);
    });
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
