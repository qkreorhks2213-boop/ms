import { NextRequest, NextResponse } from "next/server";
import { checkOwnership, requireUserId } from "../../../../../lib/economic/authGuard";
import { deleteProject, readProject, renameProject } from "../../../../../lib/mystery/store";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;
  const project = readProject(params.id);
  const ownershipError = checkOwnership(project, auth.userId);
  if (ownershipError) return ownershipError;
  return NextResponse.json({ project });
}

/** 프로젝트 이름 변경. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;
  const project = readProject(params.id);
  const ownershipError = checkOwnership(project, auth.userId);
  if (ownershipError) return ownershipError;

  const body = await req.json();
  const name = String(body?.name || "");
  if (!name.trim()) {
    return NextResponse.json({ error: "name이 필요합니다." }, { status: 400 });
  }
  try {
    const updated = renameProject(params.id, name);
    return NextResponse.json({ project: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 400 });
  }
}

/** 프로젝트 삭제. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;
  const project = readProject(params.id);
  const ownershipError = checkOwnership(project, auth.userId);
  if (ownershipError) return ownershipError;

  deleteProject(params.id);
  return NextResponse.json({ status: "deleted" });
}
