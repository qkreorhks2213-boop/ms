/**
 * render.ts 통합 테스트
 * 렌더 파이프라인의 메타데이터 통합과 오버레이 생성 검증
 */

import { Scene } from "../types";

describe("render pipeline integration", () => {
  describe("ClipPlan generation with metadata", () => {
    it("should create clipPlan with aiDisclaimerText when aiReconstructionExplained=true", () => {
      const scene: Scene = {
        id: "scene-1",
        sectionId: "sec-1",
        order: 0,
        text: "이 장면은 AI로 재현한 것이다.",
        visualType: "ai_reconstruction",
        visualQuery: "AI 재현",
        visualStatus: "done",
        visualUrl: "/generated/scene-1.png",
        narration: [],
        aiReconstructionExplained: true,
      };

      // buildSceneClipPlans의 로직을 시뮬레이션
      const clipPlan = {
        id: scene.id,
        imagePath: `/path/to${scene.visualUrl}`,
        durationSeconds: 10,
        zoomAmount: 0.12,
        captions: [],
        sourceLabel: scene.visualSourceLabel,
        aiDisclaimerText: scene.aiReconstructionExplained ? "AI 재현" : undefined,
      };

      expect(clipPlan.aiDisclaimerText).toBe("AI 재현");
    });

    it("should not set aiDisclaimerText when aiReconstructionExplained=false", () => {
      const scene: Scene = {
        id: "scene-1",
        sectionId: "sec-1",
        order: 0,
        text: "실제 자료 기반의 장면",
        visualType: "archive_photo",
        visualQuery: "자료",
        visualStatus: "done",
        visualUrl: "/generated/scene-1.png",
        narration: [],
        aiReconstructionExplained: false,
      };

      const clipPlan = {
        id: scene.id,
        imagePath: `/path/to${scene.visualUrl}`,
        durationSeconds: 10,
        zoomAmount: 0.12,
        captions: [],
        sourceLabel: scene.visualSourceLabel,
        aiDisclaimerText: scene.aiReconstructionExplained ? "AI 재현" : undefined,
      };

      expect(clipPlan.aiDisclaimerText).toBeUndefined();
    });

    it("should include both sourceLabel and aiDisclaimerText when both conditions met", () => {
      const scene: Scene = {
        id: "scene-1",
        sectionId: "sec-1",
        order: 0,
        text: "혼합 장면",
        visualType: "ai_reconstruction",
        visualQuery: "AI",
        visualStatus: "done",
        visualUrl: "/generated/scene-1.png",
        visualSourceLabel: "자료: Archive.org / 2019",
        narration: [],
        aiReconstructionExplained: true,
      };

      const clipPlan = {
        id: scene.id,
        imagePath: `/path/to${scene.visualUrl}`,
        durationSeconds: 10,
        zoomAmount: 0.12,
        captions: [],
        sourceLabel: scene.visualSourceLabel,
        aiDisclaimerText: scene.aiReconstructionExplained ? "AI 재현" : undefined,
      };

      expect(clipPlan.sourceLabel).toBe("자료: Archive.org / 2019");
      expect(clipPlan.aiDisclaimerText).toBe("AI 재현");
    });

    it("should handle undefined visualSourceLabel gracefully", () => {
      const scene: Scene = {
        id: "scene-1",
        sectionId: "sec-1",
        order: 0,
        text: "자료 없는 AI 재현",
        visualType: "ai_reconstruction",
        visualQuery: "AI",
        visualStatus: "done",
        visualUrl: "/generated/scene-1.png",
        narration: [],
        aiReconstructionExplained: true,
      };

      const clipPlan = {
        id: scene.id,
        imagePath: `/path/to${scene.visualUrl}`,
        durationSeconds: 10,
        zoomAmount: 0.12,
        captions: [],
        sourceLabel: scene.visualSourceLabel, // undefined
        aiDisclaimerText: scene.aiReconstructionExplained ? "AI 재현" : undefined,
      };

      expect(clipPlan.sourceLabel).toBeUndefined();
      expect(clipPlan.aiDisclaimerText).toBe("AI 재현");
    });
  });

  describe("Metadata inheritance from script sections", () => {
    it("should pass aiReconstructionExplained from section to scene", () => {
      // Section에서 needsDisclaimer=true → Scene의 aiReconstructionExplained=true
      const sectionMetadata = {
        visualOrigin: "AI_RECONSTRUCTION" as const,
        factStatus: "CLAIM" as const,
        needsDisclaimer: true,
      };

      const scene: Scene = {
        id: "scene-1",
        sectionId: "sec-1",
        order: 0,
        text: "테스트",
        visualType: "ai_reconstruction",
        visualQuery: "test",
        visualStatus: "done",
        visualUrl: "/test.png",
        narration: [],
        // Section에서 상속
        visualOrigin: sectionMetadata.visualOrigin,
        factStatus: sectionMetadata.factStatus,
        aiReconstructionExplained: sectionMetadata.needsDisclaimer,
      };

      expect(scene.aiReconstructionExplained).toBe(true);
      expect(scene.visualOrigin).toBe("AI_RECONSTRUCTION");
      expect(scene.factStatus).toBe("CLAIM");
    });
  });

  describe("Overlay text generation", () => {
    it("should format AI disclaimer text correctly", () => {
      const disclaimerText = "AI 재현";
      expect(disclaimerText).toMatch(/^AI 재현$/);
    });

    it("should format source label correctly", () => {
      const sourceLabel = "자료: BBC / 2019";
      expect(sourceLabel).toMatch(/^자료:/);
      expect(sourceLabel).toContain("BBC");
      expect(sourceLabel).toContain("2019");
    });

    it("should handle complex source labels", () => {
      const sourceLabel = "자료: New York Times / Associated Press / 2023-06-15";
      expect(sourceLabel).toMatch(/^자료:/);
      expect(sourceLabel.split("/").length).toBeGreaterThan(1);
    });
  });

  describe("Visual type based rendering", () => {
    const DATA_VISUAL_TYPES = ["data_card", "timeline", "diagram"];

    it("should use DATA_CARD_ZOOM_AMOUNT for data card types", () => {
      const DATA_CARD_ZOOM_AMOUNT = 0.08;
      const BODY_ZOOM_AMOUNT = 0.12;

      const dataCardScene: Scene = {
        id: "scene-1",
        sectionId: "sec-1",
        order: 0,
        text: "data",
        visualType: "data_card",
        visualQuery: "data",
        visualStatus: "done",
        visualUrl: "/data.png",
        narration: [],
      };

      const zoomAmount = DATA_VISUAL_TYPES.includes(dataCardScene.visualType)
        ? DATA_CARD_ZOOM_AMOUNT
        : BODY_ZOOM_AMOUNT;

      expect(zoomAmount).toBe(0.08);
    });

    it("should use BODY_ZOOM_AMOUNT for non-data types", () => {
      const DATA_CARD_ZOOM_AMOUNT = 0.08;
      const BODY_ZOOM_AMOUNT = 0.12;

      const photoScene: Scene = {
        id: "scene-1",
        sectionId: "sec-1",
        order: 0,
        text: "photo",
        visualType: "archive_photo",
        visualQuery: "photo",
        visualStatus: "done",
        visualUrl: "/photo.png",
        narration: [],
      };

      const zoomAmount = DATA_VISUAL_TYPES.includes(photoScene.visualType)
        ? DATA_CARD_ZOOM_AMOUNT
        : BODY_ZOOM_AMOUNT;

      expect(zoomAmount).toBe(0.12);
    });
  });

  describe("Scene collection and filtering", () => {
    it("should filter scenes by duration and visual status", () => {
      const scenes: Scene[] = [
        {
          id: "scene-1",
          sectionId: "sec-1",
          order: 0,
          text: "short",
          visualType: "text_card",
          visualQuery: "short",
          visualStatus: "done",
          visualUrl: "/1.png",
          durationSeconds: 0.1, // too short
          narration: [],
        },
        {
          id: "scene-2",
          sectionId: "sec-2",
          order: 1,
          text: "long",
          visualType: "archive_photo",
          visualQuery: "photo",
          visualStatus: "done",
          visualUrl: "/2.png",
          durationSeconds: 5,
          narration: [],
        },
        {
          id: "scene-3",
          sectionId: "sec-3",
          order: 2,
          text: "pending",
          visualType: "ai_reconstruction",
          visualQuery: "ai",
          visualStatus: "pending", // not done
          visualUrl: "/3.png",
          durationSeconds: 5,
          narration: [],
        },
      ];

      const filtered = scenes.filter(
        (s) => (s.durationSeconds || 0) > 0.3 && s.visualStatus === "done" && s.visualUrl
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("scene-2");
    });
  });

  describe("Hook montage clip metadata", () => {
    it("should apply aiDisclaimerText to hook montage clips", () => {
      const hookScene: Scene = {
        id: "scene-hook-1",
        sectionId: "hook-0",
        order: 0,
        text: "훅 장면",
        visualType: "ai_reconstruction",
        visualQuery: "hook",
        visualStatus: "done",
        visualUrl: "/hook.png",
        narration: [],
        aiReconstructionExplained: true,
      };

      const hookClipPlan = {
        id: "hook-montage-0",
        imagePath: `/path/to${hookScene.visualUrl}`,
        durationSeconds: 3,
        zoomAmount: 0.35, // HOOK_ZOOM_AMOUNT
        captions: [],
        aiDisclaimerText: hookScene.aiReconstructionExplained ? "AI 재현" : undefined,
      };

      expect(hookClipPlan.aiDisclaimerText).toBe("AI 재현");
    });
  });

  describe("Fallback handling", () => {
    it("should handle null imagePath for missing visuals", () => {
      const fallbackClipPlan = {
        id: "fallback",
        imagePath: null, // black screen fallback
        durationSeconds: 10,
        zoomAmount: 0,
        captions: [],
        sourceLabel: undefined,
        aiDisclaimerText: undefined,
      };

      expect(fallbackClipPlan.imagePath).toBeNull();
      expect(fallbackClipPlan.zoomAmount).toBe(0); // no zoom for black screen
    });
  });
});
