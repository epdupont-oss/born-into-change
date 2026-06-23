const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS_HEADERS });
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  const { messages, model } = body;
  if (!Array.isArray(messages)) {
    return new Response(JSON.stringify({ error: "`messages` array is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: model || "llama-3.3-70b-versatile",
      messages,
    }),
  });

  const data = await groqResponse.text();

  return new Response(data, {
    status: groqResponse.status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
