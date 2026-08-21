import { NextRequest, NextResponse } from "next/server";
import { researchTopic } from "../../../../../../lib/economic/research";
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

  const lockKey = `${params.id}:research`;
  if (!tryAcquire(lockKey)) {
    return NextResponse.json({ status: "already-running" });
  }

  updateProject(params.id, (p) => {
    p.pipelineError = undefined;
  });

  researchTopic(params.id, project!)
    .catch((err) => {
      const message = err?.message || String(err);
      console.error(`[economic] 리서치 실패 (${params.id}):`, err);
      updateProject(params.id, (p) => {
        p.pipelineError = message;
      });
      appendErrorLog(params.id, { stage: "research", message, retryable: true });
    })
    .finally(() => release(lockKey));

  return NextResponse.json({ status: "started" });
}
