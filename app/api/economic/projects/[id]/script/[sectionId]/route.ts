import { NextRequest, NextResponse } from "next/server";
import { checkOwnership, requireUserId } from "../../../../../../../lib/economic/authGuard";
import { CHARS_PER_MINUTE } from "../../../../../../../lib/economic/types";
import { readProject, updateProject } from "../../../../../../../lib/economic/store";

export const runtime = "nodejs";

/**
 * 사용자가 대본 섹션을 직접 고쳐 쓴 경우(검수/편집 단계). 주의: 장면/시각자료/내레이션이
 * 이미 이 섹션 기준으로 생성된 뒤에 텍스트를 고치면 그 산출물들은 옛 텍스트 기준이라 최신
 * 대본과 어긋난다 — 대본을 고쳤다면 "장면 다시 만들기"를 함께 실행해야 한다(UI에서 안내).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; sectionId: string } }
) {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;
  const project = readProject(params.id);
  const ownershipError = checkOwnership(project, auth.userId);
  if (ownershipError) return ownershipError;
  if (!project?.script) {
    return NextResponse.json({ error: "대본이 아직 생성되지 않았습니다." }, { status: 404 });
  }
  const body = await req.json();
  const text = String(body?.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "text가 필요합니다." }, { status: 400 });
  }

  const updated = updateProject(params.id, (p) => {
    const section = p.script?.sections.find((s) => s.id === params.sectionId);
    if (!section) return;
    section.text = text;
    section.charCount = text.length;
    section.estimatedSeconds = Math.round((text.length / CHARS_PER_MINUTE) * 60);
    section.status = "done";
    if (p.script) {
      p.script.totalCharCount = p.script.sections.reduce((n, s) => n + s.charCount, 0);
      p.script.estimatedMinutes = Math.round((p.script.totalCharCount / CHARS_PER_MINUTE) * 10) / 10;
    }
  });

  return NextResponse.json({ project: updated });
}
