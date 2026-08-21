import { path as ffmpegBinaryPath } from "@ffmpeg-installer/ffmpeg";
import { path as ffprobeBinaryPath } from "@ffprobe-installer/ffprobe";
import ffmpeg from "fluent-ffmpeg";

// ffmpeg-static(npm)의 최신 정적 빌드는 라이선스/빌드 복잡도 때문에 drawtext 필터가 아예
// 빠져 있어(직접 검증함: `ffmpeg -filters`에 drawtext가 없음) 자막이 조용히 렌더링되지 않는
// 문제가 있었다. @ffmpeg-installer/ffmpeg가 받아오는 정적 빌드는 drawtext를 포함하고 있어
// 이 문제가 없다 — 그래서 이 패키지로 고정한다. 이 파일은 도메인과 무관한 ffmpeg 실행 파일
// 경로 설정 + 범용 프로브 유틸만 담는다. 해상도/타임아웃 같은 도메인별 렌더링 상수는
// lib/economic/render.ts, lib/economic/constants.ts에 둔다.
if (ffmpegBinaryPath) {
  ffmpeg.setFfmpegPath(ffmpegBinaryPath);
}
if (ffprobeBinaryPath) {
  ffmpeg.setFfprobePath(ffprobeBinaryPath);
}

export { ffmpeg };

export function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err);
      const duration = data?.format?.duration;
      if (!duration || Number.isNaN(duration)) {
        return reject(new Error("영상 길이를 읽지 못했습니다."));
      }
      resolve(duration);
    });
  });
}

export function getVideoDimensions(filePath: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err);
      const videoStream = data?.streams?.find((s) => s.codec_type === "video");
      const width = videoStream?.width;
      const height = videoStream?.height;
      if (!width || !height) {
        return reject(new Error("영상 해상도를 읽지 못했습니다."));
      }
      resolve({ width, height });
    });
  });
}
