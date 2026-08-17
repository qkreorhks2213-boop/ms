/** @type {import('next').NextConfig} */

const nextConfig = {
  output: "standalone",

  // @ffmpeg-installer/ffmpeg, @ffprobe-installer/ffprobe는 실행 파일 경로를 __dirname
  // 기준으로 계산하는데, webpack이 이 패키지들을 .next 번들 안으로 넣어버리면 __dirname이
  // 실제 node_modules 위치와 달라져서 "ffmpeg/ffprobe ENOENT" 오류가 난다.
  // 번들링 대상에서 제외해서 런타임에 node_modules에서 그대로 require 하도록 한다.
  experimental: {
    serverComponentsExternalPackages: [
      "@ffmpeg-installer/ffmpeg",
      "@ffprobe-installer/ffprobe",
      "fluent-ffmpeg",
    ],
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

module.exports = nextConfig;