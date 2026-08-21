import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../auth";
import type { EconomicProject } from "./types";

/**
 * 모든 API 라우트가 맨 처음에 호출한다. 로그인 안 한 요청은 401로 막고, 로그인했으면
 * 프로젝트 소유권 검사에 쓸 사용자 id를 돌려준다.
 */
export async function requireUserId(): Promise<{ userId: string } | { error: NextResponse }> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return { error: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }) };
  }
  return { userId };
}

/** 프로젝트가 존재하고 요청한 사용자의 소유가 맞는지 확인한다. */
export function checkOwnership(
  project: (EconomicProject | { userId: string }) | undefined,
  userId: string
): NextResponse | null {
  if (!project) {
    return NextResponse.json({ error: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
  }
  if (project.userId !== userId) {
    return NextResponse.json({ error: "이 프로젝트에 접근할 권한이 없습니다." }, { status: 403 });
  }
  return null;
}
