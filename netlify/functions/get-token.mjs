export default async () => {
  return new Response(JSON.stringify({ token: process.env.CB_TOKEN || '' }), {
    headers: { 'Content-Type': 'application/json' }
  });
};
