"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function MysteryQuickCreate() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const [topic, setTopic] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleCreate = async () => {
    const finalTopic = topic.trim();
    if (!finalTopic) {
      setError("사건/주제를 입력해주세요.");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/mystery/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: finalTopic,
          // Auto-select best defaults for comprehensive documentary
          caseType: "unsolved_case",
          targetMinutes: 15, // 15-minute default for full investigation
          angles: ["case_focused", "evidence_focused", "mystery_focused"],
          endingStyle: "compare_hypotheses",
          useRealPhotos: true,
          useAiReconstruction: true,
          useBgm: true,
          sceneVisualTarget: 50, // Target 50 scenes for comprehensive visual coverage
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "프로젝트 생성 실패");

      // Start auto-pipeline-v2 (Production 14-Step Pipeline) in background
      fetch(`/api/mystery/projects/${data.project.id}/auto-pipeline-v2`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }).catch((err) => console.error("Failed to start pipeline:", err));

      // Redirect to project (pipeline runs in background)
      router.push(`/mystery?projectId=${data.project.id}`);
    } catch (err: any) {
      setError(err.message || String(err));
      setIsCreating(false);
    }
  };

  const templates = [
    {
      title: "Tamam Shud Case",
      description: "1948년 호주의 미제사건",
      text: "1948년 호주 애들레이드에서 발견된 신원 미상의 남성 시체. 주머니에 '담 샤드' 글귀가 적힌 지폐 발견. 신원 미상, 사인 불명. 국제 간첩 활동과의 연관성 의심.",
    },
    {
      title: "Mary Celeste",
      description: "유령선의 미스터리",
      text: "1872년 대서양에서 발견된 선박. 승무원 흔적은 있으나 모든 사람이 사라짐. 식사 준비 흔적, 짐은 남아있음. 극단적인 기후? 해적? 신비한 사건.",
    },
    {
      title: "Jack the Ripper",
      description: "1888년 런던의 연쇄살인",
      text: "1888년 런던 화이트채플. 최소 5명의 여성 피살자. 정교한 수법. 수많은 용의자 제시. 미해결 범죄. 현대 법의학으로 분석.",
    },
  ];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      handleCreate();
    }
  };

  if (authStatus === "loading") {
    return <div style={{ padding: "40px", textAlign: "center" }}>⏳ 로드 중...</div>;
  }

  if (authStatus === "unauthenticated") {
    return <div style={{ padding: "40px", textAlign: "center" }}>로그인이 필요합니다</div>;
  }

  return (
    <div
      style={{
        maxWidth: "800px",
        margin: "0 auto",
        padding: "60px 20px",
        display: "flex",
        flexDirection: "column",
        gap: "30px",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: "32px", marginBottom: "10px" }}>🎬 미스터리 다큐멘터리 제작</h1>
        <p style={{ color: "var(--text-muted)", fontSize: "16px" }}>
          사건/주제를 설명하면 자동으로 미스터리 다큐멘터리를 생성합니다
        </p>
      </div>

      {error && (
        <div
          style={{
            padding: "15px",
            backgroundColor: "var(--danger-bg)",
            color: "var(--danger)",
            borderRadius: "6px",
            fontSize: "14px",
          }}
        >
          ❌ {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
        <label style={{ fontSize: "14px", fontWeight: "600" }}>
          📝 사건/주제 설명
        </label>
        <textarea
          ref={textareaRef}
          value={topic}
          onChange={(e) => {
            setTopic(e.target.value);
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="예시: 1948년 호주 애들레이드에서 발견된 신원 미상의 남성 시체. 주머니에 '담 샤드' 글귀가 적힌 지폐 발견. 신원 미상, 사인 불명..."
          style={{
            width: "100%",
            minHeight: "150px",
            padding: "15px",
            fontSize: "14px",
            fontFamily: "system-ui, -apple-system, sans-serif",
            border: "1px solid var(--line)",
            borderRadius: "8px",
            backgroundColor: "var(--surface)",
            color: "var(--text)",
            lineHeight: "1.6",
            resize: "vertical",
          }}
          disabled={isCreating}
        />
      </div>

      <div style={{ display: "flex", gap: "10px" }}>
        <button
          onClick={handleCreate}
          disabled={isCreating || !topic.trim()}
          style={{
            flex: 1,
            padding: "14px 20px",
            fontSize: "16px",
            fontWeight: "600",
            border: "none",
            borderRadius: "8px",
            backgroundColor: isCreating || !topic.trim() ? "var(--text-muted)" : "var(--primary)",
            color: "white",
            cursor: isCreating || !topic.trim() ? "not-allowed" : "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            if (!isCreating && topic.trim()) {
              (e.currentTarget as HTMLElement).style.opacity = "0.8";
            }
          }}
          onMouseLeave={(e) => {
            if (!isCreating && topic.trim()) {
              (e.currentTarget as HTMLElement).style.opacity = "1";
            }
          }}
        >
          {isCreating ? "🔄 제작 중..." : "✨ 자동 제작 시작"}
        </button>
      </div>

      <div>
        <div style={{ fontWeight: "600", marginBottom: "15px", fontSize: "15px" }}>🎯 템플릿 선택 (선택사항):</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "12px",
          }}
        >
          {templates.map((template, idx) => (
            <button
              key={idx}
              onClick={async () => {
                setTopic(template.text);
                setIsCreating(true);
                setError(null);
                try {
                  const res = await fetch("/api/mystery/projects", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      topic: template.text,
                      caseType: "unsolved_case",
                      targetMinutes: 15,
                      angles: ["case_focused", "evidence_focused", "mystery_focused"],
                      endingStyle: "compare_hypotheses",
                      useRealPhotos: true,
                      useAiReconstruction: true,
                      useBgm: true,
                      sceneVisualTarget: 50,
                    }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data?.error || "프로젝트 생성 실패");
                  fetch(`/api/mystery/projects/${data.project.id}/auto-pipeline-v2`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                  }).catch((err) => console.error("Failed to start pipeline:", err));
                  router.push(`/mystery?projectId=${data.project.id}`);
                } catch (err: any) {
                  setError(err.message || String(err));
                  setIsCreating(false);
                }
              }}
              disabled={isCreating}
              style={{
                padding: "15px",
                backgroundColor: "var(--surface-raised)",
                border: "1px solid var(--line)",
                borderRadius: "8px",
                cursor: isCreating ? "not-allowed" : "pointer",
                textAlign: "left",
                transition: "all 0.2s",
                opacity: isCreating ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isCreating) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = "var(--line)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isCreating) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = "var(--surface-raised)";
                }
              }}
            >
              <div style={{ fontWeight: "600", fontSize: "14px", marginBottom: "5px" }}>
                {template.title}
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                {template.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          padding: "20px",
          backgroundColor: "var(--surface-raised)",
          borderRadius: "8px",
          border: "1px solid var(--line)",
          fontSize: "13px",
          color: "var(--text-muted)",
        }}
      >
        <div style={{ fontWeight: "600", marginBottom: "10px" }}>📌 자동 생성 과정:</div>
        <ul style={{ margin: 0, paddingLeft: "20px", lineHeight: "1.8" }}>
          <li>1️⃣ 사건 조사: 뉴스, 공식 자료, 증거 수집</li>
          <li>2️⃣ 팩트체크: 각 주장의 신뢰도 검증</li>
          <li>3️⃣ 타임라인: 시간 순서대로 정렬</li>
          <li>4️⃣ 대본 생성: 미스터리한 이야기 구조</li>
          <li>5️⃣ 장면 구성: 각 장면의 시각자료 선택</li>
          <li>6️⃣ 시각 자료: 실제 자료 + AI 재현</li>
          <li>7️⃣ 내레이션: 자동 음성 생성</li>
          <li>8️⃣ 영상 렌더링: 최종 MP4 출력</li>
        </ul>
      </div>

      <div
        style={{
          padding: "20px",
          backgroundColor: "var(--info-bg)",
          borderRadius: "8px",
          border: "1px solid var(--line)",
          fontSize: "13px",
          color: "var(--text-muted)",
        }}
      >
        <div style={{ fontWeight: "600", marginBottom: "10px" }}>⏱️ 예상 소요 시간:</div>
        <ul style={{ margin: 0, paddingLeft: "20px", lineHeight: "1.8" }}>
          <li>전체 생성 시간: 약 10-15분</li>
          <li>조사/팩트체크: 1-2분</li>
          <li>대본/장면/내레이션: 3-5분</li>
          <li>영상 렌더링: 5-10분</li>
        </ul>
      </div>
    </div>
  );
}
