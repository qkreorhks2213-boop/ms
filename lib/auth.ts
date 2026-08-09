import type { NextAuthOptions } from "next-auth";
import type { OAuthConfig } from "next-auth/providers/oauth";
import GoogleProvider from "next-auth/providers/google";

/**
 * 로그인 방식: NextAuth, JWT 세션(별도 DB 없음). 이 프로그램은 이미 프로젝트 상태를
 * data/economic-projects/<id>/project.json 파일로 저장하고 있어서(lib/economic/store.ts),
 * 로그인도 DB를 새로 들이지 않고 "요청마다 세션에서 사용자 id를 뽑아 프로젝트의 userId와
 * 대조"하는 방식으로 충분하다 — 기존 파일 기반 구조를 유지하면서 로그인만 얹는 방식이다.
 *
 * 네이버는 NextAuth 내장 프로바이더가 아니라 OAuth2 커스텀 프로바이더로 직접 정의한다
 * (구글/네이버 둘 다 Client ID·Secret은 사용자가 각자 콘솔에서 발급받아 .env.local에 넣어야
 * 함 — README "로그인 설정" 참고). 둘 다 설정 안 하면 providers가 빈 배열이 되고, 로그인
 * 화면에는 "관리자가 아직 로그인 방법을 설정하지 않았습니다" 같은 안내만 뜬다(빌드가 깨지지
 * 않도록 하는 우아한 성능 저하).
 */

interface NaverProfile {
  resultcode: string;
  message: string;
  response: {
    id: string;
    nickname?: string;
    name?: string;
    email?: string;
    profile_image?: string;
  };
}

function NaverProvider(options: { clientId: string; clientSecret: string }): OAuthConfig<NaverProfile> {
  return {
    id: "naver",
    name: "네이버",
    type: "oauth",
    authorization: {
      url: "https://nid.naver.com/oauth2.0/authorize",
      params: { response_type: "code" },
    },
    token: "https://nid.naver.com/oauth2.0/token",
    userinfo: "https://openapi.naver.com/v1/nid/me",
    checks: ["state"],
    clientId: options.clientId,
    clientSecret: options.clientSecret,
    profile(profile) {
      return {
        id: profile.response.id,
        name: profile.response.name || profile.response.nickname || "네이버 사용자",
        email: profile.response.email,
        image: profile.response.profile_image,
      };
    },
  };
}

const providers: NextAuthOptions["providers"] = [];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

if (process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET) {
  providers.push(
    NaverProvider({
      clientId: process.env.NAVER_CLIENT_ID,
      clientSecret: process.env.NAVER_CLIENT_SECRET,
    })
  );
}

export const authOptions: NextAuthOptions = {
  providers,
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/",
  },
  callbacks: {
    async jwt({ token, account }) {
      // provider가 서로 다른 사용자에게 같은 숫자 id를 줄 수 있으므로 provider를 접두사로 붙여
      // 프로젝트 소유권 검사에 쓸 전역 유일 사용자 id를 만든다.
      if (account) {
        token.userId = `${account.provider}:${account.providerAccountId}`;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId) {
        (session.user as { id?: string }).id = token.userId as string;
      }
      return session;
    },
  },
};
