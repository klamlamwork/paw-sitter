"use client";

import { useEffect, useRef, useState } from "react";

export default function GooglePlacesAutocomplete({ value, onChange, placeholder = "Enter address" }) {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!window.google?.maps?.places) {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?libraries=places&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;
      script.async = true;
      script.defer = true;
      script.onload = () => setIsLoaded(true);
      document.head.appendChild(script);
      return;
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded || !inputRef.current) return;
    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      fields: ["formatted_address", "geometry", "address_components"],
      types: ["address"],
    });
    autocompleteRef.current = autocomplete;

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place.geometry) return;
      const result = {
        formatted_address: place.formatted_address || "",
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        city: "",
        state: "",
        postal_code: "",
        country: "",
      };
      (place.address_components || []).forEach((c) => {
        const t = c.types || [];
        if (t.includes("locality")) result.city = c.long_name;
        if (t.includes("administrative_area_level_1")) result.state = c.short_name;
        if (t.includes("postal_code")) result.postal_code = c.long_name;
        if (t.includes("country")) result.country = c.long_name;
      });
      onChange(result);
    });

    return () => {
      if (autocompleteRef.current) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [isLoaded, onChange]);

  return (
    <input
      ref={inputRef}
      type="text"
      className="w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm"
      placeholder={placeholder}
      defaultValue={value?.formatted_address || ""}
    />
  );
}
