import satori, { init as initSatori } from "satori/wasm";
import initYoga from "yoga-wasm-web";
import yogaWasm from "../../node_modules/yoga-wasm-web/dist/yoga.wasm";
import { Resvg, initWasm as initResvg } from "@resvg/resvg-wasm";
import resvgWasm from "../../node_modules/@resvg/resvg-wasm/index_bg.wasm";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

// Requires `npm install` to have run before Cloudflare bundles Functions
// (the project's Pages build command must be set to `npm install` — see
// CLAUDE.md). Dynamic import() of remote esm.sh URLs at runtime was tried
// and does NOT work reliably in workerd; this is the supported approach.
let wasmReady = null;
async function ensureWasmInitialized() {
  if (!wasmReady) {
    wasmReady = Promise.all([
      initYoga(yogaWasm).then((yoga) => initSatori(yoga)),
      initResvg(resvgWasm),
    ]);
  }
  return wasmReady;
}

const WIDTH = 1200;
const HEIGHT = 627;

let cachedFont = null;
async function loadFont() {
  if (cachedFont) return cachedFont;
  const res = await fetch(
    "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.ttf"
  );
  cachedFont = await res.arrayBuffer();
  return cachedFont;
}

function buildCard({ city, year, winterWarming, summerWarming, co2 }) {
  const hasStats = winterWarming !== null && summerWarming !== null && co2 !== null;

  const statBlock = (label, value, color) => ({
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        marginRight: 56,
      },
      children: [
        {
          type: "div",
          props: {
            style: { fontSize: 22, color: "#9aa3ad", marginBottom: 6 },
            children: label,
          },
        },
        {
          type: "div",
          props: {
            style: { fontSize: 48, fontWeight: 700, color },
            children: value,
          },
        },
      ],
    },
  });

  const stats = hasStats
    ? [
        statBlock("Summers", `+${Number(summerWarming).toFixed(1)}°C`, "#c2563d"),
        statBlock("Winters", `+${Number(winterWarming).toFixed(1)}°C`, "#3b6fa6"),
        statBlock("CO2 rise", `+${Math.round(co2)} ppm`, "#c08a4e"),
      ]
    : [];

  return {
    type: "div",
    props: {
      style: {
        width: WIDTH,
        height: HEIGHT,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: "#0d1117",
        padding: 64,
        fontFamily: "Inter",
        position: "relative",
      },
      children: [
        // top-right decorative spiral
        {
          type: "div",
          props: {
            style: {
              position: "absolute",
              top: 48,
              right: 48,
              width: 140,
              height: 140,
              borderRadius: "50%",
              border: "6px solid #a82e2e",
              display: "flex",
            },
          },
        },
        {
          type: "div",
          props: {
            style: {
              position: "absolute",
              top: 66,
              right: 66,
              width: 104,
              height: 104,
              borderRadius: "50%",
              border: "6px solid #c08a4e",
              display: "flex",
            },
          },
        },
        {
          type: "div",
          props: {
            style: {
              position: "absolute",
              top: 84,
              right: 84,
              width: 68,
              height: 68,
              borderRadius: "50%",
              border: "6px solid #3b6fa6",
              display: "flex",
            },
          },
        },
        // header
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column" },
            children: [
              {
                type: "div",
                props: {
                  style: { fontSize: 40, fontWeight: 700, color: "#f0f2f4" },
                  children: "Born Into Change",
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    fontSize: 26,
                    color: "#c9cfd6",
                    marginTop: 14,
                  },
                  children: `${city} · Born ${year}`,
                },
              },
            ],
          },
        },
        // stats row
        {
          type: "div",
          props: {
            style: { display: "flex", alignItems: "center" },
            children: stats,
          },
        },
        // footer
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
            },
            children: [
              {
                type: "div",
                props: {
                  style: { fontSize: 22, color: "#7d8590", fontStyle: "italic" },
                  children: "Climate change, measured in your lifetime.",
                },
              },
              {
                type: "div",
                props: {
                  style: { display: "flex", flexDirection: "column", alignItems: "flex-end" },
                  children: [
                    {
                      type: "div",
                      props: { style: { fontSize: 20, color: "#c9cfd6" }, children: "borninto.change" },
                    },
                    {
                      type: "div",
                      props: {
                        style: { fontSize: 16, color: "#7d8590", marginTop: 4 },
                        children: "Data: Open-Meteo · NASA · NOAA",
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  };
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS_HEADERS });
}

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const city = url.searchParams.get("city") || "Somewhere";
  const year = url.searchParams.get("year") || "----";
  const winterWarming = url.searchParams.has("winterWarming")
    ? url.searchParams.get("winterWarming")
    : null;
  const summerWarming = url.searchParams.has("summerWarming")
    ? url.searchParams.get("summerWarming")
    : null;
  const co2 = url.searchParams.has("co2") ? url.searchParams.get("co2") : null;

  try {
    await ensureWasmInitialized();

    const font = await loadFont();
    const svg = await satori(buildCard({ city, year, winterWarming, summerWarming, co2 }), {
      width: WIDTH,
      height: HEIGHT,
      fonts: [{ name: "Inter", data: font, weight: 700, style: "normal" }],
    });

    const resvg = new Resvg(svg, { fitTo: { mode: "width", value: WIDTH } });
    const png = resvg.render().asPng();

    return new Response(png, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
        ...CORS_HEADERS,
      },
    });
  } catch (err) {
    // LinkedIn/Twitter fall back silently on a non-2xx og:image, so failing
    // here has no user-facing impact on the main app.
    return new Response(`OG image generation failed: ${err.message}`, {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
}
