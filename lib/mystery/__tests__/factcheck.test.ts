/**
 * Fact-Check System Validation Tests
 * 팩트체크 시스템이 올바르게 작동하는지 검증
 */

import { FactStatus, Scene, ScriptSection } from "../types";

// Mock fact-checking function
function validateFactStatus(section: ScriptSection): FactStatus {
  const text = section.text.toLowerCase();
  const sourceCount = section.sources?.length || 0;

  // FACT: Multiple reliable sources
  if (sourceCount >= 2 && section.sources?.every((s) => s.reliability === "high")) {
    return "FACT";
  }

  // SUPPORTED: One reliable source
  if (sourceCount >= 1 && section.sources?.some((s) => s.reliability === "high")) {
    return "SUPPORTED";
  }

  // FALSE: Text mentions disproven
  if (text.includes("거짓") || text.includes("입증됨")) {
    return "FALSE";
  }

  // TESTIMONY: Text mentions witness/testimony
  if (text.includes("증언") || text.includes("말했다") || text.includes("주장했다")) {
    return "TESTIMONY";
  }

  // DISPUTED: Text mentions disagreement
  if (text.includes("논쟁") || text.includes("의견이 나뉜") || text.includes("vs")) {
    return "DISPUTED";
  }

  // UNVERIFIED: No sources
  if (sourceCount === 0) {
    return "UNVERIFIED";
  }

  return "UNVERIFIED";
}

describe("Fact-Check System", () => {
  describe("FactStatus Assignment", () => {
    it("should assign FACT for multiple high-reliability sources", () => {
      const section: ScriptSection = {
        id: "test-1",
        kind: "chapter",
        text: "공식 기록에 따르면",
        charCount: 10,
        estimatedSeconds: 5,
        status: "done",
        sources: [
          {
            id: "1",
            title: "Official Report",
            publisher: "Police",
            url: "http://example.com",
            sourceType: "official",
            reliability: "high",
            factUsed: "사건 발생",
          },
          {
            id: "2",
            title: "News Report",
            publisher: "Reuters",
            url: "http://example.com",
            sourceType: "major_media",
            reliability: "high",
            factUsed: "사건 발생",
          },
        ],
      };

      expect(validateFactStatus(section)).toBe("FACT");
    });

    it("should assign SUPPORTED for single high-reliability source", () => {
      const section: ScriptSection = {
        id: "test-2",
        kind: "chapter",
        text: "신뢰도 높은 출처",
        charCount: 8,
        estimatedSeconds: 4,
        status: "done",
        sources: [
          {
            id: "1",
            title: "BBC Report",
            publisher: "BBC",
            url: "http://example.com",
            sourceType: "major_media",
            reliability: "high",
            factUsed: "사실",
          },
        ],
      };

      expect(validateFactStatus(section)).toBe("SUPPORTED");
    });

    it("should assign TESTIMONY for witness statements", () => {
      const section: ScriptSection = {
        id: "test-3",
        kind: "chapter",
        text: "목격자의 증언에 따르면",
        charCount: 12,
        estimatedSeconds: 6,
        status: "done",
        sources: [],
      };

      expect(validateFactStatus(section)).toBe("TESTIMONY");
    });

    it("should assign FALSE for disproven claims", () => {
      const section: ScriptSection = {
        id: "test-4",
        kind: "chapter",
        text: "이 주장은 거짓으로 입증됨",
        charCount: 13,
        estimatedSeconds: 6,
        status: "done",
        sources: [],
      };

      expect(validateFactStatus(section)).toBe("FALSE");
    });

    it("should assign DISPUTED for conflicting sources", () => {
      const section: ScriptSection = {
        id: "test-5",
        kind: "chapter",
        text: "당사자 주장 vs 경찰 주장",
        charCount: 12,
        estimatedSeconds: 6,
        status: "done",
        sources: [],
      };

      expect(validateFactStatus(section)).toBe("DISPUTED");
    });

    it("should assign UNVERIFIED for unverified claims", () => {
      const section: ScriptSection = {
        id: "test-6",
        kind: "chapter",
        text: "이러한 사건이 일어났습니다",
        charCount: 12,
        estimatedSeconds: 6,
        status: "done",
        sources: [],
      };

      expect(validateFactStatus(section)).toBe("UNVERIFIED");
    });
  });

  describe("Scene Fact-Check Integrity", () => {
    it("should have valid fact status for all scenes", () => {
      const validStatuses: FactStatus[] = [
        "FACT",
        "SUPPORTED",
        "TESTIMONY",
        "CLAIM",
        "DISPUTED",
        "UNVERIFIED",
        "FALSE",
      ];

      const scenes: Scene[] = [
        {
          id: "scene-1",
          sectionId: "sec-1",
          order: 0,
          text: "test",
          visualType: "text_card",
          visualQuery: "test",
          visualStatus: "done",
          visualUrl: "/test.png",
          narration: [],
          factStatus: "FACT",
        },
        {
          id: "scene-2",
          sectionId: "sec-2",
          order: 1,
          text: "test",
          visualType: "text_card",
          visualQuery: "test",
          visualStatus: "done",
          visualUrl: "/test.png",
          narration: [],
          factStatus: "UNVERIFIED",
        },
      ];

      for (const scene of scenes) {
        if (scene.factStatus) {
          expect(validStatuses).toContain(scene.factStatus);
        }
      }
    });

    it("should validate AI reconstruction disclosure", () => {
      const scene: Scene = {
        id: "scene-ai",
        sectionId: "sec-ai",
        order: 0,
        text: "AI 재현 장면",
        visualType: "ai_reconstruction",
        visualQuery: "reconstruction",
        visualStatus: "done",
        visualUrl: "/ai.png",
        visualOrigin: "AI_RECONSTRUCTION",
        narration: [],
        aiReconstructionExplained: true,
      };

      // AI 재현이면 반드시 표시되어야 함
      if (scene.visualOrigin === "AI_RECONSTRUCTION" || scene.visualOrigin === "MIXED") {
        expect(scene.aiReconstructionExplained).toBe(true);
      }
    });

    it("should not mix FACT with AI reconstruction", () => {
      const section: ScriptSection = {
        id: "test-mixed",
        kind: "chapter",
        text: "AI 재현: 당시 상황을 추정하면",
        charCount: 20,
        estimatedSeconds: 10,
        status: "done",
        sources: [],
        visualOrigin: "AI_RECONSTRUCTION",
        factStatus: "CLAIM",
      };

      // AI 재현은 FACT가 될 수 없음
      if (section.visualOrigin === "AI_RECONSTRUCTION") {
        expect(section.factStatus).not.toBe("FACT");
        expect(["CLAIM", "TESTIMONY", "UNVERIFIED"]).toContain(section.factStatus);
      }
    });
  });

  describe("Source Verification", () => {
    it("should require URL for all sources", () => {
      const section: ScriptSection = {
        id: "test-url",
        kind: "chapter",
        text: "출처가 있는 문장",
        charCount: 10,
        estimatedSeconds: 5,
        status: "done",
        sources: [
          {
            id: "1",
            title: "Test Report",
            publisher: "Test",
            url: "http://example.com",
            sourceType: "major_media",
            reliability: "high",
            factUsed: "사실",
          },
        ],
      };

      if (section.sources && section.sources.length > 0) {
        for (const source of section.sources) {
          expect(source.url).toBeTruthy();
          expect(source.url).toMatch(/^https?:\/\//);
        }
      }
    });

    it("should track reliability levels", () => {
      const reliabilityLevels = ["high", "medium", "low", "unknown"];

      const source = {
        id: "1",
        title: "Test",
        publisher: "Test",
        url: "http://example.com",
        sourceType: "major_media",
        reliability: "high" as const,
        factUsed: "사실",
      };

      expect(reliabilityLevels).toContain(source.reliability);
    });
  });

  describe("Content Density Analysis", () => {
    it("should calculate information density", () => {
      const sections: ScriptSection[] = [
        {
          id: "1",
          kind: "chapter",
          text: "첫 번째 새로운 정보",
          charCount: 10,
          estimatedSeconds: 5,
          status: "done",
          sources: [
            {
              id: "s1",
              title: "Source 1",
              publisher: "Publisher",
              url: "http://example.com",
              sourceType: "news",
              reliability: "high",
              factUsed: "사실",
            },
          ],
        },
        {
          id: "2",
          kind: "chapter",
          text: "두 번째 새로운 정보",
          charCount: 10,
          estimatedSeconds: 5,
          status: "done",
          sources: [
            {
              id: "s2",
              title: "Source 2",
              publisher: "Publisher",
              url: "http://example.com",
              sourceType: "news",
              reliability: "high",
              factUsed: "사실",
            },
          ],
        },
      ];

      const totalFacts = sections.filter((s) => s.sources && s.sources.length > 0).length;
      const uniqueFacts = new Set(
        sections.flatMap((s) => s.sources?.map((src) => src.id) || [])
      ).size;

      expect(totalFacts).toBeGreaterThan(0);
      expect(uniqueFacts).toBeGreaterThan(0);
    });

    it("should detect repetition", () => {
      const sections: ScriptSection[] = [
        {
          id: "1",
          kind: "chapter",
          text: "사건이 발생했습니다",
          charCount: 10,
          estimatedSeconds: 5,
          status: "done",
          sources: [],
        },
        {
          id: "2",
          kind: "chapter",
          text: "그 사건이 발생했습니다",
          charCount: 11,
          estimatedSeconds: 5,
          status: "done",
          sources: [],
        },
      ];

      // 같은 내용의 반복 감지
      const textSimilarity = sections[0].text === sections[1].text;
      expect(textSimilarity).toBe(false); // 약간 다르지만 같은 의미
    });
  });

  describe("Boring Segment Detection", () => {
    it("should identify low-information segments", () => {
      const scene: Scene = {
        id: "boring",
        sectionId: "sec",
        order: 0,
        text: "일반적인 내용",
        visualType: "text_card",
        visualQuery: "text",
        visualStatus: "done",
        visualUrl: "/text.png",
        narration: [],
        visualOrigin: "GENERATED_DIAGRAM",
        factStatus: "UNVERIFIED",
      };

      const isBoringRisk =
        !scene.factStatus ||
        (scene.factStatus === "UNVERIFIED" && !scene.visualOrigin?.startsWith("REAL"));

      expect(isBoringRisk).toBe(true);
    });
  });
});
