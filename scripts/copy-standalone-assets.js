// next build (output: "standalone") 실행 후 자동으로 실행됨 (package.json의 "postbuild").
// standalone 서버 폴더에는 정적 파일(.next/static), public 폴더, .env.local이
// 기본적으로 포함되지 않아서 여기서 직접 복사해줌.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const standalone = path.join(root, ".next", "standalone");

function copy(src, dest, label) {
  if (!fs.existsSync(src)) {
    console.log(`[copy-standalone-assets] 건너뜀 (없음): ${label}`);
    return;
  }
  fs.cpSync(src, dest, { recursive: true });
  console.log(`[copy-standalone-assets] 복사 완료: ${label}`);
}

if (!fs.existsSync(standalone)) {
  console.error(
    "[copy-standalone-assets] .next/standalone 폴더가 없습니다. next.config.js의 output: 'standalone' 설정을 확인하세요."
  );
  process.exit(1);
}

copy(path.join(root, "public"), path.join(standalone, "public"), "public 폴더");
copy(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), ".next/static");
copy(path.join(root, ".env.local"), path.join(standalone, ".env.local"), ".env.local (API 키)");
// @ffmpeg-installer/ffmpeg의 실행 파일은 Next의 자동 추적에서 누락되는 경우가 있어 안전하게 직접 복사
// (플랫폼별 바이너리는 @ffmpeg-installer/<platform> 하위 패키지에 실제로 들어있으므로 함께 복사됨)
copy(
  path.join(root, "node_modules", "@ffmpeg-installer"),
  path.join(standalone, "node_modules", "@ffmpeg-installer"),
  "@ffmpeg-installer (영상 인코딩용 실행 파일)"
);
// @ffprobe-installer/ffprobe도 동일한 이유로 직접 복사 (영상 길이 측정용)
copy(
  path.join(root, "node_modules", "@ffprobe-installer"),
  path.join(standalone, "node_modules", "@ffprobe-installer"),
  "@ffprobe-installer (영상 길이 측정용 실행 파일)"
);
