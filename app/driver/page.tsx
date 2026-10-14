"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FormEvent } from "react";
import "leaflet/dist/leaflet.css";

type Role = "Driver" | "Passenger";
type Point = { lat: number; lng: number };
type Landmark = { name: string; city: string; point: Point };

type Profile = {
  id: string;
  name: string;
  phone: string;
  role: Role;
  vehicle: string;
  verified: boolean;
};

type Ride = {
  id: string;
  driverId?: string;
  driverName: string;
  phone: string;
  verified: boolean;
  start: string;
  end: string;
  fare: number;
  point: Point;
  status: string;
};

const places: Landmark[] = [
  {
    name: "Kandy City Centre",
    city: "Kandy",
    point: { lat: 7.2936, lng: 80.6413 },
  },
  {
    name: "Temple of Tooth",
    city: "Kandy",
    point: { lat: 7.2936, lng: 80.6413 },
  },
  {
    name: "Hanthana",
    city: "Kandy",
    point: { lat: 7.2672, lng: 80.635 },
  },
  {
    name: "Peradeniya",
    city: "Kandy",
    point: { lat: 7.2548, lng: 80.5974 },
  },
  {
    name: "Colombo Fort",
    city: "Colombo",
    point: { lat: 6.9344, lng: 79.8428 },
  },
  {
    name: "One Galle Face",
    city: "Colombo",
    point: { lat: 6.9271, lng: 79.8447 },
  },
  {
    name: "Galle Fort",
    city: "Galle",
    point: { lat: 6.0269, lng: 80.217 },
  },
  {
    name: "Jaffna Railway Station",
    city: "Jaffna",
    point: { lat: 9.6615, lng: 80.0222 },
  },
];

function findPlace(name: string): Landmark | undefined {
  return places.find(
    (place) => place.name.toLowerCase() === name.toLowerCase()
  );
}

function getPoint(
  lat: unknown,
  lng: unknown,
  fallback: Point
): Point {
  const latitude = Number(lat);
  const longitude = Number(lng);

  if (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  ) {
    return { lat: latitude, lng: longitude };
  }

  return fallback;
}

function LandmarkMap({
  center,
  target,
  driver,
  onSelect,
}: {
  center: Point;
  target: Point | null;
  driver: Point | null;
  onSelect: (point: Point) => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markerLayer = useRef<any>(null);
  const selectRef = useRef(onSelect);

  useEffect(() => {
    selectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    let cancelled = false;
    let instance: any;

    async function setup() {
      if (!element.current || map.current) return;

      const L = await import("leaflet");

      if (cancelled || !element.current) return;

      instance = L.map(element.current, {
        center: [center.lat, center.lng],
        zoom: 12,
        zoomControl: false,
      });

      L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }
      ).addTo(instance);

      L.control.zoom({ position: "bottomright" }).addTo(instance);

      markerLayer.current = L.layerGroup().addTo(instance);

      instance.on("click", (event: any) => {
        selectRef.current({
          lat: event.latlng.lat,
          lng: event.latlng.lng,
        });
      });

      map.current = instance;

      requestAnimationFrame(() => instance.invalidateSize());
    }

    setup().catch(console.error);

    return () => {
      cancelled = true;
      instance?.remove();
      map.current = null;
      markerLayer.current = null;
    };
    // Initial map setup only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function refreshMarkers() {
      const instance = map.current;
      const layer = markerLayer.current;

      if (!instance || !layer) return;

      const L = await import("leaflet");

      if (cancelled || !map.current) return;

      layer.clearLayers();

      const icon = (emoji: string, style: string) =>
        L.divIcon({
          className: "",
          html: `<div class="galaxy-marker ${style}"><span>${emoji}</span></div>`,
          iconSize: [42, 42],
          iconAnchor: [21, 42],
        });

      if (target) {
        L.marker([target.lat, target.lng], {
          icon: icon("🎯", "target-marker"),
        })
          .bindPopup("Selected destination")
          .addTo(layer);
      }

      if (driver) {
        L.marker([driver.lat, driver.lng], {
          icon: icon("🚕", "driver-marker"),
        })
          .bindPopup("Your device GPS position")
          .addTo(layer);
      }
    }

    refreshMarkers().catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [target, driver]);

  useEffect(() => {
    if (map.current) {
      map.current.flyTo([center.lat, center.lng], 12, {
        duration: 0.7,
      });
    }
  }, [center]);

  return (
    <div
      ref={element}
      className="h-full w-full"
      aria-label="Interactive map"
    />
  );
}

const Map = dynamic(() => Promise.resolve(LandmarkMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-cyan-200">
      Loading Sri Lanka map...
    </div>
  ),
});

function Verified() {
  return (
    <span className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-[10px] font-bold text-emerald-300">
      ✓ VERIFIED
    </span>
  );
}

export default function DriverPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [kycOpen, setKycOpen] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("Driver");
  const [vehicle, setVehicle] = useState("");
  const [nic, setNic] = useState<File | null>(null);
  const [license, setLicense] = useState<File | null>(null);

  const [start, setStart] = useState("Colombo Fort");
  const [end, setEnd] = useState("Kandy City Centre");
  const [startPlace, setStartPlace] = useState<Landmark>(places[4]);
  const [endPlace, setEndPlace] = useState<Landmark>(places[0]);

  const [searchField, setSearchField] = useState<
    "start" | "end" | null
  >(null);

  const [center, setCenter] = useState<Point>(places[4].point);
  const [target, setTarget] = useState<Point | null>(places[0].point);
  const [gps, setGps] = useState<Point | null>(null);
  const [tracking, setTracking] = useState(false);
  const [gpsMessage, setGpsMessage] = useState("");

  const [message, setMessage] = useState("");
  const [fare, setFare] = useState("500");
  const [rides, setRides] = useState<Ride[]>([]);
  const [pickupIds, setPickupIds] = useState<string[]>([]);
  const [sheetOpen, setSheetOpen] = useState(true);

  const [loadingRides, setLoadingRides] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const watchId = useRef<number | null>(null);
  const requestInProgress = useRef(false);

  // Restore an existing browser profile.
  useEffect(() => {
    try {
      const stored = localStorage.getItem("galaxy-rides-profile");

      if (!stored) {
        setRegisterOpen(true);
        return;
      }

      const value = JSON.parse(stored) as Partial<Profile>;

      // Old demo profiles don't have a database ID.
      // They cannot create database rides or pickup requests.
      if (
        !value.id ||
        !value.name ||
        !value.phone ||
        (value.role !== "Driver" && value.role !== "Passenger")
      ) {
        localStorage.removeItem("galaxy-rides-profile");
        setRegisterOpen(true);
        setMessage(
          "Please register again to connect your profile to the database."
        );
        return;
      }

      const restored: Profile = {
        id: String(value.id),
        name: value.name,
        phone: value.phone,
        role: value.role,
        vehicle: value.vehicle || "",
        verified: value.verified === true,
      };

      setProfile(restored);
      setName(restored.name);
      setPhone(restored.phone);
      setRole(restored.role);
      setVehicle(restored.vehicle);
      setRegisterOpen(false);
    } catch {
      localStorage.removeItem("galaxy-rides-profile");
      setRegisterOpen(true);
    }
  }, []);

  // Load real rides from the API. No demo rides are mixed in.
  const loadRides = useCallback(async () => {
    setLoadingRides(true);

    try {
      const response = await fetch("/api/rides", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load rides.");
      }

      const apiRides = Array.isArray(data.rides) ? data.rides : [];

      const mapped: Ride[] = apiRides.map((item: any) => {
        const startName = String(item.start || "Start location");
        const endName = String(item.end || "Destination");

        const startLandmark = findPlace(startName);
        const endLandmark = findPlace(endName);

        const fallback = startLandmark?.point ||
          endLandmark?.point ||
          places[4].point;

        return {
          id: String(item.id),
          driverId: item.driverId != null
            ? String(item.driverId)
            : undefined,
          driverName: String(item.driverName || "Driver"),
          phone: String(item.phone || ""),
          verified: item.verified === true,
          start: startName,
          end: endName,
          fare: Number(item.fare || 0),
          point: getPoint(item.startLat, item.startLng, fallback),
          status: String(item.status || "SCHEDULED"),
        };
      });

      setRides(mapped);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load rides from the database."
      );
    } finally {
      setLoadingRides(false);
    }
  }, []);

  useEffect(() => {
    if (!profile) return;
    loadRides();
  }, [profile, loadRides]);

  // Clean up device GPS tracking when leaving the page.
  useEffect(
    () => () => {
      if (watchId.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    },
    []
  );

  const suggestions = useMemo(() => {
    const rawQuery =
      searchField === "start"
        ? start
        : searchField === "end"
          ? end
          : "";

    const query = rawQuery.toLowerCase().trim();

    return places
      .filter(
        (place) =>
          place.name.toLowerCase().includes(query) ||
          place.city.toLowerCase().includes(query)
      )
      .slice(0, 6);
  }, [start, end, searchField]);

  const selectPlace = useCallback(
    (place: Landmark) => {
      if (searchField === "start") {
        setStart(place.name);
        setStartPlace(place);
      } else {
        setEnd(place.name);
        setEndPlace(place);
        setTarget(place.point);
      }

      setCenter(place.point);
      setSearchField(null);
      setMessage(`${place.name} selected.`);
    },
    [searchField]
  );

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (registering) return;

    const cleanName = name.trim();
    const cleanPhone = phone.replace(/[^\d+]/g, "");
    const cleanVehicle =
      role === "Driver" ? vehicle.trim().toUpperCase() : "";

    if (cleanName.length < 2) {
      setMessage("Enter your full name.");
      return;
    }

    if (!/^\+?\d{9,15}$/.test(cleanPhone)) {
      setMessage("Enter a valid phone number with country code.");
      return;
    }

    if (role === "Driver" && cleanVehicle.length < 3) {
      setMessage("Enter your vehicle registration number.");
      return;
    }

    setRegistering(true);
    setMessage("");

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: cleanName,
          phone: cleanPhone,
          role,
          vehicle: cleanVehicle,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Registration failed. Please check your details."
        );
      }

      const dbUser = data.user;

      if (!dbUser || dbUser.id == null) {
        throw new Error(
          "The registration API did not return a user ID."
        );
      }

      const user: Profile = {
        id: String(dbUser.id),
        name: String(dbUser.name || cleanName),
        phone: String(dbUser.phone || cleanPhone),
        role,
        vehicle: cleanVehicle,
        // Only the server's existing KYC status can mark a user verified.
        verified: dbUser.kycStatus === "verified",
      };

      setProfile(user);
      setName(user.name);
      setPhone(user.phone);
      setRole(user.role);
      setVehicle(user.vehicle);
      setRegisterOpen(false);
      localStorage.setItem(
        "galaxy-rides-profile",
        JSON.stringify(user)
      );

      setMessage("Registration saved successfully.");
      await loadRides();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to register."
      );
    } finally {
      setRegistering(false);
    }
  }

  function switchRole() {
    if (!profile) return;

    // The current API does not update the role in the database.
    // Don't silently change a local role and then submit requests as another role.
    setMessage(
      "Role switching needs a server-side account update. To use Driver or Passenger features, register with that role."
    );
  }

  function submitKyc(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!profile || profile.role !== "Driver") {
      setMessage("A Driver account is required.");
      return;
    }

    if (!nic || !license) {
      setMessage("Select both document files.");
      return;
    }

    // There is no secure KYC upload/review API yet.
    // Never grant verification from a client-side file selection.
    setKycOpen(false);
    setNic(null);
    setLicense(null);
    setMessage(
      "KYC demo submitted locally only. Documents were not uploaded, and your account remains unverified."
    );
  }

  function lockRoute() {
    const a = findPlace(start.trim());
    const b = findPlace(end.trim());

    if (!a || !b) {
      setMessage("Select both locations from the suggestions.");
      return;
    }

    if (a.name === b.name) {
      setMessage("Start and destination must be different.");
      return;
    }

    setStartPlace(a);
    setEndPlace(b);
    setTarget(b.point);
    setCenter(b.point);
    setSearchField(null);
    setMessage(`Route selected: ${a.name} → ${b.name}`);
  }

  async function publishRide() {
    if (!profile) {
      setMessage("Register before publishing a ride.");
      return;
    }

    if (profile.role !== "Driver") {
      setMessage("Register with the Driver role to publish rides.");
      return;
    }

    if (publishing) return;

    const parsedFare = Number(fare);

    if (
      fare.trim() === "" ||
      !Number.isFinite(parsedFare) ||
      parsedFare < 0 ||
      parsedFare > 10_000_000
    ) {
      setMessage("Enter a valid fare in Sri Lankan rupees.");
      return;
    }

    if (startPlace.name === endPlace.name) {
      setMessage("Choose different start and destination locations.");
      return;
    }

    setPublishing(true);
    setMessage("");

    try {
      const response = await fetch("/api/rides", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          driverId: profile.id,
          start: startPlace.name,
          end: endPlace.name,
          startLat: startPlace.point.lat,
          startLng: startPlace.point.lng,
          endLat: endPlace.point.lat,
          endLng: endPlace.point.lng,
          fare: parsedFare,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to publish ride.");
      }

      setMessage(
        "Ride saved to the database. Refreshing available rides..."
      );

      await loadRides();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to publish ride."
      );
    } finally {
      setPublishing(false);
    }
  }

  function startGps() {
    if (!navigator.geolocation) {
      setGpsMessage("This browser does not support GPS.");
      return;
    }

    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }

    setGpsMessage("Waiting for location permission...");

    const success = (position: GeolocationPosition) => {
      const point = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      setGps(point);
      setCenter(point);
      setGpsMessage(
        `GPS updated · accuracy ±${Math.round(
          position.coords.accuracy
        )} m`
      );
      setTracking(true);
    };

    const failure = (error: GeolocationPositionError) => {
      setGpsMessage(
        error.code === 1
          ? "Location permission denied. Enable it in browser settings."
          : error.code === 2
            ? "Device location unavailable. Try again."
            : "GPS timed out. Please retry."
      );
    };

    navigator.geolocation.getCurrentPosition(success, failure, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 5000,
    });

    watchId.current = navigator.geolocation.watchPosition(
      success,
      failure,
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 3000,
      }
    );
  }

  function stopGps() {
    if (watchId.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }

    setTracking(false);
    setGpsMessage("GPS tracking stopped.");
  }

  async function requestPickup(ride: Ride) {
    if (!profile) {
      setMessage("Register as a Passenger to request a pickup.");
      return;
    }

    if (profile.role !== "Passenger") {
      setMessage("Pickup requests require a Passenger account.");
      return;
    }

    if (!/^[1-9]\d*$/.test(ride.id)) {
      setMessage("This ride does not have a valid database ID.");
      return;
    }

    if (pickupIds.includes(ride.id) || requestInProgress.current) {
      return;
    }

    requestInProgress.current = true;

    try {
      const response = await fetch("/api/pickup-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rideId: ride.id,
          passengerId: profile.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to send pickup request."
        );
      }

      setPickupIds((current) =>
        current.includes(ride.id)
          ? current
          : [...current, ride.id]
      );

      setMessage(
        `Pickup request saved for ${ride.driverName}.`
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to send pickup request."
      );
    } finally {
      requestInProgress.current = false;
    }
  }

  return (
    <main className="galaxy-shell min-h-dvh">
      <div className="map-frame">
        <Map
          center={center}
          target={target}
          driver={gps}
          onSelect={(point) => {
            setTarget(point);
            setCenter(point);
            setMessage(
              "Map pin moved. Select a landmark to create a named route."
            );
          }}
        />
      </div>

      <div className="pointer-events-none absolute inset-0 z-[400] bg-gradient-to-b from-slate-950/60 via-transparent to-slate-950/90" />

      <div className="relative z-[500] flex min-h-dvh flex-col">
        <header className="glass-panel mx-3 mt-3 flex items-center justify-between gap-3 rounded-2xl p-3 sm:mx-5 sm:mt-5 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-400/10 text-2xl">
              🌌
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-sm font-black sm:text-base">
                Galaxy <span className="neon-text">Rides Pro</span>
              </h1>
              <p className="text-[10px] text-slate-400">
                SRI LANKA · RIDE YOUR GALAXY
              </p>
            </div>
          </div>

          {profile && (
            <div className="flex items-center gap-2">
              <div className="hidden text-right sm:block">
                <p className="max-w-32 truncate text-xs font-bold">
                  {profile.name}
                </p>
                <p className="text-[10px] text-cyan-200">
                  {profile.role}
                </p>
              </div>

              <button
                type="button"
                className="outline-button rounded-xl px-3 py-2 text-[11px] font-bold"
                onClick={switchRole}
              >
                ⇄ Switch
              </button>
            </div>
          )}
        </header>

        {profile && (
          <div className="mx-3 mt-3 flex flex-wrap items-center justify-between gap-2 sm:mx-5">
            <div className="glass-panel flex items-center gap-2 rounded-full px-3 py-2">
              <span>
                {profile.role === "Driver" ? "🚕" : "👤"}
              </span>

              <div>
                <p className="max-w-36 truncate text-xs font-bold">
                  {profile.name}
                </p>
                <p className="text-[10px] text-slate-400">
                  {profile.role} account
                </p>
              </div>

              {profile.verified && <Verified />}
            </div>

            {profile.role === "Driver" && (
              <button
                type="button"
                className="glass-panel rounded-full px-3 py-2 text-[11px] font-bold text-cyan-100"
                onClick={() => setKycOpen(true)}
              >
                🛡️ {profile.verified ? "KYC Verified" : "KYC Demo"}
              </button>
            )}
          </div>
        )}

        <div className="pointer-events-none mt-5 flex flex-1 flex-col justify-between">
          <div className="glass-panel ml-4 mt-1 w-fit rounded-xl px-3 py-2">
            <p className="text-[10px] font-bold tracking-[.2em] text-cyan-200">
              YOUR JOURNEY
            </p>
            <p className="mt-1 text-xs text-slate-300">
              {endPlace.city} · Map
            </p>
            <p className="mt-1 text-[10px] text-slate-400">
              {gps ? "GPS position available" : "Waiting for GPS"}
            </p>
          </div>

          <section
            className={`pointer-events-auto glass-panel action-sheet mx-0 mt-4 w-full p-4 sm:mx-5 sm:mb-5 sm:w-[min(520px,calc(100%-40px))] sm:p-5 ${
              sheetOpen ? "" : "max-h-24"
            }`}
          >
            <button
              type="button"
              className="mb-4 block w-full"
              onClick={() => setSheetOpen((value) => !value)}
              aria-label="Expand or collapse action sheet"
            >
              <div className="sheet-handle" />
            </button>

            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold tracking-[.22em] text-cyan-300">
                  GALAXY MOBILITY
                </p>

                <h2 className="mt-1 text-xl font-black">
                  {profile?.role === "Passenger"
                    ? "Find your next ride."
                    : "Your route. Your galaxy."}
                </h2>

                <p className="mt-1 text-xs text-slate-400">
                  {profile?.role === "Passenger"
                    ? "Explore rides saved in the database."
                    : "Set your route and publish your ride."}
                </p>
              </div>

              <span className="status-pill">
                {tracking ? "● GPS ACTIVE" : "READY"}
              </span>
            </div>

            {sheetOpen && (
              <>
                {message && (
                  <div
                    role="status"
                    className="mb-3 rounded-xl border border-cyan-300/15 bg-cyan-300/5 px-3 py-2 text-xs text-cyan-100"
                  >
                    {message}

                    <button
                      type="button"
                      className="ml-2"
                      onClick={() => setMessage("")}
                      aria-label="Dismiss message"
                    >
                      ×
                    </button>
                  </div>
                )}

                {!profile ? (
                  <div className="card-surface p-4">
                    <p className="font-bold">Welcome aboard 🌌</p>
                    <p className="mt-2 text-xs text-slate-400">
                      Register to connect your account to the database.
                    </p>

                    <button
                      type="button"
                      className="neon-button mt-4 w-full rounded-xl p-3 font-black"
                      onClick={() => setRegisterOpen(true)}
                    >
                      Register &amp; Enter System
                    </button>
                  </div>
                ) : profile.role === "Driver" ? (
                  <div className="space-y-4">
                    <div className="card-surface space-y-3 p-4">
                      <h3 className="text-sm font-bold">
                        🗺️ Post Driver Route
                      </h3>

                      {(["start", "end"] as const).map((field) => {
                        const value =
                          field === "start" ? start : end;

                        return (
                          <div className="relative" key={field}>
                            <label className="field-label">
                              {field === "start"
                                ? "START LOCATION"
                                : "DESTINATION"}
                            </label>

                            <input
                              className="field"
                              value={value}
                              placeholder="Search Sri Lankan landmarks"
                              onFocus={() => setSearchField(field)}
                              onChange={(event) => {
                                if (field === "start") {
                                  setStart(event.target.value);
                                } else {
                                  setEnd(event.target.value);
                                }

                                setSearchField(field);
                              }}
                              autoComplete="off"
                            />

                            {searchField === field && (
                              <div className="suggestion-list">
                                {suggestions.map((place) => (
                                  <button
                                    type="button"
                                    key={place.name}
                                    className="suggestion-item"
                                    onMouseDown={(event) =>
                                      event.preventDefault()
                                    }
                                    onClick={() => selectPlace(place)}
                                  >
                                    <span>📍</span>
                                    <span>
                                      <span className="block text-xs font-bold">
                                        {place.name}
                                      </span>
                                      <span className="text-[10px] text-slate-400">
                                        {place.city}
                                      </span>
                                    </span>
                                  </button>
                                ))}

                                {!suggestions.length && (
                                  <p className="p-3 text-xs text-slate-400">
                                    No landmark found.
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      <button
                        type="button"
                        className="outline-button w-full rounded-xl p-3 text-xs font-bold"
                        onClick={lockRoute}
                      >
                        Done 🎯 · Lock destination
                      </button>
                    </div>

                    <div className="card-surface p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-bold tracking-widest text-slate-400">
                            SELECTED ROUTE
                          </p>

                          <p className="mt-2 text-sm font-bold">
                            {startPlace.name}
                          </p>

                          <p className="my-1 text-xs text-cyan-300">
                            ↓ Journey
                          </p>

                          <p className="text-sm font-bold">
                            {endPlace.name}
                          </p>
                        </div>

                        <span className="status-pill">
                          {tracking ? "GPS ACTIVE" : "READY"}
                        </span>
                      </div>

                      <div className="mt-4">
                        <label className="field-label">
                          ESTIMATED FARE (LKR)
                        </label>

                        <input
                          className="field"
                          type="number"
                          min="0"
                          max="10000000"
                          step="1"
                          value={fare}
                          onChange={(event) =>
                            setFare(event.target.value)
                          }
                          placeholder="e.g. 1500"
                        />
                      </div>

                      <button
                        type="button"
                        className="neon-button mt-4 w-full rounded-xl p-3 text-sm font-black"
                        onClick={publishRide}
                        disabled={publishing}
                      >
                        {publishing
                          ? "Publishing..."
                          : "Publish Driver Route 🚀"}
                      </button>

                      {gpsMessage && (
                        <p className="mt-3 rounded-lg bg-slate-950/70 p-2 text-[11px] text-cyan-100">
                          {gpsMessage}
                        </p>
                      )}

                      {!tracking ? (
                        <button
                          type="button"
                          className="outline-button mt-3 w-full rounded-xl p-3 text-sm font-bold"
                          onClick={startGps}
                        >
                          Start Device GPS 📍
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="mt-3 w-full rounded-xl border border-rose-400/25 bg-rose-400/10 p-3 text-sm font-bold text-rose-200"
                          onClick={stopGps}
                        >
                          Stop GPS Tracking
                        </button>
                      )}

                      {gps && (
                        <p className="mt-2 text-[10px] text-slate-400">
                          {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}
                        </p>
                      )}
                    </div>

                    <p className="text-[10px] leading-4 text-slate-500">
                      Published routes are saved in the database. GPS
                      currently updates this device's map only; it is not
                      shared live with other users.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold">
                        🚘 Available Rides
                      </h3>

                      <button
                        type="button"
                        className="outline-button rounded-lg px-3 py-2 text-[10px] font-bold"
                        onClick={loadRides}
                        disabled={loadingRides}
                      >
                        {loadingRides ? "Loading..." : "↻ Refresh"}
                      </button>
                    </div>

                    <p className="text-[10px] text-slate-400">
                      {loadingRides
                        ? "Loading rides from the database..."
                        : `${rides.length} ride(s) returned by the server`}
                    </p>

                    {!loadingRides && rides.length === 0 && (
                      <div className="card-surface p-4">
                        <p className="text-sm font-bold">
                          No rides available yet.
                        </p>
                        <p className="mt-2 text-xs text-slate-400">
                          Published rides will appear here when the
                          database API returns them.
                        </p>
                      </div>
                    )}

                    {rides.map((ride) => (
                      <article
                        key={ride.id}
                        className="card-surface p-4"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold">
                              {ride.driverName}
                            </p>

                            <div className="mt-1">
                              {ride.verified ? (
                                <Verified />
                              ) : (
                                <span className="text-[10px] text-amber-300">
                                  ⚠ Not verified
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-right">
                            <p className="text-[10px] text-slate-400">
                              EST. FARE
                            </p>
                            <p className="text-sm font-black text-cyan-200">
                              {ride.fare > 0
                                ? `Rs. ${ride.fare.toLocaleString("en-LK")}`
                                : "Contact driver"}
                            </p>
                          </div>
                        </div>

                        <div className="my-3 rounded-xl bg-slate-950/55 p-3">
                          <p className="text-xs">
                            <span className="text-cyan-300">●</span>{" "}
                            {ride.start}
                          </p>

                          <p className="my-1 text-slate-500">│</p>

                          <p className="text-xs">
                            <span className="text-fuchsia-300">●</span>{" "}
                            {ride.end}
                          </p>
                        </div>

                        <p className="mb-3 text-[10px] text-slate-400">
                          Contact: {ride.phone || "Unavailable"} ·{" "}
                          {ride.status}
                        </p>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            className="outline-button rounded-xl p-3 text-xs font-bold"
                            disabled={pickupIds.includes(ride.id)}
                            onClick={() => requestPickup(ride)}
                          >
                            {pickupIds.includes(ride.id)
                              ? "✓ Request sent"
                              : "Come Here 📍"}
                          </button>

                          {ride.phone ? (
                            <a
                              className="neon-button flex items-center justify-center rounded-xl p-3 text-xs font-black"
                              href={`https://wa.me/${ride.phone.replace(
                                /\D/g,
                                ""
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              WhatsApp 💬
                            </a>
                          ) : (
                            <span className="flex items-center justify-center rounded-xl bg-slate-900 p-3 text-xs text-slate-500">
                              No phone
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          className="mt-2 w-full rounded-lg p-2 text-[11px] text-slate-400 hover:bg-white/5"
                          onClick={() => {
                            setCenter(ride.point);
                            setTarget(ride.point);
                          }}
                        >
                          View route area on map
                        </button>
                      </article>
                    ))}

                    <p className="text-[10px] leading-4 text-slate-500">
                      Ride listings come from the database API. Pickup
                      requests require a Passenger account.
                    </p>
                  </div>
                )}
              </>
            )}
          </section>
        </div>

        <footer className="relative z-[600] px-3 py-3 text-center text-[9px] text-slate-500">
          GALAXY RIDES PRO · MAP DATA © OPENSTREETMAP CONTRIBUTORS
        </footer>
      </div>

      {registerOpen && (
        <div className="modal-backdrop">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="register-title"
            className="glass-modal animate-rise max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-3xl p-5 sm:p-7"
          >
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-300/10 text-3xl">
                🌌
              </div>

              <div>
                <p className="text-[10px] font-bold tracking-[.2em] text-cyan-300">
                  WELCOME TO
                </p>
                <h2
                  id="register-title"
                  className="mt-1 text-xl font-black"
                >
                  Galaxy Rides Pro
                </h2>
                <p className="text-xs text-slate-400">
                  Register your account
                </p>
              </div>
            </div>

            <form onSubmit={register} className="space-y-4">
              <div>
                <label className="field-label">FULL NAME</label>
                <input
                  className="field"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your full name"
                  autoComplete="name"
                  required
                  minLength={2}
                />
              </div>

              <div>
                <label className="field-label">
                  PHONE NUMBER / WHATSAPP
                </label>
                <input
                  className="field"
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="94771234567"
                  autoComplete="tel"
                  required
                />
              </div>

              <div>
                <label className="field-label">CHOOSE YOUR ROLE</label>

                <div className="grid grid-cols-2 gap-3">
                  {(["Driver", "Passenger"] as Role[]).map(
                    (option) => (
                      <button
                        type="button"
                        key={option}
                        onClick={() => setRole(option)}
                        className={`rounded-xl border p-4 text-left ${
                          role === option
                            ? "border-cyan-300/60 bg-cyan-300/10 text-cyan-100"
                            : "border-white/10 bg-slate-950/50 text-slate-400"
                        }`}
                      >
                        <span className="text-xl">
                          {option === "Driver" ? "🚕" : "👤"}
                        </span>
                        <span className="mt-2 block text-sm font-bold">
                          {option}
                        </span>
                      </button>
                    )
                  )}
                </div>
              </div>

              {role === "Driver" && (
                <div>
                  <label className="field-label">
                    VEHICLE REGISTRATION NUMBER
                  </label>
                  <input
                    className="field"
                    value={vehicle}
                    onChange={(event) =>
                      setVehicle(event.target.value)
                    }
                    placeholder="e.g. WP CAB-1234"
                    required
                  />
                </div>
              )}

              {message && (
                <p role="status" className="text-xs text-cyan-200">
                  {message}
                </p>
              )}

              <button
                type="submit"
                disabled={registering}
                className="neon-button w-full rounded-xl p-4 text-sm font-black disabled:opacity-50"
              >
                {registering
                  ? "Registering..."
                  : "Register & Enter System →"}
              </button>

              <p className="text-center text-[10px] leading-4 text-slate-500">
                Registration is submitted to the server. This prototype
                does not yet have secure login or OTP authentication.
              </p>
            </form>
          </section>
        </div>
      )}

      {kycOpen && (
        <div className="modal-backdrop">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="kyc-title"
            className="glass-modal animate-rise max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl p-5 sm:p-7"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold tracking-[.2em] text-cyan-300">
                  DRIVER SAFETY
                </p>
                <h2
                  id="kyc-title"
                  className="mt-2 text-xl font-black"
                >
                  🛡️ KYC Verification
                </h2>
                <p className="mt-2 text-xs text-slate-400">
                  Demo form only. Documents are not uploaded.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setKycOpen(false)}
                className="rounded-xl bg-white/5 px-3 py-2"
                aria-label="Close KYC"
              >
                ✕
              </button>
            </div>

            <div className="mb-4 rounded-xl border border-amber-300/20 bg-amber-300/5 p-3">
              <p className="text-xs font-bold text-amber-200">
                Verification is not active yet
              </p>
              <p className="mt-1 text-[11px] leading-5 text-slate-400">
                Selecting files does not verify identity. This demo
                does not upload or check your NIC or driving licence.
                Your verified status will not change.
              </p>
            </div>

            <form onSubmit={submitKyc} className="space-y-4">
              <div>
                <label className="field-label">
                  NIC DOCUMENT (DEMO)
                </label>
                <input
                  className="field text-xs"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(event) =>
                    setNic(event.target.files?.[0] || null)
                  }
                  required
                />
                {nic && (
                  <p className="mt-1 truncate text-[10px] text-cyan-200">
                    {nic.name}
                  </p>
                )}
              </div>

              <div>
                <label className="field-label">
                  DRIVING LICENCE (DEMO)
                </label>
                <input
                  className="field text-xs"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(event) =>
                    setLicense(event.target.files?.[0] || null)
                  }
                  required
                />
                {license && (
                  <p className="mt-1 truncate text-[10px] text-cyan-200">
                    {license.name}
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="neon-button w-full rounded-xl p-3 text-sm font-black"
              >
                Test Demo Form
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
