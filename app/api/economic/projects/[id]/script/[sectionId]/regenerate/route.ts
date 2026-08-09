import { NextRequest, NextResponse } from "next/server";
import { regenerateSection } from "../../../../../../../../lib/economic/script";
import { checkOwnership, requireUserId } from "../../../../../../../../lib/economic/authGuard";
import { appendErrorLog, readProject, updateProject } from "../../../../../../../../lib/economic/store";
import { release, tryAcquire } from "../../../../../../../../lib/economic/lock";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; sectionId: string } }
) {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;
  const project = readProject(params.id);
  const ownershipError = checkOwnership(project, auth.userId);
  if (ownershipError) return ownershipError;

  const lockKey = `${params.id}:script`;
  if (!tryAcquire(lockKey)) {
    return NextResponse.json({ status: "already-running" });
  }

  updateProject(params.id, (p) => {
    p.pipelineError = undefined;
  });

  regenerateSection(params.id, project!, params.sectionId)
    .catch((err) => {
      const message = err?.message || String(err);
      console.error(`[economic] 섹션 재생성 실패 (${params.id}/${params.sectionId}):`, err);
      updateProject(params.id, (p) => {
        p.pipelineError = message;
      });
      appendErrorLog(params.id, { stage: "script", unitId: params.sectionId, message, retryable: true });
    })
    .finally(() => release(lockKey));

  return NextResponse.json({ status: "started" });
}
