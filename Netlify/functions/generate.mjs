// This runs when someone types !avatar lion
export default async (request, context) => {
  // Enable CORS
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  // Handle preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { headers, status: 204 });
  }

  try {
    const url = new URL(request.url);
    const user = url.searchParams.get("user") || "anonymous";
    const prompt = url.searchParams.get("prompt") || "cute avatar";

    // Clean inputs
    const cleanUser = user.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
    const cleanPrompt = prompt.slice(0, 100);

    // Generate unique seed for variety
    const seed = Date.now();

    // Build Pollinations URL - FREE, NO API KEY NEEDED!
    const imageUrl = `https://image.pollinations.ai/prompt/cute%20chibi%20avatar%20of%20${encodeURIComponent(cleanUser)}%20as%20${encodeURIComponent(cleanPrompt)}%20kawaii%20colorful%203D%20render%20isometric?width=512&height=512&seed=${seed}&nologo=true&private=true`;

    // Store in Netlify's edge storage (lasts for session)
    // Using a simple global variable approach for demo (resets on cold start but works)
    const avatarData = {
      id: seed,
      username: cleanUser,
      prompt: cleanPrompt,
      image: imageUrl,
      createdAt: new Date().toISOString(),
    };

    // Store in global (simplest approach for free tier)
    globalThis.recentAvatars = globalThis.recentAvatars || [];
    globalThis.recentAvatars.unshift(avatarData);
    globalThis.recentAvatars = globalThis.recentAvatars.slice(0, 20); // Keep last 20

    // Return message for Nightbot to display in chat
    return new Response(
      JSON.stringify({
        message: `✨ @${cleanUser}'s "${cleanPrompt}" avatar is appearing on stream! 🎨`,
        imageUrl: imageUrl,
      }),
      { headers },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        message: `❌ Error generating avatar. Try again!`,
      }),
      { headers, status: 500 },
    );
  }
};
