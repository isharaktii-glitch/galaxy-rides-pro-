
import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sql = getDatabase();

    const rides = await sql`
      SELECT
        r.id,
        r.driver_id AS "driverId",
        u.full_name AS "driverName",
        u.phone,
        (u.kyc_status = 'verified') AS verified,
        r.start_location AS start,
        r.end_location AS "end",
        r.start_lat AS "startLat",
        r.start_lng AS "startLng",
        r.end_lat AS "endLat",
        r.end_lng AS "endLng",
        r.fare_lkr AS fare,
        r.status,
        r.created_at AS "createdAt"
      FROM rides r
      JOIN users u ON u.id = r.driver_id
      WHERE r.status IN ('SCHEDULED', 'IN PROGRESS')
      ORDER BY r.created_at DESC
      LIMIT 100
    `;

    return NextResponse.json({ rides });
  } catch (error) {
    console.error(
      "Ride listing failed:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return NextResponse.json(
      { error: "Unable to load rides." },
      { status: 503 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const data = body as Record<string, unknown>;
    const driverId = Number(data.driverId);
    const start = typeof data.start === "string" ? data.start.trim() : "";
    const end = typeof data.end === "string" ? data.end.trim() : "";

    if (
      !Number.isSafeInteger(driverId) ||
      driverId <= 0 ||
      !start ||
      !end ||
      start.length > 160 ||
      end.length > 160
    ) {
      return NextResponse.json(
        { error: "Valid driverId, start and end are required." },
        { status: 400 }
      );
    }

    const coordinate = (value: unknown, min: number, max: number) => {
      if (value === null || value === undefined || value === "") return null;
      if (typeof value !== "number" || !Number.isFinite(value)) return NaN;
      return value >= min && value <= max ? value : NaN;
    };

    const startLat = coordinate(data.startLat, -90, 90);
    const startLng = coordinate(data.startLng, -180, 180);
    const endLat = coordinate(data.endLat, -90, 90);
    const endLng = coordinate(data.endLng, -180, 180);

    if ([startLat, startLng, endLat, endLng].some(Number.isNaN)) {
      return NextResponse.json(
        { error: "Invalid coordinates." },
        { status: 400 }
      );
    }

    const fare = data.fare === null || data.fare === undefined
      ? null
      : typeof data.fare === "number" &&
          Number.isFinite(data.fare) &&
          data.fare >= 0 &&
          data.fare <= 10000000
        ? data.fare
        : NaN;

    if (Number.isNaN(fare)) {
      return NextResponse.json({ error: "Invalid fare." }, { status: 400 });
    }

    const sql = getDatabase();

    const owners = await sql`
      SELECT id
      FROM users
      WHERE id = ${driverId} AND role = 'Driver'
      LIMIT 1
    `;

    if (!owners.length) {
      return NextResponse.json(
        { error: "Driver account not found." },
        { status: 404 }
      );
    }

    const created = await sql`
      INSERT INTO rides (
        driver_id,
        start_location,
        end_location,
        start_lat,
        start_lng,
        end_lat,
        end_lng,
        fare_lkr
      )
      VALUES (
        ${driverId},
        ${start},
        ${end},
        ${startLat},
        ${startLng},
        ${endLat},
        ${endLng},
        ${fare}
      )
      RETURNING
        id,
        driver_id AS "driverId",
        start_location AS start,
        end_location AS "end",
        status,
        created_at AS "createdAt"
    `;

    return NextResponse.json({ ride: created[0] }, { status: 201 });
  } catch (error) {
    console.error(
      "Ride creation failed:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return NextResponse.json(
      { error: "Unable to create ride." },
      { status: 503 }
    );
  }
}
