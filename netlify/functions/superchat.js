// netlify/functions/superchat.js
// Two uses:
//   POST /.netlify/functions/superchat  — receive superchat data (from YouTube webhook or manual test)
//   GET  /.netlify/functions/superchat  — overlay polls for new superchats

const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const store = getStore("overlay-queue");

  // ── GET: overlay polls for new superchats ───────
  if (event.httpMethod === "GET") {
    try {
      let queue = [];
      try {
        const raw = await store.get("superchat-queue", { type: "json" });
        queue = Array.isArray(raw) ? raw : [];
      } catch (_) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ superchats: [] }),
        };
      }

      const newItems = queue.filter((s) => !s.shown);
      if (newItems.length > 0) {
        const updated = queue.map((s) =>
          newItems.find((n) => n.id === s.id) ? { ...s, shown: true } : s,
        );
        await store.setJSON("superchat-queue", updated);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ superchats: newItems }),
      };
    } catch (err) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ superchats: [] }),
      };
    }
  }

  // ── POST: add a superchat (test or webhook) ─────
  if (event.httpMethod === "POST") {
    const secret =
      event.headers["x-secret"] || JSON.parse(event.body || "{}").secret;
    const WEBHOOK_SECRET = process.env.NIGHTBOT_SECRET || "change-me";

    if (secret !== WEBHOOK_SECRET) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: "Unauthorized" }),
      };
    }

    try {
      const body = JSON.parse(event.body || "{}");
      let queue = [];
      try {
        const raw = await store.get("superchat-queue", { type: "json" });
        queue = Array.isArray(raw) ? raw : [];
      } catch (_) {}

      queue.push({
        id: body.id || `sc-${Date.now()}`,
        name: body.name || "Anonymous",
        avatar: body.avatar || "",
        amount: body.amount || "$5.00",
        message: body.message || "",
        ts: Date.now(),
        shown: false,
      });
      if (queue.length > 20) queue = queue.slice(-20);
      await store.setJSON("superchat-queue", queue);

      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    } catch (err) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: err.message }),
      };
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: "Method not allowed" }),
  };
};
