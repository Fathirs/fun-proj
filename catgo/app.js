/* ============================================================
 * CatGo — app.js
 * ============================================================ */

const STORE_KEY = 'catgo.cats';
const SETTINGS_KEY = 'catgo.settings';

let cats = [];
let pendingBg = null;     // original photo dataUrl (for blurred backgrounds)
let pendingSticker = null; // transparent PNG with white outline (for display)

/* ---- Storage ---- */
function load() {
  try { cats = JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
  catch { cats = []; }
}
function persist() { localStorage.setItem(STORE_KEY, JSON.stringify(cats)); }

/* ---- Helpers ---- */
const $ = (s) => document.querySelector(s);
let _uid = 0;
function uid() { return `c${Date.now()}_${_uid++}`; }

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2400);
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function assignRarity() {
  const r = Math.random();
  if (r < 0.05) return 'Legendary';
  if (r < 0.20) return 'Epic';
  if (r < 0.50) return 'Rare';
  return 'Common';
}

/* ---- Image utils ---- */
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function downscale(dataUrl, maxDim = 800) {
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

function dataUrlToBlob(dataUrl) {
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const bytes = atob(data);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/* ---- Settings ---- */
function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; }
  catch { return {}; }
}
function saveSettings(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }

/* ---- Background removal via Remove.bg API ---- */
async function removeBg(blob) {
  const { apiKey } = loadSettings();
  if (!apiKey) throw new Error('No API key configured');

  const form = new FormData();
  form.append('image_file', blob, 'cat.jpg');
  form.append('size', 'auto');

  const res = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: { 'X-Api-Key': apiKey },
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.errors?.[0]?.title || `Remove.bg error ${res.status}`);
  }
  return await res.blob();
}

/* ---- White outline sticker ---- */
function generateSticker(transparentBlob, outlineSize = 10) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(transparentBlob);
    const img = new Image();
    img.onload = () => {
      const pad = outlineSize * 2;
      const canvas = document.createElement('canvas');
      canvas.width = img.width + pad;
      canvas.height = img.height + pad;
      const ctx = canvas.getContext('2d');

      // Stamp image rotated around a circle to build the outline mask
      const steps = 32;
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        ctx.drawImage(img,
          outlineSize + Math.cos(angle) * outlineSize,
          outlineSize + Math.sin(angle) * outlineSize
        );
      }

      // Colorize every non-transparent pixel to white
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < data.data.length; i += 4) {
        if (data.data[i + 3] > 0) {
          data.data[i] = 255;
          data.data[i + 1] = 255;
          data.data[i + 2] = 255;
        }
      }
      ctx.putImageData(data, 0, 0);

      // Draw the actual cut-out on top
      ctx.drawImage(img, outlineSize, outlineSize);

      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = url;
  });
}

/* ---- Screens ---- */
const SCREENS = ['screenMap', 'screenCollection', 'screenProcessing', 'screenDetails', 'screenCatDetail'];

function showScreen(id, slideFromRight = false) {
  SCREENS.forEach((s) => {
    const el = document.getElementById(s);
    el.classList.remove('active', 'slide-in-right');
  });
  const target = document.getElementById(id);
  if (slideFromRight) {
    target.classList.add('slide-in-right');
    requestAnimationFrame(() => requestAnimationFrame(() => target.classList.add('active')));
  } else {
    target.classList.add('active');
  }
}

/* ---- Deterministic hash helpers (stable per cat) ---- */
function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
const RARITY_CP_BASE = { Common: 100, Rare: 400, Epic: 800, Legendary: 1500 };
function catCp(cat) {
  return RARITY_CP_BASE[cat.rarity] + (hashCode(cat.id) % 300);
}

/* ---- Map (overworld) ---- */
function renderMap() {
  $('#trainerCount').textContent = `${cats.length} caught`;
  const layer = $('#mapCats');
  layer.innerHTML = '';
  $('#mapHint').style.display = cats.length ? 'none' : '';

  // Scatter cats over the grass, stable position per cat.
  // Golden-angle spiral by index keeps them spread out; hash adds jitter.
  cats.forEach((cat, i) => {
    const h = hashCode(cat.id);
    const left = 8 + ((i * 47 + h % 23) % 72);        // 8%..80%
    const top = 10 + ((i * 31 + (h >> 5) % 17) % 62); // 10%..72%
    const el = document.createElement('div');
    el.className = 'map-cat';
    el.style.left = `${left}%`;
    el.style.top = `${top}%`;
    el.style.animationDelay = `${(i % 5) * 0.35}s`;
    el.innerHTML = `<img src="${cat.sticker}" alt="${cat.nickname}" /><span class="map-cat-shadow"></span>`;
    el.onclick = () => openCatDetail(cat.id);
    layer.appendChild(el);
  });
}

/* ---- Catdex (Pokedex) ---- */
function renderCollection() {
  const grid = $('#collectionGrid');
  const empty = $('#emptyState');
  $('#collectionCount').textContent = cats.length;

  grid.querySelectorAll('.dex-entry').forEach((c) => c.remove());

  if (!cats.length) {
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  const sorted = [...cats].sort((a, b) => a.createdAt - b.createdAt);
  sorted.forEach((cat, idx) => {
    const card = document.createElement('div');
    card.className = 'dex-entry';
    card.innerHTML = `
      <div class="dex-entry-no">#${String(idx + 1).padStart(3, '0')}</div>
      <div class="dex-entry-img"><img src="${cat.sticker}" alt="${cat.nickname}" /></div>
      <div class="dex-entry-name">${cat.nickname}</div>
      <div class="dex-entry-cp">CP ${catCp(cat)}</div>`;
    card.onclick = () => openCatDetail(cat.id);
    grid.appendChild(card);
  });

  // Unknown upcoming slots, Pokedex style
  const unknownSlots = 3;
  for (let i = 0; i < unknownSlots; i++) {
    const slot = document.createElement('div');
    slot.className = 'dex-entry dex-entry-unknown';
    slot.innerHTML = `
      <div class="dex-entry-no">#${String(sorted.length + i + 1).padStart(3, '0')}</div>
      <div class="dex-entry-img"><span class="dex-unknown-mark">?</span></div>
      <div class="dex-entry-name">???</div>`;
    grid.appendChild(slot);
  }
}

/* ---- Capture flow ---- */
async function handleFile(file) {
  if (!file || !file.type.startsWith('image/')) return;

  const raw = await fileToDataUrl(file);
  const bg = await downscale(raw, 800);
  pendingBg = bg;
  pendingSticker = null;

  // Show processing screen — loading state
  $('#procBg').style.backgroundImage = `url(${bg})`;
  $('#procLoading').classList.remove('hidden');
  $('#procPreview').classList.add('hidden');
  showScreen('screenProcessing');

  try {
    const blob = dataUrlToBlob(bg);
    const transparentBlob = await removeBg(blob);
    const sticker = await generateSticker(transparentBlob, 10);
    pendingSticker = sticker;

    $('#procStickerImg').src = sticker;
    $('#procLoading').classList.add('hidden');
    $('#procPreview').classList.remove('hidden');

  } catch (err) {
    console.error('Background removal failed:', err);
    pendingSticker = bg;
    $('#procStickerImg').src = bg;
    $('#procLoading').classList.add('hidden');
    $('#procPreview').classList.remove('hidden');
    const noKey = err.message === 'No API key configured';
    toast(noKey ? 'Add a Remove.bg API key in Settings ⚙️' : `BG removal failed: ${err.message}`);
  }
}

/* ---- Confirm capture → fill details ---- */
function confirmCapture() {
  const rarity = assignRarity();

  // Fill details screen preview
  $('#detailStickerImg').src = pendingSticker;
  const rarityEl = $('#rarityBadge');
  rarityEl.textContent = rarity;
  rarityEl.className = `rarity-badge ${rarity}`;
  rarityEl.dataset.rarity = rarity;

  $('#inputNickname').value = '';
  $('#inputLocation').value = '';
  $('#inputNotes').value = '';
  showScreen('screenDetails', true);
}

/* ---- Save cat ---- */
function saveCat() {
  const nickname = $('#inputNickname').value.trim() || 'Unknown Cat';
  const location = $('#inputLocation').value.trim();
  const notes = $('#inputNotes').value.trim();
  const rarity = $('#rarityBadge').dataset.rarity || 'Common';

  const cat = {
    id: uid(),
    createdAt: Date.now(),
    bg: pendingBg,
    sticker: pendingSticker,
    nickname,
    location,
    notes,
    rarity,
  };

  cats.push(cat);
  try {
    persist();
  } catch (e) {
    toast('Storage full — try releasing some cats first');
    cats.pop();
    return;
  }

  pendingBg = null;
  pendingSticker = null;
  renderCollection();
  renderMap();
  showScreen('screenMap');
  toast(`${nickname} was registered to your Catdex!`);
}

/* ---- Cat detail ---- */
let detailReturnTo = 'screenMap';

function openCatDetail(id) {
  const cat = cats.find((c) => c.id === id);
  if (!cat) return;

  detailReturnTo = $('#screenCollection').classList.contains('active')
    ? 'screenCollection' : 'screenMap';

  $('#detailHeroImg').src = cat.sticker;
  $('#detailCatName').textContent = cat.nickname;
  $('#detailCp').textContent = `CP ${catCp(cat)}`;

  const rarityEl = $('#detailRarity');
  rarityEl.textContent = cat.rarity;
  rarityEl.className = `rarity-badge ${cat.rarity}`;

  $('#detailLocation').textContent = cat.location || 'Unknown';
  $('#detailDate').textContent = fmtDate(cat.createdAt);

  const idx = [...cats].sort((a, b) => a.createdAt - b.createdAt).findIndex((c) => c.id === id);
  $('#detailDexNo').textContent = `#${String(idx + 1).padStart(3, '0')}`;

  const notesSection = $('#detailNotesSection');
  if (cat.notes) {
    $('#detailNotes').textContent = cat.notes;
    notesSection.classList.remove('hidden');
  } else {
    notesSection.classList.add('hidden');
  }

  $('#btnDeleteCat').onclick = () => {
    cats = cats.filter((c) => c.id !== id);
    persist();
    renderCollection();
    renderMap();
    showScreen(detailReturnTo);
    toast('Released back into the wild 🐾');
  };

  showScreen('screenCatDetail', true);
}

/* ---- Init ---- */
function init() {
  load();
  renderCollection();
  renderMap();
  showScreen('screenMap');

  const fileInput = $('#fileInput');
  $('#fabCapture').onclick = () => fileInput.click();
  fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
    e.target.value = '';
  });

  $('#dexBtn').onclick = () => showScreen('screenCollection', true);
  $('#dexBack').onclick = () => showScreen('screenMap');

  $('#procCancel').onclick = () => showScreen('screenMap');
  $('#procConfirm').onclick = () => confirmCapture();
  $('#procRetake').onclick = () => { showScreen('screenMap'); fileInput.click(); };

  $('#btnSave').onclick = saveCat;
  $('#detailsBack').onclick = () => showScreen('screenMap');
  $('#catDetailBack').onclick = () => showScreen(detailReturnTo);

  // Settings
  $('#settingsBtn').onclick = () => {
    $('#inputApiKey').value = loadSettings().apiKey || '';
    $('#settingsOverlay').classList.remove('hidden');
  };
  $('#settingsClose').onclick = () => $('#settingsOverlay').classList.add('hidden');
  $('#btnSaveSettings').onclick = () => {
    saveSettings({ apiKey: $('#inputApiKey').value.trim() });
    $('#settingsOverlay').classList.add('hidden');
    toast('Settings saved!');
  };
  $('#settingsOverlay').onclick = (e) => {
    if (e.target === $('#settingsOverlay')) $('#settingsOverlay').classList.add('hidden');
  };

  [$('#inputNickname'), $('#inputLocation'), $('#inputNotes')].forEach((inp) => {
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && inp.tagName !== 'TEXTAREA') inp.blur(); });
  });
}

document.addEventListener('DOMContentLoaded', init);
