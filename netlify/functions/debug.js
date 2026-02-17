// netlify/functions/debug.js
// TEMPORARY - delete after fixing
// Visit: https://stream-avatar.netlify.app/.netlify/functions/debug

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

exports.handler = async (event) => {
  const results = {};

  // Test 1: Check env vars exist
  results.hasUrl = !!REDIS_URL;
  results.hasToken = !!REDIS_TOKEN;
  results.urlPreview = REDIS_URL ? REDIS_URL.slice(0, 30) + "..." : "MISSING";

  // Test 2: Try GET (read)
  try {
    const r = await fetch(`${REDIS_URL}/get/test_key`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    });
    const d = await r.json();
    results.getStatus = r.status;
    results.getResponse = d;
  } catch (err) {
    results.getError = err.message;
  }

  // Test 3: Try SET via base URL POST with array body
  try {
    const r = await fetch(`${REDIS_URL}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(["SET", "test_key", "hello123"]),
    });
    const d = await r.json();
    results.setViaBaseUrl = { status: r.status, response: d };
  } catch (err) {
    results.setViaBaseUrlError = err.message;
  }

  // Test 4: Try SET via /set/key/value URL
  try {
    const r = await fetch(`${REDIS_URL}/set/test_key2/hello456`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    });
    const d = await r.json();
    results.setViaUrlPath = { status: r.status, response: d };
  } catch (err) {
    results.setViaUrlPathError = err.message;
  }

  // Test 5: Read back test_key to confirm write worked
  try {
    const r = await fetch(`${REDIS_URL}/get/test_key`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    });
    const d = await r.json();
    results.readBackTest1 = d;
  } catch (err) {
    results.readBackError = err.message;
  }

  // Test 6: Read back test_key2
  try {
    const r = await fetch(`${REDIS_URL}/get/test_key2`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    });
    const d = await r.json();
    results.readBackTest2 = d;
  } catch (err) {
    results.readBackError2 = err.message;
  }

  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify(results, null, 2),
  };
};
