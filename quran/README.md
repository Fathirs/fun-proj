# ۩ Ayat — Cari & Baca Al-Qur'an

"pasal.id versi Al-Qur'an" — cari & baca Al-Qur'an **per-ayat** dengan cepat,
bersih, dan bisa dibookmark. Fokusnya sama kayak pasal.id: nemu potongan yang
lo cari tanpa harus baca dokumen (surah) utuh.

MVP ini **read-only client-side** (nggak ada backend). Semua data diambil dari
API Al-Qur'an terverifikasi langsung dari browser.

## Fitur (MVP)
- 🔎 **Cari** ayat berdasar kata pada terjemahan (mis. "sabar", "rezeki")
- #️⃣ Ketik **nomor surah** (1–114) di kotak cari → langsung lompat ke surah
- 📖 **Baca per-ayat**: teks Arab + transliterasi latin + terjemahan Indonesia
- 🔊 **Audio murotal** per ayat (Mishary Alafasy)
- 🔖 **Bookmark** ayat + **lanjut baca** (ayat terakhir dibuka)
- 🌙 Dark mode otomatis (ikut sistem)

## Sumber data (terverifikasi)
Pakai **[AlQuran Cloud API](https://alquran.cloud/api)** dengan edisi:
- `quran-uthmani` — teks Arab (sumber **Tanzil**)
- `id.indonesian` — terjemahan Bahasa Indonesia (**Kemenag**)
- `en.transliteration` — transliterasi latin
- `ar.alafasy` — audio murotal

> Untuk versi produksi yang paling "resmi" di Indonesia, bisa di-swap ke
> **Qur'an Kemenag API (LPMQ)** — diatur Lajnah Pentashihan Mushaf Al-Qur'an.
> Struktur kode udah dipisah di `app.js` (konstanta `API` + `EDITIONS`) biar
> gampang diganti.

## Jalanin lokal
Static, tanpa build:
```bash
cd quran
python3 -m http.server 8000
# buka http://localhost:8000
```

## Deploy (Vercel)
Karena app ini ada di subfolder `quran/`, set **Root Directory = `quran`**
di project settings Vercel (atau bikin project Vercel terpisah yang nunjuk ke
folder ini).

## Struktur
- `index.html` — layout + search bar + Google Fonts (Scheherazade New utk Arab)
- `styles.css` — tema bersih (light/dark), tipografi Arab
- `app.js` — router SPA, fetch API, render, bookmark & last-read

## Roadmap
- [ ] AI "cari berdasar makna" (semantic search via Jatevo) — nunjuk ayat, bukan generate
- [ ] Tafsir per ayat (Kemenag / Quraish Shihab)
- [ ] Multi-terjemahan / multi-qori
- [ ] Share ayat jadi kartu gambar
- [ ] Swap ke Kemenag LPMQ API (resmi)
