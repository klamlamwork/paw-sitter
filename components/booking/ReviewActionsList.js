"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ReviewBookingButton from "@/components/booking/ReviewBookingButton";

export default function ReviewActionsList({ role = "customer", label = "Write a review" }) {
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (role === "sitter") {
        const { data: sitter } = await supabase.from("sitters").select("id").eq("profile_id", user.id).maybeSingle();
        if (!sitter?.id) return;
        const { data } = await supabase
          .from("bookings")
          .select("id, service_type, profiles:customer_id(full_name)")
          .eq("sitter_id", sitter.id)
          .order("created_at", { ascending: false })
          .limit(30);
        if (!cancelled) setBookings(data || []);
        return;
      }

      const { data } = await supabase
        .from("bookings")
        .select("id, service_type, sitters(display_name)")
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (!cancelled) setBookings(data || []);
    })();
    return () => {
      cancelled = true;
    };
  }, [role]);

  if (!bookings.length) return null;

  return (
    <div className="mt-6 space-y-2">
      {bookings.map((booking) => {
        const name =
          role === "sitter"
            ? booking.profiles?.full_name || "Customer"
            : booking.sitters?.display_name || "Sitter";
        return (
          <div key={booking.id} className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-[#7a5c4e]">{name}</span>
            <ReviewBookingButton bookingId={booking.id} label={label} />
          </div>
        );
      })}
    </div>
  );
}
