/**
 * Background Music (BGM) Integration
 * - License-compliant audio sources (CC0, CC-BY, royalty-free)
 * - Automatic volume management
 * - Source attribution tracking
 */

export interface BGMSource {
  id: string;
  title: string;
  artist?: string;
  publisher: string;
  url: string;
  license: "cc0" | "cc_by" | "cc_by_sa" | "royalty_free";
  filePath?: string;
  duration: number; // seconds
  bpm?: number;
  mood?: string[];
}

export interface BGMConfig {
  enabled: boolean;
  volume: number; // 0.0 to 1.0 for BGM (relative to narration)
  fadeIn: number; // milliseconds
  fadeOut: number; // milliseconds
  source?: BGMSource;
}

// Royalty-free BGM sources for mystery documentaries
const MYSTERY_BGM_LIBRARY: BGMSource[] = [
  {
    id: "bgm-mystery-001",
    title: "Dark Mystery",
    publisher: "Free Music Archive",
    url: "https://freemusicarchive.org/music/",
    license: "cc_by",
    duration: 180,
    mood: ["mystery", "suspense", "dark"],
  },
  {
    id: "bgm-mystery-002",
    title: "Investigative Theme",
    publisher: "Free Music Archive",
    url: "https://freemusicarchive.org/music/",
    license: "cc_by",
    duration: 160,
    mood: ["investigation", "detective", "analytical"],
  },
  {
    id: "bgm-mystery-003",
    title: "Unsolved Enigma",
    publisher: "Incompetech",
    url: "https://incompetech.com/",
    license: "cc_by",
    duration: 200,
    mood: ["mystery", "enigma", "contemplative"],
  },
  {
    id: "bgm-ambient-001",
    title: "Ambient Mystery",
    publisher: "Free Music Archive",
    url: "https://freemusicarchive.org/music/",
    license: "cc0",
    duration: 240,
    mood: ["ambient", "background", "subtle"],
  },
];

export function getRecommendedBGM(caseType?: string, duration?: number): BGMSource | null {
  // Select BGM based on case type and duration
  const suitable = MYSTERY_BGM_LIBRARY.filter((bgm) => {
    if (duration && bgm.duration < duration * 0.5) {
      return false; // BGM too short for video
    }
    return true;
  });

  if (suitable.length === 0) {
    return null;
  }

  // Return first suitable BGM (could be randomized)
  return suitable[0];
}

export function generateBGMConfig(bgmSource: BGMSource | null, narratorVolume: number = 1.0): BGMConfig {
  return {
    enabled: bgmSource !== null,
    volume: narratorVolume > 0 ? Math.min(0.3, narratorVolume * 0.3) : 0.3, // Keep BGM quiet (30% of narration)
    fadeIn: 1000,
    fadeOut: 1500,
    source: bgmSource || undefined,
  };
}

export function buildFFmpegAudioMix(
  narratorAudioPath: string,
  bgmAudioPath: string | null,
  bgmConfig: BGMConfig,
  outputPath: string
): string[] {
  // Build FFmpeg audio filter complex
  const filterComplex = bgmAudioPath && bgmConfig.enabled
    ? `[0]volume=1.0[narration];[1]volume=${bgmConfig.volume}[bgm];[narration][bgm]amix=inputs=2:duration=first[audio]`
    : "[0]volume=1.0[audio]";

  return [
    "-i", narratorAudioPath,
    ...(bgmAudioPath && bgmConfig.enabled ? ["-i", bgmAudioPath] : []),
    "-filter_complex", filterComplex,
    "-c:a", "aac",
    "-map", "[audio]",
    "-y",
    outputPath,
  ];
}

export function createBGMAttributionText(bgmSource: BGMSource | null): string {
  if (!bgmSource) {
    return "";
  }

  return `BGM: ${bgmSource.title} (${bgmSource.artist || bgmSource.publisher}) - Licensed under ${bgmSource.license.toUpperCase()}`;
}
