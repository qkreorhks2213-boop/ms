import fs from "fs";
import path from "path";

/**
 * 배경음은 PDF("떡상채널 미니북 ② 경제 채널 시장 실측")에도 언급이 없다(§1~§8 전수 확인) —
 * 순수 선택 기능이며, 차분한 배경음 한 카테고리만 지원한다.
 */
const BGM_DIR = path.join(process.cwd(), "public", "audio", "bgm", "economic");
const AUDIO_EXTENSIONS = [".mp3", ".wav", ".m4a", ".aac", ".ogg"];

export function resolveEconomicBgmFile(): string | null {
  let files: string[];
  try {
    files = fs.readdirSync(BGM_DIR).filter((f) => AUDIO_EXTENSIONS.includes(path.extname(f).toLowerCase()));
  } catch {
    return null;
  }
  if (files.length === 0) return null;
  return path.join(BGM_DIR, files[Math.floor(Math.random() * files.length)]);
}
