import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validId(value: string | null): boolean {
  return !!value && /^[1-9]\d*$/.test(value);
}

// GET: Load pickup requests belonging to a driver's rides.
export async function GET(request: NextRequest) {
  try {
    const driverId = request.nextUrl.searchParams.get("driverId");

    if (!validId(driverId)) {
      return NextResponse.json(
        { error: "A valid driverId is required." },
        { status: 400 }
      );
    }

    const sql = getDatabase();

    const driver = await sql`
      SELECT id
      FROM users
      WHERE id = ${driverId}
        AND role = 'Driver'
      LIMIT 1
    `;

    if (!driver.length) {
      return NextResponse.json(
        { error: "Driver account not found." },
        { status: 404 }
      );
    }

    const requests = await sql`
      SELECT
        pr.id,
        pr.ride_id AS "rideId",
        pr.passenger_id AS "passengerId",
        pr.status,
        pr.created_at AS "createdAt",
        u.full_name AS "passengerName",
        u.phone AS "passengerPhone",
        r.start_location AS "startLocation",
        r.end_location AS "endLocation",
        r.fare_lkr AS "fareLkr"
      FROM pickup_requests pr
      JOIN rides r ON r.id = pr.ride_id
      JOIN users u ON u.id = pr.passenger_id
      WHERE r.driver_id = ${driverId}
      ORDER BY pr.created_at DESC
      LIMIT 100
    `;

    return NextResponse.json({ requests });
  } catch (error) {
    console.error("Load pickup requests failed:", error);

    return NextResponse.json(
      { error: "Unable to load pickup requests." },
      { status: 503 }
    );
  }
}

// PATCH: Accept or reject a pickup request.
export async function PATCH(request: NextRequest) {
  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request." },
        { status: 400 }
      );
    }

    const data = body as Record<string, unknown>;
    const requestId = String(data.requestId ?? "");
    const driverId = String(data.driverId ?? "");
    const action = String(data.action ?? "").toUpperCase();

    if (
      !validId(requestId) ||
      !validId(driverId) ||
      !["ACCEPTED", "REJECTED"].includes(action)
    ) {
      return NextResponse.json(
        { error: "Valid IDs and an ACCEPTED or REJECTED action are required." },
        { status: 400 }
      );
    }

    const sql = getDatabase();

    const result = await sql`
      UPDATE pickup_requests AS pr
      SET status = ${action}
      FROM rides AS r
      WHERE pr.id = ${requestId}
        AND pr.ride_id = r.id
        AND r.driver_id = ${driverId}
        AND UPPER(pr.status) = 'PENDING'
      RETURNING
        pr.id,
        pr.ride_id AS "rideId",
        pr.passenger_id AS "passengerId",
        pr.status
    `;

    if (!result.length) {
      return NextResponse.json(
        {
          error:
            "Request not found, not pending, or not assigned to this driver."
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ request: result[0] });
  } catch (error) {
    console.error("Update pickup request failed:", error);

    return NextResponse.json(
      {
        error:
          "Unable to update the request. Check whether your database allows the ACCEPTED and REJECTED statuses."
      },
      { status: 503 }
    );
  }
}
