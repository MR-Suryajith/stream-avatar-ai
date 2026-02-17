// netlify/functions/poll-images.js
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

async function redisGet(key) {
  const r = await fetch(`${REDIS_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
  const d = await r.json();
  if (!d.result) return [];
  try {
    return JSON.parse(d.result);
  } catch {
    return [];
  }
}

async function redisSet(key, value) {
  // Correct Upstash REST format: /set/key/value
  const encoded = encodeURIComponent(JSON.stringify(value));
  await fetch(`${REDIS_URL}/set/${key}/${encoded}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS")
    return { statusCode: 200, headers: HEADERS, body: "" };

  try {
    const queue = await redisGet("img_queue");
    const newItems = queue.filter((i) => !i.shown);

    if (newItems.length > 0) {
      const updated = queue.map((i) =>
        newItems.find((n) => n.id === i.id) ? { ...i, shown: true } : i,
      );
      await redisSet("img_queue", updated.slice(-10));
    }

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({ items: newItems }),
    };
  } catch (err) {
    console.error("[poll-images]", err.message);
    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({ items: [] }),
    };
  }
};
