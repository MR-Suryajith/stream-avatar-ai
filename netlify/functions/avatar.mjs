export default async (request) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };

  globalThis.recentAvatars = globalThis.recentAvatars || [];

  const url = new URL(request.url);

  // Check if this is a generate request (has user AND prompt params)
  const userParam = url.searchParams.get("user");
  const promptParam = url.searchParams.get("prompt");

  // 🔹 GENERATE AVATAR (Nightbot) - if both params exist
  if (userParam && promptParam) {
    const user = userParam.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
    const prompt = promptParam.slice(0, 100);
    const id = Date.now();

    const imageUrl = `https://image.pollinations.ai/prompt/cute%20chibi%20avatar%20of%20${encodeURIComponent(user)}%20as%20${encodeURIComponent(prompt)}%20kawaii%20colorful%203D%20render?width=512&height=512&seed=${id}&nologo=true`;

    globalThis.recentAvatars.unshift({
      id,
      username: user,
      prompt,
      image: imageUrl,
    });

    globalThis.recentAvatars = globalThis.recentAvatars.slice(0, 10);

    return new Response(
      JSON.stringify({
        message: `✨ @${user}'s avatar is appearing on stream!`,
        imageUrl,
      }),
      { headers },
    );
  }

  // 🔹 FETCH AVATARS (OBS) - no params or missing params
  return new Response(
    JSON.stringify({
      avatars: globalThis.recentAvatars,
    }),
    { headers },
  );
};
