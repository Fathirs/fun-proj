/* ============================================================
 * Ayat — cari & baca Al-Qur'an (pasal.id vibe, versi Al-Qur'an)
 * Data: AlQuran Cloud API (teks Arab: Tanzil/quran-uthmani,
 *       terjemahan: Kemenag id.indonesian, latin: en.transliteration,
 *       audio: ar.alafasy). Semua fetch dari browser user.
 * ============================================================ */

const API = 'https://api.alquran.cloud/v1';
const EDITIONS = 'quran-uthmani,en.transliteration,id.indonesian,ar.alafasy';
const TAFSIR_API = 'https://equran.id/api/v2/tafsir'; // tafsir Kemenag, per surah
const BISMILLAH = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';

const LS_BOOKMARKS = 'ayat.bookmarks';
const LS_LASTREAD = 'ayat.lastread';

const $ = (s, r = document) => r.querySelector(s);
const view = $('#view');
const player = $('#player');

let surahCache = null;         // daftar 114 surah
const surahDetailCache = {};   // {n: {info, ayahs:[{n, arab, latin, trans, audio}]}}
const tafsirCache = {};        // {n: {ayah: teks}}
let currentAudioBtn = null;
let searchMode = 'kata';       // 'kata' | 'makna'

/* ---------------- Storage ---------------- */
function getBookmarks() {
  try { return JSON.parse(localStorage.getItem(LS_BOOKMARKS)) || []; }
  catch { return []; }
}
function setBookmarks(b) { localStorage.setItem(LS_BOOKMARKS, JSON.stringify(b)); }
function isBookmarked(s, a) { return getBookmarks().some((x) => x.surah === s && x.ayah === a); }
function toggleBookmark(entry) {
  let b = getBookmarks();
  const i = b.findIndex((x) => x.surah === entry.surah && x.ayah === entry.ayah);
  if (i >= 0) { b.splice(i, 1); toast('Bookmark dihapus'); }
  else { b.unshift(entry); toast('🔖 Ayat dibookmark'); }
  setBookmarks(b);
  return i < 0;
}
function setLastRead(entry) { localStorage.setItem(LS_LASTREAD, JSON.stringify(entry)); }
function getLastRead() {
  try { return JSON.parse(localStorage.getItem(LS_LASTREAD)); } catch { return null; }
}

/* ---------------- Helpers ---------------- */
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}
const revLabel = (t) => (t === 'Meccan' ? 'Makkiyah' : t === 'Medinan' ? 'Madaniyah' : t || '');
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function loading() { view.innerHTML = '<div class="spinner"></div>'; }
function errorState(msg) {
  view.innerHTML = `<div class="state"><span class="emoji">⚠️</span><p>${esc(msg)}</p>
    <p style="margin-top:8px;font-size:13px;">Cek koneksi internet lalu coba lagi.</p></div>`;
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gagal memuat (${res.status})`);
  const json = await res.json();
  if (json.code !== 200) throw new Error(json.status || 'Response tidak valid');
  return json.data;
}

/* ---------------- Data loaders ---------------- */
async function loadSurahList() {
  if (surahCache) return surahCache;
  surahCache = await fetchJSON(`${API}/surah`);
  return surahCache;
}

async function loadSurah(n) {
  if (surahDetailCache[n]) return surahDetailCache[n];
  const data = await fetchJSON(`${API}/surah/${n}/editions/${EDITIONS}`);
  const byId = {};
  data.forEach((ed) => { byId[ed.edition.identifier] = ed; });
  const arab = byId['quran-uthmani'];
  const latin = byId['en.transliteration'];
  const trans = byId['id.indonesian'];
  const audio = byId['ar.alafasy'];
  const ayahs = arab.ayahs.map((ay, i) => ({
    n: ay.numberInSurah,
    arab: ay.text,
    latin: latin?.ayahs[i]?.text || '',
    trans: trans?.ayahs[i]?.text || '',
    audio: audio?.ayahs[i]?.audio || '',
  }));
  const detail = {
    info: {
      number: arab.number,
      arabName: arab.name,
      latin: arab.englishName,
      transName: arab.englishNameTranslation,
      count: arab.numberOfAyahs,
      rev: arab.revelationType,
    },
    ayahs,
  };
  surahDetailCache[n] = detail;
  return detail;
}

/* ---------------- Views ---------------- */
async function viewHome() {
  loading();
  try {
    const surahs = await loadSurahList();
    const last = getLastRead();
    const resume = last ? `
      <div class="resume">
        <span class="resume-ico">📖</span>
        <div class="resume-txt">
          <b>Lanjut baca</b>
          <span>${esc(last.surahName)} : ayat ${last.ayah}</span>
        </div>
        <button class="resume-go" onclick="location.hash='#/surah/${last.surah}/${last.ayah}'">Buka</button>
      </div>` : '';

    const items = surahs.map((s) => `
      <a class="surah-item" href="#/surah/${s.number}">
        <div class="surah-num">${s.number}</div>
        <div class="surah-info">
          <div class="surah-latin">${esc(s.englishName)}</div>
          <div class="surah-meta">${esc(s.englishNameTranslation)} · ${s.numberOfAyahs} ayat · ${revLabel(s.revelationType)}</div>
        </div>
        <div class="surah-arab">${esc(s.name)}</div>
      </a>`).join('');

    view.innerHTML = `${resume}
      <div class="section-title">114 Surah</div>
      <div class="surah-grid">${items}</div>`;
  } catch (e) {
    errorState(e.message);
  }
}

async function viewSurah(n, targetAyah) {
  loading();
  try {
    const { info, ayahs } = await loadSurah(n);
    const showBismillah = n !== 1 && n !== 9; // 9 tanpa basmalah; 1 basmalah = ayat 1

    const ayahHtml = ayahs.map((ay) => {
      const bm = isBookmarked(n, ay.n);
      return `
      <div class="ayah" id="ayah-${ay.n}" data-ayah="${ay.n}">
        <div class="ayah-top">
          <span class="ayah-badge">${info.number}:${ay.n}</span>
          <div class="ayah-actions">
            ${ay.audio ? `<button class="a-btn play" data-audio="${esc(ay.audio)}" title="Putar">▶</button>` : ''}
            <button class="a-btn tafsir-btn" data-ayah="${ay.n}" title="Tafsir">📚</button>
            <button class="a-btn share-btn" data-ayah="${ay.n}" title="Bagikan">📤</button>
            <button class="a-btn bookmark ${bm ? 'active' : ''}" data-ayah="${ay.n}" title="Bookmark">🔖</button>
          </div>
        </div>
        <div class="ayah-arab">${esc(ay.arab)}</div>
        ${ay.latin ? `<div class="ayah-latin">${esc(ay.latin)}</div>` : ''}
        <div class="ayah-trans">${esc(ay.trans)}</div>
        <div class="tafsir-slot" id="tafsir-${ay.n}"></div>
      </div>`;
    }).join('');

    view.innerHTML = `
      <a class="back-link" href="#/">← Semua surah</a>
      <div class="surah-hero">
        <div class="h-arab">${esc(info.arabName)}</div>
        <div class="h-latin">${esc(info.latin)}</div>
        <div class="h-trans">${esc(info.transName)}</div>
        <div class="h-meta">${revLabel(info.rev)} · ${info.count} ayat</div>
      </div>
      ${showBismillah ? `<div class="bismillah">${BISMILLAH}</div>` : ''}
      ${ayahHtml}`;

    wireSurahActions(info);

    // scroll ke ayat target (dari search / bookmark / resume)
    if (targetAyah) {
      const el = $(`#ayah-${targetAyah}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el.classList.add('flash');
      }
    }
    // simpan sebagai "terakhir dibaca"
    setLastRead({ surah: n, ayah: targetAyah || 1, surahName: info.latin });
  } catch (e) {
    errorState(e.message);
  }
}

function wireSurahActions(info) {
  view.querySelectorAll('.bookmark').forEach((btn) => {
    btn.onclick = () => {
      const a = Number(btn.dataset.ayah);
      const ay = surahDetailCache[info.number].ayahs.find((x) => x.n === a);
      const added = toggleBookmark({
        surah: info.number, ayah: a,
        surahName: info.latin, text: ay.trans,
      });
      btn.classList.toggle('active', added);
    };
  });
  view.querySelectorAll('.play').forEach((btn) => {
    btn.onclick = () => playAudio(btn.dataset.audio, btn);
  });
  view.querySelectorAll('.tafsir-btn').forEach((btn) => {
    btn.onclick = () => toggleTafsir(info.number, Number(btn.dataset.ayah), btn);
  });
  view.querySelectorAll('.share-btn').forEach((btn) => {
    btn.onclick = () => shareAyah(info, Number(btn.dataset.ayah), btn);
  });
}

/* ---------------- Tafsir (equran.id / Kemenag) ---------------- */
async function loadTafsir(n) {
  if (tafsirCache[n]) return tafsirCache[n];
  const res = await fetch(`${TAFSIR_API}/${n}`);
  if (!res.ok) throw new Error(`Gagal memuat tafsir (${res.status})`);
  const json = await res.json();
  const list = json?.data?.tafsir || [];
  const map = {};
  list.forEach((t) => { map[t.ayat] = t.teks; });
  tafsirCache[n] = map;
  return map;
}

async function toggleTafsir(n, ayah, btn) {
  const slot = $(`#tafsir-${ayah}`);
  if (!slot) return;
  if (slot.innerHTML) { // sudah terbuka -> tutup
    slot.innerHTML = '';
    btn.classList.remove('active');
    return;
  }
  btn.classList.add('active');
  slot.innerHTML = `<div class="tafsir loading">Memuat tafsir…</div>`;
  try {
    const map = await loadTafsir(n);
    const teks = map[ayah];
    slot.innerHTML = teks
      ? `<div class="tafsir"><span class="tafsir-label">Tafsir · Kemenag</span>${esc(teks)}</div>`
      : `<div class="tafsir">Tafsir untuk ayat ini tidak tersedia.</div>`;
  } catch (e) {
    slot.innerHTML = `<div class="tafsir">⚠️ ${esc(e.message)}</div>`;
    btn.classList.remove('active');
  }
}

/* ---------------- Share ayat jadi kartu (canvas) ---------------- */
async function shareAyah(info, ayah, btn) {
  const ay = surahDetailCache[info.number]?.ayahs.find((x) => x.n === ayah);
  if (!ay) return;
  btn.textContent = '…';
  try {
    const blob = await buildCard(info, ay);
    const file = new File([blob], `ayat-${info.number}-${ayah}.png`, { type: 'image/png' });
    const ref = `${info.latin} ${info.number}:${ayah}`;
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: ref, text: `${ref} — via Ayat` });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = file.name; a.click();
      URL.revokeObjectURL(url);
      toast('Kartu ayat diunduh 📥');
    }
  } catch (e) {
    if (e.name !== 'AbortError') toast('Gagal bikin kartu: ' + e.message);
  } finally {
    btn.textContent = '📤';
  }
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

async function buildCard(info, ay) {
  await (document.fonts?.ready || Promise.resolve());
  const canvas = $('#cardCanvas');
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d');

  // background gradient (emerald gelap -> hampir hitam)
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#0d3b31'); g.addColorStop(1, '#0a1a15');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // border tipis
  ctx.strokeStyle = 'rgba(212,169,97,0.5)'; ctx.lineWidth = 3;
  ctx.strokeRect(40, 40, W - 80, H - 80);

  const cx = W / 2;
  const pad = 110;

  // Arab (RTL, wrap)
  ctx.fillStyle = '#f4efe2';
  ctx.textAlign = 'center';
  ctx.direction = 'rtl';
  ctx.font = "64px 'Scheherazade New', serif";
  const arabLines = wrapText(ctx, ay.arab, W - pad * 2);
  let y = 300;
  for (const l of arabLines) { ctx.fillText(l, cx, y); y += 92; }

  // pemisah
  y += 20;
  ctx.strokeStyle = 'rgba(212,169,97,0.4)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx - 80, y); ctx.lineTo(cx + 80, y); ctx.stroke();
  y += 60;

  // Terjemahan (LTR, wrap)
  ctx.direction = 'ltr';
  ctx.fillStyle = '#d7e2dc';
  ctx.font = "36px 'Plus Jakarta Sans', sans-serif";
  const transLines = wrapText(ctx, '“' + ay.trans + '”', W - pad * 2);
  for (const l of transLines.slice(0, 8)) { ctx.fillText(l, cx, y); y += 52; }

  // Referensi
  y += 40;
  ctx.fillStyle = '#d4a961';
  ctx.font = "700 40px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText(`${info.latin} · ${info.number}:${ay.n}`, cx, y);

  // footer app
  ctx.fillStyle = 'rgba(215,226,220,0.55)';
  ctx.font = "500 28px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText('۩  Ayat', cx, H - 90);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob gagal'))), 'image/png'));
}

function playAudio(url, btn) {
  if (currentAudioBtn === btn && !player.paused) {
    player.pause();
    btn.classList.remove('playing'); btn.textContent = '▶';
    currentAudioBtn = null;
    return;
  }
  if (currentAudioBtn) { currentAudioBtn.classList.remove('playing'); currentAudioBtn.textContent = '▶'; }
  player.src = url;
  player.play().catch(() => toast('Gagal memutar audio'));
  btn.classList.add('playing'); btn.textContent = '⏸';
  currentAudioBtn = btn;
  player.onended = () => { btn.classList.remove('playing'); btn.textContent = '▶'; currentAudioBtn = null; };
}

async function viewSearch(q) {
  loading();
  const query = q.trim();
  if (!query) return viewHome();

  // kalau input angka -> lompat ke surah
  if (/^\d{1,3}$/.test(query)) {
    const num = Number(query);
    if (num >= 1 && num <= 114) { location.hash = `#/surah/${num}`; return; }
  }

  try {
    const data = await fetchJSON(`${API}/search/${encodeURIComponent(query)}/all/id.indonesian`);
    const matches = data.matches || [];
    if (!matches.length) {
      view.innerHTML = `<a class="back-link" href="#/">← Beranda</a>
        <div class="state"><span class="emoji">🔍</span><p>Nggak ada ayat yang cocok buat “${esc(query)}”.</p></div>`;
      return;
    }
    const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
    const html = matches.map((m) => {
      const highlighted = esc(m.text).replace(re, '<mark>$1</mark>');
      return `
      <a class="result" href="#/surah/${m.surah.number}/${m.numberInSurah}">
        <span class="result-ref">${esc(m.surah.englishName)} ${m.surah.number}:${m.numberInSurah}</span>
        <div class="result-text">${highlighted}</div>
      </a>`;
    }).join('');
    view.innerHTML = `<a class="back-link" href="#/">← Beranda</a>
      <div class="result-count">${matches.length} ayat cocok · “${esc(query)}”</div>${html}`;
  } catch (e) {
    errorState(e.message);
  }
}

async function viewMeaningSearch(q) {
  const query = q.trim();
  if (!query) return viewHome();
  loading();
  try {
    const { demo, refs } = await Jatevo.searchByMeaning(query);
    if (!refs.length) {
      view.innerHTML = `<a class="back-link" href="#/">← Beranda</a>
        <div class="state"><span class="emoji">✨</span><p>AI belum nemu ayat buat “${esc(query)}”.</p></div>`;
      return;
    }
    // ambil TEKS ayat dari sumber terverifikasi (bukan dari AI)
    const cards = await Promise.all(refs.map(async (r) => {
      try {
        const { ayahs, info } = await loadSurah(r.surah);
        const ay = ayahs.find((x) => x.n === r.ayah);
        if (!ay) return '';
        return `
          <a class="result" href="#/surah/${r.surah}/${r.ayah}">
            <span class="result-ref">${esc(info.latin)} ${r.surah}:${r.ayah}</span>
            <div class="ayah-arab" style="font-size:24px;line-height:1.9;margin:6px 0;">${esc(ay.arab)}</div>
            <div class="result-text">${esc(ay.trans)}</div>
            ${r.alasan ? `<div class="result-reason">${esc(r.alasan)}</div>` : ''}
          </a>`;
      } catch { return ''; }
    }));
    const notice = `
      <div class="ai-notice">
        <span>✨</span>
        <div><b>Hasil AI${demo ? ' (Demo)' : ''}.</b> AI menunjuk ayat yang mungkin relevan; teks & terjemahan diambil dari sumber terverifikasi. Tetap periksa konteksnya, ya.</div>
      </div>`;
    view.innerHTML = `<a class="back-link" href="#/">← Beranda</a>${notice}
      <div class="result-count">${refs.length} ayat ditunjuk · “${esc(query)}”</div>
      ${cards.join('')}`;
  } catch (e) {
    view.innerHTML = `<a class="back-link" href="#/">← Beranda</a>
      <div class="state"><span class="emoji">⚠️</span><p>${esc(e.message)}</p>
      <p style="margin-top:8px;font-size:13px;">Cek pengaturan Jatevo (⚙️) atau nyalakan Demo Mode.</p></div>`;
  }
}

function viewBookmarks() {
  const b = getBookmarks();
  if (!b.length) {
    view.innerHTML = `<a class="back-link" href="#/">← Beranda</a>
      <div class="state"><span class="emoji">🔖</span><p>Belum ada ayat yang dibookmark.</p></div>`;
    return;
  }
  const html = b.map((x) => `
    <a class="result" href="#/surah/${x.surah}/${x.ayah}">
      <span class="result-ref">${esc(x.surahName)} ${x.surah}:${x.ayah}</span>
      <div class="result-text">${esc(x.text || '')}</div>
    </a>`).join('');
  view.innerHTML = `<a class="back-link" href="#/">← Beranda</a>
    <div class="section-title">Bookmark (${b.length})</div>${html}`;
}

/* ---------------- Router ---------------- */
function router() {
  const hash = location.hash.slice(1) || '/';
  const parts = hash.split('/').filter(Boolean); // ['surah','2','153']
  window.scrollTo(0, 0);

  if (parts[0] === 'surah' && parts[1]) {
    viewSurah(Number(parts[1]), parts[2] ? Number(parts[2]) : null);
  } else if (parts[0] === 'search' && parts[1]) {
    setMode('kata');
    $('#searchInput').value = decodeURIComponent(parts[1]);
    viewSearch(decodeURIComponent(parts[1]));
  } else if (parts[0] === 'ai' && parts[1]) {
    setMode('makna');
    $('#searchInput').value = decodeURIComponent(parts[1]);
    viewMeaningSearch(decodeURIComponent(parts[1]));
  } else if (parts[0] === 'bookmarks') {
    viewBookmarks();
  } else {
    viewHome();
  }
}

function setMode(mode) {
  searchMode = mode;
  document.querySelectorAll('.mode').forEach((b) =>
    b.classList.toggle('active', b.dataset.mode === mode));
  $('#searchInput').placeholder = mode === 'makna'
    ? 'Tanya makna, mis. "ayat tentang sabar"…'
    : 'Cari ayat, kata, atau nomor surah…';
}

/* ---------------- Init ---------------- */
$('#searchForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = $('#searchInput').value.trim();
  if (!q) return;
  const route = searchMode === 'makna' ? 'ai' : 'search';
  location.hash = `#/${route}/${encodeURIComponent(q)}`;
});

// toggle mode cari
$('#searchModes').addEventListener('click', (e) => {
  const b = e.target.closest('.mode');
  if (b) setMode(b.dataset.mode);
});

// settings modal (Jatevo)
function openSettings() {
  const c = Jatevo.loadConfig();
  $('#cfgBaseUrl').value = c.baseUrl || '';
  $('#cfgModel').value = c.model || '';
  $('#cfgKey').value = c.key || '';
  $('#cfgDemo').checked = c.demo !== false; // default demo ON
  $('#settingsOverlay').classList.remove('hidden');
}
$('#settingsBtn').onclick = openSettings;
$('#settingsClose').onclick = () => $('#settingsOverlay').classList.add('hidden');
$('#settingsOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'settingsOverlay') e.currentTarget.classList.add('hidden');
});
$('#cfgSave').onclick = () => {
  Jatevo.saveConfig({
    baseUrl: $('#cfgBaseUrl').value.trim(),
    model: $('#cfgModel').value.trim(),
    key: $('#cfgKey').value.trim(),
    demo: $('#cfgDemo').checked,
  });
  $('#settingsOverlay').classList.add('hidden');
  toast('Pengaturan disimpan');
};

// default: nyalain demo mode kalau belum pernah diatur (biar AI langsung bisa dicoba)
if (!Jatevo.isConfigured()) Jatevo.saveConfig({ ...Jatevo.loadConfig(), demo: true });

window.addEventListener('hashchange', router);
router();
