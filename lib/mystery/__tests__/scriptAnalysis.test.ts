/**
 * scriptAnalysis.ts 단위 테스트
 */

import {
  inferVisualOrigin,
  inferFactStatus,
  needsAiDisclaimer,
  enrichSectionsWithMetadata,
} from "../scriptAnalysis";
import { ScriptSection } from "../types";

describe("scriptAnalysis", () => {
  describe("inferVisualOrigin", () => {
    it("should detect AI reconstruction from '재현하면' pattern", () => {
      const section: ScriptSection = {
        id: "test-1",
        kind: "chapter",
        text: "이 장면을 재현하면 다음과 같을 것이다.",
        charCount: 20,
        estimatedSeconds: 10,
        status: "done",
        sources: [],
      };
      expect(inferVisualOrigin(section)).toBe("AI_RECONSTRUCTION");
    });

    it("should detect AI reconstruction from '추정하면' pattern", () => {
      const section: ScriptSection = {
        id: "test-2",
        kind: "chapter",
        text: "당시 상황을 추정하면, 범인은 이렇게 움직였을 것이다.",
        charCount: 20,
        estimatedSeconds: 10,
        status: "done",
        sources: [],
      };
      expect(inferVisualOrigin(section)).toBe("AI_RECONSTRUCTION");
    });

    it("should detect REAL_NEWS from '영상' pattern", () => {
      const section: ScriptSection = {
        id: "test-3",
        kind: "chapter",
        text: "당시 촬영된 영상에는 다음과 같은 장면이 있다.",
        charCount: 20,
        estimatedSeconds: 10,
        status: "done",
        sources: [],
      };
      expect(inferVisualOrigin(section)).toBe("REAL_NEWS");
    });

    it("should detect REAL_ARCHIVE_PHOTO from '사진' pattern", () => {
      const section: ScriptSection = {
        id: "test-4",
        kind: "chapter",
        text: "1995년의 사진 자료에 따르면, 현장은 이렇게 보였다.",
        charCount: 20,
        estimatedSeconds: 10,
        status: "done",
        sources: [],
      };
      expect(inferVisualOrigin(section)).toBe("REAL_ARCHIVE_PHOTO");
    });

    it("should detect REAL_ARCHIVE_PHOTO from 'archive' pattern", () => {
      const section: ScriptSection = {
        id: "test-5",
        kind: "chapter",
        text: "아카이브에 보관된 기록에 따르면,",
        charCount: 15,
        estimatedSeconds: 8,
        status: "done",
        sources: [],
      };
      expect(inferVisualOrigin(section)).toBe("REAL_ARCHIVE_PHOTO");
    });

    it("should detect GENERATED_DIAGRAM from '지도' pattern", () => {
      const section: ScriptSection = {
        id: "test-6",
        kind: "chapter",
        text: "이것은 사건 현장의 지도를 기반으로 한 분석이다.",
        charCount: 20,
        estimatedSeconds: 10,
        status: "done",
        sources: [],
      };
      expect(inferVisualOrigin(section)).toBe("GENERATED_DIAGRAM");
    });

    it("should detect GENERATED_TIMELINE from '타임라인' pattern", () => {
      const section: ScriptSection = {
        id: "test-7",
        kind: "chapter",
        text: "다음 타임라인에서 사건의 시간 순서를 보자.",
        charCount: 20,
        estimatedSeconds: 10,
        status: "done",
        sources: [],
      };
      expect(inferVisualOrigin(section)).toBe("GENERATED_TIMELINE");
    });

    it("should default to MIXED when no pattern matches", () => {
      const section: ScriptSection = {
        id: "test-8",
        kind: "chapter",
        text: "이것은 일반적인 서사 텍스트이다.",
        charCount: 15,
        estimatedSeconds: 8,
        status: "done",
        sources: [],
      };
      expect(inferVisualOrigin(section)).toBe("MIXED");
    });
  });

  describe("inferFactStatus", () => {
    it("should return FALSE for '거짓' pattern", () => {
      const section: ScriptSection = {
        id: "test-1",
        kind: "chapter",
        text: "이것은 거짓으로 입증되었다.",
        charCount: 15,
        estimatedSeconds: 8,
        status: "done",
        sources: [],
      };
      expect(inferFactStatus(section)).toBe("FALSE");
    });

    it("should return TESTIMONY for '증언' pattern", () => {
      const section: ScriptSection = {
        id: "test-2",
        kind: "chapter",
        text: "목격자의 증언에 따르면, 범인은 이렇게 말했다.",
        charCount: 20,
        estimatedSeconds: 10,
        status: "done",
        sources: [],
      };
      expect(inferFactStatus(section)).toBe("TESTIMONY");
    });

    it("should return DISPUTED for '논쟁' pattern", () => {
      const section: ScriptSection = {
        id: "test-3",
        kind: "chapter",
        text: "이 사건의 진상에 대해서는 여전히 논쟁이 있다.",
        charCount: 20,
        estimatedSeconds: 10,
        status: "done",
        sources: [],
      };
      expect(inferFactStatus(section)).toBe("DISPUTED");
    });

    it("should return CLAIM for '추정' pattern", () => {
      const section: ScriptSection = {
        id: "test-4",
        kind: "chapter",
        text: "전문가들은 이것을 다음과 같이 추정하고 있다.",
        charCount: 20,
        estimatedSeconds: 10,
        status: "done",
        sources: [],
      };
      expect(inferFactStatus(section)).toBe("CLAIM");
    });

    it("should return FACT for official source with multiple refs", () => {
      const section: ScriptSection = {
        id: "test-5",
        kind: "chapter",
        text: "공식 기록에 따르면",
        charCount: 10,
        estimatedSeconds: 5,
        status: "done",
        sources: [
          {
            id: "1",
            title: "Official Report",
            publisher: "Government",
            url: "http://example.com",
            sourceType: "official",
            reliability: "high",
            factUsed: "사실",
          },
          {
            id: "2",
            title: "News Report",
            publisher: "Reuters",
            url: "http://example.com",
            sourceType: "major_media",
            reliability: "high",
            factUsed: "사실",
          },
        ],
      };
      expect(inferFactStatus(section)).toBe("FACT");
    });

    it("should return UNVERIFIED when no sources", () => {
      const section: ScriptSection = {
        id: "test-6",
        kind: "chapter",
        text: "이러한 사건이 발생했다.",
        charCount: 10,
        estimatedSeconds: 5,
        status: "done",
        sources: [],
      };
      expect(inferFactStatus(section)).toBe("UNVERIFIED");
    });

    it("should return SUPPORTED for single high-reliability source", () => {
      const section: ScriptSection = {
        id: "test-7",
        kind: "chapter",
        text: "신뢰할 수 있는 출처에 따르면",
        charCount: 15,
        estimatedSeconds: 8,
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
      expect(inferFactStatus(section)).toBe("SUPPORTED");
    });
  });

  describe("needsAiDisclaimer", () => {
    it("should return true for AI_RECONSTRUCTION type", () => {
      const section: ScriptSection = {
        id: "test-1",
        kind: "chapter",
        text: "일반 텍스트",
        charCount: 10,
        estimatedSeconds: 5,
        status: "done",
        sources: [],
        visualOrigin: "AI_RECONSTRUCTION",
      };
      expect(needsAiDisclaimer(section)).toBe(true);
    });

    it("should return true for '재현하면' pattern", () => {
      const section: ScriptSection = {
        id: "test-2",
        kind: "chapter",
        text: "이를 재현하면 다음과 같을 것이다.",
        charCount: 15,
        estimatedSeconds: 8,
        status: "done",
        sources: [],
      };
      expect(needsAiDisclaimer(section)).toBe(true);
    });

    it("should return true for '추정하면' pattern", () => {
      const section: ScriptSection = {
        id: "test-3",
        kind: "chapter",
        text: "상황을 추정하면 이렇게 볼 수 있다.",
        charCount: 15,
        estimatedSeconds: 8,
        status: "done",
        sources: [],
      };
      expect(needsAiDisclaimer(section)).toBe(true);
    });

    it("should return false for plain text without AI markers", () => {
      const section: ScriptSection = {
        id: "test-4",
        kind: "chapter",
        text: "공식 기록에 따르면 사건은 이렇게 발생했다.",
        charCount: 20,
        estimatedSeconds: 10,
        status: "done",
        sources: [],
        visualOrigin: "REAL_ARCHIVE_PHOTO",
      };
      expect(needsAiDisclaimer(section)).toBe(false);
    });
  });

  describe("enrichSectionsWithMetadata", () => {
    it("should enrich multiple sections with metadata", () => {
      const sections: ScriptSection[] = [
        {
          id: "sec-1",
          kind: "hook",
          text: "이 사건을 재현하면 어떻게 될까?",
          charCount: 15,
          estimatedSeconds: 8,
          status: "done",
          sources: [],
        },
        {
          id: "sec-2",
          kind: "chapter",
          text: "공식 기록에 따르면 사실은 이렇다.",
          charCount: 20,
          estimatedSeconds: 10,
          status: "done",
          sources: [
            {
              id: "1",
              title: "Official",
              publisher: "Government",
              url: "http://example.com",
              sourceType: "official",
              reliability: "high",
              factUsed: "사실",
            },
          ],
        },
      ];

      const enriched = enrichSectionsWithMetadata(sections);

      expect(enriched).toHaveLength(2);
      expect(enriched[0].visualOrigin).toBe("AI_RECONSTRUCTION");
      expect(enriched[0].factStatus).toMatch(/^(CLAIM|UNVERIFIED)$/);
      expect(enriched[0].needsDisclaimer).toBe(true);
      expect(enriched[1].visualOrigin).toBeDefined();
      expect(enriched[1].factStatus).toBe("SUPPORTED");
      expect(enriched[1].needsDisclaimer).toBe(false);
    });

    it("should preserve existing metadata", () => {
      const sections: ScriptSection[] = [
        {
          id: "sec-1",
          kind: "chapter",
          text: "일반 텍스트",
          charCount: 10,
          estimatedSeconds: 5,
          status: "done",
          sources: [],
          visualOrigin: "GENERATED_TIMELINE",
          factStatus: "FACT",
        },
      ];

      const enriched = enrichSectionsWithMetadata(sections);

      expect(enriched[0].visualOrigin).toBe("GENERATED_TIMELINE");
      expect(enriched[0].factStatus).toBe("FACT");
    });

    it("should handle empty sections array", () => {
      const sections: ScriptSection[] = [];
      const enriched = enrichSectionsWithMetadata(sections);
      expect(enriched).toHaveLength(0);
    });
  });
});
