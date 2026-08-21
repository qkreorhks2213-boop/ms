import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { Readable } from "stream";
import { readProject } from "../../../../../../lib/mystery/store";
import { checkOwnership, requireUserId } from "../../../../../../lib/economic/authGuard";

const PROJECT_BASE_DIR = path.join(process.cwd(), "data", "mystery-projects");

/**
 * GET /api/mystery/projects/{id}/output
 * Stream MP4 file with range request support
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;

  try {
    const projectId = params.id;

    // Verify project ownership
    const project = readProject(projectId);
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const ownershipError = checkOwnership(project, auth.userId);
    if (ownershipError) return ownershipError;

    // Find MP4 file
    const mp4Path = path.join(PROJECT_BASE_DIR, projectId, "output.mp4");

    if (!fs.existsSync(mp4Path)) {
      return NextResponse.json(
        { error: "Video file not found" },
        { status: 404 }
      );
    }

    const stats = fs.statSync(mp4Path);
    const fileSize = stats.size;

    // Handle Range requests for seeking
    const range = req.headers.get("range");

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;

      const file = fs.createReadStream(mp4Path, { start, end });
      const webStream = Readable.toWeb(file) as ReadableStream<Uint8Array>;

      return new NextResponse(webStream, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize.toString(),
          "Content-Type": "video/mp4",
          "Content-Disposition": `inline; filename="output.mp4"`,
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // No range request - send full file
    const file = fs.createReadStream(mp4Path);
    const webStream = Readable.toWeb(file) as ReadableStream<Uint8Array>;

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Length": fileSize.toString(),
        "Content-Type": "video/mp4",
        "Content-Disposition": `inline; filename="output.mp4"`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error: any) {
    console.error("[mystery:output]", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
