/* ============================================================
 * CatGo — app.js
 * ============================================================ */

const STORE_KEY = 'catgo.cats';
const SETTINGS_KEY = 'catgo.settings';

let cats = [];
let pendingBg = null;      // original photo dataUrl (for blurred backgrounds)
let pendingSticker = null; // transparent PNG with white outline (for display)
let pendingInfo = null;    // AI breed identification result

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

/* ---- AI breed identification (OpenAI-compatible vision API) ---- */
const ID_PROMPT = `You are a cat expert. Look at the photo and identify the cat.
Reply with ONLY minified JSON, no markdown fences:
{"isCat":true,"breed":"","colors":"","pattern":"","temperament":"","funFact":""}
- breed: best guess of breed/type, short (e.g. "Domestic Shorthair (kucing kampung)", "Tabby", "Persian mix")
- colors: fur colors, short
- pattern: coat pattern, short
- temperament: likely personality in a few words
- funFact: one short fun fact about this kind of cat
If there is no cat in the photo set isCat to false and describe what you see in breed.`;

async function identifyCat(dataUrl) {
  const { aiBaseUrl, aiKey, aiModel } = loadSettings();
  if (!aiBaseUrl || !aiKey) return null;

  const res = await fetch(`${aiBaseUrl.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aiKey}` },
    body: JSON.stringify({
      model: aiModel || 'gpt-4o-mini',
      max_tokens: 300,
      temperature: 0.4,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: ID_PROMPT },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      }],
    }),
  });
  if (!res.ok) throw new Error(`AI error ${res.status}`);
  const json = await res.json();
  const text = (json.choices?.[0]?.message?.content || '').replace(/```json|```/g, '').trim();
  return JSON.parse(text);
}

/* ---- Screens ---- */
const SCREENS = ['screenCollection', 'screenEncounter', 'screenProcessing', 'screenDetails', 'screenCatDetail'];

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

/* ============================================================
 * Encounter: live camera + treat throw + AI tooltip
 * ============================================================ */
let camStream = null;
let stickerPromise = null;

function stopCam() {
  if (camStream) camStream.getTracks().forEach((t) => t.stop());
  camStream = null;
}

function resetEncounterUI() {
  $('#encFrozen').classList.add('hidden');
  $('#encFrozen').src = '';
  $('#camFeed').classList.remove('hidden');
  $('#encTooltip').classList.add('hidden');
  $('#encActions').classList.add('hidden');
  $('#encHint').classList.remove('hidden');
  const treat = $('#encTreat');
  treat.classList.remove('hidden', 'enc-treat-flying');
  treat.style.transform = '';
}

async function openEncounter() {
  try {
    camStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false,
    });
    $('#camFeed').srcObject = camStream;
    resetEncounterUI();
    showScreen('screenEncounter');
  } catch (err) {
    // No camera / permission denied — fall back to photo picker
    $('#fileInput').click();
  }
}

function captureFrame() {
  const video = $('#camFeed');
  const maxDim = 800;
  const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}

function fillTooltip(info) {
  const rows = $('#encInfoRows');
  $('#encSpinner').classList.add('hidden');
  if (!info) {
    $('#encBreed').textContent = 'Mysterious stray cat';
    rows.innerHTML = `<div class="enc-row">Add an AI Vision key in Settings ⚙️ to identify breeds</div>`;
    return;
  }
  if (info.isCat === false) {
    $('#encBreed').textContent = 'Hmm… not a cat? 😅';
    rows.innerHTML = `<div class="enc-row">${info.breed || 'Could not identify a cat in this shot'}</div>`;
    return;
  }
  $('#encBreed').textContent = info.breed || 'Unknown breed';
  rows.innerHTML = [
    info.colors && `<div class="enc-row"><span>🎨</span>${info.colors}</div>`,
    info.pattern && `<div class="enc-row"><span>🐾</span>${info.pattern}</div>`,
    info.temperament && `<div class="enc-row"><span>💛</span>${info.temperament}</div>`,
    info.funFact && `<div class="enc-row"><span>✨</span>${info.funFact}</div>`,
  ].filter(Boolean).join('');
}

async function treatHit(landX, landY) {
  // Freeze the frame at the moment of impact
  const frame = captureFrame();
  pendingBg = frame;
  pendingSticker = null;
  pendingInfo = null;

  $('#encFrozen').src = frame;
  $('#encFrozen').classList.remove('hidden');
  $('#camFeed').classList.add('hidden');
  stopCam();
  $('#encHint').classList.add('hidden');
  $('#encTreat').classList.add('hidden');

  // Tooltip near where the treat landed
  const tip = $('#encTooltip');
  $('#encBreed').textContent = 'Identifying cat…';
  $('#encSpinner').classList.remove('hidden');
  $('#encInfoRows').innerHTML = '';
  tip.style.left = `${Math.min(Math.max(landX, 90), window.innerWidth - 90)}px`;
  tip.style.top = `${Math.min(Math.max(landY - 30, 80), window.innerHeight - 220)}px`;
  tip.classList.remove('hidden');
  $('#encActions').classList.remove('hidden');

  // Kick off sticker + breed identification in parallel
  stickerPromise = (async () => {
    try {
      const transparentBlob = await removeBg(dataUrlToBlob(frame));
      return await generateSticker(transparentBlob, 10);
    } catch {
      return frame; // fallback: raw frame
    }
  })();

  try {
    fillTooltip(await identifyCat(frame));
  } catch (err) {
    console.error('identify failed:', err);
    $('#encSpinner').classList.add('hidden');
    $('#encBreed').textContent = 'Mysterious stray cat';
    $('#encInfoRows').innerHTML = `<div class="enc-row">Breed ID failed: ${err.message}</div>`;
  }
}

/* Flick gesture on the treat */
function initTreatGesture() {
  const treat = $('#encTreat');
  let startX = 0, startY = 0, curX = 0, curY = 0, dragging = false, startT = 0;

  treat.addEventListener('pointerdown', (e) => {
    dragging = true;
    startX = e.clientX; startY = e.clientY;
    curX = 0; curY = 0;
    startT = performance.now();
    treat.setPointerCapture(e.pointerId);
  });
  treat.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    curX = e.clientX - startX;
    curY = e.clientY - startY;
    treat.style.transform = `translate(${curX}px, ${curY}px)`;
  });
  treat.addEventListener('pointerup', (e) => {
    if (!dragging) return;
    dragging = false;
    const dt = Math.max(performance.now() - startT, 1);
    const speedY = -curY / dt; // px per ms upward
    const isFlick = curY < -40 || speedY > 0.35;
    if (!isFlick) {
      treat.style.transform = '';
      return;
    }
    // Land point: continue the flick direction toward upper part of screen
    const rect = treat.getBoundingClientRect();
    const originX = rect.left + rect.width / 2;
    const landX = Math.min(Math.max(originX + curX * 2.2, 60), window.innerWidth - 60);
    const landY = window.innerHeight * 0.38;
    treat.style.setProperty('--fly-x', `${landX - originX}px`);
    treat.style.setProperty('--fly-y', `${landY - (rect.top + rect.height / 2)}px`);
    treat.classList.add('enc-treat-flying');
    treat.addEventListener('animationend', () => treatHit(landX, landY), { once: true });
  });
}

/* ---- Capture flow ---- */
async function handleFile(file) {
  if (!file || !file.type.startsWith('image/')) return;

  const raw = await fileToDataUrl(file);
  const bg = await downscale(raw, 800);
  pendingBg = bg;
  pendingSticker = null;
  pendingInfo = null;
  identifyCat(bg).then((info) => { pendingInfo = info; }).catch(() => {});

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

  const info = pendingInfo && pendingInfo.isCat !== false ? pendingInfo : null;
  const cat = {
    id: uid(),
    createdAt: Date.now(),
    bg: pendingBg,
    sticker: pendingSticker,
    nickname,
    location,
    notes,
    rarity,
    breed: info?.breed || '',
    colors: info?.colors || '',
    pattern: info?.pattern || '',
    temperament: info?.temperament || '',
    funFact: info?.funFact || '',
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
  pendingInfo = null;
  renderCollection();
  showScreen('screenCollection');
  toast(`${nickname} was registered to your Catdex!`);
}

/* ---- Cat detail ---- */
function openCatDetail(id) {
  const cat = cats.find((c) => c.id === id);
  if (!cat) return;

  $('#detailHeroImg').src = cat.sticker;
  $('#detailCatName').textContent = cat.nickname;
  $('#detailCp').textContent = `CP ${catCp(cat)}`;

  const rarityEl = $('#detailRarity');
  rarityEl.textContent = cat.rarity;
  rarityEl.className = `rarity-badge ${cat.rarity}`;

  $('#detailLocation').textContent = cat.location || 'Unknown';
  $('#detailDate').textContent = fmtDate(cat.createdAt);

  const breedEl = $('#detailBreed');
  breedEl.textContent = cat.breed || '';
  breedEl.style.display = cat.breed ? '' : 'none';

  const aboutSection = $('#detailAboutSection');
  const aboutBits = [
    cat.colors && `🎨 ${cat.colors}`,
    cat.pattern && `🐾 ${cat.pattern}`,
    cat.temperament && `💛 ${cat.temperament}`,
    cat.funFact && `✨ ${cat.funFact}`,
  ].filter(Boolean);
  if (aboutBits.length) {
    $('#detailAbout').textContent = aboutBits.join('\n');
    aboutSection.classList.remove('hidden');
  } else {
    aboutSection.classList.add('hidden');
  }

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
    showScreen('screenCollection');
    toast('Released back into the wild 🐾');
  };

  showScreen('screenCatDetail', true);
}

/* ---- Init ---- */
function init() {
  load();
  renderCollection();
  showScreen('screenCollection');

  const fileInput = $('#fileInput');
  $('#fabCapture').onclick = () => openEncounter();
  fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
    e.target.value = '';
  });

  // Encounter screen
  initTreatGesture();
  $('#encClose').onclick = () => { stopCam(); showScreen('screenCollection'); };
  $('#encCancel').onclick = () => { stopCam(); showScreen('screenCollection'); };
  $('#encRetake').onclick = () => openEncounter();
  $('#encConfirm').onclick = async () => {
    const btn = $('#encConfirm');
    btn.disabled = true;
    pendingSticker = stickerPromise ? await stickerPromise : pendingBg;
    btn.disabled = false;
    confirmCapture();
  };

  $('#procCancel').onclick = () => showScreen('screenCollection');
  $('#procConfirm').onclick = () => confirmCapture();
  $('#procRetake').onclick = () => { showScreen('screenCollection'); fileInput.click(); };

  $('#btnSave').onclick = saveCat;
  $('#detailsBack').onclick = () => showScreen('screenCollection');
  $('#catDetailBack').onclick = () => showScreen('screenCollection');

  // Settings
  $('#settingsBtn').onclick = () => {
    const s = loadSettings();
    $('#inputApiKey').value = s.apiKey || '';
    $('#inputAiBaseUrl').value = s.aiBaseUrl || '';
    $('#inputAiKey').value = s.aiKey || '';
    $('#inputAiModel').value = s.aiModel || '';
    $('#settingsOverlay').classList.remove('hidden');
  };
  $('#settingsClose').onclick = () => $('#settingsOverlay').classList.add('hidden');
  $('#btnSaveSettings').onclick = () => {
    saveSettings({
      apiKey: $('#inputApiKey').value.trim(),
      aiBaseUrl: $('#inputAiBaseUrl').value.trim(),
      aiKey: $('#inputAiKey').value.trim(),
      aiModel: $('#inputAiModel').value.trim(),
    });
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
