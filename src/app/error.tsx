"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="app-shell">
      <section className="error-shell">
        <AlertTriangle size={34} aria-hidden />
        <h1>Game OS hit a recoverable issue.</h1>
        <p>The local studio stayed intact. Reload the room and try the action again.</p>
        <button className="primary-button" type="button" onClick={reset}>
          <RotateCcw size={18} aria-hidden />
          Reload Studio
        </button>
      </section>
    </main>
  );
}
