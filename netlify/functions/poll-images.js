// netlify/functions/poll-images.js
// Called by the OBS overlay every 3 seconds to get new generated images
// GET /.netlify/functions/poll-images

const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const store = getStore("overlay-queue");

    let queue = [];
    try {
      const raw = await store.get("image-queue", { type: "json" });
      queue = Array.isArray(raw) ? raw : [];
    } catch (_) {
      return { statusCode: 200, headers, body: JSON.stringify({ items: [] }) };
    }

    // Return only unshown items
    const newItems = queue.filter((item) => !item.shown);

    // Mark them all as shown
    if (newItems.length > 0) {
      queue = queue.map((item) =>
        newItems.find((n) => n.id === item.id)
          ? { ...item, shown: true }
          : item,
      );
      await store.setJSON("image-queue", queue);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ items: newItems }),
    };
  } catch (err) {
    console.error("Poll error:", err);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ items: [] }),
    };
  }
};
