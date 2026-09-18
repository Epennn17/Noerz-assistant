/* =========================================================
   NOERZ ASSISTANT — Backend Proxy for Vercel
   Endpoint: /api/proxy
   ========================================================= */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ status: false, error: 'Method not allowed.' });
  }
  
  try {
    const { url, text, model } = req.body || {};
    if (!url) return res.status(400).json({ status: false, error: 'url wajib diisi.' });
    
    const allowed = ['api.alwayscodex.eu.cc'];
    let host;
    try { host = new URL(url).host; } catch (e) {
      return res.status(400).json({ status: false, error: 'URL tidak valid.' });
    }
    if (!allowed.includes(host)) {
      return res.status(403).json({ status: false, error: 'Domain tidak diizinkan.' });
    }
    
    const target = new URL(url);
    if (text) target.searchParams.set('text', text);
    if (model) target.searchParams.set('model', model);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(function() { controller.abort(); }, 55000);
    
    let apiRes;
    try {
      apiRes = await fetch(target.toString(), {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
    } catch (e) {
      clearTimeout(timeoutId);
      if (e.name === 'AbortError') {
        return res.status(504).json({ status: false, error: 'Request timeout.' });
      }
      return res.status(502).json({ status: false, error: 'Gagal terhubung ke server AI.' });
    }
    
    const body = await apiRes.text();
    res.status(apiRes.status);
    try { return res.json(JSON.parse(body)); } catch (e) { return res.send(body); }
    
  } catch (err) {
    return res.status(500).json({ status: false, error: 'Server error.', detail: err.message });
  }
}