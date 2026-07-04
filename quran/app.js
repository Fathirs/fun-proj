/* ============================================================
 * Ayat — cari & baca Al-Qur'an (pasal.id vibe, versi Al-Qur'an)
 * Data: AlQuran Cloud API (teks Arab: Tanzil/quran-uthmani,
 *       terjemahan: Kemenag id.indonesian, latin: en.transliteration,
 *       audio: ar.alafasy). Semua fetch dari browser user.
 * ============================================================ */

const API = 'https://api.alquran.cloud/v1';
const EDITIONS = 'quran-uthmani,en.transliteration,id.indonesian,ar.alafasy';
const BISMILLAH = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';

const LS_BOOKMARKS = 'ayat.bookmarks';
const LS_LASTREAD = 'ayat.lastread';

const $ = (s, r = document) => r.querySelector(s);
const view = $('#view');
const player = $('#player');

let surahCache = null;         // daftar 114 surah
const surahDetailCache = {};   // {n: {info, ayahs:[{n, arab, latin, trans, audio}]}}
let currentAudioBtn = null;

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
            <button class="a-btn bookmark ${bm ? 'active' : ''}" data-ayah="${ay.n}" title="Bookmark">🔖</button>
          </div>
        </div>
        <div class="ayah-arab">${esc(ay.arab)}</div>
        ${ay.latin ? `<div class="ayah-latin">${esc(ay.latin)}</div>` : ''}
        <div class="ayah-trans">${esc(ay.trans)}</div>
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
    $('#searchInput').value = decodeURIComponent(parts[1]);
    viewSearch(decodeURIComponent(parts[1]));
  } else if (parts[0] === 'bookmarks') {
    viewBookmarks();
  } else {
    viewHome();
  }
}

/* ---------------- Init ---------------- */
$('#searchForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = $('#searchInput').value.trim();
  if (q) location.hash = `#/search/${encodeURIComponent(q)}`;
});
window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', router);
router();
