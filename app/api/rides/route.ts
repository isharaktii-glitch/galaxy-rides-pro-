File: "app/api/rides/route.ts"

import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RideBody = {
  driverId?: unknown;
  start?: unknown;
  end?: unknown;
  startLat?: unknown;
  startLng?: unknown;
  endLat?: unknown;
  endLng?: unknown;
  fare?: unknown;
};

function coordinate(
  value: unknown,
  min: number,
  max: number
): number | null | undefined {
  // Missing coordinates are allowed for rides without map coordinates.
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  if (value < min || value > max) {
    return undefined;
  }

  return value;
}

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
      ORDER BY
        CASE WHEN r.status = 'IN PROGRESS' THEN 0 ELSE 1 END,
        r.created_at DESC
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
    let body: RideBody;

    try {
      body = (await request.json()) as RideBody;
    } catch {
      return NextResponse.json(
        { error: "Request body must contain valid JSON." },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const driverId = Number(body.driverId);
    const start =
      typeof body.start === "string" ? body.start.trim() : "";
    const end =
      typeof body.end === "string" ? body.end.trim() : "";

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

    const startLat = coordinate(body.startLat, -90, 90);
    const startLng = coordinate(body.startLng, -180, 180);
    const endLat = coordinate(body.endLat, -90, 90);
    const endLng = coordinate(body.endLng, -180, 180);

    if (
      startLat === undefined ||
      startLng === undefined ||
      endLat === undefined ||
      endLng === undefined
    ) {
      return NextResponse.json(
        { error: "Invalid coordinates." },
        { status: 400 }
      );
    }

    const fare =
      body.fare === null || body.fare === undefined
        ? null
        : typeof body.fare === "number" &&
            Number.isFinite(body.fare) &&
            body.fare >= 0 &&
            body.fare <= 10_000_000
          ? body.fare
          : undefined;

    if (fare === undefined) {
      return NextResponse.json(
        { error: "Invalid fare." },
        { status: 400 }
      );
    }

    const sql = getDatabase();

    // Confirm that the referenced account exists and is a driver.
    // This is not a substitute for authenticating the requesting user.
    const owners = await sql`
      SELECT id
      FROM users
      WHERE id = ${driverId}
        AND role = 'Driver'
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
        start_lat AS "startLat",
        start_lng AS "startLng",
        end_lat AS "endLat",
        end_lng AS "endLng",
        fare_lkr AS fare,
        status,
        created_at AS "createdAt"
    `;

    return NextResponse.json(
      { ride: created[0] },
      { status: 201 }
    );
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
