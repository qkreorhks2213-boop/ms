import { NextRequest, NextResponse } from "next/server";
import { checkAllServices, generateServiceReport } from "@/lib/mystery/api-check";

export async function GET(req: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  try {
    const results = await checkAllServices();

    return NextResponse.json({
      status: "success",
      timestamp: new Date().toISOString(),
      services: results.map((r) => ({
        name: r.name,
        status: r.status,
        available: r.available,
        message: r.message,
      })),
      report: generateServiceReport(results),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Service check failed" },
      { status: 500 }
    );
  }
}
