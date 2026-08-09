import fs from "fs";
import path from "path";
import { ffmpeg } from "../common/ffmpegBase";
import { escapeFfmpegPath, resolveCaptionFont } from "../common/fonts";
import { TARGET_HEIGHT, TARGET_WIDTH } from "./constants";

/**
 * 외부 차트 렌더링 서비스(QuickChart 등) 없이, 실제로 조사·확인된 수치를 화면에 깔끔하게
 * 보여주는 정적 카드 이미지를 ffmpeg drawtext만으로 직접 그린다. 실제 시계열 차트 이미지를
 * 긁어올 방법이 없는 환경(이미지 검색 API 미설정 등)에서도 "허구 이미지" 대신 "실제 수치"를
 * 화면에 낼 수 있는 최후의 안전한 수단이다 — 숫자 자체는 리서치 단계에서 검색으로 확인한
 * 값이어야 하며, 이 함수는 그 값을 보기 좋게 그리기만 한다(숫자를 지어내지 않는다).
 */
export interface DataCardParams {
  /** 카드 중앙에 크게 표시할 핵심 수치/문구(예: "1,480원", "+2.3%"). */
  headline: string;
  /** headline 위에 작게 표시할 라벨(예: "원/달러 환율"). */
  label: string;
  /** 하단에 표시할 출처 한 줄(예: "출처: 연합뉴스 · 2026-08-08"). */
  sourceLabel?: string;
  /** 카드 종류에 따른 포인트 색상(hex, # 없이). */
  accentColor?: string;
}

const BG_COLOR = "0f1115";
const CARD_COLOR = "181b21";

export async function renderDataCard(params: DataCardParams, outPath: string): Promise<void> {
  const { headline, label, sourceLabel, accentColor = "c6a468" } = params;
  const fontPath = resolveCaptionFont();
  if (!fontPath) {
    throw new Error("데이터 카드용 한글 폰트를 찾지 못했습니다. CAPTION_FONT_PATH를 지정하세요.");
  }
  const safeFont = escapeFfmpegPath(fontPath);
  const workDir = path.dirname(outPath);
  fs.mkdirSync(workDir, { recursive: true });

  const labelFile = path.join(workDir, `${path.basename(outPath, ".png")}_label.txt`);
  const headlineFile = path.join(workDir, `${path.basename(outPath, ".png")}_headline.txt`);
  const sourceFile = path.join(workDir, `${path.basename(outPath, ".png")}_source.txt`);
  fs.writeFileSync(labelFile, label.replace(/\r?\n/g, " ").trim(), "utf-8");
  fs.writeFileSync(headlineFile, headline.replace(/\r?\n/g, " ").trim(), "utf-8");
  fs.writeFileSync(sourceFile, (sourceLabel || "").replace(/\r?\n/g, " ").trim(), "utf-8");

  const cardW = Math.round(TARGET_WIDTH * 0.68);
  const cardH = Math.round(TARGET_HEIGHT * 0.42);
  const cardX = Math.round((TARGET_WIDTH - cardW) / 2);
  const cardY = Math.round((TARGET_HEIGHT - cardH) / 2);

  // expansion=none 필수 — headline은 "3.5%"처럼 %가 매우 흔한데, ffmpeg drawtext 기본값
  // (expansion=normal)은 textfile 내용도 %{...} 확장 문법으로 해석해서 %가 섞인 줄이 통째로
  // 사라진다(직접 렌더링해서 실제로 확인한 문제).
  const filters = [
    `drawbox=x=${cardX}:y=${cardY}:w=${cardW}:h=${cardH}:color=0x${CARD_COLOR}:t=fill`,
    `drawbox=x=${cardX}:y=${cardY}:w=10:h=${cardH}:color=0x${accentColor}:t=fill`,
    `drawtext=fontfile='${safeFont}':textfile='${escapeFfmpegPath(labelFile)}':expansion=none:fontsize=42:fontcolor=0x9a9da5:x=${cardX + 70}:y=${cardY + 70}`,
    `drawtext=fontfile='${safeFont}':textfile='${escapeFfmpegPath(headlineFile)}':expansion=none:fontsize=118:fontcolor=white:x=${cardX + 70}:y=${cardY + 140}`,
    `drawtext=fontfile='${safeFont}':textfile='${escapeFfmpegPath(sourceFile)}':expansion=none:fontsize=28:fontcolor=0x6f727a:x=${cardX + 70}:y=${cardY + cardH - 70}`,
  ];

  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(`color=c=0x${BG_COLOR}:s=${TARGET_WIDTH}x${TARGET_HEIGHT}`)
      .inputOptions(["-f lavfi"])
      .videoFilters(filters)
      .outputOptions(["-frames:v 1", "-y"])
      .on("error", (err, _stdout, stderr) => reject(new Error(`${err.message}\n${(stderr || "").trim()}`)))
      .on("end", () => resolve())
      .save(outPath);
  });
}
