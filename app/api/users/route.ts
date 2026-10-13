
import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const data = body as Record<string, unknown>;
    const name = typeof data.name === "string" ? data.name.trim() : "";
    const phone = typeof data.phone === "string"
      ? data.phone.replace(/[^\d+]/g, "")
      : "";
    const role = data.role;
    const vehicle = typeof data.vehicle === "string"
      ? data.vehicle.trim().toUpperCase()
      : "";

    if (name.length < 2 || name.length > 100) {
      return NextResponse.json({ error: "Enter a valid name." }, { status: 400 });
    }

    if (!/^\+?\d{9,15}$/.test(phone)) {
      return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
    }

    if (role !== "Driver" && role !== "Passenger") {
      return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    }

    if (role === "Driver" && (vehicle.length < 3 || vehicle.length > 30)) {
      return NextResponse.json(
        { error: "Enter a valid vehicle registration." },
        { status: 400 }
      );
    }

    const sql = getDatabase();

    const result = await sql`
      INSERT INTO users (
        full_name,
        phone,
        role,
        vehicle_registration
      )
      VALUES (
        ${name},
        ${phone},
        ${role},
        ${role === "Driver" ? vehicle : null}
      )
      ON CONFLICT (phone) DO NOTHING
      RETURNING id, full_name AS name, phone, role, kyc_status AS "kycStatus"
    `;

    if (!result.length) {
      return NextResponse.json(
        { error: "This phone number is already registered." },
        { status: 409 }
      );
    }

    return NextResponse.json({ user: result[0] }, { status: 201 });
  } catch (error) {
    console.error(
      "Registration failed:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return NextResponse.json(
      { error: "Unable to register user." },
      { status: 503 }
    );
  }
}
