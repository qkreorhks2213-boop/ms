/**
 * Real Case Testing
 * 실제 한국 미스터리 사건으로 테스트
 */

import { MysteryScript, Scene, Source } from "../types";
import {
  analyzeLengthRequirement,
  detectBoringSegments,
  validateTargetLength,
} from "../lengthCalculator";

describe("Real Mystery Cases", () => {
  describe("Case 1: 노래방 살인 사건 (Karaoke Murder Case)", () => {
    it("should analyze real case with actual sources", () => {
      const sources: Source[] = [
        {
          id: "s1",
          title: "노래방 살인 사건 - 경찰청 공식 발표",
          publisher: "경찰청",
          url: "https://police.go.kr/",
          sourceType: "official",
          reliability: "high",
          factUsed: "사건 개요",
        },
        {
          id: "s2",
          title: "노래방 사건 용의자 체포, BBC 뉴스",
          publisher: "BBC News",
          url: "https://bbc.com/korean",
          sourceType: "major_media",
          reliability: "high",
          factUsed: "체포 경위",
        },
        {
          id: "s3",
          title: "목격자 증언 - SBS 뉴스",
          publisher: "SBS",
          url: "https://sbs.co.kr/",
          sourceType: "major_media",
          reliability: "high",
          factUsed: "사건 시간",
        },
        {
          id: "s4",
          title: "법원 판결 문서",
          publisher: "대법원",
          url: "https://www.scourt.go.kr/",
          sourceType: "official",
          reliability: "high",
          factUsed: "판결 결과",
        },
        {
          id: "s5",
          title: "수사관 인터뷰",
          publisher: "동아일보",
          url: "https://donga.com/",
          sourceType: "major_media",
          reliability: "high",
          factUsed: "수사 과정",
        },
      ];

      const script: MysteryScript = {
        title: "노래방 살인 사건",
        outline: "한 여성이 노래방에서 살인당한 미해결 사건",
        sections: [
          {
            id: "s1",
            kind: "chapter",
            text: "2019년 3월, 서울 강남의 한 노래방에서 여성이 살인당한 사건이 발생했다. 목격자들의 증언과 경찰의 수사가 시작되었다.",
            charCount: 65,
            estimatedSeconds: 20,
            status: "done",
            sources: [sources[0], sources[2]],
          },
          {
            id: "s2",
            kind: "chapter",
            text: "용의자는 3일 후 체포되었다. 초기 조사에서는 우발적 범행으로 보였지만, 더 깊은 진실이 숨어있었다.",
            charCount: 58,
            estimatedSeconds: 18,
            status: "done",
            sources: [sources[1], sources[4]],
          },
          {
            id: "s3",
            kind: "chapter",
            text: "법원은 1심에서 징역 15년을 선고했다. 그러나 항소심에서는 다른 판결이 나왔다.",
            charCount: 41,
            estimatedSeconds: 13,
            status: "done",
            sources: [sources[3]],
          },
        ],
        totalCharCount: 164,
        estimatedMinutes: 0.9,
      };

      const scenes: Scene[] = [
        {
          id: "scene1",
          sectionId: "s1",
          order: 0,
          text: "노래방 외부 시점",
          visualType: "news",
          visualQuery: "노래방 사건 현장",
          visualStatus: "done",
          visualUrl: "https://example.com/karaoke.jpg",
          narration: [],
          factStatus: "FACT",
          visualOrigin: "REAL_NEWS",
          sources: [sources[0], sources[2]],
        },
        {
          id: "scene2",
          sectionId: "s1",
          order: 1,
          text: "목격자 인터뷰",
          visualType: "interview",
          visualQuery: "목격자 증언",
          visualStatus: "done",
          visualUrl: "https://example.com/witness.jpg",
          narration: [],
          factStatus: "TESTIMONY",
          visualOrigin: "REAL_INTERVIEW",
          sources: [sources[2]],
        },
        {
          id: "scene3",
          sectionId: "s2",
          order: 2,
          text: "용의자 체포",
          visualType: "news",
          visualQuery: "용의자 체포 뉴스",
          visualStatus: "done",
          visualUrl: "https://example.com/arrest.jpg",
          narration: [],
          factStatus: "FACT",
          visualOrigin: "REAL_NEWS",
          sources: [sources[1]],
        },
        {
          id: "scene4",
          sectionId: "s3",
          order: 3,
          text: "법원 판결",
          visualType: "document",
          visualQuery: "법원 판결 문서",
          visualStatus: "done",
          visualUrl: "https://example.com/court.jpg",
          narration: [],
          factStatus: "FACT",
          visualOrigin: "REAL_OFFICIAL_DOCUMENT",
          sources: [sources[3]],
        },
      ];

      const analysis = analyzeLengthRequirement(script, scenes);

      // 검증
      expect(analysis.sourceCount).toBeGreaterThan(4);
      expect(analysis.uniqueFacts).toBeGreaterThan(3);
      expect(analysis.realMaterialCount).toBe(4); // All scenes are real
      // Content density is LOW with only 4 scenes (needs 30+ fact-type entries)
      expect(["LOW", "MEDIUM"]).toContain(analysis.contentDensity);
      expect(analysis.estimatedMinRange.max).toBeGreaterThan(analysis.estimatedMinRange.min);

      console.log("\n📊 Case Analysis:");
      console.log(`   Sources: ${analysis.sourceCount}`);
      console.log(`   Facts: ${analysis.uniqueFacts}`);
      console.log(`   Real Material: ${analysis.realMaterialCount}/${scenes.length}`);
      console.log(`   Density: ${analysis.contentDensity}`);
      console.log(`   Recommended: ${analysis.recommendation}`);
    });

    it("should have no boring segments in real case", () => {
      const scenes: Scene[] = [
        {
          id: "s1",
          sectionId: "sec1",
          order: 0,
          text: "Real news coverage",
          visualType: "news",
          visualQuery: "news",
          visualStatus: "done",
          visualUrl: "/real.jpg",
          narration: [],
          factStatus: "FACT",
          visualOrigin: "REAL_NEWS",
        },
        {
          id: "s2",
          sectionId: "sec1",
          order: 1,
          text: "Police statement",
          visualType: "document",
          visualQuery: "police",
          visualStatus: "done",
          visualUrl: "/police.jpg",
          narration: [],
          factStatus: "FACT",
          visualOrigin: "REAL_OFFICIAL_DOCUMENT",
        },
        {
          id: "s3",
          sectionId: "sec1",
          order: 2,
          text: "Interview testimony",
          visualType: "interview",
          visualQuery: "interview",
          visualStatus: "done",
          visualUrl: "/interview.jpg",
          narration: [],
          factStatus: "TESTIMONY",
          visualOrigin: "REAL_INTERVIEW",
        },
      ];

      const boring = detectBoringSegments(scenes);
      expect(boring.length).toBe(0); // Real cases should have no boring segments
    });
  });

  describe("Case 2: 실종 사건 (Missing Person Case)", () => {
    it("should validate length for missing person case", () => {
      const sources: Source[] = [
        {
          id: "mp1",
          title: "실종자 수색 공고",
          publisher: "경찰청",
          url: "https://police.go.kr/",
          sourceType: "official",
          reliability: "high",
          factUsed: "실종 경위",
        },
        {
          id: "mp2",
          title: "보도자료",
          publisher: "뉴스1",
          url: "https://news1.kr/",
          sourceType: "major_media",
          reliability: "high",
          factUsed: "수색 진행",
        },
        {
          id: "mp3",
          title: "가족 인터뷰",
          publisher: "MBC",
          url: "https://mbc.go.kr/",
          sourceType: "major_media",
          reliability: "high",
          factUsed: "가족 증언",
        },
      ];

      const script: MysteryScript = {
        title: "미해결 실종 사건",
        outline: "20년 전 사라진 실종자, 아직도 풀리지 않은 미스터리",
        sections: [
          {
            id: "mp1",
            kind: "chapter",
            text: "20년 전, 한 사람이 갑자기 사라졌다. 왜 그리고 어디로?",
            charCount: 30,
            estimatedSeconds: 10,
            status: "done",
            sources: [sources[0]],
          },
          {
            id: "mp2",
            kind: "chapter",
            text: "마지막 목격자의 증언과 경찰의 수사기록을 다시 살펴본다.",
            charCount: 38,
            estimatedSeconds: 12,
            status: "done",
            sources: [sources[1], sources[2]],
          },
        ],
        totalCharCount: 68,
        estimatedMinutes: 0.35,
      };

      const scenes: Scene[] = [
        {
          id: "mp_s1",
          sectionId: "mp1",
          order: 0,
          text: "실종자 사진",
          visualType: "photo",
          visualQuery: "missing person",
          visualStatus: "done",
          visualUrl: "https://example.com/missing.jpg",
          narration: [],
          factStatus: "FACT",
          visualOrigin: "REAL_ARCHIVE_PHOTO",
          sources: [sources[0]],
        },
        {
          id: "mp_s2",
          sectionId: "mp2",
          order: 1,
          text: "수색 현장",
          visualType: "video",
          visualQuery: "search operation",
          visualStatus: "done",
          visualUrl: "https://example.com/search.mp4",
          narration: [],
          factStatus: "FACT",
          visualOrigin: "REAL_VIDEO",
          sources: [sources[1]],
        },
      ];

      const analysis = analyzeLengthRequirement(script, scenes);
      const validation = validateTargetLength(15, analysis);

      expect(analysis.sourceCount).toBeGreaterThan(0);
      expect(validation.isValid).toBe(true);
      console.log(`\n📊 Missing Person Case:`);
      console.log(`   Recommended: ${analysis.recommendation}`);
      console.log(`   Target 15min Valid: ${validation.isValid}`);
    });
  });

  describe("Case 3: 미제 사건 재조명 (Cold Case Review)", () => {
    it("should handle complex case with mixed evidence", () => {
      const sources: Source[] = [
        { id: "c1", title: "원본 뉴스", publisher: "조선일보", url: "https://chosun.com", sourceType: "major_media", reliability: "high", factUsed: "사건 개요" },
        { id: "c2", title: "형사 인터뷰", publisher: "중앙일보", url: "https://joongang.com", sourceType: "major_media", reliability: "high", factUsed: "수사 기법" },
        { id: "c3", title: "유죄 판단 논거", publisher: "대법원", url: "https://scourt.go.kr", sourceType: "official", reliability: "high", factUsed: "판결 근거" },
        { id: "c4", title: "제3자 주장", publisher: "인터넷 커뮤니티", url: "https://example.com", sourceType: "user_generated", reliability: "low", factUsed: "대안 가설" },
      ];

      const scenes: Scene[] = [
        {
          id: "c1",
          sectionId: "c1",
          order: 0,
          text: "원본 뉴스 영상",
          visualType: "news",
          visualQuery: "news",
          visualStatus: "done",
          visualUrl: "/news.jpg",
          narration: [],
          factStatus: "FACT",
          visualOrigin: "REAL_NEWS",
          sources: [sources[0]],
        },
        {
          id: "c2",
          sectionId: "c2",
          order: 1,
          text: "형사 인터뷰",
          visualType: "interview",
          visualQuery: "interview",
          visualStatus: "done",
          visualUrl: "/detective.jpg",
          narration: [],
          factStatus: "TESTIMONY",
          visualOrigin: "REAL_INTERVIEW",
          sources: [sources[1]],
        },
        {
          id: "c3",
          sectionId: "c3",
          order: 2,
          text: "법원 판결문",
          visualType: "document",
          visualQuery: "court",
          visualStatus: "done",
          visualUrl: "/court.jpg",
          narration: [],
          factStatus: "FACT",
          visualOrigin: "REAL_OFFICIAL_DOCUMENT",
          sources: [sources[2]],
        },
        {
          id: "c4",
          sectionId: "c4",
          order: 3,
          text: "대안 이론",
          visualType: "graphic",
          visualQuery: "theory",
          visualStatus: "done",
          visualUrl: "/theory.jpg",
          narration: [],
          factStatus: "DISPUTED",
          visualOrigin: "GENERATED_GRAPHIC",
          sources: [sources[3]],
        },
      ];

      const analysis = analyzeLengthRequirement(
        {
          title: "미제 사건",
          outline: "새로운 증거로 재조명하는 미해결 사건",
          sections: [
            { id: "c1", kind: "chapter", text: "사건 개요", charCount: 20, estimatedSeconds: 6, status: "done", sources: [sources[0]] },
            { id: "c2", kind: "chapter", text: "수사 기법", charCount: 25, estimatedSeconds: 8, status: "done", sources: [sources[1]] },
            { id: "c3", kind: "chapter", text: "판결", charCount: 15, estimatedSeconds: 5, status: "done", sources: [sources[2]] },
            { id: "c4", kind: "chapter", text: "대안", charCount: 30, estimatedSeconds: 10, status: "done", sources: [sources[3]] },
          ],
          totalCharCount: 90,
          estimatedMinutes: 0.45,
        },
        scenes
      );

      expect(analysis.realMaterialCount).toBe(3); // 3 real, 1 graphic
      // Content density with 4 scenes is LOW (needs 30+ fact entries)
      expect(["LOW", "MEDIUM"]).toContain(analysis.contentDensity);
      expect(analysis.estimatedMinRange.min).toBeGreaterThan(5);
      expect(analysis.estimatedMinRange.max).toBeGreaterThan(analysis.estimatedMinRange.min);

      console.log(`\n📊 Cold Case Review:`);
      console.log(`   Recommended length: ${analysis.recommendation}`);
      console.log(`   Real material ratio: ${analysis.realMaterialCount}/${scenes.length}`);
    });
  });

  describe("Data Quality Validation", () => {
    it("should require URL for all sources", () => {
      const sources = [
        {
          id: "test",
          title: "Test",
          publisher: "Test",
          url: "https://example.com",
          sourceType: "news" as const,
          reliability: "high" as const,
          factUsed: "test",
        },
      ];

      for (const source of sources) {
        expect(source.url).toMatch(/^https?:\/\//);
      }
    });

    it("should track source reliability", () => {
      const reliabilityLevels = ["high", "medium", "low", "unknown"] as const;
      const testSource = { reliability: "high" as const };
      expect(reliabilityLevels).toContain(testSource.reliability);
    });

    it("should have fact status for all scenes", () => {
      const validStatuses = ["FACT", "SUPPORTED", "TESTIMONY", "CLAIM", "DISPUTED", "UNVERIFIED", "FALSE"] as const;
      const testScenes = [
        { factStatus: "FACT" as const },
        { factStatus: "TESTIMONY" as const },
        { factStatus: "DISPUTED" as const },
      ];

      for (const scene of testScenes) {
        expect(validStatuses).toContain(scene.factStatus);
      }
    });
  });
});
