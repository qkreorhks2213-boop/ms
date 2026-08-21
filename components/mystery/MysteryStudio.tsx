"use client";

import { useEffect, useState } from "react";
import type { MysteryProject, StepProgress } from "@/lib/mystery/types";
import { STEP_ORDER, STEP_LABELS, PipelineStepId } from "@/lib/mystery/types";
import styles from "./MysteryStudio.module.css";

interface MysteryStudioProps {
  project: MysteryProject;
  onRefresh: () => Promise<void>;
}

export function MysteryStudio({ project, onRefresh }: MysteryStudioProps) {
  const [currentStepId, setCurrentStepId] = useState<PipelineStepId>(PipelineStepId.STEP_01);
  const [isRunning, setIsRunning] = useState(() => {
    const hasRunningStep = (project.steps || []).some((s) => s.status === "running");
    const isInProgress = project.stage && !["done", "failed", "idle"].includes(project.stage);
    return hasRunningStep || isInProgress;
  });
  const [error, setError] = useState<string | null>(project.pipelineError || null);

  useEffect(() => {
    const hasRunningStep = (project.steps || []).some((s) => s.status === "running");
    const isInProgress = project.stage && !["done", "failed", "idle"].includes(project.stage);
    setIsRunning(hasRunningStep || isInProgress);

    if (project.pipelineError) {
      setError(project.pipelineError);
    }
  }, [project.stage, project.steps, project.pipelineError]);

  const getStepStatus = (stepId: PipelineStepId) => {
    const step = (project.steps || []).find((s) => s.stepId === stepId);
    return step?.status || "pending";
  };

  const getStepIcon = (stepId: PipelineStepId) => {
    const status = getStepStatus(stepId);
    switch (status) {
      case "completed":
        return "✓";
      case "running":
        return "▶";
      case "failed":
        return "✕";
      case "pending":
        return "○";
      default:
        return "○";
    }
  };

  const handleRunStep = async (stepId: PipelineStepId) => {
    try {
      setIsRunning(true);
      setError(null);

      const response = await fetch(`/api/mystery/projects/${project.id}/auto-pipeline-v2`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Step ${stepId} failed`);
      }

      // Poll for step completion
      let completed = false;
      let attempts = 0;
      while (!completed && attempts < 60) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await onRefresh();

        const updated = await (await fetch(`/api/mystery/projects/${project.id}`)).json();
        const step = updated?.project?.steps?.find((s: any) => s.stepId === stepId);

        if (step?.status === "completed" || step?.status === "failed") {
          completed = true;
        }
        attempts++;
      }

      if (!completed) {
        throw new Error(`Step ${stepId} timeout`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunAll = async () => {
    try {
      setIsRunning(true);
      setError(null);

      const response = await fetch(`/api/mystery/projects/${project.id}/auto-pipeline-v2`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Pipeline failed");
      }

      // Poll for completion
      let pipelineComplete = false;
      let attempts = 0;
      while (!pipelineComplete && attempts < 300) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await onRefresh();

        const updated = await (await fetch(`/api/mystery/projects/${project.id}`)).json();
        if (updated?.project?.stage === "done" || updated?.project?.stage === "failed") {
          pipelineComplete = true;
        }
        attempts++;
      }

      if (!pipelineComplete) {
        throw new Error("Pipeline timeout");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsRunning(false);
    }
  };

  const currentStep = STEP_ORDER.find((s) => s === currentStepId);
  const currentStepProgress = (project.steps || []).find((s) => s.stepId === currentStepId);

  const completedCount = (project.steps || []).filter((s) => s.status === "completed").length;
  const totalSteps = STEP_ORDER.length;
  const progressPercent = Math.round((completedCount / totalSteps) * 100);

  return (
    <div className={styles.container}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2 className={styles.projectTitle}>{project.name}</h2>
          <div className={styles.progress}>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className={styles.progressText}>
              {completedCount}/{totalSteps} steps
            </div>
          </div>
        </div>

        {/* Step Navigation */}
        <nav className={styles.stepNav}>
          {STEP_ORDER.map((stepId, index) => (
            <button
              key={stepId}
              className={`${styles.stepButton} ${
                currentStepId === stepId ? styles.active : ""
              } ${getStepStatus(stepId)}`}
              onClick={() => setCurrentStepId(stepId)}
              title={STEP_LABELS[stepId]}
            >
              <span className={styles.stepIcon}>{getStepIcon(stepId)}</span>
              <span className={styles.stepNum}>STEP_{String(index + 1).padStart(2, "0")}</span>
              <span className={styles.stepLabel}>{STEP_LABELS[stepId]}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className={styles.main}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerContent}>
            <h1 className={styles.stepTitle}>
              {currentStepId}: {STEP_LABELS[currentStepId]}
            </h1>
            {error && <div className={styles.errorBanner}>{error}</div>}
          </div>

          <div className={styles.headerActions}>
            {!isRunning && project.stage !== "done" && (
              <button className={styles.btn + " " + styles.btnPrimary} onClick={handleRunAll}>
                Run All Steps
              </button>
            )}
            {isRunning && <div className={styles.badge + " " + styles.badgeRunning}>Running...</div>}
            {project.stage === "done" && <div className={styles.badge + " " + styles.badgeDone}>Complete</div>}
            {project.stage === "failed" && <div className={styles.badge + " " + styles.badgeFailed}>Failed</div>}
          </div>
        </header>

        {/* Workspace */}
        <div className={styles.workspace}>
          {currentStepProgress?.status === "running" && (
            <div className={styles.loadingState}>
              <div className={styles.spinner} />
              <p>Executing {currentStepId}...</p>
            </div>
          )}

          {currentStepProgress?.status === "completed" && (
            <div className={styles.resultState}>
              <div className={styles.successIcon}>✓</div>
              <p>{currentStepId} completed successfully</p>
              {currentStepProgress.output && (
                <pre className={styles.outputPreview}>
                  {JSON.stringify(currentStepProgress.output, null, 2)}
                </pre>
              )}
            </div>
          )}

          {currentStepProgress?.status === "failed" && (
            <div className={styles.errorState}>
              <div className={styles.errorIcon}>✕</div>
              <p>Error: {currentStepProgress.error}</p>
            </div>
          )}

          {currentStepProgress?.status === "pending" && !isRunning && (
            <div className={styles.emptyState}>
              <p>{currentStepId} is pending</p>
              <button
                className={styles.btn + " " + styles.btnSecondary}
                onClick={() => handleRunStep(currentStepId)}
              >
                Run This Step
              </button>
            </div>
          )}
        </div>

        {/* Final Result */}
        {project.stage === "done" && project.output?.mp4 && (
          <div className={styles.resultPanel}>
            <h2>Final Output</h2>
            <div className={styles.videoPlayer}>
              <video controls width="100%" height="auto">
                <source src={project.output.mp4} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
            <div className={styles.resultInfo}>
              <p>File: {project.output.mp4}</p>
              {project.output.fileSize && (
                <p>Size: {(project.output.fileSize / 1024 / 1024).toFixed(2)}MB</p>
              )}
              {project.completedAt && (
                <p>Completed: {new Date(project.completedAt).toLocaleString()}</p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
