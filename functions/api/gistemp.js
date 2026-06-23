const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const SOURCE_URL = "https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv";

export async function onRequestOptions() {
  return new Response(null, { headers: CORS_HEADERS });
}

export async function onRequestGet() {
  // NASA's GISTEMP CSV doesn't send CORS headers, so the browser can't fetch
  // it directly. This proxies it server-side and re-serves it with CORS open.
  const res = await fetch(SOURCE_URL);
  if (!res.ok) {
    return new Response("Failed to fetch GISTEMP data", { status: 502, headers: CORS_HEADERS });
  }
  const text = await res.text();
  return new Response(text, {
    headers: {
      "Content-Type": "text/csv",
      "Cache-Control": "public, max-age=86400",
      ...CORS_HEADERS,
    },
  });
}
