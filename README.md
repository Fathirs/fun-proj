# 🎴 DripDex — Outfit Check

"Strava buat outfit" — snap fit lo, AI deteksi tiap item jadi **kartu collectible**
dengan rarity, simpan ke timeline pribadi, dan kategoriin (Casual / Office / Date / dll).

Versi ini **MVP single-user**: semua data disimpan lokal di browser lo. Belum ada
social / share / battle — itu tahap berikutnya.

## Fitur (MVP)
- 📸 Snap / upload foto outfit (kamera HP atau drag-drop di desktop)
- 🤖 Deteksi item via **Jatevo** (model vision/VL, OpenAI-compatible)
- 🃏 Tiap item jadi kartu: nama, kategori, warna, **rarity** (Common→Legendary)
- 🏷️ Kategori outfit (AI nyaranin, bisa diedit manual)
- 🗂️ Timeline pribadi + filter per kategori
- 📊 Stats: streak harian, total outfit, koleksi item, rarity tertinggi
- 🧪 **Demo Mode** — coba seluruh loop tanpa API key (pakai data dummy)

## Cara jalanin
Nggak perlu build. Cukup serve folder ini sebagai static:

```bash
python3 -m http.server 8000
# buka http://localhost:8000
```

Atau buka `index.html` langsung di browser.

## Nyambungin ke Jatevo
1. Klik ⚙️ di pojok kanan atas
2. Isi:
   - **Base URL** — endpoint OpenAI-compatible Jatevo (mis. `https://api.jatevo.ai/v1`)
   - **Model** — model **vision/VL** (mis. `qwen3-vl-...`)
   - **API Key**
3. Matiin **Demo Mode**, lalu Simpan

Kredensial disimpan **lokal di browser** (localStorage) — nggak dikirim ke server lain.

> Catatan: kalau pakai Jatevo, foto di-upload ke API buat dianalisa (cloud).
> Beda sama pendekatan on-device. Lihat roadmap.

## Struktur
- `index.html` — markup & layout
- `styles.css` — tema gelap + styling kartu rarity
- `jatevo.js` — koneksi Jatevo (OpenAI-compatible) + Demo Mode + prompt
- `app.js` — state, storage, render UI

## Roadmap (arah "Strava for outfits")
- [ ] Follow / feed sosial + kudos
- [ ] Leaderboard & weekly outfit challenge
- [ ] Battle mode (outfit vs outfit)
- [ ] Generate share-card buat IG story
- [ ] Scarcity-based rarity (makin jarang di komunitas makin langka)
- [ ] On-device AI (privacy-first, ala CatchCat)
