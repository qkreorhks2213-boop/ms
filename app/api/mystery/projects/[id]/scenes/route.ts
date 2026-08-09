import { NextRequest, NextResponse } from "next/server";
import { generateScenes } from "../../../../../../lib/mystery/scenes";
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
  if (!project!.script || project!.script.sections.some((s) => s.status !== "done")) {
    return NextResponse.json({ error: "대본이 아직 완성되지 않았습니다." }, { status: 400 });
  }

  const lockKey = `${params.id}:scenes`;
  if (!tryAcquire(lockKey)) {
    return NextResponse.json({ status: "already-running" });
  }

  updateProject(params.id, (p) => {
    p.pipelineError = undefined;
  });

  generateScenes(params.id, project!)
    .catch((err: any) => {
      const message = err?.message || String(err);
      console.error(`[mystery] 장면 생성 실패 (${params.id}):`, err);
      updateProject(params.id, (p) => {
        p.pipelineError = message;
      });
      appendErrorLog(params.id, { stage: "scenes", message, retryable: true });
    })
    .finally(() => release(lockKey));

  return NextResponse.json({ status: "started" });
}
