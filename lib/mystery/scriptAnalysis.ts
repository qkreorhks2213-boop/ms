/**
 * 스크립트 섹션의 시각자료 출처와 팩트 상태를 분석하고 추론하는 모듈.
 */

import { ScriptSection, VisualOrigin, FactStatus, SourceRef } from "./types";

/**
 * 섹션 텍스트로부터 visualOrigin 추론.
 *
 * 키워드 패턴을 분석하여 가장 가능성 높은 시각자료 유형을 결정한다.
 */
export function inferVisualOrigin(
  section: ScriptSection
): VisualOrigin {
  const text = section.text.toLowerCase();

  // AI 재현 관련 표현
  if (
    text.includes("재현하면") ||
    text.includes("추정하면") ||
    text.includes("상상해보면") ||
    text.includes("아마도") ||
    text.includes("추측")
  ) {
    return "AI_RECONSTRUCTION";
  }

  // 실제 뉴스/영상
  if (
    text.includes("보도") ||
    text.includes("영상") ||
    text.includes("촬영") ||
    text.includes("방송") ||
    text.includes("기록") ||
    text.includes("필름")
  ) {
    return "REAL_NEWS";
  }

  // 아카이브 자료
  if (
    text.includes("사진") ||
    text.includes("아카이브") ||
    text.includes("기록") ||
    text.includes("자료") ||
    text.includes("문서")
  ) {
    return "REAL_ARCHIVE_PHOTO";
  }

  // 증거/다이어그램
  if (
    text.includes("다이어그램") ||
    text.includes("도표") ||
    text.includes("그래프") ||
    text.includes("지도") ||
    text.includes("도식")
  ) {
    return "GENERATED_DIAGRAM";
  }

  // 타임라인
  if (
    text.includes("타임라인") ||
    text.includes("시간순") ||
    text.includes("연대표") ||
    text.includes("시간대")
  ) {
    return "GENERATED_TIMELINE";
  }

  // 기본값
  return "MIXED";
}

/**
 * 섹션 텍스트와 출처로부터 factStatus 추론.
 *
 * 텍스트의 언어와 출처의 신뢰도를 기반으로 판단한다.
 */
export function inferFactStatus(
  section: ScriptSection
): FactStatus {
  const text = section.text.toLowerCase();

  // 거짓으로 표시된 내용
  if (text.includes("거짓") || text.includes("사실이 아닌")) {
    return "FALSE";
  }

  // 증언/주장 표현
  if (
    text.includes("증언") ||
    text.includes("말했다") ||
    text.includes("주장") ||
    text.includes("주장했다")
  ) {
    return "TESTIMONY";
  }

  // 논쟁/대립
  if (
    text.includes("논쟁") ||
    text.includes("논란") ||
    text.includes("상이") ||
    text.includes("대립") ||
    text.includes("다양한 주장")
  ) {
    return "DISPUTED";
  }

  // 미확인/추정 표현
  if (
    text.includes("추정") ||
    text.includes("추측") ||
    text.includes("아마도") ||
    text.includes("것으로 보인다") ||
    text.includes("미확인")
  ) {
    return "CLAIM";
  }

  // 출처 신뢰도 확인
  const sources = section.sources || [];
  if (sources.length === 0) {
    return "UNVERIFIED";
  }

  // 고신뢰도 출처 확인
  const hasHighReliability = sources.some(
    (s) => s.reliability === "high" || s.sourceType === "official"
  );

  if (hasHighReliability) {
    // 공식 기록으로 확인된 내용
    const hasMultipleSources = sources.length >= 2;
    return hasMultipleSources ? "FACT" : "SUPPORTED";
  }

  // 중간 신뢰도
  return "CLAIM";
}

/**
 * 섹션이 AI 재현 디스클레이머가 필요한지 판단.
 */
export function needsAiDisclaimer(section: ScriptSection): boolean {
  const visualOrigin = section.visualOrigin || inferVisualOrigin(section);
  const text = section.text.toLowerCase();

  // AI 재현 타입이면 항상 필요
  if (
    visualOrigin === "AI_RECONSTRUCTION" ||
    visualOrigin === "AI_ATMOSPHERE" ||
    visualOrigin === "AI_RECONSTRUCTION_VIDEO"
  ) {
    return true;
  }

  // 재현/추정 표현이 있으면 필요
  if (
    text.includes("재현하면") ||
    text.includes("추정하면") ||
    text.includes("상상해보면")
  ) {
    return true;
  }

  return false;
}

/**
 * 모든 섹션에 메타데이터 추가.
 *
 * 기존 값이 있으면 유지하고, 없으면 추론한다.
 */
export function enrichSectionsWithMetadata(sections: ScriptSection[]): ScriptSection[] {
  return sections.map((section) => ({
    ...section,
    visualOrigin: section.visualOrigin || inferVisualOrigin(section),
    factStatus: section.factStatus || inferFactStatus(section),
    needsDisclaimer: section.needsDisclaimer ?? needsAiDisclaimer(section),
  }));
}
