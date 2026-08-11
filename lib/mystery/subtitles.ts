/**
 * 자막 생성 및 동기화
 * - 음성과 실시간 동기화
 * - 자막 길이 및 위치 검증
 * - 출처 표시 자동 생성
 */

import { updateProject } from "./store";
import type { NarrationSegment } from "./narration";

export interface Subtitle {
  id: string;
  text: string;
  startTime: number; // milliseconds
  endTime: number; // milliseconds
  sceneId: string;
  verified: boolean;
  issues?: string[];
}

export interface SubtitleTrack {
  language: "ko-KR" | "en-US";
  subtitles: Subtitle[];
  format: "srt" | "vtt" | "ass";
}

function splitIntoLines(text: string, maxCharsPerLine: number = 50): string[] {
  const lines: string[] = [];
  let currentLine = "";

  const words = text.split(" ");

  for (const word of words) {
    if ((currentLine + " " + word).length > maxCharsPerLine && currentLine.length > 0) {
      lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine = currentLine ? currentLine + " " + word : word;
    }
  }

  if (currentLine) {
    lines.push(currentLine.trim());
  }

  return lines;
}

function distributeTimeAcrossText(
  text: string,
  startTime: number,
  endTime: number,
  maxCharsPerLine: number = 50,
): Subtitle[] {
  const lines = splitIntoLines(text, maxCharsPerLine);
  if (lines.length === 0) return [];

  const totalDuration = endTime - startTime;
  const durationPerLine = totalDuration / lines.length;

  return lines.map((line, idx) => ({
    id: `subtitle-${startTime}-${idx}`,
    text: line,
    startTime: Math.round(startTime + idx * durationPerLine),
    endTime: Math.round(startTime + (idx + 1) * durationPerLine),
    sceneId: "",
    verified: false,
  }));
}

export function generateSubtitles(
  narrationSegments: NarrationSegment[],
  sceneIds: string[],
  language: "ko-KR" | "en-US" = "ko-KR",
): SubtitleTrack {
  const subtitles: Subtitle[] = [];
  let currentTime = 0;
  let sceneIndex = 0;

  for (const segment of narrationSegments) {
    const startTime = currentTime * 1000; // Convert to milliseconds
    const endTime = (currentTime + segment.durationSeconds) * 1000;

    const sceneId = sceneIds[sceneIndex % sceneIds.length];

    const segmentSubs = distributeTimeAcrossText(segment.text, startTime, endTime);

    segmentSubs.forEach((sub) => {
      sub.sceneId = sceneId;
    });

    subtitles.push(...segmentSubs);

    currentTime += segment.durationSeconds;
    sceneIndex++;
  }

  return {
    language,
    subtitles: validateSubtitles(subtitles),
    format: language === "ko-KR" ? "ass" : "srt",
  };
}

export function validateSubtitles(subtitles: Subtitle[]): Subtitle[] {
  const issues: string[] = [];

  return subtitles.map((sub, idx) => {
    const subIssues: string[] = [];

    // 자막 길이 검증
    if (sub.text.length > 100) {
      subIssues.push("Text too long (>100 chars)");
    }

    // 시간 범위 검증
    if (sub.startTime >= sub.endTime) {
      subIssues.push("Invalid time range");
    }

    // 중복 검증
    if (idx > 0) {
      const prev = subtitles[idx - 1];
      if (sub.startTime < prev.endTime) {
        subIssues.push(`Overlaps with previous subtitle`);
      }
    }

    // 빈 자막 검증
    if (sub.text.trim().length === 0) {
      subIssues.push("Empty subtitle");
    }

    return {
      ...sub,
      verified: subIssues.length === 0,
      issues: subIssues.length > 0 ? subIssues : undefined,
    };
  });
}

export function generateSRT(subtitles: Subtitle[]): string {
  return subtitles
    .map((sub, idx) => {
      const startTime = formatSRTTime(sub.startTime);
      const endTime = formatSRTTime(sub.endTime);

      return `${idx + 1}\n${startTime} --> ${endTime}\n${sub.text}\n`;
    })
    .join("\n");
}

export function generateASS(subtitles: Subtitle[], title: string = "Mystery Documentary"): string {
  const header = `[Script Info]
Title: ${title}
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events = subtitles
    .map((sub) => {
      const start = formatASSTime(sub.startTime);
      const end = formatASSTime(sub.endTime);
      return `Dialogue: 0,${start},${end},Default,,0,0,0,,${sub.text}`;
    })
    .join("\n");

  return header + events;
}

function formatSRTTime(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const ms = milliseconds % 1000;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function formatASSTime(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const cs = Math.floor((milliseconds % 1000) / 10);

  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

export function checkSubtitleIssues(subtitles: Subtitle[]): {
  valid: boolean;
  issues: { type: string; count: number; examples: string[] }[];
} {
  const issueMap = new Map<string, string[]>();

  subtitles.forEach((sub) => {
    (sub.issues || []).forEach((issue) => {
      if (!issueMap.has(issue)) {
        issueMap.set(issue, []);
      }
      issueMap.get(issue)!.push(sub.id);
    });
  });

  const issues = Array.from(issueMap.entries()).map(([type, examples]) => ({
    type,
    count: examples.length,
    examples: examples.slice(0, 3),
  }));

  return {
    valid: issues.length === 0,
    issues,
  };
}
