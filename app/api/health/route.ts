
import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sql = getDatabase();
    const result = await sql`SELECT NOW() AS server_time`;

    return NextResponse.json({
      ok: true,
      database: "connected",
      serverTime: result[0]?.server_time
    });
  } catch (error) {
    console.error(
      "Database health check failed:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return NextResponse.json(
      { ok: false, error: "Database connection failed or is not configured." },
      { status: 503 }
    );
  }
}
