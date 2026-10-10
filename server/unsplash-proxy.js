/**
 * Optional Cloudflare Worker that lets every user of the plugin search Unsplash without their own key.
 * The Access Key lives only here, as a Worker secret, never in the plugin:
 *   npx wrangler secret put UNSPLASH_ACCESS_KEY
 *   npx wrangler deploy server/unsplash-proxy.js --name qiaomu-unsplash --compatibility-date 2025-01-01
 * then set the plugin's "Unsplash proxy" setting to https://qiaomu-unsplash.<you>.workers.dev
 *
 * Why a proxy and not a key inside the plugin: anything shipped inside a plugin can be read by anyone who installs it, so a bundled
 * key leaks within a day. A demo key also allows only 50 requests per hour for the WHOLE app, so a shared client-side key would be
 * exhausted at once; this Worker caches results to stretch it, and you can apply for Unsplash production status (5,000/hour).
 */
const ALLOWED = [/^\/search\/photos$/, /^\/photos$/, /^\/photos\/[A-Za-z0-9_-]+\/download$/];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors() });
    if (!ALLOWED.some(r => r.test(url.pathname))) return new Response('not found', { status: 404, headers: cors() });
    const cache = caches.default; const key = new Request(url.toString(), { method: 'GET' });
    const hit = await cache.match(key); if (hit) return hit;
    const upstream = await fetch(`https://api.unsplash.com${url.pathname}${url.search}`, { headers: { Authorization: `Client-ID ${env.UNSPLASH_ACCESS_KEY}`, 'Accept-Version': 'v1' } });
    const res = new Response(upstream.body, { status: upstream.status, headers: { ...cors(), 'Content-Type': upstream.headers.get('Content-Type') || 'application/json', 'Cache-Control': 'public, max-age=3600' } });
    if (upstream.ok && !url.pathname.endsWith('/download')) ctx.waitUntil(cache.put(key, res.clone()));
    return res;
  },
};
const cors = () => ({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' });
