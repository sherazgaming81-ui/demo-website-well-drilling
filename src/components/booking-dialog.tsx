"use client";

import { useRef, useState, type FormEvent } from "react";
import { Modal } from "@/components/modal";
import { Icon } from "@/components/icons";
import { bookingServices } from "@/lib/site-data";
import { dateBounds, formatDate, validateBooking, type BookingErrors, type BookingFields } from "@/lib/booking";

export function BookingDialog({ initialService = "", onClose }: { initialService?: string; onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [fields, setFields] = useState<BookingFields>({ service: initialService, zip: "", preferredDate: "", timePreference: "flexible", fullName: "", email: "", phone: "", notes: "", consent: false, website: "", requestId: "" });
  const [errors, setErrors] = useState<BookingErrors>({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState("");
  const requestId = useRef("");
  const submissionLock = useRef(false);
  const bounds = dateBounds();

  function update<K extends keyof BookingFields>(key: K, value: BookingFields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setError("");
  }

  const focusError = (validationErrors: BookingErrors) => {
    const key = Object.keys(validationErrors)[0];
    requestAnimationFrame(() => document.getElementById(`booking-${key}`)?.focus());
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionLock.current) return;
    const validationErrors = validateBooking(fields, step === 1 ? "project" : "all");
    setErrors(validationErrors);
    setError("");
    if (Object.keys(validationErrors).length) {
      if (validationErrors.service || validationErrors.zip || validationErrors.preferredDate || validationErrors.timePreference) setStep(1);
      focusError(validationErrors);
      return;
    }
    if (step === 1) {
      setStep(2);
      requestAnimationFrame(() => document.getElementById("booking-fullName")?.focus());
      return;
    }
    submissionLock.current = true;
    setSubmitting(true);
    if (!requestId.current) requestId.current = crypto.randomUUID();
    try {
      const response = await fetch("/api/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...fields, requestId: requestId.current }) });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        if (data.errors) {
          setErrors(data.errors);
          if (data.errors.service || data.errors.zip || data.errors.preferredDate || data.errors.timePreference) setStep(1);
          focusError(data.errors);
        }
        return;
      }
      setReference(data.reference);
      requestAnimationFrame(() => document.getElementById("booking-title")?.focus());
    } catch {
      setError("We couldn't connect. Your details are still here—please check your connection and try again.");
    } finally {
      submissionLock.current = false;
      setSubmitting(false);
    }
  }

  function downloadSummary() {
    const service = bookingServices.find((item) => item.value === fields.service)?.label;
    const text = `AQUIFER WELL CO. — DEMO REQUEST\n\nReference: ${reference}\nName: ${fields.fullName}\nEmail: ${fields.email}\nPhone: ${fields.phone}\nService: ${service}\nProperty ZIP: ${fields.zip}\nPreferred date: ${formatDate(fields.preferredDate)}\nTime preference: ${fields.timePreference}\nNotes: ${fields.notes || "None"}\n\nStatus: Request received, not a confirmed appointment.\nThis is a demonstration website. No real appointment has been scheduled and no email has been sent.\n`;
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `Aquifer-${reference}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const fieldError = (key: keyof BookingFields) => errors[key] ? <p id={`error-${key}`} className="field-error">{errors[key]}</p> : null;
  const inputProps = (key: keyof BookingFields) => ({ id: `booking-${key}`, "aria-invalid": Boolean(errors[key]), "aria-describedby": errors[key] ? `error-${key}` : undefined });

  return <Modal onClose={onClose} labelledBy="booking-title" className="booking-modal">
    {reference ? <div className="success-view">
      <span className="success-icon"><Icon name="check" size={34} /></span>
      <p className="eyebrow">A GOOD START TO GREAT WATER</p>
      <h2 id="booking-title" tabIndex={-1}>You’re on your way.</h2>
      <p>Thanks, {fields.fullName.trim().split(" ")[0]}. Your free demo request has been saved. Here’s a little peace of mind for your records.</p>
      <div className="confirmation-details">
        <div><span>YOUR REFERENCE</span><strong className="reference">{reference}</strong></div>
        <div><span>YOUR PROJECT</span><strong>{bookingServices.find((item) => item.value === fields.service)?.label}</strong></div>
        <div><span>PREFERRED DATE</span><strong>{formatDate(fields.preferredDate)}</strong></div>
        <div><span>PROPERTY ZIP CODE</span><strong>{fields.zip}</strong></div>
      </div>
      <p className="success-note"><Icon name="calendar" size={17} />Your preferred date is a request, not a confirmed appointment.</p>
      <button className="button button-primary" onClick={onClose}>Back to exploring <Icon name="arrow-right" size={18} /></button>
      <button className="download-link" onClick={downloadSummary}><Icon name="download" size={16} />Download your request summary</button>
      <p className="demo-disclaimer">This is a demo website. No real appointment has been scheduled and no email has been sent.</p>
    </div> : <>
      <div className="booking-heading">
        <span className="modal-brand-icon"><Icon name="droplet" size={25} /></span>
        <p className="eyebrow">LET’S GET THE GOOD WATER FLOWING</p>
        <h2 id="booking-title">{step === 1 ? "Your free demo starts here." : "Let’s make the introduction."}</h2>
        <p>{step === 1 ? "Tell us a little about your land. We’ll take it from there." : "A few details, and you’re one step closer to clear answers."}</p>
        <div className="step-labels"><span className={step === 1 ? "active" : "complete"}>{step > 1 ? "✓ " : "01 "}Your project</span><span className={step === 2 ? "active" : ""}>02 Your details</span></div>
        <div className="step-progress" aria-label={`Step ${step} of 2`}><span className="active" /><span className={step === 2 ? "active" : ""} /></div>
      </div>
      <form className="booking-form" onSubmit={submit} noValidate>
        {error && <div role="alert" className="form-error">{error}</div>}
        {step === 1 ? <div className="form-grid">
          <div className="field field-full"><label htmlFor="booking-service">What can we help you with?</label><div className="select-wrap"><select {...inputProps("service")} value={fields.service} onChange={(event) => update("service", event.target.value)} required><option value="" disabled>Select your well service</option>{bookingServices.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><Icon name="chevron-down" size={16} /></div>{fieldError("service")}</div>
          <div className="field field-full"><label htmlFor="booking-zip">Property ZIP code</label><input {...inputProps("zip")} value={fields.zip} onChange={(event) => update("zip", event.target.value.replace(/\D/g, "").slice(0, 5))} placeholder="e.g. 28801" autoComplete="postal-code" inputMode="numeric" maxLength={5} required />{fieldError("zip")}<p className="form-help">We’ll use this to check local service availability.</p></div>
          <div className="field"><label htmlFor="booking-preferredDate">Your preferred date</label><input {...inputProps("preferredDate")} type="date" min={bounds.min} max={bounds.max} value={fields.preferredDate} onChange={(event) => update("preferredDate", event.target.value)} required />{fieldError("preferredDate")}</div>
          <div className="field"><label htmlFor="booking-timePreference">Best time to connect</label><div className="select-wrap"><select {...inputProps("timePreference")} value={fields.timePreference} onChange={(event) => update("timePreference", event.target.value)}><option value="flexible">I’m flexible</option><option value="morning">Morning · 8 am–12 pm</option><option value="afternoon">Afternoon · 12–5 pm</option></select><Icon name="chevron-down" size={16} /></div>{fieldError("timePreference")}</div>
          <p className="form-help field-full date-help"><Icon name="calendar" size={15} />Times are local to your property. We’ll confirm availability before scheduling.</p>
        </div> : <>
          <div className="summary-strip"><Icon name="droplet" size={21} /><div><strong>{bookingServices.find((item) => item.value === fields.service)?.label}</strong><span>{formatDate(fields.preferredDate)} · ZIP {fields.zip}</span></div><button type="button" onClick={() => setStep(1)}>Edit</button></div>
          <div className="form-grid">
            <div className="field field-full"><label htmlFor="booking-fullName">Full name</label><input {...inputProps("fullName")} value={fields.fullName} onChange={(event) => update("fullName", event.target.value)} placeholder="Your first and last name" autoComplete="name" maxLength={100} required />{fieldError("fullName")}</div>
            <div className="field"><label htmlFor="booking-email">Email address</label><input {...inputProps("email")} type="email" value={fields.email} onChange={(event) => update("email", event.target.value)} placeholder="you@example.com" autoComplete="email" maxLength={254} required />{fieldError("email")}</div>
            <div className="field"><label htmlFor="booking-phone">Phone number</label><input {...inputProps("phone")} type="tel" value={fields.phone} onChange={(event) => update("phone", event.target.value)} placeholder="(555) 123-4567" autoComplete="tel" maxLength={32} required />{fieldError("phone")}</div>
            <div className="field field-full"><label htmlFor="booking-notes">Anything else we should know? <span className="optional">(optional)</span></label><textarea {...inputProps("notes")} value={fields.notes} onChange={(event) => update("notes", event.target.value)} placeholder="A new home, a growing farm, a well that needs a little care…" maxLength={1500} rows={3} />{fieldError("notes")}</div>
            <div className="field-full"><label className="consent-label"><input {...inputProps("consent")} type="checkbox" checked={fields.consent} onChange={(event) => update("consent", event.target.checked)} required /><span>I agree to have these details stored to respond to my demo request. No marketing subscription, no obligation.</span></label>{fieldError("consent")}</div>
          </div>
        </>}
        <div className="honeypot" aria-hidden="true"><label htmlFor="booking-website">Leave this field empty</label><input id="booking-website" name="website" value={fields.website} onChange={(event) => update("website", event.target.value)} tabIndex={-1} autoComplete="off" /></div>
        <div className="form-actions">{step === 2 && <button className="back-button" type="button" onClick={() => setStep(1)} disabled={submitting}><Icon name="chevron-left" size={16} />Back</button>}<button className="button button-primary" type="submit" disabled={submitting}>{submitting ? <><span className="spinner" />Saving your request…</> : <>{step === 1 ? "Next: your details" : "Request my free demo"}<Icon name="arrow-right" size={18} /></>}</button></div>
        <div className="booking-assurances"><span><Icon name="check" size={14} />100% free</span><span><Icon name="check" size={14} />No obligation</span><span><Icon name="lock" size={13} />Securely stored</span></div>
        <p className="demo-disclaimer">Demo website: please use sample contact details. No real appointment or email is created. Your request is saved to this demo’s database.</p>
      </form>
    </>}
  </Modal>;
}
