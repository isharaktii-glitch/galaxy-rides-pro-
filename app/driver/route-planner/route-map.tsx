"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";

type Place = {
  name: string;
  lat: number;
  lon: number;
} | null;

type RouteData = {
  distance: number;
  duration: number;
  coordinates: [number, number][];
} | null;

export default function RouteMap({
  start,
  end,
  route,
}: {
  start: Place;
  end: Place;
  route: RouteData;
}) {
  const elementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!elementRef.current || mapRef.current) return;

    const map = L.map(elementRef.current).setView(
      [7.8731, 80.7718],
      7
    );

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    layersRef.current = L.layerGroup().addTo(map);

    const resize = () => map.invalidateSize();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      map.remove();
      mapRef.current = null;
      layersRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layers = layersRef.current;

    if (!map || !layers) return;

    layers.clearLayers();

    const points: L.LatLngExpression[] = [];

    if (start) {
      const point: L.LatLngExpression = [start.lat, start.lon];
      points.push(point);

      L.marker(point)
        .bindPopup(`Start: ${start.name}`)
        .addTo(layers);
    }

    if (end) {
      const point: L.LatLngExpression = [end.lat, end.lon];
      points.push(point);

      L.marker(point)
        .bindPopup(`Destination: ${end.name}`)
        .addTo(layers);
    }

    if (route && route.coordinates.length > 0) {
      const line = L.polyline(route.coordinates, {
        color: "#06b6d4",
        weight: 6,
        opacity: 0.9,
      }).addTo(layers);

      map.fitBounds(line.getBounds(), { padding: [35, 35] });
    } else if (points.length === 2) {
      map.fitBounds(L.latLngBounds(points), { padding: [35, 35] });
    } else if (points.length === 1) {
      map.setView(points[0], 14);
    }
  }, [start, end, route]);

  return (
    <div
      ref={elementRef}
      className="h-full min-h-[420px] w-full"
      aria-label="Route map"
    />
  );
}
