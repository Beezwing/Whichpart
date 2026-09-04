"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { Input } from "./ui";

// Jamaica-wide default so the map has somewhere sensible to sit before a
// pin is dropped, regardless of which parish the supplier/customer is in.
const JAMAICA_CENTER = { lat: 18.1096, lng: -77.2975 };

export interface LocationValue {
  address: string;
  lat: number;
  lng: number;
}

interface LocationPickerProps {
  address: string;
  onAddressChange: (address: string) => void;
  pin: { lat: number; lng: number } | null;
  onPinChange: (pin: { lat: number; lng: number } | null) => void;
}

// The typed address stays the record of what the customer agreed to
// (never overwritten once they've typed something) — the map is only a
// courier aid for dropping a pin at the exact spot. Reverse-geocoding
// the pin is best-effort: if the Geocoding API isn't enabled for this
// key, the typed address still works fine on its own.
export function LocationPicker({ address, onAddressChange, pin, onPinChange }: LocationPickerProps) {
  const [scriptLoaded, setScriptLoaded] = useState(
    typeof window !== "undefined" && !!window.google?.maps,
  );

  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  // "Latest value" refs so the map-setup effect below (which only needs to
  // run once, on script load) can always read the current props without
  // re-running — assigning refs during render is disallowed, so this
  // happens in an effect instead.
  const addressRef = useRef(address);
  const onAddressChangeRef = useRef(onAddressChange);
  const onPinChangeRef = useRef(onPinChange);
  useEffect(() => {
    addressRef.current = address;
    onAddressChangeRef.current = onAddressChange;
    onPinChangeRef.current = onPinChange;
  });

  useEffect(() => {
    if (!scriptLoaded || !mapDivRef.current || mapRef.current) return;

    const start = pin ?? JAMAICA_CENTER;
    const map = new google.maps.Map(mapDivRef.current, {
      center: start,
      zoom: pin ? 16 : 10,
    });
    mapRef.current = map;
    geocoderRef.current = new google.maps.Geocoder();

    const marker = new google.maps.Marker({ map, position: start, draggable: true });
    markerRef.current = marker;
    if (!pin) marker.setVisible(false);

    function place(lat: number, lng: number) {
      marker.setVisible(true);
      marker.setPosition({ lat, lng });
      onPinChangeRef.current({ lat, lng });
      if (!addressRef.current.trim()) {
        try {
          geocoderRef.current?.geocode({ location: { lat, lng } }, (results, status) => {
            if (status === "OK" && results?.[0]) onAddressChangeRef.current(results[0].formatted_address);
          });
        } catch {
          /* geocoding not enabled for this key — the typed address still works */
        }
      }
    }

    map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (e.latLng) place(e.latLng.lat(), e.latLng.lng());
    });
    marker.addListener("dragend", () => {
      const p = marker.getPosition();
      if (p) place(p.lat(), p.lng());
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptLoaded]);

  return (
    <div className="flex flex-col gap-2">
      {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && (
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`}
          strategy="afterInteractive"
          onLoad={() => setScriptLoaded(true)}
        />
      )}
      <Input
        placeholder="Delivery address"
        value={address}
        onChange={(e) => onAddressChange(e.target.value)}
      />
      {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && (
        <>
          <p className="text-xs text-[var(--muted)]">
            {pin ? "Pin dropped ✓ — drag it to adjust." : "Tap the map to drop a pin at the exact delivery spot."}
          </p>
          <div ref={mapDivRef} className="h-56 w-full rounded-lg border border-[var(--border)]" />
        </>
      )}
    </div>
  );
}
