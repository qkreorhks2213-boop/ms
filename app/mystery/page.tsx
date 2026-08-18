"use client";

import { Suspense, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import type { MysteryProject } from "@/lib/mystery/types";
import { MysteryStudio } from "@/components/mystery/MysteryStudio";

export const dynamic = "force-dynamic";

function MysteryStudioContent() {
  const { data: session, status: authStatus } = useSession();
  const searchParams = useSearchParams();
  const [projectList, setProjectList] = useState<MysteryProject[] | null>(null);
  const [project, setProject] = useState<MysteryProject | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
      setError(null);
    } catch (e: any) {
      setError(e.message || String(e));
      setProjectList([]);
    }
  }

  async function refreshProject() {
    if (!project) return;
    try {
      const data = await api(`/api/mystery/projects/${project.id}`);
      if (data.project) {
        setProject(data.project);
      }
      setError(null);
    } catch (e: any) {
      console.error("Failed to refresh project:", e);
    }
  }

  async function createProject(topic: string) {
    try {
      setIsLoading(true);
      const data = await api("/api/mystery/projects", {
        method: "POST",
        body: JSON.stringify({
          topic,
          caseType: "unsolved_case",
          targetMinutes: 15,
          sceneVisualTarget: 20,
          angles: ["mystery_focused"],
          endingStyle: "compare_hypotheses",
          useRealPhotos: true,
          useAiReconstruction: true,
        }),
      });
      if (data.project) {
        setProject(data.project);
      }
      setError(null);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setIsLoading(false);
    }
  }

  // Initial load
  useEffect(() => {
    if (authStatus === "authenticated" && !project) {
      refreshProjectList();

      const projectId = searchParams.get("projectId");
      if (projectId) {
        api(`/api/mystery/projects/${projectId}`)
          .then((data) => {
            if (data.project) {
              setProject(data.project);
              window.history.replaceState({}, "", "/mystery");
            }
          })
          .catch((err) => console.error("Failed to load project:", err));
      }
    }
  }, [authStatus, project, searchParams]);

  // Auto-refresh while pipeline is running
  useEffect(() => {
    if (!project || project.stage === "done" || project.stage === "failed") {
      return;
    }

    const interval = setInterval(async () => {
      await refreshProject();
    }, 3000); // Refresh every 3 seconds

    return () => clearInterval(interval);
  }, [project?.id, project?.stage]);

  // Auth loading state
  if (authStatus === "loading") {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <div style={{ fontSize: 24, marginBottom: 20 }}>⏳ Loading...</div>
      </div>
    );
  }

  // Not authenticated
  if (authStatus === "unauthenticated") {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <div style={{ fontSize: 20, marginBottom: 20 }}>Sign In Required</div>
        <p style={{ color: "var(--text-muted)" }}>Please sign in to use Mystery Studio.</p>
      </div>
    );
  }

  // Project selected - show Studio
  if (project) {
    return <MysteryStudio project={project} onRefresh={refreshProject} />;
  }

  // Project list view
  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 20px" }}>
      <div style={{ marginBottom: 40 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, margin: "0 0 20px 0" }}>Mystery Studio</h1>
        <p style={{ color: "var(--text-secondary)", margin: "0 0 20px 0" }}>
          Create documentary videos from mystery topics in 14 automated steps.
        </p>

        {error && (
          <div
            style={{
              padding: "12px 16px",
              background: "#fee2e2",
              color: "#991b1b",
              borderRadius: "6px",
              marginBottom: 20,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            id="topicInput"
            placeholder="Enter a mystery topic..."
            style={{
              flex: 1,
              padding: "8px 12px",
              border: "1px solid var(--border-default)",
              borderRadius: "6px",
              fontSize: 14,
            }}
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                const input = e.currentTarget as HTMLInputElement;
                if (input.value.trim()) {
                  createProject(input.value);
                  input.value = "";
                }
              }
            }}
          />
          <button
            onClick={() => {
              const input = document.getElementById("topicInput") as HTMLInputElement;
              if (input.value.trim()) {
                createProject(input.value);
                input.value = "";
              }
            }}
            disabled={isLoading}
            style={{
              padding: "8px 16px",
              background: "var(--accent-primary)",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading ? "Creating..." : "Create"}
          </button>
        </div>
      </div>

      {/* Project list */}
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Your Projects</h2>
        {projectList && projectList.length === 0 ? (
          <div
            style={{
              padding: "40px 20px",
              textAlign: "center",
              background: "var(--bg-secondary)",
              borderRadius: "8px",
              color: "var(--text-secondary)",
            }}
          >
            No projects yet. Create one to get started.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 16,
            }}
          >
            {(projectList || []).map((proj) => (
              <div
                key={proj.id}
                onClick={() => setProject(proj)}
                style={{
                  padding: 16,
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow =
                    "0 4px 12px rgba(0,0,0,0.1)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 8 }}>{proj.name}</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
                  {proj.stage.charAt(0).toUpperCase() + proj.stage.slice(1)}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {proj.steps && proj.steps.filter((s) => s.status === "completed").length}/{proj.steps?.length || 0} steps
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MysteryPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: "40px", textAlign: "center" }}>
          <div style={{ fontSize: 24 }}>⏳ Loading...</div>
        </div>
      }
    >
      <MysteryStudioContent />
    </Suspense>
  );
}
