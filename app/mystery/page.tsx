"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import type { MysteryProject } from "@/lib/mystery/types";
import { SceneListViewer } from "@/components/SceneAssetViewer";
import { MetadataDashboard } from "@/components/MetadataDashboard";

type Tab = "dashboard" | "scenes" | "metadata";

export default function MysteryStudio() {
  const { data: session, status: authStatus } = useSession();
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const [projectList, setProjectList] = useState<MysteryProject[] | null>(null);
  const [project, setProject] = useState<MysteryProject | null>(null);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [error, setError] = useState<string | null>(null);

  async function api(path: string, opts?: RequestInit) {
    const res = await fetch(path, {
      headers: { "Content-Type": "application/json" },
      ...opts,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `요청 실패 (HTTP ${res.status})`);
    return data;
  }

  async function refreshProjectList() {
    try {
      const data = await api("/api/mystery/projects");
      setProjectList(data.projects || []);
    } catch (e: any) {
      setError(e.message || String(e));
      setProjectList([]);
    }
  }

  useEffect(() => {
    if (authStatus === "authenticated" && !project) {
      refreshProjectList();

      // Check if projectId is in URL
      const projectId = searchParams?.get("projectId");
      if (projectId) {
        api(`/api/mystery/projects/${projectId}`)
          .then((data) => {
            if (data.project) {
              setProject(data.project);
              // Remove projectId from URL
              window.history.replaceState({}, "", "/mystery");
            }
          })
          .catch((err) => console.error("Failed to load project:", err));
      }
    }
  }, [authStatus, project, searchParams]);

  // Auto-refresh project status while pipeline is running
  useEffect(() => {
    if (!project || project.stage === "done") return;

    const interval = setInterval(async () => {
      try {
        const data = await api(`/api/mystery/projects/${project.id}`);
        if (data.project) {
          setProject(data.project);
        }
      } catch (err) {
        console.error("Failed to refresh project:", err);
      }
    }, 2000); // Refresh every 2 seconds

    return () => clearInterval(interval);
  }, [project?.id, project?.stage]);

  if (authStatus === "loading") {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <div style={{ fontSize: 24, marginBottom: 20 }}>⏳ 로드 중...</div>
      </div>
    );
  }

  if (authStatus === "unauthenticated") {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <div style={{ fontSize: 20, marginBottom: 20 }}>로그인이 필요합니다</div>
        <p style={{ color: "var(--text-muted)" }}>미스터리 프로젝트를 사용하려면 먼저 로그인하세요.</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 20px" }}>
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 28, marginBottom: 10 }}>🔍 미스터리 다큐멘터리 스튜디오</h1>
          <p style={{ color: "var(--text-muted)", marginBottom: 30 }}>
            실화 기반 미스터리 콘텐츠 자동 제작 플랫폼
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: 15,
              marginBottom: 20,
              backgroundColor: "var(--danger-bg)",
              color: "var(--danger)",
              borderRadius: 6,
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        {projectList === null ? (
          <p style={{ color: "var(--text-muted)" }}>불러오는 중...</p>
        ) : projectList.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 20 }}>🎬</div>
            <h2 style={{ fontSize: 24, marginBottom: 10 }}>새 미스터리 다큐멘터리를 만들어보세요!</h2>
            <p style={{ color: "var(--text-muted)", fontSize: 16, marginBottom: 30 }}>
              사건을 설명하면 자동으로 완성된 다큐멘터리 영상이 생성됩니다
            </p>
            <button
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.href = "/mystery/quick-create";
                }
              }}
              style={{
                padding: "16px 40px",
                fontSize: 16,
                fontWeight: 600,
                backgroundColor: "var(--primary)",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.opacity = "0.8";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.opacity = "1";
              }}
            >
              ✨ 자동 제작 시작
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 30 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h2>내 프로젝트</h2>
                <button
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      window.location.href = "/mystery/quick-create";
                    }
                  }}
                  style={{
                    padding: "8px 16px",
                    fontSize: 14,
                    fontWeight: 600,
                    backgroundColor: "var(--primary)",
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  + 새 프로젝트
                </button>
              </div>
              <div style={{ display: "grid", gap: 15 }}>
                {projectList.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setProject(p)}
                    style={{
                      padding: 20,
                      backgroundColor: "var(--surface)",
                      border: "1px solid var(--line)",
                      borderRadius: 8,
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = "var(--surface-hover)";
                      (e.currentTarget as HTMLElement).style.borderColor = "var(--line-strong)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = "var(--surface)";
                      (e.currentTarget as HTMLElement).style.borderColor = "var(--line)";
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 5 }}>{p.name}</div>
                        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{p.input.topic}</div>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {new Date(p.createdAt).toLocaleDateString("ko-KR")}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 20, fontSize: 13, color: "var(--text-muted)" }}>
                      <span>단계: {p.stage}</span>
                      <span>장면: {p.scenes?.length || 0}</span>
                      <span>대본: {p.script?.sections.length || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const scenes = project.scenes || [];

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "20px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30 }}>
        <div>
          <button
            onClick={() => setProject(null)}
            style={{
              background: "none",
              border: "none",
              color: "var(--primary)",
              cursor: "pointer",
              fontSize: 14,
              marginBottom: 10,
            }}
          >
            ← 프로젝트 목록으로
          </button>
          <h1 style={{ fontSize: 28, margin: 0 }}>{project.name}</h1>
          <p style={{ color: "var(--text-muted)", margin: "8px 0 0" }}>{project.input.topic}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 5 }}>진행률</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>
            {scenes.filter((s) => s.visualStatus === "done").length}/{scenes.length}
          </div>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: 15,
            marginBottom: 20,
            backgroundColor: "var(--danger-bg)",
            color: "var(--danger)",
            borderRadius: 6,
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 10, marginBottom: 30, borderBottom: "1px solid var(--line)" }}>
        {[
          { key: "dashboard" as Tab, label: "📊 대시보드" },
          { key: "metadata" as Tab, label: "📈 메타데이터" },
          { key: "scenes" as Tab, label: "🎬 장면" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "12px 20px",
              background: "none",
              border: "none",
              borderBottom: tab === t.key ? "2px solid var(--primary)" : "2px solid transparent",
              color: tab === t.key ? "var(--primary)" : "var(--text-muted)",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: tab === t.key ? 600 : 400,
              transition: "all 0.2s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div>
        {tab === "dashboard" && (
          <div>
            <h2 style={{ fontSize: 20, marginBottom: 20 }}>프로젝트 진행 상황</h2>

            {/* Pipeline status indicator */}
            <div
              style={{
                padding: 20,
                marginBottom: 30,
                backgroundColor: "var(--surface-raised)",
                borderRadius: 8,
                border: "1px solid var(--line)",
              }}
            >
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
                📊 자동 생성 진행 단계
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 5 }}>
                {project.stage === "done"
                  ? "✅ 완료됨"
                  : project.stage === "research"
                    ? "🔍 사건 조사 중..."
                    : project.stage === "script"
                      ? "📝 대본 생성 중..."
                      : project.stage === "scenes"
                        ? "🎬 장면 구성 중..."
                        : project.stage === "visuals"
                          ? "🖼️ 시각 자료 수집 중..."
                          : project.stage === "narration"
                            ? "🎤 음성 생성 중..."
                            : project.stage === "render"
                              ? "🎥 영상 렌더링 중..."
                              : `진행 중: ${project.stage}`}
              </div>
              <div
                style={{
                  width: "100%",
                  height: 8,
                  backgroundColor: "var(--surface)",
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    backgroundColor: "var(--primary)",
                    width: `${
                      project.stage === "done"
                        ? 100
                        : project.stage === "research"
                          ? 15
                          : project.stage === "script"
                            ? 35
                            : project.stage === "scenes"
                              ? 50
                              : project.stage === "visuals"
                                ? 65
                                : project.stage === "narration"
                                  ? 80
                                  : project.stage === "render"
                                    ? 90
                                    : 50
                    }%`,
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 15,
                marginBottom: 30,
              }}
            >
              {[
                { label: "전체 장면", value: scenes.length, icon: "🎬" },
                {
                  label: "완료됨",
                  value: scenes.filter((s) => s.visualStatus === "done").length,
                  icon: "✅",
                },
                {
                  label: "오류",
                  value: scenes.filter((s) => s.visualStatus === "error").length,
                  icon: "❌",
                },
                {
                  label: "AI 재현",
                  value: scenes.filter((s) => s.aiReconstructionExplained).length,
                  icon: "🤖",
                },
              ].map((stat, i) => (
                <div
                  key={i}
                  style={{
                    padding: 20,
                    backgroundColor: "var(--surface-raised)",
                    borderRadius: 8,
                    border: "1px solid var(--line)",
                  }}
                >
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>{stat.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 600 }}>
                    {stat.icon} {stat.value}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ backgroundColor: "var(--surface-raised)", borderRadius: 8, border: "1px solid var(--line)", padding: 20 }}>
              <h3 style={{ marginTop: 0 }}>프로젝트 정보</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20, fontSize: 14 }}>
                <div>
                  <div style={{ color: "var(--text-muted)", marginBottom: 5 }}>콘텐츠 타입</div>
                  <div style={{ fontWeight: 600 }}>{project.input.caseType}</div>
                </div>
                <div>
                  <div style={{ color: "var(--text-muted)", marginBottom: 5 }}>서사 방식</div>
                  <div style={{ fontWeight: 600 }}>{project.input.angles.join(", ")}</div>
                </div>
                <div>
                  <div style={{ color: "var(--text-muted)", marginBottom: 5 }}>목표 길이</div>
                  <div style={{ fontWeight: 600 }}>{project.input.targetMinutes}분</div>
                </div>
                <div>
                  <div style={{ color: "var(--text-muted)", marginBottom: 5 }}>목표 장면 수</div>
                  <div style={{ fontWeight: 600 }}>{project.input.sceneVisualTarget}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "metadata" && (
          <div>
            <MetadataDashboard project={project} />
          </div>
        )}

        {tab === "scenes" && (
          <div>
            {scenes.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }}>
                <p style={{ fontSize: 16 }}>아직 생성된 장면이 없습니다.</p>
                <p style={{ fontSize: 14 }}>대본 생성 후 장면이 자동으로 추가됩니다.</p>
              </div>
            ) : (
              <SceneListViewer
                scenes={scenes}
                onUpdateScene={(sceneId, updatedScene) => {
                  const updated = { ...project };
                  if (updated.scenes) {
                    const idx = updated.scenes.findIndex((s) => s.id === sceneId);
                    if (idx !== -1) {
                      updated.scenes[idx] = updatedScene;
                      setProject(updated);
                    }
                  }
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
