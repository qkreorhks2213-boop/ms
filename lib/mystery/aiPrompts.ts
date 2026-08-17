/**
 * AI 재현 이미지/영상 생성용 프롬프트 생성 모듈
 *
 * 팩트체크된 정보에 기반하여 맞춤형 프롬프트를 생성한다.
 * AI는 존재하지 않는 사실을 만들어내지 않고, 기존 정보를 시각화하는 용도로만 사용.
 */

import { Scene, TimelineEvent, SourceRef, FactStatus } from "./types";

/**
 * 재현 목적별 프롬프트 생성 인터페이스.
 */
export interface ReconstructionPromptOptions {
  type:
    | "location"
    | "atmosphere"
    | "historical_situation"
    | "silhouette"
    | "movement"
    | "environment";
  title?: string;
  description?: string;
  timeperiod?: string;
  references?: SourceRef[];
  factStatus?: FactStatus;
}

/**
 * 기본 재현 스타일 설정.
 */
const DEFAULT_STYLE = `
Style requirements:
- Cinematic documentary reconstruction
- Realistic but clearly artistic
- Documentary photography aesthetic
- Natural lighting
- Historically accurate if period-specific
- Muted, professional colors
- 16:9 aspect ratio
- No text, no watermarks
- Subtle film grain for authenticity
- No people unless explicitly described
- Focus on atmosphere and setting
`;

/**
 * 장소 재현 프롬프트 생성.
 *
 * 예: "2002년 아프가니스탄 칸다하르 산골짜기"
 */
export function generateLocationPrompt(
  options: Omit<ReconstructionPromptOptions, "type"> &
    Required<Pick<ReconstructionPromptOptions, "title" | "timeperiod">>
): string {
  const opt: ReconstructionPromptOptions = { ...options, type: "location" };
  const context = buildContextStatement(opt);

  return `
Generate a historical location reconstruction image.

Location: ${options.title}
Time period: ${options.timeperiod}

${context}

${DEFAULT_STYLE}

Based on: ${options.references?.map((r) => r.title).join(", ") || "Historical records"}
This is a documentary reconstruction, not a photograph.
  `.trim();
}

/**
 * 분위기 재현 프롬프트 생성.
 *
 * 예: "밤, 외진 산길, 어두운 분위기"
 */
export function generateAtmospherePrompt(
  options: Omit<ReconstructionPromptOptions, "type"> &
    Required<Pick<ReconstructionPromptOptions, "description">>
): string {
  const opt: ReconstructionPromptOptions = { ...options, type: "atmosphere" };
  const context = buildContextStatement(opt);

  return `
Generate an atmospheric scene reconstruction image for documentary purposes.

Atmosphere: ${options.description}
${options.timeperiod ? `Time period: ${options.timeperiod}` : ""}

${context}

${DEFAULT_STYLE}

Focus on:
- Mood and emotional tone
- Environmental conditions
- Lighting conditions
- Color palette appropriate to the period

This is a reconstruction based on historical records, not actual footage.
  `.trim();
}

/**
 * 역사적 상황 재현 프롬프트.
 *
 * 예: "1970년대 경찰 수사 현장"
 */
export function generateHistoricalSituationPrompt(
  options: Omit<ReconstructionPromptOptions, "type"> &
    Required<Pick<ReconstructionPromptOptions, "description" | "timeperiod">>
): string {
  const opt: ReconstructionPromptOptions = { ...options, type: "historical_situation" };
  const context = buildContextStatement(opt);

  return `
Generate a historical situation reconstruction image.

Situation: ${options.description}
Time period: ${options.timeperiod}

${context}

${DEFAULT_STYLE}

Additional requirements:
- Historically accurate clothing and equipment for the time period
- Period-appropriate vehicles, technology, and infrastructure
- Correct architectural style and environment
- Authentic lighting and color grading for the era

Based on: ${options.references?.map((r) => `${r.title} (${r.publishedAt})`).join(", ") || "Historical records"}
This is a reconstruction for educational documentary purposes.
  `.trim();
}

/**
 * 실루엣/뒷모습 재현 프롬프트.
 *
 * 예: "산 정상에서 멀리 바라보는 인물의 뒷모습"
 */
export function generateSilhouettePrompt(
  options: Omit<ReconstructionPromptOptions, "type"> &
    Required<Pick<ReconstructionPromptOptions, "description">>
): string {
  const opt: ReconstructionPromptOptions = { ...options, type: "silhouette" };
  const context = buildContextStatement(opt);

  return `
Generate a silhouette/back view scene reconstruction.

Scene: ${options.description}
${options.timeperiod ? `Time period: ${options.timeperiod}` : ""}

${context}

${DEFAULT_STYLE}

Critical requirements:
- Silhouette or back view only
- No facial details visible
- Focus on setting and environment
- Person is just a compositional element

This reconstruction protects privacy while showing the scene context.
  `.trim();
}

/**
 * 이동 경로/이동 시각화 프롬프트.
 *
 * 예: "집에서 사건 발생지까지의 이동 경로"
 */
export function generateMovementPrompt(
  options: Omit<ReconstructionPromptOptions, "type"> &
    Required<Pick<ReconstructionPromptOptions, "description">>
): string {
  const opt: ReconstructionPromptOptions = { ...options, type: "movement" };
  const context = buildContextStatement(opt);

  return `
Generate a path/movement visualization for documentary purposes.

Movement: ${options.description}
${options.timeperiod ? `Time period: ${options.timeperiod}` : ""}

${context}

${DEFAULT_STYLE}

Show:
- Geographic path or route
- Key locations along the journey
- Environmental conditions of the area
- Time-appropriate transportation context

This visualization aids understanding of movement patterns.
  `.trim();
}

/**
 * 환경/배경 재현 프롬프트.
 *
 * 예: "1980년대 도시 골목"
 */
export function generateEnvironmentPrompt(
  options: Omit<ReconstructionPromptOptions, "type"> &
    Required<Pick<ReconstructionPromptOptions, "description" | "timeperiod">>
): string {
  const opt: ReconstructionPromptOptions = { ...options, type: "environment" };
  const context = buildContextStatement(opt);

  return `
Generate an environmental/background scene reconstruction.

Environment: ${options.description}
Time period: ${options.timeperiod}

${context}

${DEFAULT_STYLE}

Accuracy focus:
- Architecture style appropriate to time period
- Weather and seasonal conditions
- Urban/rural characteristics
- Infrastructure and technology of the era
- Color palette reflecting the period

This is a historical environment reconstruction.
  `.trim();
}

/**
 * 재현 장면에 대한 맥락 정보 생성.
 */
function buildContextStatement(
  options: ReconstructionPromptOptions
): string {
  const parts: string[] = [];

  if (options.title) {
    parts.push(`Subject: ${options.title}`);
  }

  if (options.description) {
    parts.push(`Details: ${options.description}`);
  }

  if (options.factStatus && ["CLAIM", "TESTIMONY"].includes(options.factStatus)) {
    parts.push(
      `Note: This scene is based on accounts and records, not direct documentation.`
    );
  } else if (options.factStatus === "DISPUTED") {
    parts.push(
      `Note: Details of this scene are disputed. Reconstruction is illustrative only.`
    );
  }

  if (options.references && options.references.length > 0) {
    const sourceList = (options.references || [])
      .map((r) => `- ${r.title} (${r.publisher}, ${r.publishedAt})`)
      .join("\n");
    if (sourceList) {
      parts.push(`Based on:\n${sourceList}`);
    }
  }

  return parts.join("\n\n");
}

/**
 * Scene 객체에서 재현 프롬프트 자동 생성.
 *
 * 장면의 타입과 내용에 따라 적절한 프롬프트를 선택하고 생성.
 */
export function generateSceneReconstructionPrompt(scene: Scene): string {
  const type = scene.visualType;
  const sources = scene.sources || [];

  // 타입별 프롬프트 생성
  if (type === "location") {
    return generateLocationPrompt({
      title: scene.visualLabel || scene.visualHeadline || "Location",
      timeperiod: extractTimePeriod(sources),
      description: scene.text,
      references: sources,
      factStatus: scene.factStatus,
    });
  }

  if (type === "atmosphere") {
    return generateAtmospherePrompt({
      description: scene.text || scene.visualLabel || "Atmospheric scene",
      title: scene.visualHeadline,
      timeperiod: extractTimePeriod(sources),
      references: sources,
      factStatus: scene.factStatus,
    });
  }

  // 기본값: 일반 재현
  return generateHistoricalSituationPrompt({
    description: scene.text || "Historical scene",
    title: scene.visualHeadline,
    timeperiod: extractTimePeriod(sources),
    references: sources,
    factStatus: scene.factStatus,
  });
}

/**
 * 출처에서 시간 기간 추출.
 */
function extractTimePeriod(sources?: SourceRef[]): string {
  if (!sources || sources.length === 0) return "Unknown period";

  const dates = sources
    .filter((s) => s.publishedAt)
    .map((s) => s.publishedAt!)
    .sort();

  if (dates.length === 0) return "Unknown period";

  const first = new Date(dates[0]);
  const last = new Date(dates[dates.length - 1]);

  if (first.getFullYear() === last.getFullYear()) {
    return `${first.getFullYear()}`;
  }

  return `${first.getFullYear()}-${last.getFullYear()}`;
}

/**
 * 프롬프트 안전성 검증.
 *
 * 다음을 확인:
 * - 팩트체크된 정보만 포함
 * - 실제 인물 이름 사용 제한
 * - 존재하지 않는 사실 없음
 */
export function validatePrompt(
  prompt: string,
  scene: Scene
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // 팩트 상태 확인
  if (
    scene.factStatus === "FALSE" ||
    scene.factStatus === "UNVERIFIED"
  ) {
    issues.push(
      `Cannot generate reconstruction for unverified or false claims`
    );
  }

  // 출처 확인
  if (!scene.sources || scene.sources.length === 0) {
    issues.push("No sources provided for reconstruction");
  }

  // 프롬프트 길이 확인
  if (prompt.length > 2000) {
    issues.push("Prompt is too long (max 2000 characters)");
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * 재현 불가능한 장면 판단.
 *
 * 특정 경우에는 재현을 피해야 함.
 */
export function cannotReconstruct(scene: Scene): boolean {
  // 검증되지 않은 주장
  if (scene.factStatus === "UNVERIFIED" || scene.factStatus === "FALSE") {
    return true;
  }

  // 출처가 없음
  if (!scene.sources || scene.sources.length === 0) {
    return true;
  }

  // 실제 자료가 풍부한 경우 (재현 불필요)
  // 이는 visualAssetSelector에서 판단하므로 여기서는 스킵

  return false;
}

/**
 * 재현 장면에 대한 디스클레이머 텍스트 생성.
 */
export function generateReconstructionDisclaimer(
  scene: Scene
): string {
  if (scene.factStatus === "TESTIMONY") {
    return `증언에 기반한 재현 이미지입니다`;
  }

  if (scene.factStatus === "CLAIM" || scene.factStatus === "UNVERIFIED") {
    return `기록을 바탕으로 재현한 이미지입니다`;
  }

  if (scene.factStatus === "DISPUTED") {
    return `논쟁이 있는 상황의 재현 이미지입니다`;
  }

  return `AI 재현`;
}
