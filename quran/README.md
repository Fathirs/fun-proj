# ۩ Ayat — Cari & Baca Al-Qur'an

"pasal.id versi Al-Qur'an" — cari & baca Al-Qur'an **per-ayat** dengan cepat,
bersih, dan bisa dibookmark. Fokusnya sama kayak pasal.id: nemu potongan yang
lo cari tanpa harus baca dokumen (surah) utuh.

MVP ini **read-only client-side** (nggak ada backend). Semua data diambil dari
API Al-Qur'an terverifikasi langsung dari browser.

## Fitur
- 🔎 **Cari kata** — cari ayat berdasar kata pada terjemahan (mis. "sabar", "rezeki")
- ✨ **Cari makna (AI)** — tanya bahasa natural, **Jatevo AI menunjuk** ayat relevan;
  teks ayatnya tetap diambil dari sumber terverifikasi (AI nunjuk, bukan ngarang)
- #️⃣ Ketik **nomor surah** (1–114) di kotak cari → langsung lompat ke surah
- 📖 **Baca per-ayat**: teks Arab + transliterasi latin + terjemahan Indonesia
- 📚 **Tafsir per ayat** (Kemenag, via equran.id) — expand di tiap ayat
- 📤 **Share ayat jadi kartu** — generate gambar (Arab + terjemahan + rujukan) via canvas,
  langsung share (Web Share API) atau unduh
- 🔊 **Audio murotal** per ayat (Mishary Alafasy)
- 🔖 **Bookmark** ayat + **lanjut baca** (ayat terakhir dibuka)
- 🌙 Dark mode otomatis (ikut sistem)

## Cari makna (AI) — Jatevo
Klik ⚙️ → isi **Base URL / Model / API Key** Jatevo, matiin **Demo Mode**.
Default-nya Demo Mode **ON** (pakai contoh hasil) biar alurnya bisa dicoba tanpa key.
Guardrail: AI **hanya menunjuk** nomor surah:ayat; teks & terjemahan selalu di-fetch
dari API terverifikasi — AI tidak pernah menulis/mengubah isi ayat.

## Sumber data (terverifikasi)
Pakai **[AlQuran Cloud API](https://alquran.cloud/api)** dengan edisi:
- `quran-uthmani` — teks Arab (sumber **Tanzil**)
- `id.indonesian` — terjemahan Bahasa Indonesia (**Kemenag**)
- `en.transliteration` — transliterasi latin
- `ar.alafasy` — audio murotal

**Tafsir**: [equran.id API v2](https://equran.id/apidev/v2) — tafsir **Kemenag** per ayat.

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
- [x] AI "cari berdasar makna" (via Jatevo) — nunjuk ayat, bukan generate
- [x] Tafsir per ayat (Kemenag)
- [x] Share ayat jadi kartu gambar
- [ ] Tafsir multi-sumber (Quraish Shihab / Al-Jalalain)
- [ ] Multi-terjemahan / multi-qori
- [ ] Swap ke Kemenag LPMQ API (resmi)
