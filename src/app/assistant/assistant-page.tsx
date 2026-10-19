"use client";

import Link from "next/link";
import { useState } from "react";
import { BookingDialog } from "@/components/booking-dialog";
import { ChatWidget } from "@/components/chat-widget";
import { Icon } from "@/components/icons";
import { business } from "@/lib/site-data";

/**
 * The assistant on its own page, with room for long answers on a desktop. It reuses
 * the exact same widget component and the same estimate dialog, so behaviour and
 * validation cannot drift from the home page.
 */
export function AssistantPage() {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingService, setBookingService] = useState("");

  function openBooking(service = "") {
    setBookingService(service);
    setBookingOpen(true);
  }

  return (
    <main className="chat-page-wrap" id="main-content">
      <div className="container">
        <div className="chat-page-head">
          <div>
            <h1>Ask the assistant</h1>
            <p>
              Faults, gas, jet cleaning, inverter boards, new installs — or just say &ldquo;book&rdquo; and it will take your inspection request here. Prefer a person?{" "}
              <a href={business.phoneHref}>{business.phoneDisplay}</a>.
            </p>
          </div>
          <Link className="chat-page-back" href="/">
            <Icon name="chevron-left" size={15} />
            Back to the site
          </Link>
        </div>

        <ChatWidget variant="page" onBook={(serviceId) => openBooking(serviceId ?? "")} />
      </div>

      {bookingOpen && <BookingDialog initialService={bookingService} onClose={() => setBookingOpen(false)} />}
    </main>
  );
}
