const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#10272f"/>
  <path d="M18 45V19h17c8 0 13 5 13 12s-5 12-13 12h-8v2h-9Zm9-10h8c3 0 5-1 5-4s-2-4-5-4h-8v8Z" fill="#5eead4"/>
</svg>`;

export function GET() {
  return new Response(favicon, {
    headers: {
      "Cache-Control": "public, max-age=86400",
      "Content-Type": "image/svg+xml; charset=utf-8",
    },
  });
}
