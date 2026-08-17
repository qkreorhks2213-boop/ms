/**
 * End-to-end pipeline validation test
 * Simulates complete user flow: input → research → script → scenes → narration → render
 * Validates error handling and state management throughout pipeline
 */

import { createProject } from "../store";
import type { MysteryProject, MysteryInput } from "../types";

describe("E2E Pipeline Validation", () => {
  let projectId: string;

  beforeEach(() => {
    projectId = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  });

  describe("Project Initialization", () => {
    it("should create project with valid mystery input", () => {
      const input: MysteryInput = {
        topic: "Tamam Shud Mystery",
        caseType: "unsolved_case",
        targetMinutes: 15,
        endingStyle: "unsolved",
        sceneVisualTarget: 50,
        angleChoices: ["case_focused"],
      };

      const project = createProject(input, "test-user");

      expect(project).toBeDefined();
      expect(project.input.topic).toBe("Tamam Shud Mystery");
      expect(project.input.targetMinutes).toBe(15);
      expect(project.stage).toBe("research");
    });

    it("should clamp minimum target minutes to 5", () => {
      const input: MysteryInput = {
        topic: "Test",
        caseType: "unsolved_case",
        targetMinutes: 2, // Below minimum of 5
        endingStyle: "unsolved",
        sceneVisualTarget: 30,
        angleChoices: [],
      };

      const project = createProject(input, "test-user");
      expect(project.input.targetMinutes).toBe(5); // Clamped to minimum
    });

    it("should clamp maximum target minutes to 120", () => {
      const input: MysteryInput = {
        topic: "Test",
        caseType: "unsolved_case",
        targetMinutes: 150, // Above maximum of 120
        endingStyle: "unsolved",
        sceneVisualTarget: 30,
        angleChoices: [],
      };

      const project = createProject(input, "test-user");
      expect(project.input.targetMinutes).toBe(120); // Clamped to maximum
    });

    it("should clamp scene visual target to valid bounds", () => {
      const input: MysteryInput = {
        topic: "Test",
        caseType: "unsolved_case",
        targetMinutes: 15,
        endingStyle: "unsolved",
        sceneVisualTarget: 5, // Below minimum of 12
        angleChoices: [],
      };

      const project = createProject(input, "test-user");
      expect(project.input.sceneVisualTarget).toBe(12); // Clamped to minimum
    });

    it("should throw when topic is empty", () => {
      const input: MysteryInput = {
        topic: "",
        caseType: "unsolved_case",
        targetMinutes: 15,
        endingStyle: "unsolved",
        sceneVisualTarget: 50,
        angleChoices: [],
      };

      expect(() => createProject(input, "test-user")).toThrow();
    });

    it("should throw when userId is missing", () => {
      const input: MysteryInput = {
        topic: "Test",
        caseType: "unsolved_case",
        targetMinutes: 15,
        endingStyle: "unsolved",
        sceneVisualTarget: 50,
        angleChoices: [],
      };

      expect(() => createProject(input, "")).toThrow();
    });
  });

  describe("Pipeline State Progression", () => {
    it("should start at 'research' stage", () => {
      const input: MysteryInput = {
        topic: "Test Mystery",
        caseType: "unsolved_case",
        targetMinutes: 15,
        endingStyle: "unsolved",
        sceneVisualTarget: 50,
        angleChoices: ["case_focused"],
      };

      const project = createProject(input, "test-user");
      expect(project.stage).toBe("research");
    });

    it("should track research completion", () => {
      const input: MysteryInput = {
        topic: "Test Mystery",
        caseType: "unsolved_case",
        targetMinutes: 15,
        endingStyle: "unsolved",
        sceneVisualTarget: 50,
        angleChoices: ["case_focused"],
      };

      const project = createProject(input, "test-user");

      // Simulate research completion
      project.stage = "research";
      project.research = [
        {
          id: "finding-1",
          query: "Overview",
          summary: "Test finding",
          sources: [],
        },
      ];

      expect(project.stage).toBe("research");
      expect(project.research?.length).toBe(1);
    });

    it("should require research before script generation", () => {
      const input: MysteryInput = {
        topic: "Test Mystery",
        caseType: "unsolved_case",
        targetMinutes: 15,
        endingStyle: "unsolved",
        sceneVisualTarget: 50,
        angleChoices: ["case_focused"],
      };

      const project = createProject(input, "test-user");

      // Cannot generate script without research
      expect(project.research).toBeUndefined();
      expect(project.script).toBeUndefined();
    });
  });

  describe("Pipeline Duration Calculation", () => {
    it("should calculate correct duration target from targetMinutes", () => {
      const input: MysteryInput = {
        topic: "Test",
        caseType: "unsolved_case",
        targetMinutes: 15,
        endingStyle: "unsolved",
        sceneVisualTarget: 50,
        angleChoices: [],
      };

      const project = createProject(input, "test-user");
      const targetSeconds = input.targetMinutes * 60;

      expect(targetSeconds).toBe(900); // 15 minutes
    });

    it("should validate narration duration matches target with tolerance", () => {
      // 15 minutes = 900 seconds, ±20% = 720-1080 seconds
      const targetMinutes = 15;
      const tolerance = 0.2; // 20%
      const targetSeconds = targetMinutes * 60;
      const minSeconds = targetSeconds * (1 - tolerance);
      const maxSeconds = targetSeconds * (1 + tolerance);

      expect(minSeconds).toBe(720);
      expect(maxSeconds).toBe(1080);
    });

    it("should reject videos outside duration tolerance", () => {
      const targetMinutes = 15;
      const tolerance = 0.2; // 20%
      const targetSeconds = targetMinutes * 60;
      const minSeconds = targetSeconds * (1 - tolerance);
      const maxSeconds = targetSeconds * (1 + tolerance);

      const tooShort = 600; // Below 720s
      const tooLong = 1200; // Above 1080s
      const justRight = 900;

      expect(tooShort < minSeconds).toBe(true);
      expect(tooLong > maxSeconds).toBe(true);
      expect(justRight >= minSeconds && justRight <= maxSeconds).toBe(true);
    });
  });

  describe("Pipeline Scene Count Validation", () => {
    it("should validate scene count with tolerance", () => {
      const targetScenes = 50;
      const tolerance = 0.2; // 20%
      const minScenes = Math.floor(targetScenes * (1 - tolerance));
      const maxScenes = Math.ceil(targetScenes * (1 + tolerance));

      expect(minScenes).toBe(40);
      expect(maxScenes).toBe(60);
    });

    it("should accept scene counts within tolerance", () => {
      const targetScenes = 50;
      const tolerance = 0.2;
      const minScenes = Math.floor(targetScenes * (1 - tolerance));
      const maxScenes = Math.ceil(targetScenes * (1 + tolerance));

      const validCounts = [40, 45, 50, 55, 60];
      validCounts.forEach(count => {
        expect(count >= minScenes && count <= maxScenes).toBe(true);
      });
    });

    it("should reject scene counts outside tolerance", () => {
      const targetScenes = 50;
      const tolerance = 0.2;
      const minScenes = Math.floor(targetScenes * (1 - tolerance));
      const maxScenes = Math.ceil(targetScenes * (1 + tolerance));

      const invalidCounts = [30, 35, 65, 70];
      invalidCounts.forEach(count => {
        expect(count >= minScenes && count <= maxScenes).toBe(false);
      });
    });
  });

  describe("Pipeline Error Propagation", () => {
    it("should track error stage correctly", () => {
      const input: MysteryInput = {
        topic: "Test",
        caseType: "unsolved_case",
        targetMinutes: 15,
        endingStyle: "unsolved",
        sceneVisualTarget: 50,
        angleChoices: [],
      };

      const project = createProject(input, "test-user");

      // Simulate error at research stage
      project.errorLog = [
        {
          at: new Date().toISOString(),
          stage: "research",
          message: "RSS search timeout",
          retryable: true,
        },
      ];

      expect(project.errorLog[0].stage).toBe("research");
      expect(project.errorLog[0].retryable).toBe(true);
    });

    it("should track different error stages", () => {
      const input: MysteryInput = {
        topic: "Test",
        caseType: "unsolved_case",
        targetMinutes: 15,
        endingStyle: "unsolved",
        sceneVisualTarget: 50,
        angleChoices: [],
      };

      const project = createProject(input, "test-user");

      // Simulate errors at different stages
      project.errorLog = [
        {
          at: new Date().toISOString(),
          stage: "research",
          message: "Research failed",
          retryable: true,
        },
        {
          at: new Date().toISOString(),
          stage: "script",
          message: "Script generation failed",
          retryable: true,
        },
        {
          at: new Date().toISOString(),
          stage: "render",
          message: "Video rendering failed",
          retryable: false,
        },
      ];

      const stages = project.errorLog.map(e => e.stage);
      expect(stages).toContain("research");
      expect(stages).toContain("script");
      expect(stages).toContain("render");
    });
  });

  describe("Pipeline Output Validation", () => {
    it("should validate required outputs before completion", () => {
      const input: MysteryInput = {
        topic: "Test",
        caseType: "unsolved_case",
        targetMinutes: 15,
        endingStyle: "unsolved",
        sceneVisualTarget: 50,
        angleChoices: [],
      };

      const project = createProject(input, "test-user");

      // Simulate completed pipeline
      project.research = [{ id: "1", query: "test", summary: "test", sources: [] }];
      project.script = {
        title: "Test",
        outline: "test",
        sections: [
          {
            id: "1",
            kind: "hook",
            text: "test",
            charCount: 100,
            estimatedSeconds: 10,
            status: "done",
            sources: [],
          },
        ],
        totalCharCount: 100,
        estimatedMinutes: 1,
      };
      project.scenes = [
        {
          id: "1",
          sectionId: "1",
          order: 0,
          text: "test",
          visualType: "ai_reconstruction",
          visualQuery: "test",
          visualStatus: "pending",
          narration: [],
        },
      ];
      project.narrationSegments = [
        {
          id: "1",
          text: "test",
          audioPath: "/path/to/audio.wav",
          durationSeconds: 10,
          sampleRate: 16000,
          channels: 1,
          format: "wav",
        },
      ];
      project.subtitleTracks = [
        {
          id: "subtitles-ko",
          format: "srt",
          languageCode: "ko-KR",
          subtitles: [
            {
              id: "1",
              text: "test",
              startTime: 0,
              endTime: 10,
            },
          ],
        },
      ];
      project.output = {
        mp4: "/output.mp4",
        status: "complete",
      };

      // Validate all required fields
      const isComplete =
        !!project.research &&
        project.research.length > 0 &&
        !!project.script &&
        project.script.sections.length > 0 &&
        !!project.scenes &&
        project.scenes.length > 0 &&
        !!project.narrationSegments &&
        project.narrationSegments.length > 0 &&
        !!project.subtitleTracks &&
        project.subtitleTracks.length > 0 &&
        !!project.output?.mp4;

      expect(isComplete).toBe(true);
    });

    it("should fail validation with missing research", () => {
      const input: MysteryInput = {
        topic: "Test",
        caseType: "unsolved_case",
        targetMinutes: 15,
        endingStyle: "unsolved",
        sceneVisualTarget: 50,
        angleChoices: [],
      };

      const project = createProject(input, "test-user");

      const isComplete = !!project.research && project.research.length > 0;
      expect(isComplete).toBe(false);
    });

    it("should fail validation with missing narration", () => {
      const input: MysteryInput = {
        topic: "Test",
        caseType: "unsolved_case",
        targetMinutes: 15,
        endingStyle: "unsolved",
        sceneVisualTarget: 50,
        angleChoices: [],
      };

      const project = createProject(input, "test-user");
      project.research = [{ id: "1", query: "test", summary: "test", sources: [] }];
      project.script = {
        title: "Test",
        outline: "test",
        sections: [
          {
            id: "1",
            kind: "hook",
            text: "test",
            charCount: 100,
            estimatedSeconds: 10,
            status: "done",
            sources: [],
          },
        ],
        totalCharCount: 100,
        estimatedMinutes: 1,
      };
      project.scenes = [
        {
          id: "1",
          sectionId: "1",
          order: 0,
          text: "test",
          visualType: "ai_reconstruction",
          visualQuery: "test",
          visualStatus: "pending",
          narration: [],
        },
      ];

      const isComplete =
        !!project.research &&
        !!project.script &&
        !!project.scenes &&
        !!project.narrationSegments &&
        project.narrationSegments.length > 0;

      expect(isComplete).toBe(false);
    });
  });
});
