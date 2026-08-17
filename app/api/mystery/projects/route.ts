import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "../../../../lib/economic/authGuard";
import { createProject, listProjects } from "../../../../lib/mystery/store";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;
  return NextResponse.json({ projects: listProjects(auth.userId) });
}

export async function POST(req: NextRequest) {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const project = createProject(body, auth.userId);
    return NextResponse.json({ project });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 400 });
  }
}
