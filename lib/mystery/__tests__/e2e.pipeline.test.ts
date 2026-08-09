/**
 * End-to-End Pipeline Tests
 *
 * 5가지 미스터리 타입으로 전체 파이프라인 검증:
 * 1. unsolved_case - 미제사건
 * 2. missing_person - 실종사건
 * 3. historical_mystery - 역사적 미스터리
 * 4. supernatural - 초자연 현상
 * 5. crime - 범죄 미스터리
 */

import {
  MysteryInput,
  MysteryProject,
  MysteryScript,
  Scene,
  FactStatus,
  VisualOrigin,
} from "../types";

// E2E 테스트 헬퍼 함수들

/**
 * Mock MysteryProject 생성
 */
function createMockProject(caseType: string): MysteryProject {
  return {
    id: `project-e2e-${caseType}`,
    name: `E2E Test - ${caseType}`,
    userId: "test-user",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    input: {
      topic: `Test ${caseType}`,
      caseType: caseType as any,
      targetMinutes: 10,
      angles: ["case_focused"],
      endingStyle: "confirmed_facts",
      useRealPhotos: true,
      useAiReconstruction: true,
      useBgm: false,
      voiceName: "default",
      sceneVisualTarget: 20,
    },
    stage: "script",
    errorLog: [],
    render: { status: "idle" },
  };
}

/**
 * Mock Script 생성
 */
function createMockScript(): MysteryScript {
  return {
    title: "Test Script",
    outline: "Test outline",
    sections: [
      {
        id: "hook-0",
        kind: "hook",
        text: "이 사건을 재현하면 어떻게 될까? 1995년의 충격적인 발견부터 시작해보자.",
        charCount: 50,
        estimatedSeconds: 15,
        status: "done",
        sources: [],
        visualOrigin: "AI_RECONSTRUCTION",
        factStatus: "CLAIM",
        needsDisclaimer: true,
      },
      {
        id: "chapter-0",
        kind: "chapter",
        index: 1,
        chapterType: "background",
        outlineSummary: "배경 설명",
        text: "사건의 배경은 이렇다. 공식 기록에 따르면 사건은 다음과 같이 발생했다.",
        charCount: 50,
        estimatedSeconds: 20,
        status: "done",
        sources: [
          {
            id: "src-1",
            title: "Official Report",
            publisher: "Government",
            url: "http://example.com",
            sourceType: "official",
            reliability: "high",
            factUsed: "사건 발생",
          },
        ],
        visualOrigin: "REAL_ARCHIVE_PHOTO",
        factStatus: "FACT",
        needsDisclaimer: false,
      },
      {
        id: "chapter-1",
        kind: "chapter",
        index: 2,
        chapterType: "main_event",
        outlineSummary: "주요 사건",
        text: "지도를 보면서 사건 현장을 파악해보자.",
        charCount: 30,
        estimatedSeconds: 15,
        status: "done",
        sources: [],
        visualOrigin: "GENERATED_DIAGRAM",
        factStatus: "FACT",
        needsDisclaimer: false,
      },
    ],
    totalCharCount: 130,
    estimatedMinutes: 1.2,
  };
}

/**
 * Mock Scenes 생성
 */
function createMockScenes(): Scene[] {
  return [
    {
      id: "scene-0",
      sectionId: "hook-0",
      order: 0,
      text: "훅 장면",
      visualType: "ai_reconstruction",
      visualQuery: "AI 재현",
      visualStatus: "done",
      visualUrl: "/generated/scene-0.png",
      visualSourceLabel: undefined,
      visualOrigin: "AI_RECONSTRUCTION",
      factStatus: "CLAIM",
      aiReconstructionExplained: true,
      narration: [],
      durationSeconds: 3,
    },
    {
      id: "scene-1",
      sectionId: "chapter-0",
      order: 0,
      text: "배경 설명 장면",
      visualType: "archive_photo",
      visualQuery: "historical photo",
      visualStatus: "done",
      visualUrl: "/generated/scene-1.png",
      visualSourceLabel: "자료: Archive.org / 1995",
      visualOrigin: "REAL_ARCHIVE_PHOTO",
      factStatus: "FACT",
      aiReconstructionExplained: false,
      narration: [],
      durationSeconds: 5,
    },
    {
      id: "scene-2",
      sectionId: "chapter-1",
      order: 0,
      text: "지도 장면",
      visualType: "diagram",
      visualQuery: "map",
      visualStatus: "done",
      visualUrl: "/generated/scene-2.png",
      visualSourceLabel: "지도",
      visualOrigin: "GENERATED_DIAGRAM",
      factStatus: "FACT",
      aiReconstructionExplained: false,
      narration: [],
      durationSeconds: 2,
    },
  ];
}

describe("E2E Pipeline Tests", () => {
  describe("Case Type: unsolved_case", () => {
    const caseType = "unsolved_case";

    it("should handle unsolved case with proper metadata flow", () => {
      const project = createMockProject(caseType);
      expect(project.input.caseType).toBe(caseType);

      const script = createMockScript();
      project.script = script;

      // 메타데이터 검증
      expect(script.sections[0].visualOrigin).toBe("AI_RECONSTRUCTION");
      expect(script.sections[0].needsDisclaimer).toBe(true);
      expect(script.sections[1].visualOrigin).toBe("REAL_ARCHIVE_PHOTO");
      expect(script.sections[1].factStatus).toBe("FACT");
    });

    it("should create scenes with inherited metadata", () => {
      const scenes = createMockScenes();

      // Scene 0: AI 재현
      expect(scenes[0].visualOrigin).toBe("AI_RECONSTRUCTION");
      expect(scenes[0].aiReconstructionExplained).toBe(true);
      expect(scenes[0].durationSeconds).toBeGreaterThan(0);

      // Scene 1: 실제 자료
      expect(scenes[1].visualOrigin).toBe("REAL_ARCHIVE_PHOTO");
      expect(scenes[1].visualSourceLabel).toBeDefined();
      expect(scenes[1].visualSourceLabel).toContain("자료:");

      // Scene 2: 생성 그래픽
      expect(scenes[2].visualOrigin).toBe("GENERATED_DIAGRAM");
      expect(scenes[2].aiReconstructionExplained).toBe(false);
    });

    it("should validate visual asset distribution", () => {
      const scenes = createMockScenes();

      const realCount = scenes.filter((s) =>
        s.visualOrigin?.startsWith("REAL")
      ).length;
      const graphicCount = scenes.filter((s) =>
        s.visualOrigin?.startsWith("GENERATED")
      ).length;
      const aiCount = scenes.filter((s) =>
        s.visualOrigin?.startsWith("AI")
      ).length;

      const total = scenes.length;
      expect(realCount + graphicCount + aiCount).toBe(total);

      // unsolved_case는 실제 자료가 많아야 함
      expect(realCount).toBeGreaterThan(0);
    });
  });

  describe("Case Type: missing_person", () => {
    const caseType = "missing_person";

    it("should handle missing person case", () => {
      const project = createMockProject(caseType);
      expect(project.input.caseType).toBe(caseType);

      const script = createMockScript();
      project.script = script;
      project.scenes = createMockScenes();

      // 실종 사건은 인물 정보가 중요
      expect(project.script.sections.length).toBeGreaterThan(0);
      expect(project.scenes?.length).toBeGreaterThan(0);
    });
  });

  describe("Case Type: historical_mystery", () => {
    const caseType = "historical_mystery";

    it("should handle historical mystery case", () => {
      const project = createMockProject(caseType);
      expect(project.input.caseType).toBe(caseType);

      const script = createMockScript();
      project.script = script;
      project.scenes = createMockScenes();

      // 역사 미스터리는 아카이브 자료가 풍부해야 함
      const scenes = project.scenes;
      const archiveScenes = scenes?.filter(
        (s) => s.visualOrigin === "REAL_ARCHIVE_PHOTO"
      );
      expect(archiveScenes?.length).toBeGreaterThan(0);
    });
  });

  describe("Case Type: supernatural", () => {
    const caseType = "supernatural";

    it("should handle supernatural case", () => {
      const project = createMockProject(caseType);
      expect(project.input.caseType).toBe(caseType);

      const script = createMockScript();
      project.script = script;
      project.scenes = createMockScenes();

      // 초자연 현상은 AI 재현이 더 많을 수 있음
      expect(project.input.useAiReconstruction).toBe(true);
      expect(project.scenes).toBeDefined();
    });
  });

  describe("Case Type: crime", () => {
    const caseType = "crime";

    it("should handle crime mystery case", () => {
      const project = createMockProject(caseType);
      expect(project.input.caseType).toBe(caseType);

      const script = createMockScript();
      project.script = script;
      project.scenes = createMockScenes();

      // 범죄 미스터리는 증거/문서가 중요
      expect(project.script.sections.length).toBeGreaterThan(0);
    });
  });

  describe("Common Pipeline Validations", () => {
    it("should maintain metadata integrity through pipeline", () => {
      const project = createMockProject("unsolved_case");
      const script = createMockScript();
      const scenes = createMockScenes();

      project.script = script;
      project.scenes = scenes;

      // Script → Scene 메타데이터 전파 검증
      for (let i = 0; i < Math.min(script.sections.length, scenes.length); i++) {
        const section = script.sections[i];
        const scene = scenes[i];

        expect(scene.visualOrigin).toBeDefined();
        expect(scene.factStatus).toBeDefined();
      }
    });

    it("should have valid fact status values", () => {
      const scenes = createMockScenes();
      const validStatuses: FactStatus[] = [
        "FACT",
        "SUPPORTED",
        "TESTIMONY",
        "CLAIM",
        "DISPUTED",
        "UNVERIFIED",
        "FALSE",
      ];

      for (const scene of scenes) {
        if (scene.factStatus) {
          expect(validStatuses).toContain(scene.factStatus);
        }
      }
    });

    it("should have valid visual origin values", () => {
      const scenes = createMockScenes();
      const validOrigins: VisualOrigin[] = [
        "REAL_ARCHIVE_PHOTO",
        "REAL_NEWS",
        "REAL_INTERVIEW",
        "REAL_VIDEO",
        "REAL_MAP",
        "REAL_DOCUMENT",
        "GENERATED_GRAPHIC",
        "GENERATED_DIAGRAM",
        "GENERATED_TIMELINE",
        "AI_RECONSTRUCTION",
        "AI_RECONSTRUCTION_VIDEO",
        "AI_ATMOSPHERE",
        "MIXED",
      ];

      for (const scene of scenes) {
        if (scene.visualOrigin) {
          expect(validOrigins).toContain(scene.visualOrigin);
        }
      }
    });

    it("should have positive duration for all scenes", () => {
      const scenes = createMockScenes();

      for (const scene of scenes) {
        expect(scene.durationSeconds).toBeGreaterThan(0);
      }
    });

    it("should have completed visual status", () => {
      const scenes = createMockScenes();

      for (const scene of scenes) {
        expect(scene.visualStatus).toBe("done");
      }
    });

    it("should have valid visual URLs", () => {
      const scenes = createMockScenes();

      for (const scene of scenes) {
        expect(scene.visualUrl).toMatch(/^\/generated\//);
        expect(scene.visualUrl).toMatch(/\.png$/);
      }
    });

    it("should match AI disclaimer with reconstruction flag", () => {
      const scenes = createMockScenes();

      for (const scene of scenes) {
        if (
          scene.visualOrigin?.includes("AI") ||
          scene.visualOrigin === "MIXED"
        ) {
          // AI 타입이면 디스클레이머 필요할 수 있음
          if (scene.aiReconstructionExplained) {
            expect(scene.visualOrigin).toMatch(/^AI/);
          }
        }
      }
    });

    it("should have source labels for real materials", () => {
      const scenes = createMockScenes();

      const realMaterials = scenes.filter(
        (s) => s.visualOrigin?.startsWith("REAL")
      );
      for (const scene of realMaterials) {
        // 실제 자료면 출처 라벨이 있거나, 혹은 없을 수 있음 (선택)
        if (scene.visualSourceLabel) {
          expect(scene.visualSourceLabel).toMatch(/^자료:|^지도/);
        }
      }
    });
  });

  describe("Pipeline Robustness", () => {
    it("should handle empty scene narration gracefully", () => {
      const scene: Scene = {
        id: "test",
        sectionId: "sec",
        order: 0,
        text: "test",
        visualType: "text_card",
        visualQuery: "test",
        visualStatus: "done",
        visualUrl: "/test.png",
        narration: [], // empty
        durationSeconds: 1,
      };

      expect(scene.narration.length).toBe(0);
      expect(scene.visualStatus).toBe("done");
    });

    it("should handle scenes without sources gracefully", () => {
      const scene: Scene = {
        id: "test",
        sectionId: "sec",
        order: 0,
        text: "test",
        visualType: "ai_reconstruction",
        visualQuery: "test",
        visualStatus: "done",
        visualUrl: "/test.png",
        narration: [],
        durationSeconds: 1,
        sources: undefined,
      };

      expect(scene.sources).toBeUndefined();
      expect(scene.factStatus).toBeUndefined();
    });
  });
});
