// A dedicated response avoids combining the page CSP with the Wasm worker policy.
// Only the trusted worker loader runs browser JS; guest source stays in QuickJS.
export const onRequest: PagesFunction<{ ASSETS: Fetcher }> = async ({
  request,
  env,
}) => {
  const url = new URL(request.url);
  if (
    !/^\/practice-worker\/local-practice\.worker-[A-Za-z0-9_-]+\.js$/.test(
      url.pathname,
    ) ||
    !["GET", "HEAD"].includes(request.method)
  )
    return new Response(null, { status: 404 });
  const asset = await env.ASSETS.fetch(request);
  const response = new Response(asset.body, asset);
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'none'; object-src 'none'; base-uri 'none'",
  );
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
};
