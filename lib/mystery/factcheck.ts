/**
 * Real fact-checking implementation.
 * Validates research findings against multiple sources and classifies fact status.
 */

import type { ResearchFinding, FactStatus, SourceRef } from "./types";

export interface FactCheckResult {
  claim: string;
  status: FactStatus;
  sources: SourceRef[];
  confidence: number; // 0-1
  reasoning: string;
}

export interface FactCheckReport {
  totalClaims: number;
  verified: number; // FACT + SUPPORTED
  testimonies: number; // TESTIMONY only
  disputed: number; // DISPUTED
  unverified: number; // UNVERIFIED + CLAIM
  results: FactCheckResult[];
}

/**
 * Analyze research findings and classify each claim's fact status.
 */
export function analyzeResearchClaims(findings: ResearchFinding[]): FactCheckReport {
  const results: FactCheckResult[] = [];

  for (const finding of findings) {
    const claim = finding.summary;
    let status: FactStatus = "UNVERIFIED";
    let confidence = 0;

    // Analyze source reliability
    const officialSources = finding.sources.filter(
      (s) => s.sourceType === "official" || s.sourceType === "court" || s.sourceType === "military"
    );
    const reliableSources = finding.sources.filter((s) => s.reliability !== "low");
    const disputedSources = finding.sources.filter((s) => s.reliability === "disputed");

    // Classification logic
    if (officialSources.length >= 2) {
      // Multiple official sources = confirmed fact
      status = "FACT";
      confidence = Math.min(1.0, 0.9 + officialSources.length * 0.05);
    } else if (officialSources.length === 1 && reliableSources.length >= 2) {
      // One official + other reliable sources = supported
      status = "SUPPORTED";
      confidence = Math.min(1.0, 0.8 + reliableSources.length * 0.05);
    } else if (reliableSources.length >= 3) {
      // Multiple reliable sources without official = supported
      status = "SUPPORTED";
      confidence = Math.min(1.0, 0.75 + reliableSources.length * 0.05);
    } else if (finding.sources.some((s) => s.sourceType === "interview")) {
      // Interview/testimony only
      status = "TESTIMONY";
      confidence = 0.5;
    } else if (disputedSources.length > 0 && reliableSources.length > 0) {
      // Some sources agree, some disagree
      status = "DISPUTED";
      confidence = 0.4;
    } else if (finding.sources.length === 0 || reliableSources.length === 0) {
      // No sources or only unreliable sources
      status = "UNVERIFIED";
      confidence = 0.1;
    } else {
      // Default to claim
      status = "CLAIM";
      confidence = 0.3;
    }

    results.push({
      claim,
      status,
      sources: finding.sources,
      confidence,
      reasoning: generateReasoning(status, finding),
    });
  }

  // Generate report
  const report: FactCheckReport = {
    totalClaims: results.length,
    verified: results.filter((r) => r.status === "FACT" || r.status === "SUPPORTED").length,
    testimonies: results.filter((r) => r.status === "TESTIMONY").length,
    disputed: results.filter((r) => r.status === "DISPUTED").length,
    unverified: results.filter((r) => r.status === "UNVERIFIED" || r.status === "CLAIM").length,
    results,
  };

  return report;
}

function generateReasoning(status: FactStatus, finding: ResearchFinding): string {
  const sourceCount = finding.sources.length;
  const officialCount = finding.sources.filter(
    (s) => s.sourceType === "official" || s.sourceType === "court"
  ).length;

  switch (status) {
    case "FACT":
      return `Confirmed by ${officialCount} official sources (${sourceCount} total sources)`;
    case "SUPPORTED":
      return `Supported by ${sourceCount} credible sources including ${officialCount} official`;
    case "TESTIMONY":
      return `Based on witness testimony (${sourceCount} source(s))`;
    case "DISPUTED":
      return `Conflicting information across ${sourceCount} sources`;
    case "CLAIM":
      return `Claimed but not independently verified (${sourceCount} source(s))`;
    case "UNVERIFIED":
      return `No credible sources found (${sourceCount} source(s))`;
    case "FALSE":
      return `Contradicted by official sources`;
    default:
      return "Unknown verification status";
  }
}
