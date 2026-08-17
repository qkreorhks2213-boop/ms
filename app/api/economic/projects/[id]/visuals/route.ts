import { NextRequest, NextResponse } from "next/server";
import { generateAllSceneVisuals } from "../../../../../../lib/economic/visuals";
import { checkOwnership, requireUserId } from "../../../../../../lib/economic/authGuard";
import { appendErrorLog, readProject, updateProject } from "../../../../../../lib/economic/store";
import { release, tryAcquire } from "../../../../../../lib/economic/lock";

export const runtime = "nodejs";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;
  const project = readProject(params.id);
  const ownershipError = checkOwnership(project, auth.userId);
  if (ownershipError) return ownershipError;
  if (!project!.scenes || project!.scenes.length === 0) {
    return NextResponse.json({ error: "장면이 아직 생성되지 않았습니다." }, { status: 400 });
  }

  const lockKey = `${params.id}:visuals`;
  if (!tryAcquire(lockKey)) {
    return NextResponse.json({ status: "already-running" });
  }

  updateProject(params.id, (p) => {
    p.pipelineError = undefined;
  });

  generateAllSceneVisuals(params.id, project!)
    .catch((err) => {
      const message = err?.message || String(err);
      console.error(`[economic] 시각자료 소싱 실패 (${params.id}):`, err);
      updateProject(params.id, (p) => {
        p.pipelineError = message;
      });
      appendErrorLog(params.id, { stage: "visuals", message, retryable: true });
    })
    .finally(() => release(lockKey));

  return NextResponse.json({ status: "started" });
}
