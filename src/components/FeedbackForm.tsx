"use client";

import { useState } from "react";

/**
 * Guest feedback form under the Act-of-Parliament heading.
 * Sends directly to the institute's dedicated email (mail app) or WhatsApp
 * number — both entered manually by the root admin in Settings.
 */
export default function FeedbackForm({
  orgShortName,
  feedbackEmail,
  feedbackWhatsapp,
}: {
  orgShortName: string;
  feedbackEmail: string;
  feedbackWhatsapp: string;
}) {
  const ENQUIRY_TYPES = [
    "General enquiry",
    "Change of Name",
    "Correction of Record (wrong spelling, number, address…)",
    "Missing Record / Not found in database",
    "Certificate Collection",
    "Membership Upgrade",
    "Renewal / Dues enquiry",
    "Replacement of Lost Certificate",
    "New Membership Application",
    "Complaint",
  ];

  const [form, setForm] = useState({ name: "", contact: "", enquiry: ENQUIRY_TYPES[0], regNumber: "", message: "" });
  const [notice, setNotice] = useState("");

  const hasEmail = Boolean(feedbackEmail.trim());
  const digits = feedbackWhatsapp.replace(/\D/g, "");
  const hasWhatsapp = digits.length >= 10;

  const composed = () =>
    [
      `${form.enquiry} — ${orgShortName} Membership Database`,
      "",
      `Enquiry type: ${form.enquiry}`,
      `From: ${form.name.trim() || "A guest"}`,
      form.regNumber.trim() ? `Registration number: ${form.regNumber.trim()}` : "",
      form.contact.trim() ? `Contact: ${form.contact.trim()}` : "",
      "",
      form.message.trim(),
    ]
      .filter((line) => line !== "")
      .join("\n");

  function valid(): boolean {
    if (form.message.trim().length < 5) {
      setNotice("Please write your feedback first (at least a short sentence).");
      return false;
    }
    setNotice("");
    return true;
  }

  function sendEmail() {
    if (!valid()) return;
    const url = `mailto:${feedbackEmail}?subject=${encodeURIComponent(
      `${form.enquiry} — ${form.name.trim() || "guest"}`,
    )}&body=${encodeURIComponent(composed())}`;
    window.location.href = url;
    setNotice("Your mail app has opened with the message ready — press send there.");
  }

  function sendWhatsapp() {
    if (!valid()) return;
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(composed())}`, "_blank", "noopener");
    setNotice("WhatsApp has opened with the message ready — press send there.");
  }

  if (!hasEmail && !hasWhatsapp) return null;

  return (
    <section className="mx-auto mt-10 max-w-3xl">
      <div className="card overflow-hidden">
        <div className="border-b-2 border-brand-600 bg-gradient-to-r from-brand-50 via-white to-brand-50 px-4 py-4 text-center sm:px-6">
          <p className="text-[10px] font-bold uppercase leading-relaxed tracking-[0.04em] text-stone-800 sm:text-xs sm:tracking-[0.08em]">
            Established by the act of Parliament of the Federal Republic of Nigeria Gazetted Bill No. SB 220 Vol. 9 of 2012
          </p>
          <p className="mt-1.5 text-sm font-semibold text-brand-700 sm:text-base">For Questions, Corrections or Complaints, Send Feedback Below</p>
        </div>

        <div className="p-4 sm:p-6">
          <div className="mb-3">
            <label className="label" htmlFor="fb-enquiry">Enquiry type</label>
            <select
              id="fb-enquiry"
              className="input"
              value={form.enquiry}
              onChange={(event) => setForm({ ...form, enquiry: event.target.value })}
            >
              {ENQUIRY_TYPES.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="fb-name">Your name (optional)</label>
              <input
                id="fb-name"
                className="input"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="OLOWOOKERE OLUWASEYI ISAAC"
              />
            </div>
            <div>
              <label className="label" htmlFor="fb-contact">Your phone or email (optional)</label>
              <input
                id="fb-contact"
                className="input"
                value={form.contact}
                onChange={(event) => setForm({ ...form, contact: event.target.value })}
                placeholder="So the registry can reply to you"
              />
            </div>
          </div>
          <div className="mt-3">
            <label className="label" htmlFor="fb-reg">Registration number (if you have one)</label>
            <input
              id="fb-reg"
              className="input"
              value={form.regNumber}
              onChange={(event) => setForm({ ...form, regNumber: event.target.value })}
              placeholder="e.g. 3932/SILRM"
            />
          </div>
          <div className="mt-3">
            <label className="label" htmlFor="fb-message">Your feedback</label>
            <textarea
              id="fb-message"
              className="input min-h-[110px]"
              value={form.message}
              onChange={(event) => setForm({ ...form, message: event.target.value })}
              placeholder={form.enquiry === "Change of Name" ? "e.g. My name changed from OKONKWO GRACE IFEOMA to ADEYEMI GRACE IFEOMA after marriage — attached is my court affidavit." : "Describe your enquiry — include any details that will help the registry resolve it."}
            />
          </div>

          {notice ? <p className="mt-3 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-2.5 text-xs font-medium text-brand-900">{notice}</p> : null}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            {hasEmail ? (
              <button type="button" className="btn-primary flex-1" onClick={sendEmail}>
                ✉️ Send by Email
              </button>
            ) : null}
            {hasWhatsapp ? (
              <button
                type="button"
                className="btn flex-1 font-semibold text-white"
                style={{ background: "#25D366" }}
                onClick={sendWhatsapp}
              >
                Send via WhatsApp
              </button>
            ) : null}
          </div>
          <p className="mt-3 text-center text-[11px] text-stone-400">
            Goes directly to the institute&apos;s dedicated {hasEmail && hasWhatsapp ? "email / WhatsApp" : hasEmail ? "email" : "WhatsApp"} — no account needed.
          </p>
        </div>
      </div>
    </section>
  );
}
