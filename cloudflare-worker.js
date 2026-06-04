/**
 * Cloudflare Worker — CORS Proxy for RamanStock macro dashboard
 * 部署步驟：
 * 1. 前往 https://workers.cloudflare.com → 登入（免費帳號即可）
 * 2. Create Worker → 貼上此程式碼 → Deploy
 * 3. 記下你的 Worker URL（格式：https://xxx.xxx.workers.dev）
 * 4. 把 URL 填入 analysis_macro_v6.js 的 WORKER_PROXY_URL 變數
 */

const ALLOWED_ORIGINS = [
  'https://anonymous596314-source.github.io',
  'http://localhost',
  'http://127.0.0.1',
];

// 允許代理的目標域名白名單（安全起見只允許必要的域名）
const ALLOWED_TARGETS = [
  'query1.finance.yahoo.com',
  'query2.finance.yahoo.com',
  'stooq.com',
  'fred.stlouisfed.org',
  'api.stlouisfed.org',
  'historyofmarket.com',
  'api.frankfurter.app',
  'data.gov.tw',
];

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    const corsHeaders = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const target = url.searchParams.get('url');

    if (!target) {
      return new Response('Missing ?url= parameter', { status: 400, headers: corsHeaders });
    }

    let targetUrl;
    try { targetUrl = new URL(target); } catch {
      return new Response('Invalid URL', { status: 400, headers: corsHeaders });
    }

    if (!ALLOWED_TARGETS.some(d => targetUrl.hostname.endsWith(d))) {
      return new Response(`Domain not allowed: ${targetUrl.hostname}`, { status: 403, headers: corsHeaders });
    }

    try {
      const resp = await fetch(targetUrl.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        cf: { cacheTtl: 300, cacheEverything: false },
      });

      const body = await resp.arrayBuffer();
      return new Response(body, {
        status: resp.status,
        headers: {
          ...corsHeaders,
          'Content-Type': resp.headers.get('Content-Type') || 'text/plain',
        },
      });
    } catch (e) {
      return new Response(`Proxy error: ${e.message}`, { status: 502, headers: corsHeaders });
    }
  },
};
