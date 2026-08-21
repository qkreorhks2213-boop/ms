import fs from "fs";
import { execFileSync } from "child_process";

/**
 * 자막을 영상에 입히려면(drawtext) 한글이 깨지지 않는 폰트 파일 경로가 필요하다.
 * 사용자가 CAPTION_FONT_PATH를 직접 지정하지 않으면, OS별로 흔히 존재하는
 * 한글 지원 폰트를 순서대로 찾아본다. 하나도 없으면 null을 반환하고,
 * 렌더링 단계에서는 자막 없이 영상만 합성한다 (자막을 건너뛴 이유를 알려줌).
 */
const CANDIDATE_PATHS = [
  // Windows — 맑은 고딕은 기본 내장 폰트
  "C:\\Windows\\Fonts\\malgun.ttf",
  "C:\\Windows\\Fonts\\malgunbd.ttf",
  // macOS
  "/System/Library/Fonts/Supplemental/AppleGothic.ttf",
  "/System/Library/Fonts/AppleSDGothicNeo.ttc",
  // Linux (나눔고딕/Noto CJK가 흔한 경로에 설치되어 있는 경우)
  "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
  "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
];

/**
 * 위 고정 경로 목록에 없는 배포 환경(예: 리눅스 서버/컨테이너에 다른 이름으로 CJK 폰트가
 * 깔려 있는 경우)을 위한 마지막 안전장치. 하드코딩된 경로 대신 시스템의 fontconfig에
 * "한국어(lang=ko)를 지원하는 폰트가 뭐야?"라고 직접 물어본다 — 정적 목록보다 훨씬
 * 범용적으로 동작한다. fc-match가 없거나 실패해도(Windows/macOS 등) 조용히 넘어간다.
 */
function findFontViaFontconfig(): string | null {
  try {
    const output = execFileSync("fc-match", [":lang=ko", "-f", "%{file}"], {
      encoding: "utf-8",
      timeout: 3000,
    }).trim();
    return output && fs.existsSync(output) ? output : null;
  } catch {
    return null;
  }
}

export function resolveCaptionFont(): string | null {
  const override = process.env.CAPTION_FONT_PATH;
  if (override && fs.existsSync(override)) {
    return override;
  }
  for (const p of CANDIDATE_PATHS) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return findFontViaFontconfig();
}

/** ffmpeg 필터 문자열 안에 경로를 넣을 때 콜론과 역슬래시를 이스케이프한다. */
export function escapeFfmpegPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/:/g, "\\:");
}
