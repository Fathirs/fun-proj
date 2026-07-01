/* ============================================================
 * CatGo — app.js
 * ============================================================ */

const STORE_KEY = 'catgo.cats';

let cats = [];
let pendingImage = null; // dataUrl of current capture

/* ---- Storage ---- */
function load() {
  try { cats = JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
  catch { cats = []; }
}
function save() { localStorage.setItem(STORE_KEY, JSON.stringify(cats)); }

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

/* ---- Rarity: based on dominant hue of image ---- */
function assignRarity() {
  const roll = Math.random();
  if (roll < 0.05) return 'Legendary';
  if (roll < 0.20) return 'Epic';
  if (roll < 0.50) return 'Rare';
  return 'Common';
}

/* ---- Downscale image ---- */
function downscale(dataUrl, maxDim = 900) {
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
      resolve(canvas.toDataURL('image/jpeg', 0.88));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/* ---- Screens ---- */
const SCREENS = ['screenCollection', 'screenProcessing', 'screenDetails', 'screenCatDetail'];

function showScreen(id, slideFromRight = false) {
  SCREENS.forEach((s) => {
    const el = document.getElementById(s);
    el.classList.remove('active', 'slide-in-right');
  });
  const target = document.getElementById(id);
  if (slideFromRight) {
    target.classList.add('slide-in-right');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => target.classList.add('active'));
    });
  } else {
    target.classList.add('active');
  }
}

/* ---- Sticker effect helpers ---- */
function applyBgToEl(el, dataUrl) {
  el.style.backgroundImage = `url(${dataUrl})`;
}

/* ---- Collection ---- */
function renderCollection() {
  const grid = $('#collectionGrid');
  const empty = $('#emptyState');
  $('#collectionCount').textContent = `${cats.length} cat${cats.length !== 1 ? 's' : ''} caught`;

  // remove existing cards (keep empty state el)
  grid.querySelectorAll('.cat-card').forEach((c) => c.remove());

  if (!cats.length) {
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  const sorted = [...cats].sort((a, b) => b.createdAt - a.createdAt);
  sorted.forEach((cat, idx) => {
    const card = document.createElement('div');
    card.className = 'cat-card';
    card.innerHTML = `
      <div class="cat-card-image">
        <div class="cat-card-bg"></div>
        <div class="cat-card-sticker"><img src="${cat.image}" alt="${cat.nickname}" /></div>
        <div class="cat-card-rarity">
          <span class="rarity-badge ${cat.rarity}">${cat.rarity}</span>
        </div>
      </div>
      <div class="cat-card-info">
        <div class="cat-card-name">${cat.nickname}</div>
        <div class="cat-card-location">${cat.location || '📍 Unknown'}</div>
      </div>`;
    card.querySelector('.cat-card-bg').style.backgroundImage = `url(${cat.image})`;
    card.onclick = () => openCatDetail(cat.id);
    grid.appendChild(card);
  });
}

/* ---- Capture flow ---- */
async function handleFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const raw = await fileToDataUrl(file);
  const image = await downscale(raw);
  pendingImage = image;

  // show processing screen
  applyBgToEl($('#processingBg'), image);
  $('#stickerImg').src = image;
  showScreen('screenProcessing');

  // simulate processing delay (1.6s) then go to details
  await new Promise((r) => setTimeout(r, 1600));

  // prep details screen
  applyBgToEl($('.detail-sticker-wrap'), image);
  $('#detailStickerImg').src = image;
  const rarity = assignRarity();
  const rarityEl = $('#rarityBadge');
  rarityEl.textContent = rarity;
  rarityEl.className = `rarity-badge ${rarity}`;
  rarityEl.dataset.rarity = rarity;
  $('#inputNickname').value = '';
  $('#inputLocation').value = '';

  showScreen('screenDetails', true);
}

/* ---- Save cat ---- */
function saveCat() {
  const nickname = $('#inputNickname').value.trim() || 'Unknown Cat';
  const location = $('#inputLocation').value.trim();
  const rarity = $('#rarityBadge').dataset.rarity || 'Common';

  const cat = {
    id: uid(),
    createdAt: Date.now(),
    image: pendingImage,
    nickname,
    location,
    rarity,
  };
  cats.push(cat);
  save();
  pendingImage = null;

  renderCollection();
  showScreen('screenCollection');
  toast(`${nickname} added to your collection!`);
}

/* ---- Cat Detail ---- */
function openCatDetail(id) {
  const cat = cats.find((c) => c.id === id);
  if (!cat) return;

  applyBgToEl($('#detailHeroBg'), cat.image);
  $('#detailHeroImg').src = cat.image;
  $('#detailCatName').textContent = cat.nickname;

  const rarityEl = $('#detailRarity');
  rarityEl.textContent = cat.rarity;
  rarityEl.className = `rarity-badge ${cat.rarity}`;

  $('#detailLocation').textContent = cat.location || 'Unknown location';
  $('#detailDate').textContent = fmtDate(cat.createdAt);

  const idx = [...cats].sort((a, b) => a.createdAt - b.createdAt).findIndex((c) => c.id === id);
  $('#detailDexNo').textContent = `#${String(idx + 1).padStart(3, '0')}`;

  $('#btnDeleteCat').onclick = () => {
    cats = cats.filter((c) => c.id !== id);
    save();
    renderCollection();
    showScreen('screenCollection');
    toast('Removed from collection');
  };

  showScreen('screenCatDetail', true);
}

/* ---- Init ---- */
function init() {
  load();
  renderCollection();
  showScreen('screenCollection');

  const fileInput = $('#fileInput');
  $('#fabCapture').onclick = () => fileInput.click();
  fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
    e.target.value = '';
  });

  $('#btnSave').onclick = saveCat;
  $('#detailsBack').onclick = () => showScreen('screenCollection');
  $('#catDetailBack').onclick = () => showScreen('screenCollection');

  // keyboard submit on inputs
  [$('#inputNickname'), $('#inputLocation')].forEach((inp) => {
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') inp.blur(); });
  });
}

document.addEventListener('DOMContentLoaded', init);
