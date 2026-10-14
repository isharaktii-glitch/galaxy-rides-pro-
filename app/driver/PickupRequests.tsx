"use client";

import { useCallback, useEffect, useState } from "react";

type PickupRequest = {
  id: number | string;
  rideId: number | string;
  passengerId: number | string;
  status: string;
  createdAt?: string;
  passengerName: string;
  passengerPhone: string;
  startLocation: string;
  endLocation: string;
  fareLkr: number | string | null;
};

type Props = {
  driverId: string;
};

export default function PickupRequests({ driverId }: Props) {
  const [requests, setRequests] = useState<PickupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const loadRequests = useCallback(async () => {
    if (!driverId || !/^[1-9]\d*$/.test(driverId)) {
      setRequests([]);
      setLoading(false);
      setMessage("Valid driver account එකක් අවශ්‍යයි.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `/api/pickup-requests?driverId=${encodeURIComponent(driverId)}`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Requests ලබාගැනීමට නොහැකි වුණා.");
      }

      setRequests(Array.isArray(data.requests) ? data.requests : []);
      setMessage("");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Requests ලබාගැනීම අසාර්ථකයි."
      );
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests, refreshKey]);

  async function updateRequest(
    requestId: string | number,
    action: "ACCEPTED" | "REJECTED"
  ) {
    const id = String(requestId);

    if (busyId) return;

    setBusyId(id);
    setMessage("");

    try {
      const response = await fetch("/api/pickup-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: id,
          driverId,
          action,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Pickup request එක update කිරීමට නොහැකි වුණා."
        );
      }

      setRequests((previous) =>
        previous.map((item) =>
          String(item.id) === id
            ? { ...item, status: data.request?.status || action }
            : item
        )
      );

      setMessage(
        action === "ACCEPTED"
          ? "Pickup request එක accept කළා."
          : "Pickup request එක reject කළා."
      );

      setRefreshKey((value) => value + 1);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Request update කිරීම අසාර්ථකයි."
      );
    } finally {
      setBusyId(null);
    }
  }

  function whatsappLink(phone: string) {
    let digits = phone.replace(/\D/g, "");

    if (digits.startsWith("0")) {
      digits = "94" + digits.slice(1);
    } else if (digits.startsWith("94")) {
      // Already in Sri Lankan international format.
    }

    return digits ? `https://wa.me/${digits}` : "";
  }

  return (
    <section
      style={{
        marginTop: 24,
        padding: 20,
        borderRadius: 20,
        border: "1px solid rgba(125, 211, 252, 0.25)",
        background: "rgba(15, 23, 42, 0.72)",
        color: "#e2e8f0",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
            Pickup Requests
          </h2>
          <p style={{ fontSize: 13, opacity: 0.75, marginTop: 6 }}>
            ඔබේ rides සඳහා ලැබුණු passenger ඉල්ලීම්
          </p>
        </div>

        <button
          type="button"
          onClick={() => setRefreshKey((value) => value + 1)}
          disabled={loading}
          style={{
            padding: "9px 14px",
            borderRadius: 10,
            border: "1px solid rgba(125, 211, 252, 0.35)",
            background: "#0f2942",
            color: "#bae6fd",
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {message && (
        <p
          role="status"
          style={{
            marginTop: 14,
            padding: 10,
            borderRadius: 10,
            background: "rgba(14, 165, 233, 0.10)",
            overflowWrap: "anywhere",
          }}
        >
          {message}
        </p>
      )}

      {loading && requests.length === 0 ? (
        <p style={{ marginTop: 18 }}>Requests load වෙමින් පවතී...</p>
      ) : requests.length === 0 ? (
        <p style={{ marginTop: 18, opacity: 0.75 }}>
          දැනට pickup requests නැහැ.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
          {requests.map((item) => {
            const id = String(item.id);
            const pending = item.status.toUpperCase() === "PENDING";
            const link = whatsappLink(item.passengerPhone);

            return (
              <article
                key={id}
                style={{
                  padding: 16,
                  borderRadius: 16,
                  border: "1px solid rgba(148, 163, 184, 0.22)",
                  background: "rgba(2, 6, 23, 0.5)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 650 }}>
                    {item.passengerName || "Passenger"}
                  </h3>

                  <span
                    style={{
                      fontSize: 12,
                      padding: "5px 9px",
                      borderRadius: 20,
                      background: pending
                        ? "rgba(234, 179, 8, 0.14)"
                        : "rgba(34, 197, 94, 0.12)",
                      color: pending ? "#fde68a" : "#86efac",
                    }}
                  >
                    {item.status}
                  </span>
                </div>

                <p style={{ marginTop: 12, marginBottom: 6 }}>
                  <strong>From:</strong> {item.startLocation}
                </p>
                <p style={{ marginTop: 0, marginBottom: 6 }}>
                  <strong>To:</strong> {item.endLocation}
                </p>
                <p style={{ marginTop: 0, marginBottom: 6 }}>
                  <strong>Fare:</strong>{" "}
                  {item.fareLkr == null
                    ? "Not specified"
                    : `LKR ${Number(item.fareLkr).toLocaleString("en-LK")}`}
                </p>
                <p style={{ marginTop: 0, opacity: 0.8 }}>
                  <strong>Phone:</strong> {item.passengerPhone}
                </p>

                {link && (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-block",
                      color: "#7dd3fc",
                      marginBottom: 12,
                      textDecoration: "underline",
                    }}
                  >
                    WhatsApp passenger
                  </a>
                )}

                {pending && (
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => void updateRequest(item.id, "ACCEPTED")}
                      style={{
                        padding: "10px 16px",
                        border: 0,
                        borderRadius: 10,
                        background: "#15803d",
                        color: "#fff",
                        cursor: busyId ? "wait" : "pointer",
                        opacity: busyId ? 0.6 : 1,
                      }}
                    >
                      {busyId === id ? "Updating..." : "Accept"}
                    </button>

                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => void updateRequest(item.id, "REJECTED")}
                      style={{
                        padding: "10px 16px",
                        border: "1px solid rgba(248, 113, 113, 0.5)",
                        borderRadius: 10,
                        background: "rgba(127, 29, 29, 0.35)",
                        color: "#fecaca",
                        cursor: busyId ? "wait" : "pointer",
                        opacity: busyId ? 0.6 : 1,
                      }}
                    >
                      Reject
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
