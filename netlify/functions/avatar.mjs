export default async (request) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };

  globalThis.recentAvatars = globalThis.recentAvatars || [];
  const url = new URL(request.url);
  const userParam = url.searchParams.get("user");
  const promptParam = url.searchParams.get("prompt");

  if (userParam && promptParam) {
    const user = userParam.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
    const prompt = promptParam.slice(0, 100);
    const id = Date.now();

    // Use reliable placeholder service with custom text
    const encodedText = encodeURIComponent(`${user}'s ${prompt}`);
const imageUrl = `https://www.pollinations.ai/prompt/cute%20chibi%20avatar%20of%20${encodeURIComponent(user)}%20as%20${encodeURIComponent(prompt)}?width=512&height=512&seed=${id}&nologo=true`;
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

  // FETCH AVATARS (OBS) - no params or missing params
  return new Response(
    JSON.stringify({
      avatars: globalThis.recentAvatars,
    }),
    { headers },
  );
};
