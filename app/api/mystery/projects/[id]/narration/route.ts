import { NextRequest, NextResponse } from "next/server";
import { synthesizeAllNarration } from "../../../../../../lib/mystery/tts";
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
  if (!project!.scenes || project!.scenes.length === 0) {
    return NextResponse.json({ error: "장면이 아직 생성되지 않았습니다." }, { status: 400 });
  }
  // 시각자료 소싱과 내레이션 생성은 서로 독립적이라(둘 다 장면 텍스트에만 의존) 동시에
  // 진행해도 된다 — 렌더링 단계 진입 전에 둘 다 끝나 있으면 되므로 여기서 시각자료 완료를
  // 기다리지 않는다.

  const lockKey = `${params.id}:narration`;
  if (!tryAcquire(lockKey)) {
    return NextResponse.json({ status: "already-running" });
  }

  updateProject(params.id, (p) => {
    p.pipelineError = undefined;
  });

  synthesizeAllNarration(params.id, project!)
    .catch((err) => {
      const message = err?.message || String(err);
      console.error(`[mystery] 내레이션 생성 실패 (${params.id}):`, err);
      updateProject(params.id, (p) => {
        p.pipelineError = message;
      });
      appendErrorLog(params.id, { stage: "narration", message, retryable: true });
    })
    .finally(() => release(lockKey));

  return NextResponse.json({ status: "started" });
}
