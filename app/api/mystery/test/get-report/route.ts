import { NextRequest, NextResponse } from "next/server";
import { readProject } from "@/lib/mystery/store";
import { generateStatusReport, formatStatusReportMarkdown } from "@/lib/mystery/status-report";
import { checkAllServices } from "@/lib/mystery/api-check";

export async function GET(req: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const project = readProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Check API availability
    const services = await checkAllServices();
    const apiStatus = {
      ffmpeg: services[0].available,
      piper: services[1].available,
      ollama: services[2].available,
    };

    // Generate status report
    const report = generateStatusReport(project, apiStatus);
    const markdown = formatStatusReportMarkdown(report);

    return NextResponse.json({
      status: "success",
      projectId,
      projectName: project.name,
      report,
      markdown,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Report generation failed" },
      { status: 500 }
    );
  }
}
