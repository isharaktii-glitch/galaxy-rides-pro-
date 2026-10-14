import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

const VALID_REQUEST_STATUSES = ["PENDING", "ACCEPTED", "DECLINED", "CANCELLED"];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rideId = Number(body.rideId);
    const passengerId = Number(body.passengerId);
    const sql = getDatabase();

    if (!Number.isSafeInteger(rideId) || rideId <= 0 ||
        !Number.isSafeInteger(passengerId) || passengerId <= 0) {
      return NextResponse.json(
        { error: "Valid rideId and passengerId are required." },
        { status: 400 }
      );
    }

    const passengers = await sql`
      SELECT id FROM users
      WHERE id = ${passengerId} AND role = 'Passenger'
      LIMIT 1
    `;
    if (!passengers.length) {
      return NextResponse.json(
        { error: "Passenger account not found." },
        { status: 404 }
      );
    }

    const rides = await sql`
      SELECT id, driver_id, status
      FROM rides
      WHERE id = ${rideId}
      LIMIT 1
    `;
    if (!rides.length) {
      return NextResponse.json({ error: "Ride not found." }, { status: 404 });
    }

    const ride = rides[0];

    if (String(ride.driver_id) === String(passengerId)) {
      return NextResponse.json(
        { error: "You cannot request your own ride." },
        { status: 400 }
      );
    }

    if (!["SCHEDULED", "IN PROGRESS"].includes(String(ride.status).toUpperCase())) {
      return NextResponse.json(
        { error: "This ride is not accepting pickup requests." },
        { status: 409 }
      );
    }

    const inserted = await sql`
      INSERT INTO pickup_requests (ride_id, passenger_id, status, created_at)
      VALUES (${rideId}, ${passengerId}, 'PENDING', NOW())
      ON CONFLICT (ride_id, passenger_id) DO NOTHING
      RETURNING id, ride_id AS "rideId", passenger_id AS "passengerId",
                status, created_at AS "createdAt"
    `;

    if (!inserted.length) {
      return NextResponse.json(
        { error: "You have already requested this ride." },
        { status: 409 }
      );
    }

    return NextResponse.json({ ok: true, request: inserted[0] }, { status: 201 });
  } catch (error) {
    console.error("POST /api/pickup-requests:", error);
    return NextResponse.json(
      { error: "Could not create pickup request. Check the server logs." },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const driverId = Number(request.nextUrl.searchParams.get("driverId"));
    if (!Number.isSafeInteger(driverId) || driverId <= 0) {
      return NextResponse.json({ error: "Valid driverId is required." }, { status: 400 });
    }

    const sql = getDatabase();
    const drivers = await sql`
      SELECT id FROM users WHERE id = ${driverId} AND role = 'Driver' LIMIT 1
    `;
    if (!drivers.length) {
      return NextResponse.json({ error: "Driver account not found." }, { status: 404 });
    }

    const requests = await sql`
      SELECT
        pr.id,
        pr.ride_id AS "rideId",
        pr.passenger_id AS "passengerId",
        pr.status,
        pr.created_at AS "createdAt",
        passenger.full_name AS "passengerName",
        passenger.phone AS "passengerPhone",
        r.start_location AS "startLocation",
        r.end_location AS "endLocation",
        r.fare_lkr AS "fareLkr"
      FROM pickup_requests pr
      JOIN rides r ON r.id = pr.ride_id
      JOIN users passenger ON passenger.id = pr.passenger_id
      WHERE r.driver_id = ${driverId}
      ORDER BY pr.created_at DESC
    `;

    return NextResponse.json({ ok: true, requests });
  } catch (error) {
    console.error("GET /api/pickup-requests:", error);
    return NextResponse.json(
      { error: "Could not load pickup requests." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const requestId = Number(body.requestId);
    const driverId = Number(body.driverId);
    const action = String(body.action || "").toUpperCase();

    if (!Number.isSafeInteger(requestId) || requestId <= 0 ||
        !Number.isSafeInteger(driverId) || driverId <= 0) {
      return NextResponse.json(
        { error: "Valid requestId and driverId are required." },
        { status: 400 }
      );
    }

    if (!["ACCEPTED", "DECLINED"].includes(action)) {
      return NextResponse.json(
        { error: "Action must be ACCEPTED or DECLINED." },
        { status: 400 }
      );
    }

    const sql = getDatabase();
    const drivers = await sql`
      SELECT id FROM users WHERE id = ${driverId} AND role = 'Driver' LIMIT 1
    `;
    if (!drivers.length) {
      return NextResponse.json({ error: "Driver account not found." }, { status: 404 });
    }

    const updated = await sql`
      UPDATE pickup_requests AS pr
      SET status = ${action}
      FROM rides AS r
      WHERE pr.id = ${requestId}
        AND pr.ride_id = r.id
        AND r.driver_id = ${driverId}
        AND pr.status = 'PENDING'
      RETURNING pr.id, pr.status
    `;

    if (!updated.length) {
      return NextResponse.json(
        { error: "Request not found, not owned by this driver, or already processed." },
        { status: 409 }
      );
    }

    return NextResponse.json({ ok: true, request: updated[0] });
  } catch (error) {
    console.error("PATCH /api/pickup-requests:", error);
    return NextResponse.json(
      { error: "Could not update pickup request." },
      { status: 500 }
    );
  }
}
