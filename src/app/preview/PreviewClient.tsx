"use client";

import { useState } from "react";

const SCREENS = [
  { href: "/", label: "Home" },
  { href: "/guest", label: "Records" },
  { href: "/sync", label: "Sync / Upload" },
  { href: "/settings", label: "Settings" },
  { href: "/login", label: "Sign in" },
  { href: "/admin", label: "Admin dashboard" },
  { href: "/admin/records", label: "Admin records" },
  { href: "/admin/import", label: "Admin upload" },
];

const DEVICES = [
  { key: "phone", label: "Phone", width: 390, height: 780, note: "iPhone 14 / Pixel" },
  { key: "phone-sm", label: "Small phone", width: 320, height: 680, note: "iPhone SE" },
  { key: "tablet", label: "Tablet", width: 768, height: 900, note: "iPad portrait" },
] as const;

export default function PreviewClient() {
  const [device, setDevice] = useState<(typeof DEVICES)[number]>(DEVICES[0]);
  const [screen, setScreen] = useState(SCREENS[0].href);
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <div className="mx-auto max-w-6xl px-3 py-6 sm:px-6 sm:py-10">
      <div className="text-center">
        <span className="eyebrow">Device preview</span>
        <h1 className="mt-3 text-2xl font-black tracking-tight text-stone-900 sm:text-3xl">See the mobile view</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-stone-600">
          The live app rendered at real phone and tablet widths. Notice the menu moves to the bottom bar on small screens.
        </p>
      </div>

      <div className="mt-6 flex flex-col items-center gap-3">
        <div className="flex flex-wrap justify-center gap-1.5">
          {DEVICES.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setDevice(item)}
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                device.key === item.key ? "bg-brand-600 text-white" : "border border-[#eadfd5] bg-white text-stone-600 hover:border-brand-300"
              }`}
            >
              {item.label}
              <span className="ml-1.5 text-[10px] opacity-70">
                {item.width}×{item.height}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap justify-center gap-1.5">
          {SCREENS.map((item) => (
            <button
              key={item.href}
              type="button"
              onClick={() => setScreen(item.href)}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
                screen === item.href ? "bg-stone-900 text-white" : "bg-white text-stone-600 ring-1 ring-[#eadfd5] hover:ring-brand-300"
              }`}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-semibold text-brand-700 ring-1 ring-brand-200 hover:ring-brand-400"
          >
            ⟳ Reload
          </button>
        </div>
      </div>

      <div className="mt-7 flex justify-start overflow-x-auto pb-4 sm:justify-center">
        <div
          className="relative shrink-0 rounded-[2.2rem] border-[10px] border-stone-900 bg-stone-900 shadow-[0_30px_70px_-30px_rgba(23,21,20,0.6)]"
          style={{ width: device.width + 20, height: device.height + 20 }}
        >
          <div className="absolute left-1/2 top-[5px] z-10 h-4 w-28 -translate-x-1/2 rounded-full bg-stone-900" />
          <iframe
            key={`${device.key}-${screen}-${reloadKey}`}
            src={screen}
            title={`${device.label} preview`}
            className="h-full w-full rounded-[1.6rem] bg-white"
            style={{ width: device.width, height: device.height }}
          />
        </div>
      </div>

      <p className="text-center text-xs text-stone-500">
        Showing <span className="font-semibold text-stone-700">{screen}</span> at {device.width}×{device.height} ({device.note}).
        Admin screens need you to be signed in.
      </p>

      <div className="mx-auto mt-6 max-w-2xl rounded-2xl border border-[#f1e7df] bg-[#fffdfb] p-4 text-xs leading-relaxed text-stone-600">
        <p className="font-semibold text-stone-800">On a real phone</p>
        <p className="mt-1">
          Open the same link on your phone&apos;s browser. On Android/Chrome tap ⋮ → <strong>Install app</strong>; on iPhone/Safari tap Share →{" "}
          <strong>Add to Home Screen</strong> to run it full-screen and offline.
        </p>
      </div>
    </div>
  );
}
