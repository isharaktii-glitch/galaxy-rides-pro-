"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";

type Place = {
  name: string;
  lat: number;
  lon: number;
};

type RouteData = {
  distance: number;
  duration: number;
  coordinates: [number, number][];
};

const MapView = dynamic(
  () => import("./route-map"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-cyan-300">
        Loading map...
      </div>
    ),
  }
);

export default function RoutePlannerPage() {
  const [start, setStart] = useState<Place | null>(null);
  const [end, setEnd] = useState<Place | null>(null);
  const [startText, setStartText] = useState("Colombo Fort");
  const [endText, setEndText] = useState("Kandy");
  const [activeField, setActiveField] = useState<"start" | "end">("start");
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [mode, setMode] = useState<"short" | "shortest">("short");
  const [route, setRoute] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const text = activeField === "start" ? startText : endText;

    if (text.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=lk&q=${encodeURIComponent(text)}`,
          { signal: controller.signal }
        );

        if (!response.ok) throw new Error("Place search failed");

        const data = await response.json();

        setSuggestions(
          data.map((item: any) => ({
            name: item.display_name,
            lat: Number(item.lat),
            lon: Number(item.lon),
          }))
        );
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          setError("ස්ථාන සෙවීමට නොහැකි වුණා. නැවත උත්සාහ කරන්න.");
        }
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [startText, endText, activeField]);

  function choosePlace(place: Place) {
    if (activeField === "start") {
      setStart(place);
      setStartText(place.name);
    } else {
      setEnd(place);
      setEndText(place.name);
    }

    setSuggestions([]);
    setError("");
  }

  async function getRoute() {
    setError("");
    setRoute(null);

    if (!start || !end) {
      setError("Suggestions වලින් ආරම්භක ස්ථානය සහ ගමනාන්තය තෝරන්න.");
      return;
    }

    if (start.lat === end.lat && start.lon === end.lon) {
      setError("වෙනස් ආරම්භක ස්ථානයක් සහ ගමනාන්තයක් තෝරන්න.");
      return;
    }

    setLoading(true);

    try {
      const coordinates =
        `${start.lon},${start.lat};${end.lon},${end.lat}`;

      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&alternatives=2&steps=false`,
        { signal: AbortSignal.timeout(20000) }
      );

      if (!response.ok) throw new Error("Routing service unavailable");

      const data = await response.json();

      if (data.code !== "Ok" || !data.routes?.length) {
        throw new Error("මෙම ස්ථාන දෙක අතර මාර්ගයක් හමු වුණේ නැහැ.");
      }

      const routes = data.routes as {
        distance: number;
        duration: number;
        geometry: { coordinates: [number, number][] };
      }[];

      // OSRM returns alternative routes when available.
      // "Shortest Route" selects the shortest distance among returned routes.
      // "Short Ride" selects the fastest among returned routes.
      const selected =
        mode === "shortest"
          ? [...routes].sort((a, b) => a.distance - b.distance)[0]
          : [...routes].sort((a, b) => a.duration - b.duration)[0];

      setRoute({
        distance: selected.distance,
        duration: selected.duration,
        coordinates: selected.geometry.coordinates.map(
          ([lon, lat]) => [lat, lon]
        ),
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "මාර්ගය ලබාගැනීමට නොහැකි වුණා."
      );
    } finally {
      setLoading(false);
    }
  }

  function clearRoute() {
    setStart(null);
    setEnd(null);
    setStartText("");
    setEndText("");
    setRoute(null);
    setSuggestions([]);
    setError("");
  }

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white md:p-8">
      <header className="mx-auto mb-6 flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <a href="/driver" className="text-xl font-black text-cyan-300">
          🪐 Galaxy Rides Pro
        </a>
        <span className="text-sm text-slate-400">
          Sri Lanka · Route Planner
        </span>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[360px_1fr]">
        <section className="space-y-5">
          <div className="rounded-3xl border border-cyan-900 bg-slate-900/90 p-5 shadow-xl">
            <h1 className="mb-5 text-2xl font-bold">Find Your Route</h1>

            <label className="mb-2 block text-sm text-slate-300">
              Starting location
            </label>
            <input
              value={startText}
              onFocus={() => setActiveField("start")}
              onChange={(e) => {
                setStartText(e.target.value);
                setStart(null);
              }}
              placeholder="Search a town, road or place..."
              className="mb-3 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 outline-none focus:border-cyan-400"
            />

            <label className="mb-2 block text-sm text-slate-300">
              Destination
            </label>
            <input
              value={endText}
              onFocus={() => setActiveField("end")}
              onChange={(e) => {
                setEndText(e.target.value);
                setEnd(null);
              }}
              placeholder="Where are you going?"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 outline-none focus:border-cyan-400"
            />

            {suggestions.length > 0 && (
              <div className="mt-3 max-h-56 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950">
                {suggestions.map((place, index) => (
                  <button
                    key={`${place.lat}-${place.lon}-${index}`}
                    onClick={() => choosePlace(place)}
                    className="block w-full border-b border-slate-800 p-3 text-left text-sm hover:bg-cyan-950"
                  >
                    📍 {place.name}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                onClick={() => setMode("short")}
                className={`rounded-xl border p-3 text-sm ${
                  mode === "short"
                    ? "border-cyan-400 bg-cyan-500/20 text-cyan-200"
                    : "border-slate-700 bg-slate-950"
                }`}
              >
                🚗 Short Ride
                <span className="mt-1 block text-xs">Fastest returned route</span>
              </button>

              <button
                onClick={() => setMode("shortest")}
                className={`rounded-xl border p-3 text-sm ${
                  mode === "shortest"
                    ? "border-cyan-400 bg-cyan-500/20 text-cyan-200"
                    : "border-slate-700 bg-slate-950"
                }`}
              >
                🛣️ Shortest Route
                <span className="mt-1 block text-xs">Shortest returned distance</span>
              </button>
            </div>

            <button
              onClick={getRoute}
              disabled={loading}
              className="mt-5 w-full rounded-xl bg-cyan-500 p-3 font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
            >
              {loading ? "Finding route..." : "Find Route →"}
            </button>

            <button
              onClick={clearRoute}
              className="mt-2 w-full rounded-xl border border-slate-700 p-3 text-slate-300 hover:bg-slate-800"
            >
              Clear Route
            </button>

            {error && (
              <p role="alert" className="mt-4 text-sm text-red-300">
                {error}
              </p>
            )}
          </div>

          {route && (
            <div className="rounded-3xl border border-cyan-900 bg-slate-900 p-5">
              <h2 className="mb-4 text-lg font-bold">Route Summary</h2>
              <p className="mb-2 text-slate-300">
                Distance:{" "}
                <strong className="text-white">
                  {(route.distance / 1000).toFixed(1)} km
                </strong>
              </p>
              <p className="mb-2 text-slate-300">
                Estimated time:{" "}
                <strong className="text-white">
                  {Math.round(route.duration / 60)} minutes
                </strong>
              </p>
              <p className="text-sm text-slate-400">
                Selected: {mode === "short" ? "Short Ride" : "Shortest Route"}
              </p>
              <p className="mt-3 text-xs text-slate-500">
                Time is a routing estimate, not live traffic information.
              </p>
            </div>
          )}
        </section>

        <section
          onDoubleClick={() => setFullscreen((value) => !value)}
          className={
            fullscreen
              ? "fixed inset-0 z-50 bg-slate-950 p-3"
              : "relative h-[65vh] min-h-[420px] overflow-hidden rounded-3xl border border-cyan-900 bg-slate-900"
          }
        >
          <button
            onClick={() => setFullscreen((value) => !value)}
            className="absolute right-4 top-4 z-[1000] rounded-lg border border-cyan-700 bg-slate-950/90 px-3 py-2 text-sm"
          >
            {fullscreen ? "✕ Close map" : "⛶ Fullscreen"}
          </button>

          <MapView
            start={start}
            end={end}
            route={route}
          />
        </section>
      </div>

      <footer className="mx-auto mt-6 max-w-7xl text-center text-xs text-slate-500">
        Map data © OpenStreetMap contributors · Routing by OSRM
      </footer>
    </main>
  );
}
