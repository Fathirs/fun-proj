/* ============================================================
 * jatevo.js — "Cari berdasar makna" via Jatevo (OpenAI-compatible)
 * PENTING: AI cuma NUNJUK nomor surah:ayat yang relevan.
 * Teks ayatnya SELALU diambil dari API terverifikasi (app.js),
 * bukan dari AI. Jadi AI nggak pernah "ngarang" isi ayat.
 * ============================================================ */

const Jatevo = (() => {
  const CFG_KEY = 'ayat.jatevo.cfg';

  function loadConfig() {
    try { return JSON.parse(localStorage.getItem(CFG_KEY)) || {}; }
    catch { return {}; }
  }
  function saveConfig(cfg) { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); }
  function isConfigured() {
    const c = loadConfig();
    return c.demo || (c.baseUrl && c.model && c.key);
  }

  const SYSTEM_PROMPT =
    'Kamu asisten yang membantu menemukan ayat Al-Qur\'an yang relevan dengan ' +
    'pertanyaan atau tema dari pengguna. Kamu HANYA menunjuk lokasi ayat (nomor ' +
    'surah dan nomor ayat), TIDAK menuliskan teks ayat maupun terjemahannya. ' +
    'Pastikan nomor surah antara 1-114 dan nomor ayat valid untuk surah tsb. ' +
    'Balas HANYA JSON valid tanpa markdown, bentuk: ' +
    '{"refs":[{"surah":<int>,"ayah":<int>,"alasan":"<alasan singkat Bahasa Indonesia>"}]}. ' +
    'Maksimal 8 ayat, urut dari yang paling relevan.';

  function extractJSON(text) {
    if (!text) throw new Error('Balasan kosong dari model');
    let t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    try { return JSON.parse(t); }
    catch {
      const m = t.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
      throw new Error('Gagal parse JSON dari model');
    }
  }

  function normalize(data) {
    const refs = Array.isArray(data.refs) ? data.refs : [];
    return refs
      .map((r) => ({
        surah: Number(r.surah),
        ayah: Number(r.ayah),
        alasan: String(r.alasan || ''),
      }))
      .filter((r) => r.surah >= 1 && r.surah <= 114 && r.ayah >= 1)
      .slice(0, 8);
  }

  async function callApi(query, cfg) {
    const base = cfg.baseUrl.replace(/\/$/, '');
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.key}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Tema/pertanyaan: "${query}". Tunjuk ayat-ayat relevan (JSON saja).` },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Jatevo error ${res.status}: ${body.slice(0, 160)}`);
    }
    const json = await res.json();
    return normalize(extractJSON(json?.choices?.[0]?.message?.content));
  }

  // Demo: contoh referensi tetap (buat nyobain alur tanpa API key)
  const DEMO_REFS = [
    { surah: 2, ayah: 153, alasan: 'Perintah memohon pertolongan dengan sabar & salat' },
    { surah: 2, ayah: 155, alasan: 'Ujian dan kabar gembira bagi orang sabar' },
    { surah: 3, ayah: 200, alasan: 'Anjuran bersabar dan tetap teguh' },
    { surah: 103, ayah: 3, alasan: 'Saling menasihati dalam kesabaran' },
  ];

  async function searchByMeaning(query) {
    const cfg = loadConfig();
    if (cfg.demo || !(cfg.baseUrl && cfg.model && cfg.key)) {
      await new Promise((r) => setTimeout(r, 600));
      return { demo: true, refs: DEMO_REFS };
    }
    const refs = await callApi(query, cfg);
    return { demo: false, refs };
  }

  return { loadConfig, saveConfig, isConfigured, searchByMeaning };
})();
