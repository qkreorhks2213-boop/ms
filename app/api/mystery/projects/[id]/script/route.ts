import { NextRequest, NextResponse } from "next/server";
import { generateScript } from "../../../../../../lib/mystery/script";
import { checkOwnership, requireUserId } from "../../../../../../lib/economic/authGuard";
import { appendErrorLog, readProject, updateProject } from "../../../../../../lib/mystery/store";
import { release, tryAcquire } from "../../../../../../lib/economic/lock";

export const runtime = "nodejs";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
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

  generateScript(params.id, project!)
    .catch((err) => {
      const message = err?.message || String(err);
      console.error(`[mystery] 대본 생성 실패 (${params.id}):`, err);
      updateProject(params.id, (p) => {
        p.pipelineError = message;
      });
      appendErrorLog(params.id, { stage: "script", message, retryable: true });
    })
    .finally(() => release(lockKey));

  return NextResponse.json({ status: "started" });
}

/** 제목 후보 중 하나를 최종 제목으로 선택(검수/편집 단계). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;
  const project = readProject(params.id);
  const ownershipError = checkOwnership(project, auth.userId);
  if (ownershipError) return ownershipError;
  if (!project?.script) {
    return NextResponse.json({ error: "대본이 아직 생성되지 않았습니다." }, { status: 404 });
  }
  const body = await req.json();
  const title = String(body?.title || "").trim();
  if (!title) {
    return NextResponse.json({ error: "title이 필요합니다." }, { status: 400 });
  }
  const updated = updateProject(params.id, (p) => {
    if (p.script) p.script.title = title;
  });
  return NextResponse.json({ project: updated });
}
