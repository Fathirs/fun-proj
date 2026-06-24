/* ============================================================
 * jatevo.js — koneksi ke Jatevo (OpenAI-compatible) + Demo Mode
 * Tugasnya: terima gambar outfit -> balikin struktur deteksi.
 * ============================================================ */

const Jatevo = (() => {
  const CFG_KEY = 'dripdex.jatevo.cfg';

  const RARITIES = ['Common', 'Rare', 'Epic', 'Legendary'];

  function loadConfig() {
    try {
      return JSON.parse(localStorage.getItem(CFG_KEY)) || {};
    } catch {
      return {};
    }
  }

  function saveConfig(cfg) {
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
  }

  function isReady() {
    const c = loadConfig();
    return c.demo || (c.baseUrl && c.model && c.key);
  }

  // Prompt yang maksa model balikin JSON terstruktur.
  const SYSTEM_PROMPT =
    'Kamu adalah "DripDex", AI penilai outfit. Diberi sebuah foto, ' +
    'identifikasi tiap item fashion yang terlihat (atasan, bawahan, outerwear, ' +
    'sepatu, tas, jam, topi, kacamata, aksesoris). Untuk setiap item beri: ' +
    'name (singkat, mis. "Sneaker putih"), category (Atasan/Bawahan/Outerwear/' +
    'Sepatu/Tas/Jam/Aksesoris/Topi/Kacamata), color, emoji (1 emoji), ' +
    'rarity (Common/Rare/Epic/Legendary berdasar perpaduan nilai & gaya), ' +
    'dan note singkat (<=8 kata). Juga tentukan outfitCategory ' +
    '(Casual/Office/Date/Gym/Streetwear/Formal/Loungewear) dan dripScore (0-100). ' +
    'Balas HANYA JSON valid dengan bentuk: ' +
    '{"outfitCategory": string, "dripScore": number, "items": [{"name","category","color","emoji","rarity","note"}]}. ' +
    'Tanpa teks lain, tanpa markdown.';

  function extractJSON(text) {
    if (!text) throw new Error('Balasan kosong dari model');
    // buang fence ```json ... ```
    let t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    try {
      return JSON.parse(t);
    } catch {
      const m = t.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
      throw new Error('Gagal parse JSON dari model');
    }
  }

  function normalize(data) {
    const items = Array.isArray(data.items) ? data.items : [];
    return {
      outfitCategory: data.outfitCategory || 'Casual',
      dripScore: Math.max(0, Math.min(100, Math.round(data.dripScore ?? 50))),
      items: items.map((it) => ({
        name: it.name || 'Item',
        category: it.category || 'Aksesoris',
        color: it.color || '',
        emoji: it.emoji || '🧥',
        rarity: RARITIES.includes(it.rarity) ? it.rarity : 'Common',
        note: it.note || '',
      })),
    };
  }

  // ---- Panggilan API beneran (OpenAI-compatible chat completions) ----
  async function callApi(dataUrl, cfg) {
    const base = cfg.baseUrl.replace(/\/$/, '');
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.key}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0.4,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analisa outfit di foto ini. Balas JSON saja.' },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Jatevo error ${res.status}: ${body.slice(0, 200)}`);
    }
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    return normalize(extractJSON(content));
  }

  // ---- Demo mode: data dummy biar bisa nyobain loop tanpa API ----
  const DEMO_POOL = [
    { name: 'Kaos oversized', category: 'Atasan', color: 'Hitam', emoji: '👕', rarity: 'Common', note: 'Basic tapi clean' },
    { name: 'Cargo pants', category: 'Bawahan', color: 'Olive', emoji: '👖', rarity: 'Rare', note: 'Siluet on point' },
    { name: 'Sneaker chunky', category: 'Sepatu', color: 'Putih', emoji: '👟', rarity: 'Epic', note: 'Statement piece' },
    { name: 'Jam diver', category: 'Jam', color: 'Silver', emoji: '⌚', rarity: 'Legendary', note: 'Wrist game kuat' },
    { name: 'Tote bag kanvas', category: 'Tas', color: 'Cream', emoji: '👜', rarity: 'Rare', note: 'Daily driver' },
    { name: 'Bucket hat', category: 'Topi', color: 'Beige', emoji: '🧢', rarity: 'Rare', note: 'Nutup bad hair day' },
    { name: 'Kemeja linen', category: 'Atasan', color: 'Putih', emoji: '👔', rarity: 'Epic', note: 'Rapi & adem' },
    { name: 'Kacamata bulat', category: 'Kacamata', color: 'Hitam', emoji: '🕶️', rarity: 'Common', note: 'Aksen wajah' },
  ];
  const DEMO_CATS = ['Casual', 'Streetwear', 'Office', 'Date'];

  function demoDetect() {
    // pseudo-random tanpa Math.random (pakai waktu) — cukup buat demo
    const seed = Date.now();
    const n = 3 + (seed % 3); // 3-5 item
    const items = [];
    for (let i = 0; i < n; i++) {
      items.push(DEMO_POOL[(seed + i * 37) % DEMO_POOL.length]);
    }
    return normalize({
      outfitCategory: DEMO_CATS[seed % DEMO_CATS.length],
      dripScore: 55 + (seed % 40),
      items,
    });
  }

  // ---- Entry point dipakai app.js ----
  async function detectOutfit(dataUrl) {
    const cfg = loadConfig();
    if (cfg.demo || !(cfg.baseUrl && cfg.model && cfg.key)) {
      // delay kecil biar kerasa "loading"
      await new Promise((r) => setTimeout(r, 700));
      return demoDetect();
    }
    return callApi(dataUrl, cfg);
  }

  return { loadConfig, saveConfig, isReady, detectOutfit, RARITIES };
})();
