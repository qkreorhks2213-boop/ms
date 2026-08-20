/**
 * 자체 제작 그래픽 생성 모듈
 *
 * 다음 그래픽을 자동으로 생성한다:
 * - Timeline: 사건 타임라인
 * - Map: 장소 표시 지도
 * - Diagram: 구조 다이어그램
 * - DataCard: 정보 카드
 * - Evidence: 증거 설명
 *
 * NOTE: canvas 모듈이 필요합니다. 설치하려면:
 * npm install canvas
 */

let createCanvas: any = null;
try {
  createCanvas = require("canvas").createCanvas;
} catch {
  // canvas not installed, will use fallback
}

import { TimelineEvent } from "./types";

/**
 * Canvas 사용 불가능시 FFmpeg을 사용해 플레이스홀더 생성
 * 1920x1080 크기의 유효한 PNG 이미지 반환
 */
async function createPlaceholderBuffer(title: string): Promise<Buffer> {
  const { execSync } = require("child_process");
  const fs = require("fs");
  const path = require("path");
  const os = require("os");

  const tmpFile = path.join(os.tmpdir(), `placeholder-${Date.now()}.png`);

  try {
    const titleEscaped = title.replace(/'/g, "'\\''");
    const cmd = `ffmpeg -f lavfi -i color=c=1a1a2e:s=1920x1080:d=1 -vf "drawtext=fontsize=72:fontcolor=white:text='${titleEscaped}':x=(w-text_w)/2:y=(h-text_h)/2" -frames:v 1 -update 1 -y "${tmpFile}" 2>/dev/null`;

    execSync(cmd, { timeout: 5000 });
    const buffer = fs.readFileSync(tmpFile);
    fs.unlinkSync(tmpFile);
    return buffer;
  } catch (err) {
    // Fallback: create a minimal valid PNG (solid color, 1920x1080 would be too large)
    // Use a small valid PNG as last resort
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
      0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
      0x42, 0x60, 0x82,
    ]);
    return pngHeader;
  }
}

/**
 * 타임라인 그래픽 생성.
 *
 * 예: 2002년 발견 → 2003년 조사 → 2004년 보고
 */
export async function generateTimeline(
  events: TimelineEvent[],
  options?: {
    title?: string;
    width?: number;
    height?: number;
  }
): Promise<Buffer> {
  // Canvas not available fallback
  if (!createCanvas) {
    return await createPlaceholderBuffer(options?.title || "Timeline");
  }

  const width = options?.width ?? 1920;
  const height = options?.height ?? 1080;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // 배경
  ctx.fillStyle = "#0f1419";
  ctx.fillRect(0, 0, width, height);

  // 제목
  if (options?.title) {
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 48px Arial";
    ctx.textAlign = "center";
    ctx.fillText(options.title, width / 2, 80);
  }

  // 타임라인 생성
  const startY = 150;
  const lineLength = width - 300;
  const startX = 150;
  const endX = startX + lineLength;

  // 타임라인 기본 라인
  ctx.strokeStyle = "#4a9eff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(startX, height / 2);
  ctx.lineTo(endX, height / 2);
  ctx.stroke();

  // 이벤트 마커 그리기
  if (events.length > 0) {
    const timelineStart = new Date(events[0].date).getTime();
    const timelineEnd = new Date(events[events.length - 1].date).getTime();
    const totalDays = (timelineEnd - timelineStart) / (1000 * 60 * 60 * 24);

    events.forEach((event, idx) => {
      const eventDate = new Date(event.date).getTime();
      const daysSinceStart =
        (eventDate - timelineStart) / (1000 * 60 * 60 * 24);
      const position =
        startX + (daysSinceStart / totalDays) * lineLength;

      // 마커
      ctx.fillStyle = idx % 2 === 0 ? "#4a9eff" : "#ff6b6b";
      ctx.beginPath();
      ctx.arc(position, height / 2, 10, 0, Math.PI * 2);
      ctx.fill();

      // 날짜 텍스트
      ctx.fillStyle = "#ffffff";
      ctx.font = "16px Arial";
      ctx.textAlign = "center";

      if (idx % 2 === 0) {
        ctx.fillText(event.date, position, height / 2 - 50);
        ctx.fillText(event.title, position, height / 2 - 30);
      } else {
        ctx.fillText(event.date, position, height / 2 + 50);
        ctx.fillText(event.title, position, height / 2 + 70);
      }
    });
  }

  return canvas.toBuffer("image/png");
}

/**
 * 데이터 카드 생성.
 *
 * 예: "칸다하르의 거인 | 2002년 6월 | 아프가니스탄"
 */
export async function generateDataCard(
  data: {
    title: string;
    subtitle?: string;
    label?: string;
    accentColor?: string;
  },
  options?: {
    width?: number;
    height?: number;
  }
): Promise<Buffer> {
  // Canvas not available fallback
  if (!createCanvas) {
    return await createPlaceholderBuffer(data.title);
  }

  const width = options?.width ?? 1920;
  const height = options?.height ?? 1080;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // 배경색 (기본: 어두운 파란색)
  const accentColor = data.accentColor ?? "#1a1a2e";
  const rgbColor = hexToRgb(accentColor);
  const bgColor = `rgb(${Math.round(rgbColor.r * 0.8)}, ${Math.round(rgbColor.g * 0.8)}, ${Math.round(rgbColor.b * 0.8)})`;

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  // 강조 바
  ctx.fillStyle = accentColor;
  ctx.fillRect(0, 0, width, 15);
  ctx.fillRect(0, height - 15, width, 15);

  // 제목
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 72px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(data.title, width / 2, height / 2 - 100);

  // 부제목
  if (data.subtitle) {
    ctx.fillStyle = "#cccccc";
    ctx.font = "36px Arial";
    ctx.fillText(data.subtitle, width / 2, height / 2 + 50);
  }

  // 라벨
  if (data.label) {
    ctx.fillStyle = accentColor;
    ctx.fillRect(width / 2 - 150, height / 2 + 150, 300, 60);

    ctx.fillStyle = "#ffffff";
    ctx.font = "24px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(data.label, width / 2, height / 2 + 180);
  }

  return canvas.toBuffer("image/png");
}

/**
 * 간단한 다이어그램 생성.
 *
 * 예: 관계도, 인과관계 등
 */
export async function generateDiagram(
  elements: Array<{ label: string; color?: string }>,
  type: "flow" | "relationship" = "flow",
  options?: {
    width?: number;
    height?: number;
    title?: string;
  }
): Promise<Buffer> {
  // Canvas not available fallback
  if (!createCanvas) {
    return await createPlaceholderBuffer(options?.title || "Diagram");
  }

  const width = options?.width ?? 1920;
  const height = options?.height ?? 1080;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // 배경
  ctx.fillStyle = "#0f1419";
  ctx.fillRect(0, 0, width, height);

  // 제목
  if (options?.title) {
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 48px Arial";
    ctx.textAlign = "center";
    ctx.fillText(options.title, width / 2, 80);
  }

  if (type === "flow") {
    drawFlowDiagram(ctx, elements, width, height);
  } else {
    drawRelationshipDiagram(ctx, elements, width, height);
  }

  return canvas.toBuffer("image/png");
}

/**
 * 플로우 다이어그램 그리기.
 */
function drawFlowDiagram(
  ctx: CanvasRenderingContext2D,
  elements: Array<{ label: string; color?: string }>,
  width: number,
  height: number
) {
  if (elements.length === 0) return;

  const startY = (height - 200) / 2;
  const boxWidth = 200;
  const boxHeight = 100;
  const spacing = (width - 200) / (elements.length + 1);

  elements.forEach((element, idx) => {
    const x = spacing * (idx + 1);

    // 박스
    const color = element.color ?? "#4a9eff";
    ctx.fillStyle = color;
    ctx.fillRect(x - boxWidth / 2, startY, boxWidth, boxHeight);

    // 텍스트
    ctx.fillStyle = "#ffffff";
    ctx.font = "16px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(element.label, x, startY + boxHeight / 2);

    // 화살표
    if (idx < elements.length - 1) {
      ctx.strokeStyle = "#4a9eff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + boxWidth / 2, startY + boxHeight / 2);
      ctx.lineTo(x + spacing - boxWidth / 2, startY + boxHeight / 2);
      ctx.stroke();

      // 화살표 헤드
      ctx.fillStyle = "#4a9eff";
      ctx.beginPath();
      ctx.moveTo(x + spacing - boxWidth / 2 - 10, startY + boxHeight / 2 - 5);
      ctx.lineTo(x + spacing - boxWidth / 2, startY + boxHeight / 2);
      ctx.lineTo(x + spacing - boxWidth / 2 - 10, startY + boxHeight / 2 + 5);
      ctx.fill();
    }
  });
}

/**
 * 관계도 그리기.
 */
function drawRelationshipDiagram(
  ctx: CanvasRenderingContext2D,
  elements: Array<{ label: string; color?: string }>,
  width: number,
  height: number
) {
  if (elements.length === 0) return;

  const centerX = width / 2;
  const centerY = height / 2;
  const radius = 200;
  const boxSize = 60;

  elements.forEach((element, idx) => {
    const angle = (idx / elements.length) * Math.PI * 2;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;

    // 중심으로부터 선
    ctx.strokeStyle = "#4a9eff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(x, y);
    ctx.stroke();

    // 박스
    const color = element.color ?? "#4a9eff";
    ctx.fillStyle = color;
    ctx.fillRect(x - boxSize / 2, y - boxSize / 2, boxSize, boxSize);

    // 텍스트
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const lines = element.label.split(" ");
    lines.forEach((line, lineIdx) => {
      ctx.fillText(line, x, y - 8 + lineIdx * 16);
    });
  });

  // 중심 원
  ctx.fillStyle = "#ff6b6b";
  ctx.beginPath();
  ctx.arc(centerX, centerY, 30, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * 간단한 지도 배경 생성.
 *
 * 실제 지도를 사용할 수 없을 때 배경으로 사용.
 */
export async function generateMapBackground(
  options?: {
    title?: string;
    locations?: string[];
    width?: number;
    height?: number;
  }
): Promise<Buffer> {
  // Canvas not available fallback
  if (!createCanvas) {
    return await createPlaceholderBuffer(options?.title || "Map");
  }

  const width = options?.width ?? 1920;
  const height = options?.height ?? 1080;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // 배경 그래디언트
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#1a4d7a");
  gradient.addColorStop(1, "#0f2d4d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // 제목
  if (options?.title) {
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 48px Arial";
    ctx.textAlign = "center";
    ctx.fillText(options.title, width / 2, 80);
  }

  // 위치 마커
  if (options?.locations && options.locations.length > 0) {
    const markerRadius = 15;
    const colors = ["#ff6b6b", "#4a9eff", "#51cf66", "#ffd93d"];

    options.locations.forEach((location, idx) => {
      const x = (width / (options.locations!.length + 1)) * (idx + 1);
      const y = height / 2 + (idx % 2 === 0 ? -50 : 50);

      // 마커
      ctx.fillStyle = colors[idx % colors.length];
      ctx.beginPath();
      ctx.arc(x, y, markerRadius, 0, Math.PI * 2);
      ctx.fill();

      // 텍스트
      ctx.fillStyle = "#ffffff";
      ctx.font = "14px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(location, x, y + markerRadius + 10);
    });
  }

  return canvas.toBuffer("image/png");
}

/**
 * 증거 설명 카드 생성.
 */
export async function generateEvidenceCard(
  evidence: {
    title: string;
    description: string;
    type: string;
  },
  options?: {
    width?: number;
    height?: number;
  }
): Promise<Buffer> {
  // Canvas not available fallback
  if (!createCanvas) {
    return await createPlaceholderBuffer(evidence.title);
  }

  const width = options?.width ?? 1920;
  const height = options?.height ?? 1080;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // 배경
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, width, height);

  // 타입 배너
  const typeColors: Record<string, string> = {
    photo: "#ff6b6b",
    document: "#4a9eff",
    testimony: "#51cf66",
    physical: "#ffd93d",
  };

  const typeColor = typeColors[evidence.type] ?? "#4a9eff";
  ctx.fillStyle = typeColor;
  ctx.fillRect(0, 0, width, 80);

  // 타입 텍스트
  ctx.fillStyle = "#ffffff";
  ctx.font = "24px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(`증거: ${evidence.type}`, 50, 40);

  // 제목
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 48px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(evidence.title, width / 2, 150);

  // 설명
  ctx.fillStyle = "#cccccc";
  ctx.font = "24px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const maxWidth = width - 200;
  const words = evidence.description.split(" ");
  let line = "";
  let y = 350;
  const lineHeight = 40;

  words.forEach((word) => {
    const testLine = line + (line ? " " : "") + word;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth) {
      ctx.fillText(line, width / 2, y);
      line = word;
      y += lineHeight;
    } else {
      line = testLine;
    }
  });

  if (line) {
    ctx.fillText(line, width / 2, y);
  }

  return canvas.toBuffer("image/png");
}

/**
 * 16진수 색상을 RGB로 변환.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 26, g: 26, b: 46 }; // 기본값: #1a1a2e
}
