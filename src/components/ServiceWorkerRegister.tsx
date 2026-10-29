"use client";

import { useEffect } from "react";

/**
 * Installs the offline app shell and — crucially — asks the browser for
 * *persistent* storage. Without this, Chrome/Safari may evict IndexedDB and
 * cached pages when the device is low on space. With it granted, the saved
 * register survives reboots and stays until the user deletes it.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    const register = async () => {
      if ("serviceWorker" in navigator) {
        try {
          const registration = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
          // Pick up new app versions without the user doing anything.
          registration.addEventListener("updatefound", () => {
            const installing = registration.installing;
            if (!installing) return;
            installing.addEventListener("statechange", () => {
              if (installing.state === "installed" && navigator.serviceWorker.controller) {
                window.dispatchEvent(new Event("meridian:update-ready"));
              }
            });
          });
          setInterval(() => registration.update().catch(() => undefined), 60 * 60 * 1000);
        } catch {
          /* service workers unavailable (private mode / http) */
        }
      }

      // Ask the OS to keep our data permanently.
      try {
        if (navigator.storage?.persist) {
          const already = await navigator.storage.persisted?.();
          if (!already) await navigator.storage.persist();
        }
      } catch {
        /* storage API unsupported */
      }
    };

    if (document.readyState === "complete") void register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
