import type { Metadata } from "next";
import { Fraunces, Manrope, IBM_Plex_Mono } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

// 예전엔 Oswald(콘덴스드 대문자 스포츠 포스터 느낌)였는데, 브랜드를 "예능 편집" 톤에서
// "고급 편집 스튜디오" 톤으로 옮기면서 캐릭터 있는 세리프(Fraunces)로 교체했다.
const display = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

// 본문도 IBM Plex Sans(다소 개발자 도구 느낌)에서 더 정갈한 인상의 Manrope로 교체.
const body = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "경제 다큐 스튜디오 — AI 경제 뉴스 롱폼 자동 제작",
  description: "경제 주제 하나로 최신 뉴스 리서치·대본·실제 시각자료·내레이션·자막을 자동 생성해 실제 사실에 근거한 경제 뉴스 롱폼 영상을 만들어 드립니다.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
