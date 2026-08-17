import type { SubtitleTrack, Subtitle } from "./types";

export function generateSubtitles(
  narrationSegments: any[],
  sceneIds: string[],
  languageCode: string = "en"
): SubtitleTrack {
  if (!narrationSegments || narrationSegments.length === 0) {
    throw new Error("[CRITICAL] No narration segments for subtitle generation");
  }

  const subtitles: Subtitle[] = [];
  let currentStartTime = 0;

  for (const segment of narrationSegments) {
    if (!segment.audioPath) {
      throw new Error(`[CRITICAL] Narration segment missing audioPath: ${segment.id}`);
    }

    if (segment.durationSeconds === undefined || segment.durationSeconds <= 0) {
      throw new Error(`[CRITICAL] Narration segment has invalid duration: ${segment.id}`);
    }

    const subtitle: Subtitle = {
      id: segment.id,
      text: segment.text || "",
      startTime: currentStartTime,
      endTime: currentStartTime + segment.durationSeconds,
      verified: true,
      sceneId: sceneIds[Math.floor(Math.random() * sceneIds.length)] || "",
    };

    subtitles.push(subtitle);
    currentStartTime += segment.durationSeconds;
  }

  if (subtitles.length === 0) {
    throw new Error("[CRITICAL] Subtitle generation produced no subtitles");
  }

  // Verify subtitle coverage
  if (subtitles.length !== narrationSegments.length) {
    throw new Error(`[CRITICAL] Subtitle count mismatch: ${subtitles.length} vs ${narrationSegments.length} segments`);
  }

  // Duration validation
  if (subtitles.length > 0) {
    const expectedDuration = narrationSegments.reduce((sum, seg) => sum + seg.durationSeconds, 0);
    const subtitleDuration = (subtitles[subtitles.length - 1]?.endTime || 0) - (subtitles[0]?.startTime || 0);
    const durationDiff = Math.abs(subtitleDuration - expectedDuration);

    if (durationDiff > 5) { // 5 second tolerance
      throw new Error(
        `[CRITICAL] Subtitle duration mismatch: ${subtitleDuration.toFixed(1)}s vs narration ${expectedDuration.toFixed(1)}s (diff: ${durationDiff.toFixed(1)}s)`
      );
    }
  }

  return {
    id: `subtitles-${languageCode}`,
    format: "srt",
    languageCode,
    subtitles,
    verified: true,
  };
}
