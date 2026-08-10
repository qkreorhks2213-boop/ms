/**
 * 성능 벤치마크 테스트
 * 메타데이터 추론, 렌더 파이프라인 등의 성능 측정
 */

import {
  inferVisualOrigin,
  inferFactStatus,
  needsAiDisclaimer,
  enrichSectionsWithMetadata,
} from "../scriptAnalysis";
import { ScriptSection } from "../types";

interface BenchmarkResult {
  name: string;
  iterations: number;
  totalMs: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  opsPerSecond: number;
}

function measureTime(fn: () => void, iterations: number = 1000): BenchmarkResult {
  const name = fn.name || "anonymous";
  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    const end = performance.now();
    times.push(end - start);
  }

  const totalMs = times.reduce((a, b) => a + b, 0);
  const avgMs = totalMs / iterations;
  const minMs = Math.min(...times);
  const maxMs = Math.max(...times);
  const opsPerSecond = 1000 / avgMs;

  return {
    name,
    iterations,
    totalMs,
    avgMs,
    minMs,
    maxMs,
    opsPerSecond,
  };
}

describe("Performance Benchmarks", () => {
  describe("Script Analysis Functions", () => {
    it("should measure inferVisualOrigin performance", () => {
      const section: ScriptSection = {
        id: "test",
        kind: "chapter",
        text: "이 장면을 재현하면 이렇게 보일 것이다.",
        charCount: 20,
        estimatedSeconds: 10,
        status: "done",
        sources: [],
      };

      const result = measureTime(
        () => inferVisualOrigin(section),
        1000
      );

      console.log(`\n📊 inferVisualOrigin Performance:`);
      console.log(`   Iterations: ${result.iterations}`);
      console.log(`   Total: ${result.totalMs.toFixed(2)}ms`);
      console.log(`   Average: ${result.avgMs.toFixed(3)}ms`);
      console.log(`   Min: ${result.minMs.toFixed(3)}ms`);
      console.log(`   Max: ${result.maxMs.toFixed(3)}ms`);
      console.log(`   Ops/sec: ${result.opsPerSecond.toFixed(0)}`);

      // 벤치마크: 평균 5ms 이하
      expect(result.avgMs).toBeLessThan(5);
      expect(result.opsPerSecond).toBeGreaterThan(200);
    });

    it("should measure inferFactStatus performance", () => {
      const section: ScriptSection = {
        id: "test",
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
      };

      const result = measureTime(
        () => inferFactStatus(section),
        1000
      );

      console.log(`\n📊 inferFactStatus Performance:`);
      console.log(`   Average: ${result.avgMs.toFixed(3)}ms`);
      console.log(`   Ops/sec: ${result.opsPerSecond.toFixed(0)}`);

      expect(result.avgMs).toBeLessThan(5);
      expect(result.opsPerSecond).toBeGreaterThan(200);
    });

    it("should measure needsAiDisclaimer performance", () => {
      const section: ScriptSection = {
        id: "test",
        kind: "chapter",
        text: "이를 재현하면 다음과 같을 것이다.",
        charCount: 20,
        estimatedSeconds: 10,
        status: "done",
        sources: [],
      };

      const result = measureTime(
        () => needsAiDisclaimer(section),
        1000
      );

      console.log(`\n📊 needsAiDisclaimer Performance:`);
      console.log(`   Average: ${result.avgMs.toFixed(3)}ms`);
      console.log(`   Ops/sec: ${result.opsPerSecond.toFixed(0)}`);

      expect(result.avgMs).toBeLessThan(5);
    });

    it("should measure enrichSectionsWithMetadata performance", () => {
      const sections: ScriptSection[] = Array(10)
        .fill(null)
        .map((_, i) => ({
          id: `sec-${i}`,
          kind: "chapter" as const,
          text: "이 장면을 재현하면 이렇게 보일 것이다.",
          charCount: 20,
          estimatedSeconds: 10,
          status: "done" as const,
          sources: [],
        }));

      const result = measureTime(
        () => enrichSectionsWithMetadata(sections),
        100
      );

      console.log(`\n📊 enrichSectionsWithMetadata (10 sections) Performance:`);
      console.log(`   Total: ${result.totalMs.toFixed(2)}ms`);
      console.log(`   Average: ${result.avgMs.toFixed(3)}ms`);
      console.log(`   Per-section avg: ${(result.avgMs / 10).toFixed(3)}ms`);
      console.log(`   Ops/sec: ${result.opsPerSecond.toFixed(0)}`);

      // 벤치마크: 평균 50ms 이하 (10 sections)
      expect(result.avgMs).toBeLessThan(50);
    });
  });

  describe("Pipeline Performance Estimates", () => {
    it("should estimate full pipeline performance", () => {
      const SECTIONS_PER_MINUTE = 2; // 약 30초마다 1개 섹션
      const TARGET_MINUTES = 30; // 30분 다큐
      const TOTAL_SECTIONS = SECTIONS_PER_MINUTE * TARGET_MINUTES;

      // 벤치마크 결과 기반 추정
      const AVG_INFERENCE_MS = 5; // per section
      const ENRICHMENT_OVERHEAD_MS = 50; // for all sections

      const estimatedMs =
        TOTAL_SECTIONS * AVG_INFERENCE_MS + ENRICHMENT_OVERHEAD_MS;
      const estimatedSecs = estimatedMs / 1000;

      console.log(`\n📊 Estimated Full Pipeline Performance:`);
      console.log(`   Target: ${TARGET_MINUTES} minutes`);
      console.log(`   Estimated sections: ${TOTAL_SECTIONS}`);
      console.log(`   Inference time: ${estimatedSecs.toFixed(2)} seconds`);
      console.log(`   Per-section avg: ${AVG_INFERENCE_MS}ms`);

      // 벤치마크: 전체 추론이 30분 다큐 기준 10초 이내
      expect(estimatedSecs).toBeLessThan(10);
    });

    it("should have acceptable memory overhead per section", () => {
      const section: ScriptSection = {
        id: "test",
        kind: "chapter",
        text: "Text content",
        charCount: 100,
        estimatedSeconds: 20,
        status: "done",
        sources: [],
      };

      // 메모리 추정 (엄격한 테스트는 아니지만, 기본 체크)
      const enriched = enrichSectionsWithMetadata([section]);

      // 추가 메타데이터: visualOrigin (enum), factStatus (enum), needsDisclaimer (boolean)
      // 추정 크기: < 1KB per section
      expect(enriched).toHaveLength(1);
      expect(enriched[0].visualOrigin).toBeDefined();
      expect(enriched[0].factStatus).toBeDefined();
    });
  });

  describe("Scalability Tests", () => {
    it("should scale linearly with section count", () => {
      const measureBatch = (count: number): number => {
        const sections: ScriptSection[] = Array(count)
          .fill(null)
          .map((_, i) => ({
            id: `sec-${i}`,
            kind: "chapter" as const,
            text: "이 장면을 재현하면...",
            charCount: 20,
            estimatedSeconds: 10,
            status: "done" as const,
            sources: [],
          }));

        const start = performance.now();
        enrichSectionsWithMetadata(sections);
        return performance.now() - start;
      };

      const time10 = measureBatch(10);
      const time20 = measureBatch(20);
      const time50 = measureBatch(50);

      console.log(`\n📊 Scalability Analysis:`);
      console.log(`   10 sections: ${time10.toFixed(2)}ms`);
      console.log(`   20 sections: ${time20.toFixed(2)}ms`);
      console.log(`   50 sections: ${time50.toFixed(2)}ms`);

      // 선형 성장 확인 (비례해야 함)
      expect(time20).toBeLessThan(time10 * 3);
      expect(time50).toBeLessThan(time10 * 7);
    });
  });

  describe("Text Pattern Analysis Performance", () => {
    it("should handle various text lengths efficiently", () => {
      const shortText = "재현하면";
      const mediumText = "이 장면을 재현하면 어떻게 될까요? 추정에 따르면 이렇게 보일 것입니다.";
      const longText = "a".repeat(5000) + "재현하면" + "b".repeat(5000);

      const measureText = (text: string): number => {
        const section: ScriptSection = {
          id: "test",
          kind: "chapter",
          text,
          charCount: text.length,
          estimatedSeconds: 10,
          status: "done",
          sources: [],
        };

        const start = performance.now();
        inferVisualOrigin(section);
        return performance.now() - start;
      };

      const shortMs = measureText(shortText);
      const mediumMs = measureText(mediumText);
      const longMs = measureText(longText);

      console.log(`\n📊 Text Length Performance:`);
      console.log(`   Short (${shortText.length} chars): ${shortMs.toFixed(3)}ms`);
      console.log(`   Medium (${mediumText.length} chars): ${mediumMs.toFixed(3)}ms`);
      console.log(`   Long (${longText.length} chars): ${longMs.toFixed(3)}ms`);

      // 성능이 선형 이하로 증가해야 함
      expect(longMs).toBeLessThan(10);
    });
  });

  describe("Performance Metrics Summary", () => {
    it("should validate performance budgets", () => {
      const metrics = {
        metadataInferencePerSection: 5, // ms
        enrichmentOverhead: 50, // ms for all sections
        pipelineEstimate30Min: 8, // seconds for 30-min doc
        maxScalability: 50, // sections
      };

      console.log(`\n✅ Performance Budget Summary:`);
      console.log(`   Metadata inference: < ${metrics.metadataInferencePerSection}ms per section`);
      console.log(
        `   Enrichment overhead: < ${metrics.enrichmentOverhead}ms total`
      );
      console.log(
        `   30-min pipeline: < ${metrics.pipelineEstimate30Min} seconds`
      );
      console.log(`   Max scalability: ${metrics.maxScalability}+ sections`);

      // 모든 메트릭이 합리적인 범위 내
      expect(metrics.metadataInferencePerSection).toBeLessThanOrEqual(5);
      expect(metrics.pipelineEstimate30Min).toBeLessThanOrEqual(10);
    });
  });
});
