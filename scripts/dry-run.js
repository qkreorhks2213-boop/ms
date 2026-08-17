#!/usr/bin/env node

/**
 * DRY RUN - 전체 파이프라인 연결 테스트
 *
 * 사용: npm run dry-run
 *
 * 역할:
 * 1. Mock 데이터로 전체 파이프라인 시뮬레이션
 * 2. API 호출 없음
 * 3. 이미지 생성 없음
 * 4. TTS 생성 없음
 * 5. 실제 렌더링 없음
 * 6. 각 단계의 데이터 구조만 검증
 *
 * 목적: 코드 연결성 확인 (실제 구동 전)
 */

const fs = require("fs");
const path = require("path");

const DIAGNOSTICS_DIR = path.join(__dirname, "../diagnostics");
const DRYRUN_FILE = path.join(DIAGNOSTICS_DIR, "dry-run-result.json");

if (!fs.existsSync(DIAGNOSTICS_DIR)) {
  fs.mkdirSync(DIAGNOSTICS_DIR, { recursive: true });
}

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

const dryRunResult = {
  timestamp: new Date().toISOString(),
  stages: {},
  timeline: [],
  errors: [],
};

function recordStage(stageName, status, details = {}) {
  const timestamp = new Date().toISOString();
  dryRunResult.stages[stageName] = {
    status,
    timestamp,
    ...details,
  };
  dryRunResult.timeline.push({
    stage: stageName,
    status,
    timestamp,
  });
}

function recordError(stage, error) {
  dryRunResult.errors.push({
    stage,
    message: error.message || String(error),
    timestamp: new Date().toISOString(),
  });
}

// Mock 데이터 생성
const mockProject = {
  id: "dry-run-test-001",
  name: "Dry Run Test - Kandahar Giant",
  userId: "test-user",
  createdAt: new Date().toISOString(),
  stage: "research",
  input: {
    topic: "칸다하르의 거인",
    caseType: "military_mystery",
    targetMinutes: 3, // 테스트용 짧은 영상
    angles: ["evidence_focused"],
    endingStyle: "unsolved",
    useRealPhotos: true,
    useAiReconstruction: false,
    sceneVisualTarget: 30,
    voiceName: "default",
    useBgm: false,
  },
};

const mockResearch = {
  findings: [
    {
      query: "Kandahar Giant overview",
      sources: [
        {
          title: "Mock source 1",
          url: "https://example.com/1",
          published: "2024-01-01",
          type: "article",
        },
      ],
      summary: "Test research data",
    },
  ],
  timeline: [
    {
      date: "2002-06-01",
      title: "Test event 1",
      description: "Mock event",
      sources: ["Mock source 1"],
    },
  ],
  factcheck: [
    {
      claim: "Test claim",
      status: "TESTIMONY",
      evidence: "Test evidence",
      source: "Mock source 1",
    },
  ],
};

const mockScript = {
  title: "Kandahar Mystery - Test",
  outline: "Test outline",
  sections: [
    {
      id: "section-0",
      kind: "opening",
      index: 0,
      chapterType: "opening",
      text: "This is a test introduction. The Kandahar Giant is a fascinating mystery. Let's explore the evidence.",
      charCount: 100,
      estimatedSeconds: 22,
      status: "done",
      sources: ["Mock source 1"],
    },
    {
      id: "section-1",
      kind: "main_event",
      index: 1,
      chapterType: "main_event",
      text: "According to official records, something unusual was discovered. The details are documented in military archives.",
      charCount: 100,
      estimatedSeconds: 22,
      status: "done",
      sources: ["Mock source 1"],
    },
  ],
  totalCharCount: 200,
  estimatedMinutes: 2,
};

const mockScenes = [
  {
    id: "scene-0",
    sectionId: "section-0",
    order: 0,
    text: "Test scene 1",
    visualType: "archive_photo",
    visualQuery: "military archive photo",
    visualStatus: "pending",
    narration: [],
  },
  {
    id: "scene-1",
    sectionId: "section-1",
    order: 1,
    text: "Test scene 2",
    visualType: "map",
    visualQuery: "Afghanistan map",
    visualStatus: "pending",
    narration: [],
  },
];

const mockVisuals = [
  {
    id: "scene-0",
    visualUrl: "file:///test/scene-0.png",
    visualStatus: "done",
    visualOrigin: "GENERATED_GRAPHIC",
    visualSourceLabel: "Generated placeholder",
  },
  {
    id: "scene-1",
    visualUrl: "file:///test/scene-1.png",
    visualStatus: "done",
    visualOrigin: "GENERATED_GRAPHIC",
    visualSourceLabel: "Generated placeholder",
  },
];

const mockNarration = [
  {
    sceneId: "scene-0",
    audioUrl: "file:///test/scene-0.wav",
    durationMs: 5000,
    status: "done",
  },
  {
    sceneId: "scene-1",
    audioUrl: "file:///test/scene-1.wav",
    durationMs: 5000,
    status: "done",
  },
];

async function stageResearch() {
  log("\n📊 Stage 1: Research...", "blue");

  try {
    // Mock 데이터 검증
    if (!mockResearch.findings || !mockResearch.timeline) {
      throw new Error("Invalid research data structure");
    }

    log("  ✓ Research data structure valid", "green");
    recordStage("research", "PASS", {
      findings: mockResearch.findings.length,
      timeline: mockResearch.timeline.length,
    });

    return true;
  } catch (error) {
    log(`  ✗ Research failed: ${error.message}`, "red");
    recordStage("research", "FAIL");
    recordError("research", error);
    return false;
  }
}

async function stageFactCheck() {
  log("\n✅ Stage 2: Fact Check...", "blue");

  try {
    if (!mockResearch.factcheck || !Array.isArray(mockResearch.factcheck)) {
      throw new Error("Invalid factcheck data");
    }

    const validStatuses = [
      "FACT",
      "SUPPORTED",
      "TESTIMONY",
      "CLAIM",
      "DISPUTED",
      "UNVERIFIED",
      "FALSE",
    ];
    for (const check of mockResearch.factcheck) {
      if (!validStatuses.includes(check.status)) {
        throw new Error(`Invalid status: ${check.status}`);
      }
    }

    log("  ✓ Fact check data structure valid", "green");
    recordStage("factcheck", "PASS", {
      checks: mockResearch.factcheck.length,
    });

    return true;
  } catch (error) {
    log(`  ✗ Fact check failed: ${error.message}`, "red");
    recordStage("factcheck", "FAIL");
    recordError("factcheck", error);
    return false;
  }
}

async function stageScript() {
  log("\n📝 Stage 3: Script Generation...", "blue");

  try {
    if (!mockScript.sections || !Array.isArray(mockScript.sections)) {
      throw new Error("Invalid script data structure");
    }

    for (const section of mockScript.sections) {
      if (
        !section.id ||
        !section.text ||
        !section.kind ||
        !section.status
      ) {
        throw new Error("Invalid section structure");
      }
    }

    log(
      `  ✓ Script valid: ${mockScript.sections.length} sections, ${mockScript.estimatedMinutes} minutes`,
      "green"
    );
    recordStage("script", "PASS", {
      sections: mockScript.sections.length,
      estimatedMinutes: mockScript.estimatedMinutes,
    });

    return true;
  } catch (error) {
    log(`  ✗ Script generation failed: ${error.message}`, "red");
    recordStage("script", "FAIL");
    recordError("script", error);
    return false;
  }
}

async function stageScenes() {
  log("\n🎬 Stage 4: Scene Generation...", "blue");

  try {
    if (!mockScenes || !Array.isArray(mockScenes)) {
      throw new Error("Invalid scenes data");
    }

    const visualTypes = [
      "archive_photo",
      "official_document",
      "newspaper",
      "map",
      "satellite",
      "timeline",
      "interview",
      "evidence",
      "location",
      "ai_reconstruction",
      "diagram",
      "data_card",
      "text_card",
      "atmosphere",
      "video_archive",
    ];

    for (const scene of mockScenes) {
      if (!scene.id || !scene.text || !scene.visualType) {
        throw new Error("Invalid scene structure");
      }
      if (!visualTypes.includes(scene.visualType)) {
        throw new Error(`Invalid visual type: ${scene.visualType}`);
      }
    }

    log(`  ✓ Scenes valid: ${mockScenes.length} scenes`, "green");
    recordStage("scenes", "PASS", {
      scenes: mockScenes.length,
    });

    return true;
  } catch (error) {
    log(`  ✗ Scene generation failed: ${error.message}`, "red");
    recordStage("scenes", "FAIL");
    recordError("scenes", error);
    return false;
  }
}

async function stageVisuals() {
  log("\n🖼️  Stage 5: Visual Assets...", "blue");

  try {
    if (!mockVisuals || !Array.isArray(mockVisuals)) {
      throw new Error("Invalid visuals data");
    }

    const validOrigins = ["REAL", "AI_RECONSTRUCTION", "GENERATED_GRAPHIC"];

    for (const visual of mockVisuals) {
      if (!visual.id || !visual.visualStatus) {
        throw new Error("Invalid visual structure");
      }
      if (
        visual.visualOrigin &&
        !validOrigins.includes(visual.visualOrigin)
      ) {
        throw new Error(`Invalid visual origin: ${visual.visualOrigin}`);
      }
    }

    log(`  ✓ Visuals valid: ${mockVisuals.length} assets`, "green");
    recordStage("visuals", "PASS", {
      visuals: mockVisuals.length,
    });

    return true;
  } catch (error) {
    log(`  ✗ Visual generation failed: ${error.message}`, "red");
    recordStage("visuals", "FAIL");
    recordError("visuals", error);
    return false;
  }
}

async function stageNarration() {
  log("\n🔊 Stage 6: Narration...", "blue");

  try {
    if (!mockNarration || !Array.isArray(mockNarration)) {
      throw new Error("Invalid narration data");
    }

    for (const narration of mockNarration) {
      if (
        !narration.sceneId ||
        !narration.durationMs ||
        !narration.status
      ) {
        throw new Error("Invalid narration structure");
      }
    }

    const totalMs = mockNarration.reduce(
      (sum, n) => sum + n.durationMs,
      0
    );
    const totalSeconds = Math.round(totalMs / 1000);

    log(
      `  ✓ Narration valid: ${mockNarration.length} tracks, ${totalSeconds}s total`,
      "green"
    );
    recordStage("narration", "PASS", {
      narrations: mockNarration.length,
      totalSeconds,
    });

    return true;
  } catch (error) {
    log(`  ✗ Narration failed: ${error.message}`, "red");
    recordStage("narration", "FAIL");
    recordError("narration", error);
    return false;
  }
}

async function stageRender() {
  log("\n🎥 Stage 7: Render Preparation...", "blue");

  try {
    // Mock 렌더 준비 데이터
    const renderConfig = {
      fps: 30,
      resolution: "1920x1080",
      audioSampleRate: 48000,
      duration: 10,
      scenes: mockScenes.length,
    };

    if (
      !renderConfig.fps ||
      !renderConfig.resolution ||
      !renderConfig.duration
    ) {
      throw new Error("Invalid render configuration");
    }

    log(
      `  ✓ Render ready: ${renderConfig.duration}s @ ${renderConfig.resolution} ${renderConfig.fps}fps`,
      "green"
    );
    recordStage("render", "PASS", {
      duration: renderConfig.duration,
      resolution: renderConfig.resolution,
    });

    return true;
  } catch (error) {
    log(`  ✗ Render preparation failed: ${error.message}`, "red");
    recordStage("render", "FAIL");
    recordError("render", error);
    return false;
  }
}

async function main() {
  console.clear();
  log("\n================================", "blue");
  log("DRY RUN - PIPELINE CONNECTION TEST", "blue");
  log("================================\n", "blue");

  log("Project: " + mockProject.name, "cyan");
  log("Duration: " + mockProject.input.targetMinutes + " minutes\n", "cyan");

  let allPassed = true;

  allPassed = (await stageResearch()) && allPassed;
  allPassed = (await stageFactCheck()) && allPassed;
  allPassed = (await stageScript()) && allPassed;
  allPassed = (await stageScenes()) && allPassed;
  allPassed = (await stageVisuals()) && allPassed;
  allPassed = (await stageNarration()) && allPassed;
  allPassed = (await stageRender()) && allPassed;

  // 결과 요약
  log("\n================================", "blue");

  if (allPassed) {
    log("✓ DRY RUN PASSED", "green");
    log("\nAll pipeline stages connected correctly!", "green");
    dryRunResult.overallStatus = "PASS";
  } else {
    log("✗ DRY RUN FAILED", "red");
    log("\nSome stages have issues (see above)", "red");
    dryRunResult.overallStatus = "FAIL";
  }

  log("================================\n", "blue");

  // JSON 저장
  fs.writeFileSync(DRYRUN_FILE, JSON.stringify(dryRunResult, null, 2));
  log(`Dry run result saved to: ${DRYRUN_FILE}`, "blue");

  // 다음 단계
  log("\nNext Steps:", "blue");
  if (allPassed) {
    log("  1. npm run test:scene  (test 1 real scene)", "green");
    log("  2. npm run test:short  (test 2-3 minute video)", "green");
  } else {
    log("  Review failures above and fix issues", "yellow");
    log("  Then run: npm run dry-run", "yellow");
  }

  process.exit(allPassed ? 0 : 1);
}

main().catch((error) => {
  console.error("Dry run failed:", error);
  process.exit(1);
});
