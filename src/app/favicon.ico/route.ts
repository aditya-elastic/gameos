const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#101413"/>
  <path d="M18 35h10M23 30v10M39 33h.1M47 29h.1" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>
  <path d="M18 22h28c6 0 10 5 11 11l2 10c1 6-3 11-9 11-3 0-5-1-7-3l-3-3H24l-3 3c-2 2-4 3-7 3-6 0-10-5-9-11l2-10c1-6 5-11 11-11Z" fill="none" stroke="#0f8f68" stroke-width="4"/>
</svg>`;

export function GET() {
  return new Response(icon, {
    headers: {
      "content-type": "image/svg+xml",
      "cache-control": "public, max-age=31536000, immutable"
    }
  });
}
