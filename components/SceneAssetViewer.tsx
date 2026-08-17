/**
 * Scene Asset Viewer Component
 *
 * 각 장면의 시각자료 정보를 표시하고 선택할 수 있는 UI
 * - 시각자료 출처 표시 (실제/그래픽/AI)
 * - 팩트 상태 표시
 * - 출처 정보
 * - AI 재현 표시
 */

import React, { useState } from "react";
import { Scene, VisualOrigin, FactStatus } from "@/lib/mystery/types";

interface SceneAssetViewerProps {
  scene: Scene;
  onUpdate?: (updatedScene: Scene) => void;
}

// VisualOrigin 한글 라벨
const VISUAL_ORIGIN_LABELS: Record<VisualOrigin, string> = {
  REAL_ARCHIVE_PHOTO: "실제 아카이브",
  REAL_NEWS: "실제 뉴스",
  REAL_INTERVIEW: "실제 인터뷰",
  REAL_VIDEO: "실제 영상",
  REAL_MAP: "실제 지도",
  REAL_DOCUMENT: "실제 문서",
  GENERATED_GRAPHIC: "생성 그래픽",
  GENERATED_DIAGRAM: "생성 다이어그램",
  GENERATED_TIMELINE: "생성 타임라인",
  AI_RECONSTRUCTION: "AI 재현",
  AI_RECONSTRUCTION_VIDEO: "AI 재현 영상",
  AI_ATMOSPHERE: "AI 분위기",
  MIXED: "혼합",
};

// FactStatus 한글 라벨
const FACT_STATUS_LABELS: Record<FactStatus, string> = {
  FACT: "확인된 사실",
  SUPPORTED: "뒷받침됨",
  TESTIMONY: "증언 기반",
  CLAIM: "주장",
  DISPUTED: "논쟁 중",
  UNVERIFIED: "미확인",
  FALSE: "거짓",
};

// FactStatus 색상
const FACT_STATUS_COLORS: Record<FactStatus, string> = {
  FACT: "bg-green-100 text-green-800",
  SUPPORTED: "bg-blue-100 text-blue-800",
  TESTIMONY: "bg-amber-100 text-amber-800",
  CLAIM: "bg-yellow-100 text-yellow-800",
  DISPUTED: "bg-orange-100 text-orange-800",
  UNVERIFIED: "bg-gray-100 text-gray-800",
  FALSE: "bg-red-100 text-red-800",
};

// VisualOrigin 색상
const VISUAL_ORIGIN_COLORS: Record<VisualOrigin, string> = {
  REAL_ARCHIVE_PHOTO: "bg-blue-100 text-blue-800",
  REAL_NEWS: "bg-blue-100 text-blue-800",
  REAL_INTERVIEW: "bg-blue-100 text-blue-800",
  REAL_VIDEO: "bg-blue-100 text-blue-800",
  REAL_MAP: "bg-blue-100 text-blue-800",
  REAL_DOCUMENT: "bg-blue-100 text-blue-800",
  GENERATED_GRAPHIC: "bg-purple-100 text-purple-800",
  GENERATED_DIAGRAM: "bg-purple-100 text-purple-800",
  GENERATED_TIMELINE: "bg-purple-100 text-purple-800",
  AI_RECONSTRUCTION: "bg-amber-100 text-amber-800",
  AI_RECONSTRUCTION_VIDEO: "bg-amber-100 text-amber-800",
  AI_ATMOSPHERE: "bg-amber-100 text-amber-800",
  MIXED: "bg-indigo-100 text-indigo-800",
};

export function SceneAssetViewer({ scene, onUpdate }: SceneAssetViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const visualOrigin = scene.visualOrigin || "MIXED";
  const factStatus = scene.factStatus || "UNVERIFIED";
  const isAiReconstruction = scene.aiReconstructionExplained ?? false;

  return (
    <div className="border rounded-lg p-4 mb-4 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 truncate">{scene.visualLabel || scene.visualQuery}</h3>
          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{scene.text}</p>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="ml-4 text-gray-500 hover:text-gray-700 p-2"
        >
          {isExpanded ? "▼" : "▶"}
        </button>
      </div>

      {/* Quick Info Row */}
      <div className="flex flex-wrap gap-2 mt-3">
        {/* Visual Origin Badge */}
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${VISUAL_ORIGIN_COLORS[visualOrigin]}`}>
          {VISUAL_ORIGIN_LABELS[visualOrigin]}
        </div>

        {/* Fact Status Badge */}
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${FACT_STATUS_COLORS[factStatus]}`}>
          {FACT_STATUS_LABELS[factStatus]}
        </div>

        {/* AI Reconstruction Warning */}
        {isAiReconstruction && (
          <div className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
            🤖 AI 재현
          </div>
        )}

        {/* Duration */}
        {scene.durationSeconds && (
          <div className="px-3 py-1 rounded-full text-sm text-gray-600 bg-gray-100">
            {scene.durationSeconds.toFixed(1)}초
          </div>
        )}
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t space-y-3">
          {/* Visual URL */}
          {scene.visualUrl && (
            <div>
              <label className="text-sm font-medium text-gray-700">시각자료 URL</label>
              <div className="text-sm text-gray-600 break-all font-mono">{scene.visualUrl}</div>
            </div>
          )}

          {/* Source Label */}
          {scene.visualSourceLabel && (
            <div>
              <label className="text-sm font-medium text-gray-700">출처</label>
              <div className="text-sm text-gray-900 bg-gray-50 p-2 rounded border border-gray-200">
                {scene.visualSourceLabel}
              </div>
            </div>
          )}

          {/* Visual Type */}
          <div>
            <label className="text-sm font-medium text-gray-700">시각자료 타입</label>
            <div className="text-sm text-gray-600">{scene.visualType}</div>
          </div>

          {/* Status */}
          <div>
            <label className="text-sm font-medium text-gray-700">생성 상태</label>
            <div className={`text-sm px-2 py-1 rounded w-fit ${
              scene.visualStatus === "done"
                ? "bg-green-50 text-green-800"
                : scene.visualStatus === "error"
                  ? "bg-red-50 text-red-800"
                  : "bg-yellow-50 text-yellow-800"
            }`}>
              {scene.visualStatus === "done"
                ? "✅ 완료"
                : scene.visualStatus === "error"
                  ? "❌ 오류"
                  : "⏳ 진행 중"}
            </div>
          </div>

          {/* Sources */}
          {scene.sources && scene.sources.length > 0 && (
            <div>
              <label className="text-sm font-medium text-gray-700">출처 정보</label>
              <ul className="text-sm text-gray-600 space-y-1 mt-1">
                {scene.sources.map((source, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-gray-400 mt-0.5">•</span>
                    <span>
                      {source.title}
                      {source.publisher && ` (${source.publisher})`}
                      {source.publishedAt && ` - ${source.publishedAt.slice(0, 10)}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Narration Count */}
          {scene.narration && scene.narration.length > 0 && (
            <div>
              <label className="text-sm font-medium text-gray-700">내레이션</label>
              <div className="text-sm text-gray-600">{scene.narration.length}개 청크</div>
            </div>
          )}
        </div>
      )}

      {/* Status Footer */}
      {scene.visualError && (
        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded">
          <p className="text-sm text-red-800">
            <span className="font-medium">❌ 오류:</span> {scene.visualError}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Scene List Viewer
 * 모든 장면을 리스트로 표시
 */
interface SceneListViewerProps {
  scenes: Scene[];
  onUpdateScene?: (sceneId: string, updatedScene: Scene) => void;
}

export function SceneListViewer({ scenes, onUpdateScene }: SceneListViewerProps) {
  // 통계 계산
  const stats = {
    total: scenes.length,
    real: scenes.filter((s) => s.visualOrigin?.startsWith("REAL")).length,
    generated: scenes.filter((s) => s.visualOrigin?.startsWith("GENERATED")).length,
    ai: scenes.filter((s) => s.visualOrigin?.startsWith("AI")).length,
    done: scenes.filter((s) => s.visualStatus === "done").length,
    error: scenes.filter((s) => s.visualStatus === "error").length,
    aiReconstruction: scenes.filter((s) => s.aiReconstructionExplained).length,
  };

  const realPercentage = ((stats.real / stats.total) * 100).toFixed(0);
  const generatedPercentage = ((stats.generated / stats.total) * 100).toFixed(0);
  const aiPercentage = ((stats.ai / stats.total) * 100).toFixed(0);

  return (
    <div className="space-y-4">
      {/* Statistics */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
        <h2 className="font-semibold text-lg text-gray-900 mb-3">📊 시각자료 통계</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white p-3 rounded border border-gray-200">
            <div className="text-sm text-gray-600">전체 장면</div>
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          </div>
          <div className="bg-blue-100 p-3 rounded border border-blue-300">
            <div className="text-sm text-blue-800 font-medium">실제 자료</div>
            <div className="text-2xl font-bold text-blue-900">{stats.real}</div>
            <div className="text-xs text-blue-700">{realPercentage}%</div>
          </div>
          <div className="bg-purple-100 p-3 rounded border border-purple-300">
            <div className="text-sm text-purple-800 font-medium">생성 그래픽</div>
            <div className="text-2xl font-bold text-purple-900">{stats.generated}</div>
            <div className="text-xs text-purple-700">{generatedPercentage}%</div>
          </div>
          <div className="bg-amber-100 p-3 rounded border border-amber-300">
            <div className="text-sm text-amber-800 font-medium">AI 재현</div>
            <div className="text-2xl font-bold text-amber-900">{stats.ai}</div>
            <div className="text-xs text-amber-700">{aiPercentage}%</div>
          </div>
        </div>

        {/* Warnings */}
        <div className="mt-3 space-y-2">
          {stats.error > 0 && (
            <div className="flex items-center gap-2 text-sm text-red-800 bg-red-50 p-2 rounded">
              <span>❌</span>
              <span>{stats.error}개 장면에 오류 발생</span>
            </div>
          )}
          {stats.aiReconstruction > 0 && (
            <div className="flex items-center gap-2 text-sm text-amber-800 bg-amber-50 p-2 rounded">
              <span>🤖</span>
              <span>{stats.aiReconstruction}개 장면이 AI 재현을 포함</span>
            </div>
          )}
        </div>
      </div>

      {/* Scenes List */}
      <div>
        <h2 className="font-semibold text-lg text-gray-900 mb-3">🎬 장면별 시각자료</h2>
        <div className="space-y-2">
          {scenes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              생성된 장면이 없습니다.
            </div>
          ) : (
            scenes.map((scene, idx) => (
              <SceneAssetViewer
                key={scene.id}
                scene={scene}
                onUpdate={onUpdateScene ? (updated) => onUpdateScene(scene.id, updated) : undefined}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
