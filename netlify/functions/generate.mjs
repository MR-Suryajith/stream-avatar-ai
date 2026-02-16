export default async (request, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers, status: 204 });
  }

  try {
    const url = new URL(request.url);
    const user = url.searchParams.get("user") || "anonymous";
    const prompt = url.searchParams.get("prompt") || "cute avatar";

    const cleanUser = user.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
    const cleanPrompt = prompt.slice(0, 100);
    const seed = Date.now();

    const imageUrl = `https://image.pollinations.ai/prompt/cute%20chibi%20avatar%20of%20${encodeURIComponent(cleanUser)}%20as%20${encodeURIComponent(cleanPrompt)}%20kawaii%20colorful%203D%20render?width=512&height=512&seed=${seed}&nologo=true`;

    globalThis.recentAvatars = globalThis.recentAvatars || [];
    globalThis.recentAvatars.unshift({
      id: seed,
      username: cleanUser,
      prompt: cleanPrompt,
      image: imageUrl,
      createdAt: new Date().toISOString(),
    });
    globalThis.recentAvatars = globalThis.recentAvatars.slice(0, 20);

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
        error: error.message,
      }),
      { headers, status: 500 },
    );
  }
};
