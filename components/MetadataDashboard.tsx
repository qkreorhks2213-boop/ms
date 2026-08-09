/**
 * Metadata Dashboard Component
 *
 * 프로젝트 전체의 메타데이터 통계를 시각화하는 대시보드
 * - 시각자료 분포 (실제/그래픽/AI)
 * - 팩트 상태 분포
 * - 출처 통계
 * - AI 재현 통계
 */

import React, { useMemo } from "react";
import { MysteryProject, Scene, VisualOrigin, FactStatus } from "@/lib/mystery/types";

interface MetadataDashboardProps {
  project: MysteryProject;
}

interface DistributionStats {
  real: number;
  graphic: number;
  ai: number;
  mixed: number;
  total: number;
}

interface FactStatusStats {
  [key in FactStatus]: number;
}

interface SourceStats {
  totalSources: number;
  uniquePublishers: Set<string>;
  sourcesByType: Record<string, number>;
}

function calculateDistribution(scenes: Scene[] | undefined): DistributionStats {
  const scenes_ = scenes || [];

  const stats = {
    real: 0,
    graphic: 0,
    ai: 0,
    mixed: 0,
    total: scenes_.length,
  };

  for (const scene of scenes_) {
    const origin = scene.visualOrigin;
    if (!origin) continue;

    if (origin.startsWith("REAL")) {
      stats.real++;
    } else if (origin.startsWith("GENERATED")) {
      stats.graphic++;
    } else if (origin.startsWith("AI")) {
      stats.ai++;
    } else if (origin === "MIXED") {
      stats.mixed++;
    }
  }

  return stats;
}

function calculateFactStatus(scenes: Scene[] | undefined): Partial<FactStatusStats> {
  const scenes_ = scenes || [];
  const stats: Partial<FactStatusStats> = {
    FACT: 0,
    SUPPORTED: 0,
    TESTIMONY: 0,
    CLAIM: 0,
    DISPUTED: 0,
    UNVERIFIED: 0,
    FALSE: 0,
  };

  for (const scene of scenes_) {
    const status = scene.factStatus || "UNVERIFIED";
    if (status in stats) {
      stats[status as FactStatus]!++;
    }
  }

  return stats;
}

function calculateSources(scenes: Scene[] | undefined): SourceStats {
  const scenes_ = scenes || [];
  const publishers = new Set<string>();
  const sourcesByType: Record<string, number> = {};
  let totalSources = 0;

  for (const scene of scenes_) {
    const sources = scene.sources || [];
    totalSources += sources.length;

    for (const source of sources) {
      if (source.publisher) {
        publishers.add(source.publisher);
      }
      sourcesByType[source.sourceType] = (sourcesByType[source.sourceType] || 0) + 1;
    }
  }

  return {
    totalSources,
    uniquePublishers: publishers,
    sourcesByType,
  };
}

export function MetadataDashboard({ project }: MetadataDashboardProps) {
  const distribution = useMemo(() => calculateDistribution(project.scenes), [project.scenes]);
  const factStatus = useMemo(() => calculateFactStatus(project.scenes), [project.scenes]);
  const sources = useMemo(() => calculateSources(project.scenes), [project.scenes]);

  const aiReconstructionCount = (project.scenes || []).filter((s) => s.aiReconstructionExplained).length;
  const completedCount = (project.scenes || []).filter((s) => s.visualStatus === "done").length;
  const errorCount = (project.scenes || []).filter((s) => s.visualStatus === "error").length;

  // 백분율 계산
  const total = distribution.total || 1; // 0 나누기 방지
  const realPct = Math.round((distribution.real / total) * 100);
  const graphicPct = Math.round((distribution.graphic / total) * 100);
  const aiPct = Math.round((distribution.ai / total) * 100);
  const completedPct = Math.round((completedCount / total) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">📊 메타데이터 대시보드</h1>
        <p className="text-gray-600 mt-2">프로젝트: {project.name}</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="text-sm text-gray-600">전체 장면</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">{distribution.total}</div>
          <div className="text-xs text-gray-500 mt-1">개</div>
        </div>

        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <div className="text-sm text-green-800 font-medium">완료됨</div>
          <div className="text-3xl font-bold text-green-900 mt-2">{completedCount}</div>
          <div className="text-xs text-green-700 mt-1">{completedPct}%</div>
        </div>

        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <div className="text-sm text-red-800 font-medium">오류</div>
          <div className="text-3xl font-bold text-red-900 mt-2">{errorCount}</div>
          <div className="text-xs text-red-700 mt-1">
            {total > 0 ? Math.round((errorCount / total) * 100) : 0}%
          </div>
        </div>

        <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
          <div className="text-sm text-amber-800 font-medium">AI 재현</div>
          <div className="text-3xl font-bold text-amber-900 mt-2">🤖 {aiReconstructionCount}</div>
          <div className="text-xs text-amber-700 mt-1">
            {total > 0 ? Math.round((aiReconstructionCount / total) * 100) : 0}%
          </div>
        </div>
      </div>

      {/* Visual Asset Distribution */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">🎨 시각자료 분포</h2>
        <div className="space-y-4">
          {/* Real Materials */}
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">실제 자료</span>
              <span className="text-sm font-semibold text-blue-700">
                {distribution.real} ({realPct}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-blue-500 h-3 rounded-full transition-all"
                style={{ width: `${Math.max(realPct, 5)}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-1">목표: 50-70%</p>
          </div>

          {/* Generated Graphics */}
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">생성 그래픽</span>
              <span className="text-sm font-semibold text-purple-700">
                {distribution.graphic} ({graphicPct}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-purple-500 h-3 rounded-full transition-all"
                style={{ width: `${Math.max(graphicPct, 5)}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-1">목표: 15-25%</p>
          </div>

          {/* AI Reconstruction */}
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">AI 재현</span>
              <span className="text-sm font-semibold text-amber-700">
                {distribution.ai} ({aiPct}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-amber-500 h-3 rounded-full transition-all"
                style={{ width: `${Math.max(aiPct, 5)}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-1">목표: 10-25%</p>
          </div>

          {/* Mixed */}
          {distribution.mixed > 0 && (
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">혼합</span>
                <span className="text-sm font-semibold text-indigo-700">
                  {distribution.mixed} ({Math.round((distribution.mixed / total) * 100)}%)
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-indigo-500 h-3 rounded-full transition-all"
                  style={{ width: `${Math.max(Math.round((distribution.mixed / total) * 100), 5)}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fact Status Distribution */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">📋 팩트 상태 분포</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-green-50 p-3 rounded border border-green-200">
            <div className="text-sm text-green-800 font-medium">확인된 사실</div>
            <div className="text-2xl font-bold text-green-900 mt-1">{factStatus.FACT || 0}</div>
          </div>
          <div className="bg-blue-50 p-3 rounded border border-blue-200">
            <div className="text-sm text-blue-800 font-medium">뒷받침됨</div>
            <div className="text-2xl font-bold text-blue-900 mt-1">{factStatus.SUPPORTED || 0}</div>
          </div>
          <div className="bg-amber-50 p-3 rounded border border-amber-200">
            <div className="text-sm text-amber-800 font-medium">증언 기반</div>
            <div className="text-2xl font-bold text-amber-900 mt-1">{factStatus.TESTIMONY || 0}</div>
          </div>
          <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
            <div className="text-sm text-yellow-800 font-medium">주장</div>
            <div className="text-2xl font-bold text-yellow-900 mt-1">{factStatus.CLAIM || 0}</div>
          </div>
          <div className="bg-orange-50 p-3 rounded border border-orange-200">
            <div className="text-sm text-orange-800 font-medium">논쟁 중</div>
            <div className="text-2xl font-bold text-orange-900 mt-1">{factStatus.DISPUTED || 0}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded border border-gray-200">
            <div className="text-sm text-gray-800 font-medium">미확인</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{factStatus.UNVERIFIED || 0}</div>
          </div>
          <div className="bg-red-50 p-3 rounded border border-red-200">
            <div className="text-sm text-red-800 font-medium">거짓</div>
            <div className="text-2xl font-bold text-red-900 mt-1">{factStatus.FALSE || 0}</div>
          </div>
        </div>
      </div>

      {/* Source Statistics */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">📚 출처 통계</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-indigo-50 p-4 rounded border border-indigo-200">
            <div className="text-sm text-indigo-800 font-medium">전체 출처</div>
            <div className="text-3xl font-bold text-indigo-900 mt-2">{sources.totalSources}</div>
            <div className="text-xs text-indigo-700 mt-1">개</div>
          </div>
          <div className="bg-teal-50 p-4 rounded border border-teal-200">
            <div className="text-sm text-teal-800 font-medium">고유 출판사</div>
            <div className="text-3xl font-bold text-teal-900 mt-2">{sources.uniquePublishers.size}</div>
            <div className="text-xs text-teal-700 mt-1">개</div>
          </div>
          <div className="bg-cyan-50 p-4 rounded border border-cyan-200">
            <div className="text-sm text-cyan-800 font-medium">평균 출처</div>
            <div className="text-3xl font-bold text-cyan-900 mt-2">
              {total > 0 ? (sources.totalSources / total).toFixed(1) : 0}
            </div>
            <div className="text-xs text-cyan-700 mt-1">개/장면</div>
          </div>
        </div>

        {/* Source Types */}
        {Object.keys(sources.sourcesByType).length > 0 && (
          <div className="mt-6">
            <h3 className="font-medium text-gray-900 mb-3">출처 유형별 분포</h3>
            <div className="space-y-2">
              {Object.entries(sources.sourcesByType)
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => (
                  <div key={type} className="flex justify-between items-center">
                    <span className="text-sm text-gray-700 capitalize">{type}</span>
                    <span className="text-sm font-semibold text-gray-900">{count}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Top Publishers */}
        {sources.uniquePublishers.size > 0 && (
          <div className="mt-6">
            <h3 className="font-medium text-gray-900 mb-3">주요 출판사</h3>
            <div className="space-y-1 text-sm text-gray-700">
              {Array.from(sources.uniquePublishers)
                .slice(0, 5)
                .map((pub) => (
                  <div key={pub} className="flex items-center gap-2">
                    <span>•</span>
                    <span>{pub}</span>
                  </div>
                ))}
              {sources.uniquePublishers.size > 5 && (
                <div className="text-gray-500 text-xs mt-2">
                  +{sources.uniquePublishers.size - 5}개 더 보기
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quality Indicators */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">✅ 품질 지표</h2>
        <div className="space-y-3">
          {/* Real Material Target */}
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded border border-blue-200">
            <div className="flex items-center gap-2">
              <span className="text-lg">{realPct >= 50 && realPct <= 70 ? "✅" : "⚠️"}</span>
              <span className="text-sm text-gray-700">실제 자료 비율 목표 (50-70%)</span>
            </div>
            <span className="font-semibold text-blue-900">{realPct}%</span>
          </div>

          {/* Graphics Target */}
          <div className="flex items-center justify-between p-3 bg-purple-50 rounded border border-purple-200">
            <div className="flex items-center gap-2">
              <span className="text-lg">{graphicPct >= 15 && graphicPct <= 25 ? "✅" : "⚠️"}</span>
              <span className="text-sm text-gray-700">생성 그래픽 비율 목표 (15-25%)</span>
            </div>
            <span className="font-semibold text-purple-900">{graphicPct}%</span>
          </div>

          {/* AI Target */}
          <div className="flex items-center justify-between p-3 bg-amber-50 rounded border border-amber-200">
            <div className="flex items-center gap-2">
              <span className="text-lg">{aiPct >= 10 && aiPct <= 25 ? "✅" : "⚠️"}</span>
              <span className="text-sm text-gray-700">AI 재현 비율 목표 (10-25%)</span>
            </div>
            <span className="font-semibold text-amber-900">{aiPct}%</span>
          </div>

          {/* Completion Rate */}
          <div className="flex items-center justify-between p-3 bg-green-50 rounded border border-green-200">
            <div className="flex items-center gap-2">
              <span className="text-lg">{completedPct === 100 ? "✅" : "⚠️"}</span>
              <span className="text-sm text-gray-700">생성 완료율</span>
            </div>
            <span className="font-semibold text-green-900">{completedPct}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
