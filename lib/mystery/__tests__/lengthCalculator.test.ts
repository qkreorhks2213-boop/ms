/**
 * Length Calculator Tests
 * 자동 영상 길이 계산이 정확한지 검증
 */

import {
  analyzeLengthRequirement,
  detectBoringSegments,
  validateTargetLength,
} from "../lengthCalculator";
import { MysteryScript, Scene } from "../types";

describe("Length Calculator", () => {
  describe("analyzeLengthRequirement", () => {
    it("should calculate density for well-sourced cases", () => {
      const script: MysteryScript = {
        title: "Test",
        outline: "Well-sourced case",
        sections: [
          {
            id: "1",
            kind: "chapter",
            text: "사건 설명",
            charCount: 50,
            estimatedSeconds: 20,
            status: "done",
            sources: [
              {
                id: "s1",
                title: "Source 1",
                publisher: "News",
                url: "http://example.com",
                sourceType: "major_media",
                reliability: "high",
                factUsed: "사실",
              },
            ],
          },
          {
            id: "2",
            kind: "chapter",
            text: "사건 진행",
            charCount: 50,
            estimatedSeconds: 20,
            status: "done",
            sources: [
              {
                id: "s2",
                title: "Source 2",
                publisher: "Police",
                url: "http://example.com",
                sourceType: "official",
                reliability: "high",
                factUsed: "진행",
              },
            ],
          },
        ],
        totalCharCount: 100,
        estimatedMinutes: 0.7,
      };

      const scenes: Scene[] = [
        {
          id: "1",
          sectionId: "1",
          order: 0,
          text: "scene 1",
          visualType: "newspaper",
          visualQuery: "major_media",
          visualStatus: "done",
          visualUrl: "/news.png",
          narration: [],
          factStatus: "FACT",
          visualOrigin: "REAL_NEWS",
          sources: [
            {
              id: "s1",
              title: "Source 1",
              publisher: "News",
              url: "http://example.com",
              sourceType: "major_media",
              reliability: "high",
              factUsed: "사실",
            },
          ],
        },
        {
          id: "2",
          sectionId: "2",
          order: 1,
          text: "scene 2",
          visualType: "archive_photo",
          visualQuery: "archive_photo",
          visualStatus: "done",
          visualUrl: "/photo.png",
          narration: [],
          factStatus: "SUPPORTED",
          visualOrigin: "REAL_ARCHIVE_PHOTO",
          sources: [
            {
              id: "s2",
              title: "Source 2",
              publisher: "Police",
              url: "http://example.com",
              sourceType: "official",
              reliability: "high",
              factUsed: "진행",
            },
          ],
        },
      ];

      const analysis = analyzeLengthRequirement(script, scenes);

      expect(analysis.sourceCount).toBe(2);
      expect(analysis.uniqueFacts).toBe(2);
      expect(analysis.estimatedMinRange.max).toBeGreaterThan(
        analysis.estimatedMinRange.min
      );
      expect(analysis.estimatedMinRange.min).toBeGreaterThan(5);
    });

    it("should calculate LOW density for minimal sources", () => {
      const script: MysteryScript = {
        title: "Test",
        outline: "Low density case",
        sections: [
          {
            id: "1",
            kind: "chapter",
            text: "사건",
            charCount: 10,
            estimatedSeconds: 5,
            status: "done",
            sources: [],
          },
        ],
        totalCharCount: 10,
        estimatedMinutes: 0.1,
      };

      const scenes: Scene[] = [
        {
          id: "1",
          sectionId: "1",
          order: 0,
          text: "scene",
          visualType: "text_card",
          visualQuery: "text_card",
          visualStatus: "done",
          visualUrl: "/text.png",
          narration: [],
          factStatus: "UNVERIFIED",
          visualOrigin: "GENERATED_DIAGRAM",
        },
      ];

      const analysis = analyzeLengthRequirement(script, scenes);

      expect(analysis.contentDensity).toBe("LOW");
      expect(analysis.estimatedMinRange.max).toBeLessThan(30);
    });

    it("should count mystery threads correctly", () => {
      const script: MysteryScript = {
        title: "Test",
        outline: "Mystery case",
        sections: [
          {
            id: "1",
            kind: "chapter",
            text: "무엇이 일어났을까? 왜 사라졌을까? 누가 했을까?",
            charCount: 25,
            estimatedSeconds: 10,
            status: "done",
            sources: [],
          },
        ],
        totalCharCount: 25,
        estimatedMinutes: 0.2,
      };

      const scenes: Scene[] = [];

      const analysis = analyzeLengthRequirement(script, scenes);

      expect(analysis.mysteryThreads).toBeGreaterThan(0);
      expect(analysis.estimatedMinRange.max).toBeGreaterThan(
        analysis.estimatedMinRange.min
      );
    });

    it("should account for real material ratio", () => {
      const script: MysteryScript = {
        title: "Test",
        outline: "Real material case",
        sections: [
          {
            id: "1",
            kind: "chapter",
            text: "충분한 자료",
            charCount: 10,
            estimatedSeconds: 5,
            status: "done",
            sources: [
              {
                id: "s1",
                title: "Source",
                publisher: "News",
                url: "http://example.com",
                sourceType: "major_media",
                reliability: "high",
                factUsed: "사실",
              },
            ],
          },
        ],
        totalCharCount: 10,
        estimatedMinutes: 0.1,
      };

      const scenes: Scene[] = [
        {
          id: "1",
          sectionId: "1",
          order: 0,
          text: "real",
          visualType: "newspaper",
          visualQuery: "major_media",
          visualStatus: "done",
          visualUrl: "/real.png",
          narration: [],
          visualOrigin: "REAL_NEWS",
          factStatus: "FACT",
          sources: [
            {
              id: "s1",
              title: "Source",
              publisher: "News",
              url: "http://example.com",
              sourceType: "major_media",
              reliability: "high",
              factUsed: "사실",
            },
          ],
        },
        {
          id: "2",
          sectionId: "1",
          order: 1,
          text: "ai_reconstruction",
          visualType: "ai_reconstruction",
          visualQuery: "ai_reconstruction",
          visualStatus: "done",
          visualUrl: "/ai.png",
          narration: [],
          visualOrigin: "AI_RECONSTRUCTION",
          factStatus: "CLAIM",
        },
      ];

      const analysis = analyzeLengthRequirement(script, scenes);

      expect(analysis.realMaterialCount).toBe(1);
      expect(analysis.sourceCount).toBe(1);
      expect(analysis.estimatedMinRange.max).toBeGreaterThanOrEqual(analysis.estimatedMinRange.min);
    });
  });

  describe("detectBoringSegments", () => {
    it("should identify segments with no new information", () => {
      const scenes: Scene[] = [
        {
          id: "1",
          sectionId: "1",
          order: 0,
          text: "unverified scene",
          visualType: "diagram",
          visualQuery: "diagram",
          visualStatus: "done",
          visualUrl: "/graphic.png",
          narration: [],
          factStatus: "UNVERIFIED",
          visualOrigin: "GENERATED_DIAGRAM",
        },
        {
          id: "2",
          sectionId: "1",
          order: 1,
          text: "real scene",
          visualType: "newspaper",
          visualQuery: "major_media",
          visualStatus: "done",
          visualUrl: "/real.png",
          narration: [],
          factStatus: "FACT",
          visualOrigin: "REAL_NEWS",
        },
      ];

      const boring = detectBoringSegments(scenes);

      expect(boring.length).toBe(1);
      expect(boring[0].id).toBe("1");
    });

    it("should not mark high-quality segments as boring", () => {
      const scenes: Scene[] = [
        {
          id: "1",
          sectionId: "1",
          order: 0,
          text: "real evidence",
          visualType: "archive_photo",
          visualQuery: "archive_photo",
          visualStatus: "done",
          visualUrl: "/photo.png",
          narration: [],
          factStatus: "FACT",
          visualOrigin: "REAL_ARCHIVE_PHOTO",
        },
      ];

      const boring = detectBoringSegments(scenes);

      expect(boring.length).toBe(0);
    });
  });

  describe("validateTargetLength", () => {
    it("should accept valid target lengths", () => {
      const analysis = {
        contentDensity: "MEDIUM" as const,
        sourceCount: 20,
        uniqueFacts: 15,
        realMaterialCount: 10,
        interviewCount: 2,
        mysteryThreads: 2,
        repetitionRisk: "LOW" as const,
        estimatedMinRange: { min: 20, max: 40 },
        recommendation: "20-40분 권장",
        reasoning: ["충분한 자료"],
      };

      const result = validateTargetLength(30, analysis);

      expect(result.isValid).toBe(true);
      expect(result.warning).toBeUndefined();
    });

    it("should warn if target is below minimum", () => {
      const analysis = {
        contentDensity: "HIGH" as const,
        sourceCount: 50,
        uniqueFacts: 40,
        realMaterialCount: 30,
        interviewCount: 5,
        mysteryThreads: 4,
        repetitionRisk: "LOW" as const,
        estimatedMinRange: { min: 40, max: 60 },
        recommendation: "40-60분 권장",
        reasoning: ["풍부한 자료"],
      };

      const result = validateTargetLength(20, analysis);

      expect(result.isValid).toBe(false);
      expect(result.warning).toBeTruthy();
      expect(result.suggestion).toBeTruthy();
    });

    it("should warn if target exceeds maximum", () => {
      const analysis = {
        contentDensity: "LOW" as const,
        sourceCount: 5,
        uniqueFacts: 4,
        realMaterialCount: 2,
        interviewCount: 0,
        mysteryThreads: 1,
        repetitionRisk: "HIGH" as const,
        estimatedMinRange: { min: 10, max: 20 },
        recommendation: "10-20분 권장",
        reasoning: ["제한적 자료"],
      };

      const result = validateTargetLength(60, analysis);

      expect(result.isValid).toBe(false);
      expect(result.warning).toBeTruthy();
      expect(result.suggestion).toBeTruthy();
    });
  });

  describe("No Fixed Length", () => {
    it("should never require 110-minute format", () => {
      const shortScript: MysteryScript = {
        title: "Short",
        outline: "Short case",
        sections: [
          {
            id: "1",
            kind: "chapter",
            text: "Short content",
            charCount: 10,
            estimatedSeconds: 5,
            status: "done",
            sources: [],
          },
        ],
        totalCharCount: 10,
        estimatedMinutes: 0.1,
      };

      const scenes: Scene[] = [
        {
          id: "1",
          sectionId: "1",
          order: 0,
          text: "scene",
          visualType: "text_card",
          visualQuery: "text_card",
          visualStatus: "done",
          visualUrl: "/text.png",
          narration: [],
        },
      ];

      const analysis = analyzeLengthRequirement(shortScript, scenes);

      // 짧은 사건은 짧은 영상이 정상
      expect(analysis.estimatedMinRange.max).toBeLessThan(30);
    });

    it("should handle very long cases naturally", () => {
      const longScript: MysteryScript = {
        title: "Long",
        outline: "Complex case",
        sections: Array.from({ length: 30 }, (_, i) => ({
          id: `sec-${i}`,
          kind: "chapter" as const,
          text: `Section ${i}: Important information`,
          charCount: 50,
          estimatedSeconds: 20,
          status: "done" as const,
          sources: [
            {
              id: `src-${i}`,
              title: `Source ${i}`,
              publisher: "Publisher",
              url: `http://example.com/${i}`,
              sourceType: "major_media" as const,
              reliability: "high" as const,
              factUsed: "사실",
            },
          ],
        })),
        totalCharCount: 1500,
        estimatedMinutes: 10,
      };

      const scenes: Scene[] = Array.from({ length: 30 }, (_, i) => ({
        id: `scene-${i}`,
        sectionId: `sec-${i}`,
        order: i,
        text: `Scene ${i}`,
        visualType: "newspaper",
        visualQuery: "major_media",
        visualStatus: "done" as const,
        visualUrl: `/scene-${i}.png`,
        narration: [],
        factStatus: (["FACT", "SUPPORTED", "TESTIMONY"][i % 3] as any),
        visualOrigin: (["REAL_NEWS", "REAL_PHOTO", "REAL_VIDEO"][i % 3] as any),
      }));

      const analysis = analyzeLengthRequirement(longScript, scenes);

      // 충분한 자료가 있으면 최대 길이도 커진다
      expect(analysis.estimatedMinRange.max).toBeGreaterThan(50);
      expect(analysis.contentDensity).toBe("HIGH");
    });
  });
});
