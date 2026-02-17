// netlify/functions/superchat.js
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const WEBHOOK_SECRET = process.env.NIGHTBOT_SECRET || "change-me";

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-secret",
  "Content-Type": "application/json",
};

async function redisPipeline(commands) {
  const r = await fetch(`${REDIS_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });
  return r.json();
}

async function redisGet(key) {
  const result = await redisPipeline([["GET", key]]);
  const val = result?.[0]?.result;
  if (!val) return [];
  try {
    return JSON.parse(val);
  } catch {
    return [];
  }
}

async function redisSet(key, value) {
  await redisPipeline([["SET", key, JSON.stringify(value)]]);
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS")
    return { statusCode: 200, headers: HEADERS, body: "" };

  if (event.httpMethod === "GET") {
    try {
      const queue = await redisGet("sc_queue");
      const newItems = queue.filter((s) => !s.shown);
      if (newItems.length > 0) {
        const updated = queue.map((s) =>
          newItems.find((n) => n.id === s.id) ? { ...s, shown: true } : s,
        );
        await redisSet("sc_queue", updated.slice(-30));
      }
      return {
        statusCode: 200,
        headers: HEADERS,
        body: JSON.stringify({ superchats: newItems }),
      };
    } catch (err) {
      console.error("[superchat GET error]", err.message);
      return {
        statusCode: 500,
        headers: HEADERS,
        body: JSON.stringify({ error: err.message, superchats: [] }),
      };
    }
  }

  if (event.httpMethod === "POST") {
    const secret = event.headers["x-secret"] || "";
    if (secret !== WEBHOOK_SECRET)
      return {
        statusCode: 401,
        headers: HEADERS,
        body: JSON.stringify({ error: "Unauthorized" }),
      };
    try {
      const body = JSON.parse(event.body || "{}");
      const queue = await redisGet("sc_queue");
      queue.push({
        id: `sc-${Date.now()}`,
        name: body.name || "Anonymous",
        avatar: body.avatar || "",
        amount: body.amount || "$5.00",
        message: body.message || "",
        ts: Date.now(),
        shown: false,
      });
      await redisSet("sc_queue", queue.slice(-30));
      return {
        statusCode: 200,
        headers: HEADERS,
        body: JSON.stringify({ ok: true }),
      };
    } catch (err) {
      console.error("[superchat POST error]", err.message);
      return {
        statusCode: 500,
        headers: HEADERS,
        body: JSON.stringify({ error: err.message }),
      };
    }
  }

  return {
    statusCode: 405,
    headers: HEADERS,
    body: JSON.stringify({ error: "Method not allowed" }),
  };
};
