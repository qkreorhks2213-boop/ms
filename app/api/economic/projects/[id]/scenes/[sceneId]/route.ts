import { NextRequest, NextResponse } from "next/server";
import { checkOwnership, requireUserId } from "../../../../../../../lib/economic/authGuard";
import { readProject, updateProject } from "../../../../../../../lib/economic/store";

export const runtime = "nodejs";

/** 장면의 대본 텍스트 또는 시각자료 검색어/수치를 사용자가 직접 수정(검수/편집 단계). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; sceneId: string } }
) {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;
  const project = readProject(params.id);
  const ownershipError = checkOwnership(project, auth.userId);
  if (ownershipError) return ownershipError;
  if (!project?.scenes) {
    return NextResponse.json({ error: "장면이 아직 생성되지 않았습니다." }, { status: 404 });
  }
  const body = await req.json();

  const updated = updateProject(params.id, (p) => {
    const scene = p.scenes?.find((s) => s.id === params.sceneId);
    if (!scene) return;
    if (typeof body.visualQuery === "string" && body.visualQuery.trim()) {
      scene.visualQuery = body.visualQuery.trim();
      scene.visualStatus = "pending";
      scene.visualUrl = undefined;
    }
    if (typeof body.visualHeadline === "string") {
      scene.visualHeadline = body.visualHeadline.trim();
      scene.visualStatus = "pending";
      scene.visualUrl = undefined;
    }
    if (typeof body.text === "string" && body.text.trim()) {
      scene.text = body.text.trim();
      // 내레이션 텍스트가 바뀌면 기존 음성은 더 이상 최신 상태가 아니다 — 다시 합성해야 함을 표시.
      scene.narration = [];
      scene.durationSeconds = undefined;
    }
  });

  return NextResponse.json({ project: updated });
}
