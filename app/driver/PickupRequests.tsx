"use client";

import { useCallback, useEffect, useState } from "react";

type PickupRequest = {
  id: string | number;
  rideId: string | number;
  passengerId: string | number;
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

function getWhatsAppNumber(phone: string): string {
  let digits = phone.replace(/\D/g, "");

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (digits.startsWith("0")) {
    digits = `94${digits.slice(1)}`;
  }

  return digits;
}

export default function PickupRequests({ driverId }: Props) {
  const [requests, setRequests] = useState<PickupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const loadRequests = useCallback(async (manual = false) => {
    if (!driverId) {
      setRequests([]);
      setLoading(false);
      return;
    }

    if (manual) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await fetch(
        `/api/pickup-requests?driverId=${encodeURIComponent(driverId)}`,
        {
          method: "GET",
          cache: "no-store"
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load pickup requests.");
      }

      setRequests(Array.isArray(data.requests) ? data.requests : []);
      setMessage("");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load pickup requests."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [driverId]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const updateRequest = async (
    requestId: string | number,
    action: "ACCEPTED" | "REJECTED"
  ) => {
    const id = String(requestId);
    setUpdatingId(id);
    setMessage("");

    try {
      const response = await fetch("/api/pickup-requests", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          requestId: id,
          driverId,
          action
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not update this request.");
      }

      setRequests((current) =>
        current.map((item) =>
          String(item.id) === id
            ? { ...item, status: action }
            : item
        )
      );

      setMessage(
        action === "ACCEPTED"
          ? "Pickup request accepted."
          : "Pickup request rejected."
      );

      await loadRequests(true);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not update this request."
      );
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <section className="card-surface space-y-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-white">
            📥 Passenger Requests
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Manage requests for your published rides.
          </p>
        </div>

        <button
          type="button"
          className="outline-button rounded-xl px-3 py-2 text-xs font-bold"
          disabled={refreshing || loading}
          onClick={() => void loadRequests(true)}
        >
          {refreshing ? "Loading..." : "↻ Refresh"}
        </button>
      </div>

      {message && (
        <p
          role="status"
          className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-3 text-xs text-cyan-100"
        >
          {message}
        </p>
      )}

      {loading ? (
        <div className="py-6 text-center text-sm text-slate-400">
          Loading pickup requests...
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-xl border border-white/5 bg-slate-950/40 p-5 text-center">
          <p className="text-2xl">🚘</p>
          <p className="mt-2 text-sm font-bold text-slate-200">
            No pickup requests yet
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Requests from passengers will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => {
            const status = String(request.status).toUpperCase();
            const pending = status === "PENDING";
            const busy = updatingId === String(request.id);
            const whatsapp = getWhatsAppNumber(request.passengerPhone);

            return (
              <article
                key={String(request.id)}
                className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-white">
                      {request.passengerName || "Passenger"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Request #{request.id}
                    </p>
                  </div>

                  <span className="status-pill">
                    {status || "UNKNOWN"}
                  </span>
                </div>

                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex gap-2">
                    <span className="text-cyan-300">●</span>
                    <span className="text-slate-200">
                      {request.startLocation}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <span className="text-fuchsia-300">●</span>
                    <span className="text-slate-200">
                      {request.endLocation}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-slate-400">
                    Ride #{request.rideId}
                  </p>

                  <p className="font-bold text-cyan-300">
                    {request.fareLkr == null
                      ? "Fare not set"
                      : `LKR ${Number(request.fareLkr).toLocaleString("en-LK")}`}
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {whatsapp && (
                    <a
                      href={`https://wa.me/${whatsapp}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="outline-button rounded-xl p-3 text-center text-xs font-bold"
                    >
                      WhatsApp Passenger
                    </a>
                  )}

                  {pending && (
                    <>
                      <button
                        type="button"
                        className="neon-button rounded-xl p-3 text-xs font-black"
                        disabled={busy}
                        onClick={() =>
                          void updateRequest(request.id, "ACCEPTED")
                        }
                      >
                        {busy ? "Updating..." : "✓ Accept Request"}
                      </button>

                      <button
                        type="button"
                        className="outline-button rounded-xl p-3 text-xs font-bold sm:col-span-2"
                        disabled={busy}
                        onClick={() =>
                          void updateRequest(request.id, "REJECTED")
                        }
                      >
                        {busy ? "Updating..." : "✕ Reject Request"}
                      </button>
                    </>
                  )}
                </div>

                {pending && (
                  <p className="mt-3 text-[10px] leading-4 text-slate-500">
                    Accepting or rejecting updates the saved request status.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
