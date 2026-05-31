import Link from "next/link";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <main className="app-shell">
      <section className="error-shell">
        <h1>Studio room not found.</h1>
        <p>This local route does not exist. Return to the Game OS dashboard to continue.</p>
        <Link className="primary-button" href="/">
          <Home size={18} aria-hidden />
          Open Dashboard
        </Link>
      </section>
    </main>
  );
}
