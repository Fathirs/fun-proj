/* ============================================================
 * app.js — UI & state DripDex (single-user MVP, localStorage)
 * ============================================================ */

const STORE_KEY = 'dripdex.outfits';

const CATEGORIES = ['Semua', 'Casual', 'Office', 'Date', 'Gym', 'Streetwear', 'Formal', 'Loungewear'];

let outfits = [];        // semua outfit tersimpan
let activeFilter = 'Semua';

/* ---------------- Storage ---------------- */
function loadOutfits() {
  try {
    outfits = JSON.parse(localStorage.getItem(STORE_KEY)) || [];
  } catch {
    outfits = [];
  }
}
function persist() {
  localStorage.setItem(STORE_KEY, JSON.stringify(outfits));
}

/* ---------------- Helpers ---------------- */
const $ = (sel) => document.querySelector(sel);
const RARITY_RANK = { Common: 0, Rare: 1, Epic: 2, Legendary: 3 };
const RARITY_COLOR = {
  Common: 'var(--r-common)', Rare: 'var(--r-rare)',
  Epic: 'var(--r-epic)', Legendary: 'var(--r-legendary)',
};

function fmtDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

// uid tanpa Math.random (counter + waktu)
let _uidc = 0;
function uid() { return `o${Date.now()}_${_uidc++}`; }

/* ---------------- Stats ---------------- */
function computeStreak() {
  if (!outfits.length) return 0;
  const days = new Set(
    outfits.map((o) => new Date(o.createdAt).toDateString())
  );
  let streak = 0;
  let cursor = new Date();
  // kalau hari ini belum ada, mulai cek dari kemarin
  if (!days.has(cursor.toDateString())) cursor.setDate(cursor.getDate() - 1);
  while (days.has(cursor.toDateString())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function renderStats() {
  $('#statStreak').textContent = computeStreak();
  $('#statTotal').textContent = outfits.length;
  const allItems = outfits.flatMap((o) => o.items);
  $('#statItems').textContent = allItems.length;
  let top = '—';
  let best = -1;
  for (const it of allItems) {
    if (RARITY_RANK[it.rarity] > best) { best = RARITY_RANK[it.rarity]; top = it.rarity; }
  }
  const el = $('#statTopRarity');
  el.textContent = top === '—' ? '—' : top.slice(0, 4);
  el.style.color = top === '—' ? '' : RARITY_COLOR[top];
}

/* ---------------- Filter bar ---------------- */
function renderFilterBar() {
  const bar = $('#filterBar');
  bar.innerHTML = '';
  // hanya tampilkan kategori yang ada datanya (+ Semua)
  const present = new Set(outfits.map((o) => o.category));
  const cats = CATEGORIES.filter((c) => c === 'Semua' || present.has(c));
  for (const c of cats) {
    const chip = document.createElement('button');
    chip.className = 'chip' + (c === activeFilter ? ' active' : '');
    chip.textContent = c;
    chip.onclick = () => { activeFilter = c; renderFilterBar(); renderTimeline(); };
    bar.appendChild(chip);
  }
}

/* ---------------- Timeline ---------------- */
function rarityDots(items) {
  return `<div class="rarity-dots">${items.slice(0, 6).map((it) =>
    `<span class="rdot" style="background:${RARITY_COLOR[it.rarity]}"></span>`).join('')}</div>`;
}

function renderTimeline() {
  const tl = $('#timeline');
  const list = outfits
    .filter((o) => activeFilter === 'Semua' || o.category === activeFilter)
    .sort((a, b) => b.createdAt - a.createdAt);

  if (!outfits.length) {
    tl.innerHTML = `<div class="empty-state"><span class="empty-emoji">🪞</span><p>Belum ada outfit. Snap fit pertama lo!</p></div>`;
    return;
  }
  if (!list.length) {
    tl.innerHTML = `<div class="empty-state"><span class="empty-emoji">🔍</span><p>Nggak ada outfit di kategori ini.</p></div>`;
    return;
  }

  tl.innerHTML = '';
  for (const o of list) {
    const card = document.createElement('div');
    card.className = 'outfit-card';
    card.onclick = () => openDetail(o.id);
    card.innerHTML = `
      <div class="outfit-head">
        <img class="outfit-thumb" src="${o.image}" alt="outfit" />
        <div class="outfit-meta">
          <div class="outfit-cat-row">
            <span class="cat-badge">${o.category}</span>
            <span class="outfit-date">${fmtDate(o.createdAt)}</span>
          </div>
          <span class="item-count">${o.items.length} item terdeteksi</span>
          ${rarityDots(o.items)}
          <div class="drip-row">
            <div class="drip-bar"><div class="drip-fill" style="width:${o.dripScore}%"></div></div>
            <span class="drip-score">${o.dripScore}</span>
          </div>
        </div>
      </div>`;
    tl.appendChild(card);
  }
}

/* ---------------- Detail sheet ---------------- */
function openDetail(id) {
  const o = outfits.find((x) => x.id === id);
  if (!o) return;
  const content = $('#detailContent');

  const catChips = CATEGORIES.filter((c) => c !== 'Semua').map((c) =>
    `<button class="chip ${c === o.category ? 'active' : ''}" data-cat="${c}">${c}</button>`
  ).join('');

  const itemCards = o.items.map((it) => `
    <div class="item-card r-${it.rarity.toLowerCase()}">
      <div class="item-emoji">${it.emoji}</div>
      <div class="item-name">${it.name}</div>
      <div class="item-sub">${[it.color, it.category].filter(Boolean).join(' · ')}</div>
      ${it.note ? `<div class="item-sub">“${it.note}”</div>` : ''}
      <span class="rarity-tag">${it.rarity}</span>
    </div>`).join('');

  content.innerHTML = `
    <img class="detail-hero" src="${o.image}" alt="outfit" />
    <div class="drip-row" style="margin-top:16px;">
      <div class="drip-bar"><div class="drip-fill" style="width:${o.dripScore}%"></div></div>
      <span class="drip-score">${o.dripScore} drip</span>
    </div>
    <div class="detail-section-title">Kategori outfit (ketuk buat ganti)</div>
    <div class="detail-cat-edit" id="catEdit">${catChips}</div>
    <div class="detail-section-title">${o.items.length} item · ${fmtDate(o.createdAt)}</div>
    <div class="items-grid">${itemCards}</div>
    <div style="display:flex; gap:10px; margin-top:22px; flex-wrap:wrap;">
      <button class="btn-primary" id="saveGallery">📥 Simpan ke Galeri</button>
      <button class="btn-ghost" id="deleteOutfit" style="color:#ff6b6b;">🗑️ Hapus</button>
    </div>`;

  // ganti kategori
  content.querySelector('#catEdit').onclick = (e) => {
    const btn = e.target.closest('[data-cat]');
    if (!btn) return;
    o.category = btn.dataset.cat;
    persist();
    content.querySelectorAll('#catEdit .chip').forEach((c) =>
      c.classList.toggle('active', c.dataset.cat === o.category));
    renderFilterBar();
    renderTimeline();
    toast(`Dipindah ke ${o.category}`);
  };

  content.querySelector('#saveGallery').onclick = () => saveToGallery(o);

  content.querySelector('#deleteOutfit').onclick = () => {
    outfits = outfits.filter((x) => x.id !== o.id);
    persist();
    closeOverlay('#detailOverlay');
    refreshAll();
    toast('Outfit dihapus');
  };

  showOverlay('#detailOverlay');
}

/* ---------------- Overlays ---------------- */
function showOverlay(sel) { $(sel).classList.remove('hidden'); }
function closeOverlay(sel) { $(sel).classList.add('hidden'); }

/* ---------------- Save to gallery ---------------- */
async function dataUrlToFile(dataUrl, filename) {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || 'image/jpeg' });
}

async function saveToGallery(o) {
  const filename = `dripdex-${o.category.toLowerCase()}-${o.id}.jpg`;
  try {
    const file = await dataUrlToFile(o.image, filename);
    // Web Share API: di HP munculin "Save Image" ke galeri / share ke app
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'DripDex outfit' });
      return;
    }
  } catch (err) {
    if (err && err.name === 'AbortError') return; // user batal, jangan fallback
    // selain itu, lanjut ke fallback download
  }
  // Fallback: download biasa (desktop / browser tanpa share)
  const a = document.createElement('a');
  a.href = o.image;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  toast('📥 Foto disimpan');
}

/* ---------------- Capture flow ---------------- */
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// kecilin gambar biar localStorage nggak jebol & upload ringan
function downscale(dataUrl, maxDim = 1024) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      const scale = Math.min(1, maxDim / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function handleFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const raw = await fileToDataUrl(file);
  const image = await downscale(raw);

  $('#analyzePreview').src = image;
  $('#analyzeText').textContent = Jatevo.loadConfig().demo || !Jatevo.isReady()
    ? 'Demo mode — bikin kartu dummy…'
    : 'Jatevo AI lagi ngecek outfit lo…';
  showOverlay('#analyzeOverlay');

  try {
    const result = await Jatevo.detectOutfit(image);
    const outfit = {
      id: uid(),
      createdAt: Date.now(),
      image,
      category: result.outfitCategory,
      dripScore: result.dripScore,
      items: result.items,
    };
    outfits.push(outfit);
    persist();
    closeOverlay('#analyzeOverlay');
    refreshAll();
    openDetail(outfit.id);
    const legendary = result.items.some((i) => i.rarity === 'Legendary');
    toast(legendary ? '✨ LEGENDARY drop!' : `${result.items.length} item ke-snap!`);
  } catch (err) {
    closeOverlay('#analyzeOverlay');
    console.error(err);
    toast('Gagal: ' + err.message);
  }
}

/* ---------------- Settings ---------------- */
function openSettings() {
  const c = Jatevo.loadConfig();
  $('#cfgBaseUrl').value = c.baseUrl || '';
  $('#cfgModel').value = c.model || '';
  $('#cfgKey').value = c.key || '';
  $('#cfgDemo').checked = !!c.demo;
  showOverlay('#settingsOverlay');
}
function saveSettings() {
  Jatevo.saveConfig({
    baseUrl: $('#cfgBaseUrl').value.trim(),
    model: $('#cfgModel').value.trim(),
    key: $('#cfgKey').value.trim(),
    demo: $('#cfgDemo').checked,
  });
  closeOverlay('#settingsOverlay');
  toast('Pengaturan disimpan');
}

/* ---------------- Bootstrap ---------------- */
function refreshAll() {
  renderStats();
  renderFilterBar();
  renderTimeline();
}

function init() {
  loadOutfits();
  refreshAll();

  // default ke demo mode kalau belum dikonfigurasi sama sekali
  if (!Jatevo.isReady()) {
    const c = Jatevo.loadConfig();
    Jatevo.saveConfig({ ...c, demo: true });
  }

  const fileInput = $('#fileInput');
  fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
    e.target.value = '';
  });

  // drag & drop di desktop
  const drop = $('#dropZone');
  ['dragover', 'dragenter'].forEach((ev) =>
    drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((ev) =>
    drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
  drop.addEventListener('drop', (e) => {
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });

  $('#settingsBtn').onclick = openSettings;
  $('#settingsClose').onclick = () => closeOverlay('#settingsOverlay');
  $('#cfgSave').onclick = saveSettings;
  $('#detailClose').onclick = () => closeOverlay('#detailOverlay');

  // klik backdrop buat nutup
  document.querySelectorAll('.overlay').forEach((ov) => {
    ov.addEventListener('click', (e) => {
      if (e.target === ov && ov.id !== 'analyzeOverlay') ov.classList.add('hidden');
    });
  });
}

document.addEventListener('DOMContentLoaded', init);
