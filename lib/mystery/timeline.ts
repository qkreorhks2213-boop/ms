/**
 * Real timeline generation implementation.
 * Creates chronological timeline of events from research findings.
 */

import type { ResearchFinding, TimelineEvent, FactStatus, SourceRef } from "./types";

/**
 * Parse dates from research findings and extract timeline events.
 */
export function generateTimeline(findings: ResearchFinding[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const eventMap = new Map<string, TimelineEvent>();

  for (const finding of findings) {
    // Extract date information from the summary
    const dateMatch = finding.summary.match(
      /(\d{4}[-\/]\d{1,2}[-\/]\d{1,2}|\d{4}[-\/]\d{1,2}|\d{4})/
    );
    if (!dateMatch) continue;

    const dateStr = dateMatch[1];
    const eventId = `timeline-${dateStr}-${events.length}`;

    // Determine fact status based on sources
    const status = determineEventStatus(finding.sources);

    // Extract key event title from summary
    const title = extractEventTitle(finding.summary);
    if (!title) continue;

    // Create event
    const event: TimelineEvent = {
      id: eventId,
      date: dateStr,
      title,
      description: finding.summary,
      sources: finding.sources,
      status,
    };

    // Group by date to avoid duplicates
    const key = dateStr;
    if (!eventMap.has(key)) {
      eventMap.set(key, event);
    }
  }

  // Convert to array and sort by date
  const timelineEvents = Array.from(eventMap.values());
  return sortTimelineEvents(timelineEvents);
}

/**
 * Determine fact status for a timeline event based on its sources.
 */
function determineEventStatus(sources: SourceRef[]): FactStatus {
  const officialCount = sources.filter(
    (s) => s.sourceType === "official" || s.sourceType === "court" || s.sourceType === "military"
  ).length;
  const reliableCount = sources.filter((s) => s.reliability !== "low").length;

  if (officialCount >= 2) return "FACT";
  if (officialCount >= 1 && reliableCount >= 2) return "SUPPORTED";
  if (reliableCount >= 3) return "SUPPORTED";
  if (sources.some((s) => s.sourceType === "interview") && officialCount === 0) return "TESTIMONY";
  if (sources.filter((s) => s.reliability === "disputed").length > 0) return "DISPUTED";
  if (sources.length === 0) return "UNVERIFIED";
  return "CLAIM";
}

/**
 * Extract a meaningful event title from research summary.
 */
function extractEventTitle(summary: string): string | null {
  // Remove date patterns
  const cleaned = summary
    .replace(/\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/g, "")
    .replace(/\d{4}[-\/]\d{1,2}/g, "")
    .trim();

  // Take first sentence (up to period or 80 chars)
  const match = cleaned.match(/^([^.!?]{10,80})/);
  if (match) {
    return match[1].trim();
  }

  // Fall back to first 60 chars
  if (cleaned.length >= 10) {
    return cleaned.substring(0, 60).trim();
  }

  return null;
}

/**
 * Sort timeline events chronologically.
 */
function sortTimelineEvents(events: TimelineEvent[]): TimelineEvent[] {
  return events.sort((a, b) => {
    const dateA = parseDate(a.date);
    const dateB = parseDate(b.date);
    return dateA.getTime() - dateB.getTime();
  });
}

/**
 * Parse various date formats to Date object.
 */
function parseDate(dateStr: string): Date {
  // Try ISO format YYYY-MM-DD
  if (dateStr.includes("-")) {
    const parts = dateStr.split("-").map(Number);
    if (parts.length === 3) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    } else if (parts.length === 2) {
      return new Date(parts[0], parts[1] - 1, 1);
    } else if (parts.length === 1) {
      return new Date(parts[0], 0, 1);
    }
  }

  // Try slash format YYYY/MM/DD
  if (dateStr.includes("/")) {
    const parts = dateStr.split("/").map(Number);
    if (parts.length === 3) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    } else if (parts.length === 2) {
      return new Date(parts[0], parts[1] - 1, 1);
    } else if (parts.length === 1) {
      return new Date(parts[0], 0, 1);
    }
  }

  // Try just year
  const year = parseInt(dateStr);
  if (!isNaN(year)) {
    return new Date(year, 0, 1);
  }

  return new Date();
}
