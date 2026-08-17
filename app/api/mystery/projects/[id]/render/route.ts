import { NextRequest, NextResponse } from "next/server";
import { submitRenderJob } from "../../../../../../lib/mystery/render";
import { checkOwnership, requireUserId } from "../../../../../../lib/economic/authGuard";
import { readProject } from "../../../../../../lib/mystery/store";

export const runtime = "nodejs";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;
  const project = readProject(params.id);
  const ownershipError = checkOwnership(project, auth.userId);
  if (ownershipError) return ownershipError;
  if (project!.render.status === "working") {
    return NextResponse.json({ status: "already-running" });
  }

  submitRenderJob(params.id);
  return NextResponse.json({ status: "started" });
}
