"use client";

import { useEffect, useRef, useState } from "react";
import { getProviders, signIn, signOut, useSession } from "next-auth/react";
import type {
  EconomicProject,
  EndingStyle,
  NarrativeAngle,
  PipelineStage,
  Scene,
  ScriptSection,
} from "../lib/economic/types";
import {
  CHARS_PER_MINUTE,
  DEFAULT_SCENE_VISUAL_TARGET,
  LENGTH_PRESETS_MINUTES,
  MAX_SCENE_VISUAL_TARGET,
  MAX_TARGET_MINUTES,
  MIN_SCENE_VISUAL_TARGET,
  MIN_TARGET_MINUTES,
  NARRATIVE_ANGLE_INFO,
  SHORT_LENGTH_WARNING_MINUTES,
  VISUAL_TYPE_LABEL,
} from "../lib/economic/types";

type Tab = "research" | "script" | "scenes" | "narration" | "edit" | "review" | "render" | "done";

const TAB_DEFS: { key: Tab; label: string }[] = [
  { key: "research", label: "리서치" },
  { key: "script", label: "대본" },
  { key: "scenes", label: "장면·자료" },
  { key: "narration", label: "음성" },
  { key: "edit", label: "편집" },
  { key: "review", label: "검수" },
  { key: "render", label: "렌더링" },
  { key: "done", label: "완료" },
];

const NARRATIVE_ANGLE_OPTIONS: NarrativeAngle[] = ["collapse", "macro", "company_story", "concept_explainer", "wealth_howto"];
// 로컬 TTS(Piper)는 서버에 설치된 음성 모델 하나(.env.local의 PIPER_VOICE_MODEL)로 고정된다
// — Gemini처럼 여러 프리셋 목소리를 선택할 수 없으므로 옵션이 하나뿐이다.
const VOICE_OPTIONS = ["기본"];

const SECTION_LABEL: Record<ScriptSection["kind"], string> = {
  hook: "훅 (오프닝)",
  chapter: "챕터",
  summary: "핵심 정리",
};

const ANGLE_SHORT_LABEL: Record<string, string> = {
  situation: "현황",
  cause: "원인",
  history: "과거 사례",
  impact: "영향",
  numbers: "숫자·자료",
  expert: "전문가 관점",
  outlook: "전망",
};

/** 프로젝트를 이어서 열 때 어느 탭으로 보낼지 — 진행 단계와 화면 탭 이름이 조금 다르다. */
function stageToTab(stage: PipelineStage): Tab {
  if (stage === "visuals") return "scenes";
  if (stage === "scenes") return "scenes";
  return stage as Tab;
}

interface ChecklistLine {
  icon: "✅" | "🔄" | "❌" | "⬜";
  text: string;
}

function buildChecklist(p: EconomicProject): ChecklistLine[] {
  const lines: ChecklistLine[] = [];
  const scenes = p.scenes || [];

  if (p.research && p.research.length > 0) {
    lines.push({ icon: "✅", text: `리서치 완료 (출처 ${p.research.reduce((n, r) => n + r.sources.length, 0)}건)` });
  } else {
    lines.push({ icon: "⬜", text: "리서치" });
  }

  if (p.script && p.script.sections.length > 0 && p.stage !== "script") {
    lines.push({ icon: "✅", text: `대본 완료 (${p.script.totalCharCount.toLocaleString()}자)` });
  } else if (p.script && p.script.sections.length > 0) {
    lines.push({ icon: "🔄", text: `대본 작성 중 (${p.script.sections.length}개 섹션)` });
  } else {
    lines.push({ icon: "⬜", text: "대본" });
  }

  if (scenes.length > 0) {
    lines.push({ icon: "✅", text: `장면 구성 완료 (${scenes.length}개)` });
  } else if (p.stage === "scenes") {
    lines.push({ icon: "🔄", text: "장면 구성 중" });
  } else {
    lines.push({ icon: "⬜", text: "장면 구성" });
  }

  const visualsDone = scenes.filter((s) => s.visualStatus === "done").length;
  const visualsError = scenes.filter((s) => s.visualStatus === "error").length;
  if (scenes.length === 0) {
    lines.push({ icon: "⬜", text: "시각자료" });
  } else if (visualsDone === scenes.length) {
    lines.push({ icon: "✅", text: `시각자료 완료 (${visualsDone}/${scenes.length})` });
  } else if (visualsError > 0) {
    lines.push({ icon: "❌", text: `시각자료 ${visualsDone}/${scenes.length} 완료 · ${visualsError}건 오류` });
  } else if (visualsDone > 0) {
    lines.push({ icon: "🔄", text: `시각자료 ${visualsDone}/${scenes.length} 완료` });
  } else {
    lines.push({ icon: "⬜", text: `시각자료 (0/${scenes.length})` });
  }

  const narrDone = scenes.filter((s) => s.narration.length > 0 && s.narration.every((n) => n.status === "done")).length;
  const narrError = scenes.filter((s) => s.narration.some((n) => n.status === "error")).length;
  if (scenes.length === 0) {
    lines.push({ icon: "⬜", text: "내레이션" });
  } else if (narrDone === scenes.length) {
    lines.push({ icon: "✅", text: `내레이션 완료 (${narrDone}/${scenes.length})` });
  } else if (narrError > 0) {
    lines.push({ icon: "❌", text: `내레이션 ${narrDone}/${scenes.length} 완료 · ${narrError}건 오류` });
  } else if (narrDone > 0) {
    lines.push({ icon: "🔄", text: `내레이션 ${narrDone}/${scenes.length} 완료` });
  } else {
    lines.push({ icon: "⬜", text: `내레이션 (0/${scenes.length})` });
  }

  if (p.render.status === "ready") {
    lines.push({ icon: "✅", text: "최종 영상 완료" });
  } else if (p.render.status === "error") {
    lines.push({ icon: "❌", text: `영상 생성 오류: ${(p.render.error || "").slice(0, 60)}` });
  } else if (p.render.status === "working") {
    lines.push({ icon: "🔄", text: p.render.currentStep || "영상 생성 중" });
  } else {
    lines.push({ icon: "⬜", text: "영상 생성" });
  }

  return lines;
}

function Checklist({ project }: { project: EconomicProject }) {
  return (
    <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
      {buildChecklist(project).map((line, i) => (
        <li key={i} style={{ fontSize: 12.5, display: "flex", gap: 7, alignItems: "flex-start" }}>
          <span>{line.icon}</span>
          <span style={{ color: "var(--text-muted)" }}>{line.text}</span>
        </li>
      ))}
    </ul>
  );
}

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `요청 실패 (HTTP ${res.status})`);
  return data;
}

function StatusDot({ status }: { status: string }) {
  const labelMap: Record<string, string> = {
    pending: "대기",
    generating: "생성 중",
    done: "완료",
    error: "오류",
  };
  return <span className={`status-dot ${status}`}>{labelMap[status] || status}</span>;
}

function ProgressBar({ completed, total, label }: { completed: number; total: number; label: string }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="progress-label">
        <span>{label}</span>
        <span>
          {completed}/{total} ({pct}%)
        </span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SourceList({ sources }: { sources: { title: string; publisher: string; url: string; factUsed: string }[] }) {
  if (sources.length === 0) return null;
  return (
    <div className="source-list">
      {sources.slice(0, 4).map((s, i) => (
        <a key={i} className="source-chip" href={s.url} target="_blank" rel="noreferrer" title={s.factUsed}>
          {s.publisher} · {s.title.slice(0, 28)}
        </a>
      ))}
    </div>
  );
}

export default function Home() {
  const { data: session, status: authStatus } = useSession();
  const [projectList, setProjectList] = useState<EconomicProject[] | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [authProviders, setAuthProviders] = useState<Record<string, { id: string; name: string }> | null>(null);
  // next-auth의 getProviders()는 설정된 로그인 방법이 하나도 없으면 "로딩 전"과 똑같이
  // null을 반환한다(라이브러리 자체 동작: fetchData가 빈 객체를 null로 바꿔서 돌려줌).
  // authProviders만으로 "아직 안 불러옴"과 "불러왔는데 0개"를 구분할 수 없어서, 실제로
  // 불러오기가 끝났는지는 이 플래그로 따로 추적해야 한다 — 안 그러면 Google/네이버를 둘 다
  // 설정하지 않은 경우 "불러오는 중..." 화면에서 영원히 멈춘다.
  const [authProvidersLoaded, setAuthProvidersLoaded] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const [project, setProject] = useState<EconomicProject | null>(null);
  const [tab, setTab] = useState<Tab>("research");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [topic, setTopic] = useState("");
  const [targetMinutes, setTargetMinutes] = useState(30);
  const [narrativeAngle, setNarrativeAngle] = useState<NarrativeAngle>("collapse");
  const [endingStyle, setEndingStyle] = useState<EndingStyle>("summary");
  const [useEngagementCta, setUseEngagementCta] = useState(true);
  const [voiceName, setVoiceName] = useState(VOICE_OPTIONS[0]);
  const [useBgm, setUseBgm] = useState(false);
  const [sceneVisualTarget, setSceneVisualTarget] = useState(DEFAULT_SCENE_VISUAL_TARGET);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function refreshProject(id?: string) {
    const pid = id || project?.id;
    if (!pid) return;
    try {
      const data = await api(`/api/economic/projects/${pid}`);
      setProject(data.project);
    } catch {
      // 폴링 중 일시적 오류는 조용히 무시하고 다음 폴링에서 다시 시도한다.
    }
  }

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!project || project.render.status === "ready") return;
    pollRef.current = setInterval(() => refreshProject(project.id), 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, project?.render.status]);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      getProviders()
        .then((p) => setAuthProviders(p))
        .catch(() => setAuthProviders(null))
        .finally(() => setAuthProvidersLoaded(true));
    }
  }, [authStatus]);

  async function refreshProjectList() {
    try {
      const data = await api("/api/economic/projects");
      setProjectList(data.projects);
    } catch (e: any) {
      setError(e.message || String(e));
      setProjectList([]);
    }
  }

  useEffect(() => {
    if (authStatus === "authenticated" && !project) {
      refreshProjectList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus, project]);

  function handleResumeProject(p: EconomicProject) {
    setProject(p);
    setTab(stageToTab(p.stage));
  }

  async function handleRenameProject(id: string) {
    const name = renameDraft.trim();
    if (!name) {
      setRenamingId(null);
      return;
    }
    try {
      await api(`/api/economic/projects/${id}`, { method: "PATCH", body: JSON.stringify({ name }) });
      setRenamingId(null);
      await refreshProjectList();
    } catch (e: any) {
      setError(e.message || String(e));
    }
  }

  async function handleDeleteProject(id: string) {
    if (!confirm("이 프로젝트를 삭제할까요? 생성된 대본/자료/영상이 모두 사라지며 되돌릴 수 없습니다.")) return;
    try {
      await api(`/api/economic/projects/${id}`, { method: "DELETE" });
      await refreshProjectList();
    } catch (e: any) {
      setError(e.message || String(e));
    }
  }

  const sections = project?.script?.sections || [];
  const scenes = project?.scenes || [];

  const visualsDone = scenes.filter((s) => s.visualStatus === "done").length;
  const visualsError = scenes.filter((s) => s.visualStatus === "error").length;
  const narrationDone = scenes.filter((s) => s.narration.length > 0 && s.narration.every((n) => n.status === "done")).length;
  const narrationError = scenes.filter((s) => s.narration.some((n) => n.status === "error")).length;

  async function handleCreateProject() {
    setError(null);
    setBusy(true);
    try {
      const data = await api("/api/economic/projects", {
        method: "POST",
        body: JSON.stringify({
          topic,
          targetMinutes,
          narrativeAngle,
          endingStyle,
          useEngagementCta,
          voiceName,
          useBgm,
          sceneVisualTarget,
        }),
      });
      setProject(data.project);
      setTab("research");
      await api(`/api/economic/projects/${data.project.id}/research`, { method: "POST" });
      await refreshProject(data.project.id);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleStartScript() {
    if (!project) return;
    setError(null);
    setBusy(true);
    try {
      await api(`/api/economic/projects/${project.id}/script`, { method: "POST" });
      setTab("script");
      await refreshProject();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleRegenerateSection(sectionId: string) {
    if (!project) return;
    setError(null);
    try {
      await api(`/api/economic/projects/${project.id}/script/${sectionId}/regenerate`, { method: "POST" });
      await refreshProject();
    } catch (e: any) {
      setError(e.message || String(e));
    }
  }

  async function handleEditSectionText(sectionId: string, text: string) {
    if (!project) return;
    try {
      const data = await api(`/api/economic/projects/${project.id}/script/${sectionId}`, {
        method: "PATCH",
        body: JSON.stringify({ text }),
      });
      setProject(data.project);
    } catch (e: any) {
      setError(e.message || String(e));
    }
  }

  async function handleStartScenes() {
    if (!project) return;
    setError(null);
    setBusy(true);
    try {
      await api(`/api/economic/projects/${project.id}/scenes`, { method: "POST" });
      setTab("scenes");
      await refreshProject();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleEditSceneQuery(sceneId: string, visualQuery: string) {
    if (!project) return;
    try {
      const data = await api(`/api/economic/projects/${project.id}/scenes/${sceneId}`, {
        method: "PATCH",
        body: JSON.stringify({ visualQuery }),
      });
      setProject(data.project);
    } catch (e: any) {
      setError(e.message || String(e));
    }
  }

  async function handleStartVisuals() {
    if (!project) return;
    setError(null);
    try {
      await api(`/api/economic/projects/${project.id}/visuals`, { method: "POST" });
      await refreshProject();
    } catch (e: any) {
      setError(e.message || String(e));
    }
  }

  async function handleRetryVisual(sceneId: string) {
    if (!project) return;
    try {
      await api(`/api/economic/projects/${project.id}/visuals/${sceneId}/regenerate`, { method: "POST" });
      await refreshProject();
    } catch (e: any) {
      setError(e.message || String(e));
    }
  }

  async function handleStartNarration() {
    if (!project) return;
    setError(null);
    try {
      await api(`/api/economic/projects/${project.id}/narration`, { method: "POST" });
      await refreshProject();
    } catch (e: any) {
      setError(e.message || String(e));
    }
  }

  async function handleRetryNarration(sceneId: string) {
    if (!project) return;
    try {
      await api(`/api/economic/projects/${project.id}/narration/${sceneId}/regenerate`, { method: "POST" });
      await refreshProject();
    } catch (e: any) {
      setError(e.message || String(e));
    }
  }

  async function handleStartRender() {
    if (!project) return;
    setError(null);
    try {
      await api(`/api/economic/projects/${project.id}/render`, { method: "POST" });
      setTab("render");
      await refreshProject();
    } catch (e: any) {
      setError(e.message || String(e));
    }
  }

  function handleReset() {
    setProject(null);
    setShowCreateForm(false);
    setTab("research");
    setError(null);
    refreshProjectList();
  }

  const currentTabIndex = TAB_DEFS.findIndex((t) => t.key === tab);

  if (authStatus === "loading") {
    return (
      <div className="app-shell">
        <div className="loading-stage">
          <div className="spinner" />
          <div className="loading-title">로그인 상태 확인 중...</div>
        </div>
      </div>
    );
  }

  if (authStatus === "unauthenticated") {
    const providerList = authProviders ? Object.values(authProviders) : [];
    return (
      <div className="app-shell">
        <section className="hero">
          <span className="hero-eyebrow">AI 경제 뉴스 롱폼 자동 제작</span>
          <h1>경제 다큐 스튜디오에 로그인하세요</h1>
          <p className="lead">로그인하면 작업물이 계정별로 저장되어, 언제 다시 와도 이어서 진행할 수 있습니다.</p>
          <div className="panel" style={{ maxWidth: 380, display: "flex", flexDirection: "column", gap: 12 }}>
            {!authProvidersLoaded ? (
              <p className="hint">로그인 방법을 불러오는 중...</p>
            ) : providerList.length === 0 ? (
              <p className="hint">
                관리자가 아직 로그인 방법(Google/네이버)을 설정하지 않았습니다. .env.local에
                GOOGLE_CLIENT_ID/SECRET 또는 NAVER_CLIENT_ID/SECRET을 넣어야 합니다.
              </p>
            ) : (
              providerList.map((p) => (
                <button key={p.id} className="btn block" onClick={() => signIn(p.id)}>
                  {p.name}로 계속하기
                </button>
              ))
            )}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark">
          <span className="name">
            경제 다큐<em>스튜디오</em>
          </span>
          <span className="tagline">AI 경제 뉴스 롱폼 자동 제작</span>
        </div>
        {project && (
          <nav className="stepper">
            {TAB_DEFS.map((t, i) => (
              <div key={t.key} style={{ display: "flex", alignItems: "center" }}>
                {i > 0 && <span className="step-sep" />}
                <span
                  className={`step-pill ${i === currentTabIndex ? "is-current" : i < currentTabIndex ? "is-done" : ""}`}
                  style={{ cursor: "pointer" }}
                  onClick={() => setTab(t.key)}
                >
                  <span className="dot" />
                  {t.label}
                </span>
              </div>
            ))}
          </nav>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span className="hint" style={{ margin: 0 }}>{session?.user?.name || session?.user?.email}</span>
          <button className="btn secondary" style={{ padding: "8px 14px", fontSize: 11 }} onClick={() => signOut()}>
            로그아웃
          </button>
        </div>
      </header>

      {!project && !showCreateForm && (projectList === null || (projectList?.length ?? 0) > 0) ? (
        <section className="hero">
          <span className="hero-eyebrow">경제 다큐 스튜디오</span>
          <h1>내 프로젝트</h1>
          <p className="lead">새 영상을 시작하거나, 하던 작업을 이어서 진행하세요.</p>
          <div className="panel" style={{ maxWidth: 720, textAlign: "left" }}>
            <button className="btn block" style={{ marginBottom: 20 }} onClick={() => setShowCreateForm(true)}>
              + 새 프로젝트 시작
            </button>
            {error && <div className="error-box">{error}</div>}
            {projectList === null ? (
              <p className="hint">불러오는 중...</p>
            ) : projectList.length === 0 ? (
              <p className="hint">아직 만든 프로젝트가 없습니다.</p>
            ) : (
              projectList.map((p) => (
                <div key={p.id} className="scene-card">
                  <div className="scene-card-head">
                    {renamingId === p.id ? (
                      <input
                        type="text"
                        autoFocus
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onBlur={() => handleRenameProject(p.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRenameProject(p.id);
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        style={{
                          flex: 1,
                          background: "var(--surface-raised)",
                          border: "1px solid var(--line-strong)",
                          borderRadius: 6,
                          color: "var(--text)",
                          padding: "6px 10px",
                          fontSize: 13,
                        }}
                      />
                    ) : (
                      <span className="tag mono" style={{ cursor: "pointer" }} onClick={() => handleResumeProject(p)}>
                        {p.name || p.script?.title || p.input.topic.slice(0, 40)}
                      </span>
                    )}
                    <span className="badge">{new Date(p.createdAt).toLocaleDateString("ko-KR")}</span>
                    <button
                      className="btn secondary"
                      style={{ padding: "6px 10px", fontSize: 10.5 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenamingId(p.id);
                        setRenameDraft(p.name);
                      }}
                    >
                      이름변경
                    </button>
                    <button
                      className="btn secondary"
                      style={{ padding: "6px 10px", fontSize: 10.5, color: "var(--danger)" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProject(p.id);
                      }}
                    >
                      삭제
                    </button>
                  </div>
                  <div onClick={() => handleResumeProject(p)} style={{ cursor: "pointer" }}>
                    <Checklist project={p} />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      ) : !project ? (
        <section className="hero">
          <span className="hero-eyebrow">AI 경제 뉴스 롱폼 자동 제작</span>
          <h1>경제 주제 하나만 넣으면, 실제 뉴스 기반 롱폼 영상이 완성됩니다</h1>
          <p className="lead">
            최신 뉴스 리서치 → 대본(후킹→현황→원인→과거사례→영향→숫자→전문가관점→전망→정리) →
            장면별 실제 시각자료(뉴스사진·차트·그래프·로고) → 내레이션 → 자막 → 렌더링까지
            자동으로 만들어 드립니다.
          </p>

          <div className="panel" style={{ maxWidth: 640, textAlign: "left" }}>
            <div className="field">
              <label>경제 주제 (필수)</label>
              <textarea
                rows={4}
                placeholder="예: 미국 기준금리 인하가 한국 부동산 시장에 미치는 영향"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>

            <div className="field">
              <label>목표 길이</label>
              <div className="choice-grid">
                {LENGTH_PRESETS_MINUTES.map((m) => (
                  <label key={m} className={`choice-chip ${targetMinutes === m ? "is-checked" : ""}`}>
                    <input type="radio" checked={targetMinutes === m} onChange={() => setTargetMinutes(m)} />
                    {m}분
                  </label>
                ))}
              </div>
              <input
                type="number"
                min={MIN_TARGET_MINUTES}
                max={MAX_TARGET_MINUTES}
                value={targetMinutes}
                onChange={(e) => setTargetMinutes(Number(e.target.value) || 30)}
                style={{ marginTop: 10, maxWidth: 140 }}
              />
              {targetMinutes < SHORT_LENGTH_WARNING_MINUTES ? (
                <p className="field-hint" style={{ color: "var(--danger)" }}>
                  PDF 실측: 경제 채널은 20분 미만 영상의 중앙 조회수가 40~60분 대비 크게 낮습니다
                  (0~10분 1,471회 vs 40~60분 44,712회). 짧게 만들 수는 있지만 참고하세요.
                </p>
              ) : (
                <p className="field-hint">
                  PDF 실측: 60분+ 영상이 10~20분 대비 조회수 9.3배. 개별 편은 20~40분 이상을 권장.
                </p>
              )}
            </div>

            <div className="field">
              <label>서사 앵글</label>
              <div className="choice-grid">
                {NARRATIVE_ANGLE_OPTIONS.map((a) => {
                  const info = NARRATIVE_ANGLE_INFO[a];
                  return (
                    <label key={a} className={`choice-chip ${narrativeAngle === a ? "is-checked" : ""}`}>
                      <input type="radio" checked={narrativeAngle === a} onChange={() => setNarrativeAngle(a)} />
                      {info.label} <span className="factor">{info.share}</span>
                    </label>
                  );
                })}
              </div>
              <p className="field-hint">{NARRATIVE_ANGLE_INFO[narrativeAngle].desc}</p>
            </div>

            <div className="row">
              <div className="field">
                <label>결말 스타일</label>
                <select value={endingStyle} onChange={(e) => setEndingStyle(e.target.value as EndingStyle)}>
                  <option value="summary">핵심 정리형</option>
                  <option value="outlook">향후 전망형</option>
                </select>
              </div>
              <div className="field">
                <label>내레이터 목소리</label>
                <select value={voiceName} onChange={(e) => setVoiceName(e.target.value)}>
                  {VOICE_OPTIONS.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field">
              <label>장면(시각자료) 개수(대략)</label>
              <input
                type="number"
                min={MIN_SCENE_VISUAL_TARGET}
                max={MAX_SCENE_VISUAL_TARGET}
                value={sceneVisualTarget}
                onChange={(e) => setSceneVisualTarget(Number(e.target.value) || DEFAULT_SCENE_VISUAL_TARGET)}
              />
              <p className="field-hint">
                목표 길이에 맞춰 자동으로 나뉘며, 이미지 검색/렌더링 API 사용량에 영향을 줍니다.
              </p>
            </div>

            <div className="field">
              <label className="choice-chip" style={{ display: "inline-flex" }}>
                <input type="checkbox" checked={useEngagementCta} onChange={(e) => setUseEngagementCta(e.target.checked)} />
                훅에 참여 유도 CTA 포함 (&quot;이 이슈 어떻게 보세요? 댓글로 남겨주세요&quot;)
              </label>
            </div>
            <div className="field">
              <label className="choice-chip" style={{ display: "inline-flex" }}>
                <input type="checkbox" checked={useBgm} onChange={(e) => setUseBgm(e.target.checked)} />
                차분한 배경음 사용(선택 — public/audio/bgm/economic/ 폴더 필요, PDF 요구사항 아님)
              </label>
            </div>

            <div className="warning-box">
              실제 사진/로고/지도 검색은 GOOGLE_CSE_API_KEY·GOOGLE_CSE_CX가 설정된 경우에만
              작동합니다(선택, 무료 등급 하루 100건). 미설정 시 해당 장면은 실제 수치 기반 데이터
              카드 또는 AI 보조 그래픽으로 자동 대체되어 렌더링은 그대로 진행됩니다.
            </div>

            {error && <div className="error-box">{error}</div>}

            <div className="actions">
              {projectList && projectList.length > 0 ? (
                <button className="btn secondary" onClick={() => setShowCreateForm(false)}>
                  취소
                </button>
              ) : (
                <span />
              )}
              <button className="btn" disabled={!topic.trim() || busy} onClick={handleCreateProject}>
                {busy ? "시작하는 중..." : "리서치 시작"}
              </button>
            </div>
          </div>
        </section>
      ) : (
        <div className="studio">
          <main className="studio-main">
            {error && <div className="error-box">{error}</div>}
            {project.pipelineError && <div className="error-box">마지막 시도 오류: {project.pipelineError}</div>}

            {tab === "research" && (
              <div className="panel">
                <h2 className="panel-title">리서치</h2>
                <p className="panel-desc">
                  최신 동향 / 배경·원인 / 영향·전망 세 관점으로 실제 뉴스를 검색해 사실관계를
                  정리합니다. 대본은 이 결과에 근거해서만 작성됩니다.
                </p>
                {(!project.research || project.research.length === 0) && (
                  <p className="hint">리서치를 진행하는 중입니다. 잠시 기다려 주세요.</p>
                )}
                {(project.research || []).map((f) => (
                  <div className="scene-card" key={f.id}>
                    <div className="scene-card-head">
                      <span className="tag mono">{f.query}</span>
                      <span className="badge">출처 {f.sources.length}건</span>
                    </div>
                    <p className="scene-thumb-text" style={{ fontSize: 13.5, lineHeight: 1.7 }}>
                      {f.summary}
                    </p>
                    <SourceList sources={f.sources} />
                  </div>
                ))}
                <div className="actions">
                  <button className="btn secondary" onClick={handleReset}>
                    처음부터
                  </button>
                  <button
                    className="btn"
                    disabled={!project.research || project.research.length < 3 || busy}
                    onClick={handleStartScript}
                  >
                    다음: 대본 생성
                  </button>
                </div>
              </div>
            )}

            {tab === "script" && (
              <div className="panel">
                <h2 className="panel-title">대본</h2>
                <p className="panel-desc">
                  훅 → 챕터(현황·원인·과거사례·영향·숫자·전문가관점·전망) → 핵심 정리 순으로
                  생성됩니다. 리서치에서 확인된 사실만 사용하며, 섹션마다 출처가 함께 표시됩니다.
                  섹션을 직접 고쳐 쓸 수도 있습니다.
                </p>
                {sections.length === 0 && (
                  <p className="hint">대본을 생성하는 중입니다. 길이에 따라 몇 분 정도 걸릴 수 있습니다.</p>
                )}

                {project.script?.titleCandidates && project.script.titleCandidates.length > 0 && (
                  <>
                    <div className="section-label">제목 후보 (PDF §3 공식 기준 참고 점수)</div>
                    {project.script.titleCandidates.map((c) => (
                      <div
                        key={c.text}
                        className={`title-candidate ${project.script?.title === c.text ? "is-selected" : ""}`}
                        onClick={async () => {
                          if (!project) return;
                          try {
                            const data = await api(`/api/economic/projects/${project.id}/script`, {
                              method: "PATCH",
                              body: JSON.stringify({ title: c.text }),
                            });
                            setProject(data.project);
                          } catch (e: any) {
                            setError(e.message || String(e));
                          }
                        }}
                      >
                        <span>{c.text}</span>
                        <span className="score mono">{c.score}</span>
                      </div>
                    ))}
                  </>
                )}

                <div className="section-label">섹션</div>
                <p className="hint" style={{ marginTop: -4, marginBottom: 14 }}>
                  챕터는 API 호출을 아끼려고 최대 3개씩 묶어서 생성됩니다 — 챕터 하나를 &quot;다시
                  생성&quot;하면 같은 묶음의 다른 챕터도 함께 다시 써집니다.
                </p>
                {sections.map((s) => (
                  <div className="scene-card" key={s.id}>
                    <div className="scene-card-head">
                      <span className="tag mono">
                        {SECTION_LABEL[s.kind]}
                        {s.kind === "chapter" ? ` ${(s.index ?? 0) + 1}` : ""}
                        {s.angles && s.angles.length > 0
                          ? ` · ${s.angles.map((a) => ANGLE_SHORT_LABEL[a] || a).join("/")}`
                          : ""}
                      </span>
                      <span className="badge">{s.charCount.toLocaleString()}자 · 약 {Math.round(s.estimatedSeconds / 60)}분</span>
                      <button className="btn secondary" onClick={() => handleRegenerateSection(s.id)}>
                        다시 생성
                      </button>
                    </div>
                    <textarea
                      rows={6}
                      defaultValue={s.text}
                      onBlur={(e) => {
                        if (e.target.value !== s.text) handleEditSectionText(s.id, e.target.value);
                      }}
                    />
                    <SourceList sources={s.sources} />
                  </div>
                ))}

                <div className="actions">
                  <button className="btn secondary" onClick={() => setTab("research")}>
                    이전
                  </button>
                  <button
                    className="btn"
                    disabled={sections.length === 0 || sections.some((s) => s.status !== "done")}
                    onClick={handleStartScenes}
                  >
                    다음: 장면 만들기
                  </button>
                </div>
              </div>
            )}

            {tab === "scenes" && (
              <div className="panel">
                <h2 className="panel-title">장면 · 시각자료</h2>
                <p className="panel-desc">
                  대본을 목표 장수에 맞춰 나누고, 장면마다 무엇을 보여줄지(실제 사진/로고/차트/
                  그래프/지도/데이터시각화) 먼저 판단한 뒤 그에 맞는 실제 자료를 가져옵니다.
                  실사진·차트로 표현할 수 없는 개념 설명 장면만 AI 보조 그래픽으로 대체됩니다.
                </p>
                {scenes.length === 0 ? (
                  <p className="hint">&quot;장면 만들기&quot;를 아직 시작하지 않았거나 진행 중입니다.</p>
                ) : (
                  <>
                    <ProgressBar completed={visualsDone} total={scenes.length} label={`시각자료 소싱 (실패 ${visualsError}건)`} />
                    <div className="actions" style={{ marginTop: 0, marginBottom: 20 }}>
                      <span className="hint" style={{ margin: 0 }}>
                        훅 몽타주에는 이 중 {project.hookMontageSceneIds?.length || 0}개 장면이 재활용됩니다.
                      </span>
                      <button className="btn" onClick={handleStartVisuals}>
                        시각자료 소싱 시작/이어하기
                      </button>
                    </div>
                    <div className="scene-grid">
                      {scenes.map((scene) => (
                        <SceneCard
                          key={scene.id}
                          scene={scene}
                          onRetry={() => handleRetryVisual(scene.id)}
                          onEditQuery={(v) => handleEditSceneQuery(scene.id, v)}
                        />
                      ))}
                    </div>
                  </>
                )}
                <div className="actions">
                  <button className="btn secondary" onClick={() => setTab("script")}>
                    이전
                  </button>
                  <button className="btn" disabled={scenes.length === 0} onClick={() => setTab("narration")}>
                    다음: 내레이션
                  </button>
                </div>
              </div>
            )}

            {tab === "narration" && (
              <div className="panel">
                <h2 className="panel-title">음성 · 내레이션</h2>
                <p className="panel-desc">
                  리포터 톤 단일 목소리(&quot;{project.input.voiceName}&quot;)로 훅과 모든 장면의
                  대본을 낭독합니다.
                </p>
                <ProgressBar completed={narrationDone} total={scenes.length} label={`장면 내레이션 (실패 ${narrationError}건)`} />
                <div className="actions" style={{ marginTop: 0, marginBottom: 20 }}>
                  <span />
                  <button className="btn" onClick={handleStartNarration}>
                    내레이션 생성 시작/이어하기
                  </button>
                </div>

                <div className="section-label">훅 내레이션</div>
                <div className="scene-card">
                  {(project.hookNarration || []).length === 0 ? (
                    <p className="hint">아직 생성되지 않았습니다.</p>
                  ) : (
                    (project.hookNarration || []).map((n) => (
                      <div key={n.id} className="stat-row">
                        <span className="k">{n.text.slice(0, 40)}...</span>
                        <span className="v">
                          <StatusDot status={n.status} /> {n.durationSeconds ? `${n.durationSeconds.toFixed(1)}s` : ""}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <div className="section-label">장면별 내레이션</div>
                {scenes.map((scene) => (
                  <div className="scene-card" key={scene.id}>
                    <div className="scene-card-head">
                      <span className="tag mono">{scene.id}</span>
                      <StatusDot
                        status={
                          scene.narration.length === 0
                            ? "pending"
                            : scene.narration.some((n) => n.status === "error")
                            ? "error"
                            : scene.narration.every((n) => n.status === "done")
                            ? "done"
                            : "generating"
                        }
                      />
                      <span className="badge">{scene.durationSeconds ? `${scene.durationSeconds.toFixed(1)}초` : "-"}</span>
                      <button className="btn secondary" onClick={() => handleRetryNarration(scene.id)}>
                        다시 생성
                      </button>
                    </div>
                    {scene.narration
                      .filter((n) => n.status === "error" && n.error)
                      .map((n) => (
                        <p key={n.id} className="error-box" style={{ fontSize: 12 }}>
                          {n.error}
                        </p>
                      ))}
                    <p className="scene-thumb-text">{scene.text}</p>
                  </div>
                ))}

                <div className="actions">
                  <button className="btn secondary" onClick={() => setTab("scenes")}>
                    이전
                  </button>
                  <button className="btn" onClick={() => setTab("edit")}>
                    다음: 편집
                  </button>
                </div>
              </div>
            )}

            {tab === "edit" && (
              <div className="panel">
                <h2 className="panel-title">편집 · 전체 검토</h2>
                <p className="panel-desc">
                  렌더링 전 마지막으로 전체 대본을 이어서 읽어보고, 훅 몽타주에 쓰일 장면을
                  조정하세요. 대본을 여기서 고치면 &quot;대본&quot; 탭으로 돌아가 저장하세요(장면/
                  시각자료/음성이 이미 만들어졌다면 다시 생성해야 최신 내용이 반영됩니다).
                </p>
                <div className="section-label">전체 대본 미리보기</div>
                <div className="scene-card" style={{ maxHeight: 420, overflowY: "auto" }}>
                  {sections.map((s) => (
                    <p key={s.id} style={{ marginBottom: 14, fontSize: 13.5, lineHeight: 1.8 }}>
                      {s.text}
                    </p>
                  ))}
                </div>

                <div className="section-label" style={{ marginTop: 20 }}>
                  훅 몽타주 재활용 장면 ({project.hookMontageSceneIds?.length || 0}개)
                </div>
                <div className="scene-grid">
                  {scenes
                    .filter((s) => project.hookMontageSceneIds?.includes(s.id))
                    .map((scene) => (
                      <SceneCard key={scene.id} scene={scene} readOnly />
                    ))}
                </div>

                <div className="actions">
                  <button className="btn secondary" onClick={() => setTab("narration")}>
                    이전
                  </button>
                  <button className="btn" onClick={() => setTab("review")}>
                    다음: 검수
                  </button>
                </div>
              </div>
            )}

            {tab === "review" && (
              <div className="panel">
                <h2 className="panel-title">검수 · 렌더링 준비</h2>
                <p className="panel-desc">아래 항목이 모두 준비되어야 렌더링을 시작할 수 있습니다.</p>

                <div className="section-label">진행 상태</div>
                <div className="stat-card" style={{ marginBottom: 20 }}>
                  <Checklist project={project} />
                </div>

                {project.errorLog && project.errorLog.length > 0 && (
                  <details style={{ marginBottom: 20 }}>
                    <summary className="section-label" style={{ cursor: "pointer", display: "inline-block" }}>
                      오류 기록 ({project.errorLog.length}건)
                    </summary>
                    <div className="stat-card" style={{ marginTop: 8, maxHeight: 260, overflowY: "auto" }}>
                      {[...project.errorLog].reverse().map((e, i) => (
                        <div key={i} className="stat-row" style={{ display: "block" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                            <span className="k mono" style={{ fontSize: 11 }}>
                              [{e.stage}
                              {e.unitId ? ` · ${e.unitId}` : ""}]
                            </span>
                            <span className="k mono" style={{ fontSize: 10.5 }}>
                              {new Date(e.at).toLocaleString("ko-KR")}
                            </span>
                          </div>
                          <div style={{ fontSize: 12 }}>{e.message}</div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                <div className="stat-card" style={{ marginBottom: 20 }}>
                  <div className="stat-row">
                    <span className="k">총 글자수 / 예상 러닝타임</span>
                    <span className="v">
                      {project.script?.totalCharCount.toLocaleString()}자 / 약 {project.script?.estimatedMinutes}분
                      (목표 {project.input.targetMinutes}분)
                    </span>
                  </div>
                  <div className="stat-row">
                    <span className="k">시각자료</span>
                    <span className="v">
                      {visualsDone}/{scenes.length} 완료{visualsError > 0 ? ` · 오류 ${visualsError}건` : ""}
                    </span>
                  </div>
                  <div className="stat-row">
                    <span className="k">내레이션</span>
                    <span className="v">
                      {narrationDone}/{scenes.length} 완료{narrationError > 0 ? ` · 오류 ${narrationError}건` : ""}
                    </span>
                  </div>
                  <div className="stat-row">
                    <span className="k">제목</span>
                    <span className="v gold">{project.script?.title}</span>
                  </div>
                </div>

                <div className="warning-box">
                  참고(PDF §4 실측): 게시 시각은 오후 14시가 중앙 조회수 최고 구간입니다(가장
                  경쟁이 치열한 저녁 17~19시는 피하는 것을 권장). 제목은 큰 주어 + 구체적 숫자 +
                  붕괴/반전 신호 단언문 틀을 따르면 유리합니다.
                </div>

                {(visualsDone < scenes.length || narrationDone < scenes.length) && (
                  <div className="error-box">
                    아직 준비되지 않은 장면이 있습니다. &quot;장면·자료&quot;/&quot;음성&quot; 탭에서
                    나머지를 생성하거나 재시도해 주세요.
                  </div>
                )}

                <div className="actions">
                  <button className="btn secondary" onClick={() => setTab("edit")}>
                    이전
                  </button>
                  <button
                    className="btn"
                    disabled={
                      scenes.length === 0 || visualsDone < scenes.length || narrationDone < scenes.length
                    }
                    onClick={handleStartRender}
                  >
                    렌더링 시작
                  </button>
                </div>
              </div>
            )}

            {tab === "render" && (
              <div className="panel">
                <h2 className="panel-title">렌더링 중</h2>
                <p className="panel-desc">
                  목표 길이({project.input.targetMinutes}분 안팎)에 따라 시간이 꽤 걸릴 수
                  있습니다. 이 화면을 닫아도 서버에서 계속 진행되며, 다시 들어오면 진행 상황이
                  그대로 남아 있습니다.
                </p>
                {project.render.status === "error" ? (
                  <div className="error-box">{project.render.error}</div>
                ) : (
                  <>
                    <div className="loading-stage">
                      <div className="spinner" />
                      <div className="loading-title">{project.render.currentStep || "준비 중..."}</div>
                    </div>
                    {project.render.progress && (
                      <ProgressBar
                        completed={project.render.progress.completed}
                        total={project.render.progress.total}
                        label="장면 영상 렌더링"
                      />
                    )}
                  </>
                )}
                <div className="actions">
                  <button className="btn secondary" onClick={() => setTab("review")}>
                    이전
                  </button>
                  {project.render.status === "error" ? (
                    <button className="btn" onClick={handleStartRender}>
                      다시 시도
                    </button>
                  ) : (
                    <button className="btn" disabled={project.render.status !== "ready"} onClick={() => setTab("done")}>
                      완료 화면으로
                    </button>
                  )}
                </div>
              </div>
            )}

            {tab === "done" && (
              <div className="panel">
                <h2 className="panel-title">완성됐습니다</h2>
                <p className="panel-desc">오른쪽 미리보기에서 확인하고 다운로드하세요.</p>
                {project.render.warning && <div className="warning-box">{project.render.warning}</div>}
                <div className="actions">
                  <button className="btn secondary" onClick={handleReset}>
                    새 영상 만들기
                  </button>
                  {project.render.videoUrl && (
                    <a className="btn" href={project.render.videoUrl} download>
                      다운로드
                    </a>
                  )}
                </div>
              </div>
            )}
          </main>

          <aside className="studio-preview">
            <div className="video-frame-wrap">
              <div className="video-frame">
                {tab === "done" && project.render.videoUrl ? (
                  <video src={project.render.videoUrl} controls />
                ) : scenes.find((s) => s.visualUrl) ? (
                  <img src={scenes.find((s) => s.visualUrl)?.visualUrl} alt="" />
                ) : (
                  <span className="frame-empty">아직 미리 볼 화면이 없습니다</span>
                )}
              </div>
            </div>
            <p className="phone-caption">{tab === "done" ? "완성된 영상" : "장면 미리보기(가로 1920×1080)"}</p>

            <div className="stat-card">
              <div className="stat-card-title">현재 상태</div>
              <div className="stat-row">
                <span className="k">제목</span>
                <span className="v">{project.script?.title || "-"}</span>
              </div>
              <div className="stat-row">
                <span className="k">목표 길이</span>
                <span className="v">{project.input.targetMinutes}분</span>
              </div>
              <div className="stat-row">
                <span className="k">리서치</span>
                <span className="v">{project.research?.length || 0}/3</span>
              </div>
              <div className="stat-row">
                <span className="k">대본</span>
                <span className="v">{sections.length} 섹션</span>
              </div>
              <div className="stat-row">
                <span className="k">장면</span>
                <span className="v">{scenes.length || "-"}</span>
              </div>
              <div className="stat-row">
                <span className="k">시각자료</span>
                <span className="v">
                  {visualsDone}/{scenes.length}
                </span>
              </div>
              <div className="stat-row">
                <span className="k">내레이션</span>
                <span className="v">
                  {narrationDone}/{scenes.length}
                </span>
              </div>
              <div className="stat-row">
                <span className="k">렌더링</span>
                <span className="v gold">{project.render.status}</span>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function SceneCard({
  scene,
  onRetry,
  onEditQuery,
  readOnly,
}: {
  scene: Scene;
  onRetry?: () => void;
  onEditQuery?: (value: string) => void;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(scene.visualQuery);

  return (
    <div className="scene-thumb">
      {scene.visualUrl ? (
        <img className="scene-thumb-img" src={scene.visualUrl} alt="" />
      ) : (
        <div className="scene-thumb-empty">
          <StatusDot status={scene.visualStatus} />
        </div>
      )}
      <div className="scene-thumb-body">
        <span className="badge" style={{ marginBottom: 6, display: "inline-block" }}>
          {VISUAL_TYPE_LABEL[scene.visualType]}
        </span>
        {scene.visualSourceLabel && <p className="hint" style={{ margin: "0 0 6px" }}>{scene.visualSourceLabel}</p>}
        {scene.visualStatus === "error" && scene.visualError && (
          <p className="error-box" style={{ margin: 0, fontSize: 11, padding: "8px 10px" }}>
            {scene.visualError}
          </p>
        )}
        <p className="scene-thumb-text">{scene.text}</p>
        {editing ? (
          <>
            <textarea rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} style={{ fontSize: 11.5 }} />
            <div style={{ display: "flex", gap: 6 }}>
              <button
                className="btn secondary"
                style={{ padding: "6px 10px", fontSize: 10.5 }}
                onClick={() => {
                  onEditQuery?.(draft);
                  setEditing(false);
                }}
              >
                적용
              </button>
              <button className="btn secondary" style={{ padding: "6px 10px", fontSize: 10.5 }} onClick={() => setEditing(false)}>
                취소
              </button>
            </div>
          </>
        ) : (
          !readOnly && (
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn secondary" style={{ padding: "6px 10px", fontSize: 10.5 }} onClick={() => setEditing(true)}>
                검색어 수정
              </button>
              {onRetry && (
                <button className="btn secondary" style={{ padding: "6px 10px", fontSize: 10.5 }} onClick={onRetry}>
                  재생성
                </button>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
