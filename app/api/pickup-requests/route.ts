import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request." },
        { status: 400 }
      );
    }

    const data = body as Record<string, unknown>;
    const rideId = String(data.rideId ?? "");
    const passengerId = String(data.passengerId ?? "");

    if (!/^[1-9]\d*$/.test(rideId) ||
        !/^[1-9]\d*$/.test(passengerId)) {
      return NextResponse.json(
        { error: "Valid ride and passenger IDs are required." },
        { status: 400 }
      );
    }

    const sql = getDatabase();

    const passenger = await sql`
      SELECT id
      FROM users
      WHERE id = ${passengerId}
        AND role = 'Passenger'
      LIMIT 1
    `;

    if (!passenger.length) {
      return NextResponse.json(
        { error: "Passenger account not found." },
        { status: 404 }
      );
    }

    const ride = await sql`
      SELECT id, driver_id
      FROM rides
      WHERE id = ${rideId}
        AND status IN ('SCHEDULED', 'IN PROGRESS')
      LIMIT 1
    `;

    if (!ride.length) {
      return NextResponse.json(
        { error: "This ride is no longer available." },
        { status: 404 }
      );
    }

    const result = await sql`
      INSERT INTO pickup_requests (ride_id, passenger_id, status)
      VALUES (${rideId}, ${passengerId}, 'PENDING')
      ON CONFLICT (ride_id, passenger_id) DO NOTHING
      RETURNING id, ride_id AS "rideId",
                passenger_id AS "passengerId",
                status, created_at AS "createdAt"
    `;

    if (!result.length) {
      return NextResponse.json(
        { error: "You have already requested this ride." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { request: result[0] },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Pickup request failed:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return NextResponse.json(
      { error: "Unable to submit pickup request." },
      { status: 503 }
    );
  }
}
