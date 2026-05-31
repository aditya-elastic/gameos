import { Gamepad2 } from "lucide-react";

export default function Loading() {
  return (
    <main className="app-shell">
      <section className="loading-shell">
        <Gamepad2 size={34} aria-hidden />
        <h1>Loading Game OS</h1>
        <p>Preparing the local studio command center.</p>
      </section>
    </main>
  );
}
