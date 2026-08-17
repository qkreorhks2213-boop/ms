/**
 * Mystery Documentary - Automatic Length Calculator
 *
 * 사건의 정보량과 자료 양을 분석해서 적정 영상 길이를 자동으로 결정한다
 * 110분 고정이 아니라 사건이 결정한다
 */

import { MysteryScript, Scene, FactStatus } from "./types";

export interface LengthAnalysis {
  contentDensity: "HIGH" | "MEDIUM" | "LOW";
  sourceCount: number;
  uniqueFacts: number;
  realMaterialCount: number;
  interviewCount: number;
  mysteryThreads: number;
  repetitionRisk: "HIGH" | "MEDIUM" | "LOW";
  estimatedMinRange: {
    min: number;
    max: number;
  };
  recommendation: string;
  reasoning: string[];
}

export interface ContentMetrics {
  sections: number;
  totalChars: number;
  sourceCount: number;
  factCount: Record<FactStatus, number>;
  realMaterialRatio: number;
  aiReconstructionCount: number;
  averageSceneDuration: number;
}

/**
 * Content Density 계산
 */
function calculateContentDensity(
  metrics: ContentMetrics
): "HIGH" | "MEDIUM" | "LOW" {
  const factSum =
    (metrics.factCount.FACT || 0) +
    (metrics.factCount.SUPPORTED || 0) +
    (metrics.factCount.TESTIMONY || 0);

  if (factSum >= 30) return "HIGH";
  if (factSum >= 15) return "MEDIUM";
  return "LOW";
}

/**
 * Repetition Risk 계산
 * 같은 내용이 반복될 위험도
 */
function calculateRepetitionRisk(
  sections: number,
  uniqueFacts: number
): "HIGH" | "MEDIUM" | "LOW" {
  if (sections === 0) return "LOW";

  const repetitionRatio = sections / Math.max(uniqueFacts, 1);

  if (repetitionRatio > 1.5) return "HIGH"; // 섹션이 팩트보다 많으면 반복 위험
  if (repetitionRatio > 1.2) return "MEDIUM";
  return "LOW";
}

/**
 * 영상 길이 범위 계산
 */
function calculateLengthRange(analysis: {
  contentDensity: "HIGH" | "MEDIUM" | "LOW";
  sourceCount: number;
  uniqueFacts: number;
  realMaterialCount: number;
  interviewCount: number;
  mysteryThreads: number;
  repetitionRisk: "HIGH" | "MEDIUM" | "LOW";
}): { min: number; max: number } {
  let baseMin = 10;
  let baseMax = 20;

  // Content Density에 따른 기본 길이
  if (analysis.contentDensity === "HIGH") {
    baseMin = 30;
    baseMax = 80;
  } else if (analysis.contentDensity === "MEDIUM") {
    baseMin = 20;
    baseMax = 40;
  }

  // Unique Facts에 따른 조정 (가장 중요한 지표)
  if (analysis.uniqueFacts > 30) {
    baseMax = Math.max(baseMax, 70);
  } else if (analysis.uniqueFacts > 20) {
    baseMax = Math.max(baseMax, 50);
  }

  // Source Count에 따른 조정
  const sourceBonus = Math.min(
    analysis.sourceCount / 5,
    20
  );
  baseMax += sourceBonus;

  // Interview Count에 따른 조정
  const interviewBonus = Math.min(
    analysis.interviewCount * 3,
    15
  );
  baseMax += interviewBonus;

  // Mystery Threads에 따른 조정
  const mysteryBonus = analysis.mysteryThreads * 8;
  baseMax += mysteryBonus;

  // Repetition Risk에 따른 감소
  if (analysis.repetitionRisk === "HIGH") {
    baseMax *= 0.7; // 30% 감소
  } else if (analysis.repetitionRisk === "MEDIUM") {
    baseMax *= 0.85; // 15% 감소
  }

  // Real Material이 많으면 증가
  if (analysis.sourceCount > 0) {
    const realMaterialRatio = analysis.realMaterialCount / analysis.sourceCount;
    const realMaterialBonus = realMaterialRatio * 20;
    baseMax += realMaterialBonus;
  }

  return {
    min: Math.max(5, Math.round(baseMin)),
    max: Math.min(120, Math.round(baseMax)),
  };
}

/**
 * Mystery Threads 개수 계산
 * 해결되지 않은 의문의 개수
 */
function countMysteryThreads(script: MysteryScript): number {
  const text = script.sections.map((s) => s.text).join(" ");

  let count = 0;

  // 의문 표현 패턴
  if (text.match(/뭐가|뭘|뭐?가.*했을까|무엇인가|어떤.*/g)) count++;
  if (text.match(/왜|왜그럴까|어째서/g)) count++;
  if (text.match(/어디로|어디서|어디에/g)) count++;
  if (text.match(/누가|누구인가|누구였을까/g)) count++;
  if (text.match(/언제|언제부터|언제까지/g)) count++;
  if (text.match(/어떻게|어떻게.*했을까/g)) count++;

  // 논쟁이 있는 부분
  if (text.includes("설")) count += 0.5;
  if (text.includes("주장")) count += 0.5;
  if (text.includes("논쟁")) count += 0.5;

  return Math.round(count);
}

/**
 * 실제 자료 개수 계산
 */
function countRealMaterial(scenes: Scene[]): number {
  return scenes.filter(
    (s) =>
      s.visualOrigin?.startsWith("REAL") ||
      s.visualOrigin === "MIXED"
  ).length;
}

/**
 * 인터뷰 개수 계산
 */
function countInterviews(scenes: Scene[]): number {
  return scenes.filter((s) => s.visualOrigin === "REAL_INTERVIEW").length;
}

/**
 * 메인 계산 함수
 */
export function analyzeLengthRequirement(
  script: MysteryScript | undefined,
  scenes: Scene[] | undefined
): LengthAnalysis {
  const scenes_ = scenes || [];
  const script_ = script;

  // 메트릭 수집
  const sections = script_?.sections.length || 0;
  const totalChars = script_?.totalCharCount || 0;

  // 팩트 타입별 카운트
  const factCount: Record<FactStatus, number> = {
    FACT: 0,
    SUPPORTED: 0,
    TESTIMONY: 0,
    CLAIM: 0,
    DISPUTED: 0,
    UNVERIFIED: 0,
    FALSE: 0,
  };

  scenes_.forEach((scene) => {
    const status = scene.factStatus || "UNVERIFIED";
    if (status in factCount) {
      factCount[status]++;
    }
  });

  const sourceCount = scenes_.reduce(
    (sum, s) => sum + (s.sources?.length || 0),
    0
  );
  const uniqueFacts = new Set(
    scenes_
      .flatMap((s) => s.sources?.map((src) => src.id) || [])
  ).size;
  const realMaterialCount = countRealMaterial(scenes_);
  const interviewCount = countInterviews(scenes_);
  const mysteryThreads = script_ ? countMysteryThreads(script_) : 0;

  const metrics: ContentMetrics = {
    sections,
    totalChars,
    sourceCount,
    factCount,
    realMaterialRatio: sourceCount > 0 ? realMaterialCount / sourceCount : 0,
    aiReconstructionCount: scenes_.filter(
      (s) => s.visualOrigin === "AI_RECONSTRUCTION"
    ).length,
    averageSceneDuration:
      scenes_.length > 0
        ? scenes_.reduce((sum, s) => sum + (s.durationSeconds || 0), 0) /
          scenes_.length
        : 0,
  };

  const contentDensity = calculateContentDensity(metrics);
  const repetitionRisk = calculateRepetitionRisk(
    sections,
    uniqueFacts
  );

  const analysis = {
    contentDensity,
    sourceCount,
    uniqueFacts,
    realMaterialCount,
    interviewCount,
    mysteryThreads,
    repetitionRisk,
  };

  const estimatedMinRange = calculateLengthRange(analysis);

  const reasoning: string[] = [];

  // 추론 기록
  if (contentDensity === "HIGH") {
    reasoning.push(`콘텐츠 밀도 높음: 팩트 ${uniqueFacts}개`);
  } else if (contentDensity === "LOW") {
    reasoning.push(`콘텐츠 밀도 낮음: 팩트 ${uniqueFacts}개만 확인됨`);
  }

  if (sourceCount > 30) {
    reasoning.push(`출처가 많음: ${sourceCount}건 (길이 증가)`);
  } else if (sourceCount < 5) {
    reasoning.push(`출처가 적음: ${sourceCount}건만 (길이 감소)`);
  }

  if (realMaterialCount > scenes_.length * 0.6) {
    reasoning.push(`실제 자료가 풍부함 (${realMaterialCount}/${scenes_.length})`);
  } else if (realMaterialCount < scenes_.length * 0.3) {
    reasoning.push(`실제 자료가 부족함 (${realMaterialCount}/${scenes_.length})`);
  }

  if (interviewCount > 0) {
    reasoning.push(`인터뷰 ${interviewCount}건 (가치 있는 증언)`);
  }

  if (mysteryThreads >= 3) {
    reasoning.push(`미해결 의문 ${mysteryThreads}개 (길이 증가)`);
  }

  if (repetitionRisk === "HIGH") {
    reasoning.push(`반복 위험 높음: 내용 축약 필요`);
  }

  const recommendation = generateRecommendation(
    estimatedMinRange,
    contentDensity
  );

  return {
    contentDensity,
    sourceCount,
    uniqueFacts,
    realMaterialCount,
    interviewCount,
    mysteryThreads,
    repetitionRisk,
    estimatedMinRange,
    recommendation,
    reasoning,
  };
}

/**
 * 권장사항 생성
 */
function generateRecommendation(
  range: { min: number; max: number },
  density: "HIGH" | "MEDIUM" | "LOW"
): string {
  const mid = Math.round((range.min + range.max) / 2);

  if (range.max < 20) {
    return `${range.min}~${range.max}분 권장 (짧은 사건, 자료 제한적)`;
  } else if (range.max < 40) {
    return `${range.min}~${range.max}분 권장 (중간 규모 사건)`;
  } else if (range.max < 60) {
    return `${range.min}~${range.max}분 권장 (충분한 자료와 맥락)`;
  } else {
    return `${range.min}~${range.max}분 권장 (광범위한 사건, 풍부한 자료)`;
  }
}

/**
 * 긴 영상에서 지루한 구간 감지
 */
export function detectBoringSegments(scenes: Scene[]): Scene[] {
  return scenes.filter((scene) => {
    // 새로운 정보 없음
    const noNewInfo =
      !scene.factStatus || scene.factStatus === "UNVERIFIED";

    // 시각 변화 없음 (같은 자료)
    const noVisualChange =
      scene.visualOrigin === "GENERATED_DIAGRAM" ||
      scene.visualOrigin === "MIXED";

    // 자료가 없음
    const noRealMaterial = !scene.visualOrigin?.startsWith("REAL");

    // 최소 두 개 이상의 문제가 있으면 지루한 것으로 판단
    const issues = [noNewInfo, noVisualChange, noRealMaterial].filter(
      Boolean
    ).length;
    return issues >= 2;
  });
}

/**
 * 고정 길이 기반 타겟 검증
 */
export function validateTargetLength(
  targetMinutes: number,
  analysis: LengthAnalysis
): {
  isValid: boolean;
  warning?: string;
  suggestion?: string;
} {
  const { min, max } = analysis.estimatedMinRange;

  if (targetMinutes < min) {
    return {
      isValid: false,
      warning: `목표 길이(${targetMinutes}분)가 권장 최소 길이(${min}분)보다 짧습니다`,
      suggestion: `최소 ${min}분 이상을 권장합니다. 콘텐츠가 너무 빨리 끝날 수 있습니다.`,
    };
  }

  if (targetMinutes > max) {
    return {
      isValid: false,
      warning: `목표 길이(${targetMinutes}분)가 권장 최대 길이(${max}분)보다 깁니다`,
      suggestion: `${max}분 이내를 권장합니다. 반복되는 내용이 추가될 수 있습니다.`,
    };
  }

  return { isValid: true };
}
