"use client";

import { ReactNode, useEffect, useState } from "react";
import { MiniKit } from "@worldcoin/minikit-js";

/**
 * Installs MiniKit so this page behaves as a World App mini-app.
 *
 * MiniKit is what makes the app "native" inside World App (it bridges to the
 * host app). World ID verification itself runs through IDKit (unified SDK),
 * which automatically uses the in-app bridge when it detects it's running
 * inside World App, and falls back to a QR flow on desktop web. So the same
 * verification UI works in both places.
 */
export default function MiniKitProvider({ children }: { children: ReactNode }) {
  const [isWorldApp, setIsWorldApp] = useState<boolean | null>(null);

  useEffect(() => {
    MiniKit.install();
    setIsWorldApp(MiniKit.isInstalled());
  }, []);

  return (
    <>
      {isWorldApp === false && (
        <div className="mx-auto mb-4 max-w-md rounded-xl border border-amber-300/40 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
          Not running inside World App — verification will use the desktop QR
          flow. Open this app from World App for the native experience.
        </div>
      )}
      {children}
    </>
  );
}
