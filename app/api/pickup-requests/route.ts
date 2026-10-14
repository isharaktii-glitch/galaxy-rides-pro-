import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validId(value: unknown): boolean {
  return (
    (typeof value === "string" || typeof value === "number") &&
    /^[1-9]\d*$/.test(String(value))
  );
}

// POST: Passenger sends a pickup request.
export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const data = body as Record<string, unknown>;
    const rideId = String(data.rideId ?? "");
    const passengerId = String(data.passengerId ?? "");

    if (!validId(rideId) || !validId(passengerId)) {
      return NextResponse.json(
        { error: "A valid rideId and passengerId are required." },
        { status: 400 }
      );
    }

    const sql = getDatabase();

    const passengers = await sql`
      SELECT id
      FROM users
      WHERE id = ${passengerId}
        AND role = 'Passenger'
      LIMIT 1
    `;

    if (passengers.length === 0) {
      return NextResponse.json(
        { error: "Passenger account not found." },
        { status: 404 }
      );
    }

    const rides = await sql`
      SELECT id, driver_id
      FROM rides
      WHERE id = ${rideId}
        AND UPPER(status) IN ('SCHEDULED', 'IN PROGRESS')
      LIMIT 1
    `;

    if (rides.length === 0) {
      return NextResponse.json(
        { error: "Ride not found or no longer available." },
        { status: 404 }
      );
    }

    if (String(rides[0].driver_id) === passengerId) {
      return NextResponse.json(
        { error: "You cannot request your own ride." },
        { status: 400 }
      );
    }

    const inserted = await sql`
      INSERT INTO pickup_requests (
        ride_id,
        passenger_id,
        status,
        created_at
      )
      VALUES (
        ${rideId},
        ${passengerId},
        'PENDING',
        NOW()
      )
      ON CONFLICT (ride_id, passenger_id) DO NOTHING
      RETURNING
        id,
        ride_id AS "rideId",
        passenger_id AS "passengerId",
        status,
        created_at AS "createdAt"
    `;

    if (inserted.length === 0) {
      return NextResponse.json(
        { error: "You have already requested this ride." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { request: inserted[0] },
      {
        status: 201,
        headers: { "Cache-Control": "no-store" }
      }
    );
  } catch (error) {
    console.error("Create pickup request failed:", error);

    return NextResponse.json(
      {
        error:
          "Unable to create pickup request. Check the database status constraints."
      },
      { status: 503 }
    );
  }
}

// GET: Driver retrieves requests for their published rides.
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

    const drivers = await sql`
      SELECT id
      FROM users
      WHERE id = ${driverId}
        AND role = 'Driver'
      LIMIT 1
    `;

    if (drivers.length === 0) {
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
      INNER JOIN rides r ON r.id = pr.ride_id
      INNER JOIN users u ON u.id = pr.passenger_id
      WHERE r.driver_id = ${driverId}
      ORDER BY pr.created_at DESC
      LIMIT 100
    `;

    return NextResponse.json(
      { requests },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" }
      }
    );
  } catch (error) {
    console.error("Load pickup requests failed:", error);

    return NextResponse.json(
      { error: "Unable to load pickup requests." },
      { status: 503 }
    );
  }
}

// PATCH: Driver accepts or rejects a pending pickup request.
export async function PATCH(request: NextRequest) {
  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const data = body as Record<string, unknown>;
    const requestId = String(data.requestId ?? "");
    const driverId = String(data.driverId ?? "");
    const action =
      typeof data.action === "string"
        ? data.action.trim().toUpperCase()
        : "";

    if (
      !validId(requestId) ||
      !validId(driverId) ||
      !["ACCEPTED", "REJECTED"].includes(action)
    ) {
      return NextResponse.json(
        {
          error:
            "Valid IDs and an ACCEPTED or REJECTED action are required."
        },
        { status: 400 }
      );
    }

    const sql = getDatabase();

    const updated = await sql`
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
        pr.status,
        pr.created_at AS "createdAt"
    `;

    if (updated.length === 0) {
      return NextResponse.json(
        {
          error:
            "Request not found, not pending, or not assigned to this driver."
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { request: updated[0] },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" }
      }
    );
  } catch (error) {
    console.error("Update pickup request failed:", error);

    return NextResponse.json(
      {
        error:
          "Unable to update the request. Confirm that the database allows PENDING, ACCEPTED and REJECTED statuses."
      },
      { status: 503 }
    );
  }
}
