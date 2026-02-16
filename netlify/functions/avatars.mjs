export default async (request, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
    "Cache-Control": "no-cache",
  };

  const avatars = globalThis.recentAvatars || [];

  return new Response(
    JSON.stringify({
      avatars: avatars,
      count: avatars.length,
    }),
    { headers },
  );
};
