import { bookingServices } from "@/lib/site-data";

export type BookingFields = {
  service: string;
  zip: string;
  preferredDate: string;
  timePreference: string;
  fullName: string;
  email: string;
  phone: string;
  notes: string;
  consent: boolean;
  website: string;
  requestId: string;
};

export type BookingErrors = Partial<Record<keyof BookingFields, string>>;

export function dateBounds() {
  const min = new Date();
  min.setUTCDate(min.getUTCDate() + 1);
  const max = new Date();
  max.setUTCDate(max.getUTCDate() + 90);
  return { min: min.toISOString().slice(0, 10), max: max.toISOString().slice(0, 10) };
}

export function formatDate(value: string) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short", month: "long", day: "numeric", timeZone: "UTC",
  });
}

export function validateBooking(fields: Partial<BookingFields>, scope: "project" | "contact" | "all" = "all"): BookingErrors {
  const errors: BookingErrors = {};
  const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
  if (scope !== "contact") {
    if (!bookingServices.some((service) => service.value === fields.service)) errors.service = "Please choose a service.";
    if (!/^\d{5}$/.test(text(fields.zip))) errors.zip = "Enter a valid five-digit US ZIP code.";
    const preferredDate = text(fields.preferredDate);
    const { min, max } = dateBounds();
    const parsed = new Date(`${preferredDate}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(preferredDate) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== preferredDate || preferredDate < min || preferredDate > max) {
      errors.preferredDate = "Choose a date from tomorrow through the next 90 days.";
    }
    if (!["morning", "afternoon", "flexible"].includes(text(fields.timePreference))) errors.timePreference = "Choose your preferred time.";
  }
  if (scope !== "project") {
    const name = text(fields.fullName);
    const email = text(fields.email);
    const phone = text(fields.phone);
    if (name.length < 2 || name.length > 100) errors.fullName = "Enter your full name (2–100 characters).";
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address.";
    const digits = phone.replace(/\D/g, "");
    if (!/^[+\d().\s-]+$/.test(phone) || digits.length < 10 || digits.length > 15 || phone.length > 32) errors.phone = "Enter a valid phone number with area code.";
    if (typeof fields.notes !== "string" || fields.notes.length > 1500) errors.notes = "Please keep your message under 1,500 characters.";
    if (fields.consent !== true) errors.consent = "Please agree so we can respond to your request.";
  }
  return errors;
}
