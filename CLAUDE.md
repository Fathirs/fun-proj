# fun-proj — Project Context

Repo: `Fathirs/fun-proj` · Owner: Fathirs (luca@jatevo.ai)

Two independent static apps live here, no build step, no backend:

| App | Path | Status |
|---|---|---|
| **CatGo** | `catgo/` | Active development — main project |
| DripDex (outfit logger) | root (`index.html`, `app.js`, `jatevo.js`, `styles.css`) | Older experiment, don't touch unless asked |

---

## CatGo — Pokemon Go for stray cats

Catch stray cats with your phone camera, Pokemon Go style. Pure HTML/CSS/JS + localStorage, designed mobile-first (iPhone).

### The flow (final concept, user-approved)

1. **Home = Catdex** — Pokedex-style 3-column grid: `#001` numbering, CP values, greyed-out `???` future slots. Orange header, count pill, settings gear.
2. Tap the **pokeball button** (bottom center) → **live camera encounter** (`getUserMedia`, rear camera; falls back to file picker if no camera/permission).
3. **Drag & flick the chicken treat 🍗** at the cat → it flies with an arc → impact flash → frame freezes.
4. **Catch animation** (Pokemon Go sequence): frozen frame gets *sucked into* the treat → treat **wobbles 3×** → star burst ✨ + **GOTCHA!** banner.
5. **Scan result sheet** slides up: breed, fur colors, coat pattern, temperament, fun fact — identified by AI vision. Buttons: *Release* (re-open camera) / *Register to Catdex*.
6. **Register screen**: nickname, location found, notes → saved to collection.
7. **Cat detail page** (Pokemon Go style): big `CP` number over sky/grass scene, floating sticker, rarity badge, breed line, stat tiles (dex no / found at / caught on), "About this cat" (AI info), notes, release (delete).

### Files

- `catgo/index.html` — all 5 screens: `screenCollection` (home/Catdex), `screenEncounter` (camera + catch), `screenProcessing` (fallback for file-picker path), `screenDetails` (register form), `screenCatDetail`. Settings bottom-sheet overlay lives inside screenCollection.
- `catgo/app.js` — ES module. All logic: localStorage store, screen router (`showScreen`), encounter/catch sequence (`openEncounter`, `initTreatGesture`, `treatHit`), Remove.bg call (`removeBg`), white-outline sticker generator (`generateSticker`, canvas 32-step circle stamp), AI breed scan (`identifyCat`), Catdex render, detail render, deterministic CP (`catCp` = rarity base + id hash).
- `catgo/styles.css` — Apple-HIG-ish + playful. Palette: orange `#F4632A`, sky blue `#4B9FE1`, rounded font stack `ui-rounded/SF Pro Rounded`. All encounter/catch FX animations live here (`enc-*` classes, `treat-fly`, `ball-wobble`, `star-pop`, `sheet-up`).
- `vercel.json` — `cleanUrls: true` + CSP header for `/catgo/*`: `connect-src 'self' https:` (needed for Remove.bg + AI APIs), `media-src 'self' blob:` (camera).

**Important:** `index.html` references assets with **absolute paths** (`/catgo/styles.css`, `/catgo/app.js`) because Vercel `cleanUrls` strips trailing slashes and breaks relative paths. Keep it that way — this means locally you must serve the **repo root**, not the `catgo/` folder.

### Data model (localStorage `catgo.cats`)

```js
{ id, createdAt, bg /* jpeg dataUrl */, sticker /* png dataUrl, white outline */,
  nickname, location, notes, rarity /* Common|Rare|Epic|Legendary, random on catch */,
  breed, colors, pattern, temperament, funFact /* from AI scan, '' if none */ }
```

Settings in localStorage `catgo.settings`: `{ apiKey /* remove.bg */, aiBaseUrl, aiKey, aiModel }`.

### External services (both user-configured in Settings ⚙️, both optional with graceful fallback)

1. **Remove.bg** — background removal → sticker cut-out. `POST https://api.remove.bg/v1.0/removebg`, header `X-Api-Key`. Free tier 50/mo at remove.bg/dashboard. No key → raw photo used as sticker.
2. **AI vision, OpenAI-compatible** — breed identification. `POST {aiBaseUrl}/chat/completions`, Bearer key, image as data-URL `image_url`. User plans to use **SumoPod** (e.g. `https://ai.sumopod.com/v1`) with a vision model (e.g. `gpt-4o-mini`). Prompt asks for strict JSON `{isCat, breed, colors, pattern, temperament, funFact}`. No key → "Mysterious stray cat".

### Running locally

```bash
# from repo root (NOT from catgo/) — absolute paths need root serving
python3 -m http.server 3000        # or: npx serve .
# open http://localhost:3000/catgo/
```

- Camera (`getUserMedia`) works on `localhost` without HTTPS; on other hosts/IPs it requires HTTPS.
- Test the encounter on desktop Chrome: DevTools device toolbar; flick the treat with mouse drag. Fake camera: launch Chrome with `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`.

### Deployment

- Vercel, GitHub integration, team `fathirs-projects-f88ea97a`, two projects deploy this repo: `fun-proj` and `fun-proj-g7gb`.
- Every branch push → preview deploy. Branch preview URL used throughout dev: `https://fun-proj-git-claude-cat-captur-37f901-fathirs-projects-f88ea97a.vercel.app/catgo`
- `main` is production. **UNRESOLVED:** the exact production domain is unknown — `fun-proj.vercel.app` belongs to someone else (404 NOT_FOUND on `/catgo`). Check Vercel dashboard → project → Settings → Domains for the real one. The Vercel REST API was unreachable from the previous (sandboxed) session; locally it should work fine with the user's token.
- Vercel CLI can deploy directly too: `vercel --prod` from repo root (user has a token).

### Git state (as of last session, 2026-07-13)

- `main` = production, contains everything up to PR #3 (squash `8d224d1`).
- Working branch `claude/cat-capture-notes-tuxmts` == main (reset after merge).
- PR #1 closed (duplicate), PR #2 merged (initial app + iterations), PR #3 merged (live camera encounter + catch animation + AI scan + CSP fix).

### History / decisions (why things are the way they are)

- Concept evolved: photo-upload collection app → Apple HIG cards → playful sticker-book UI → full Pokemon Go (map overworld + Catdex) → **simplified back to Catdex-as-home** (user: "simple kayak stamp app, tapi persis Pokemon Go, gaada order-orderan") → **live camera + treat throw + catch animation + AI breed scan** (current).
- A map overworld screen existed briefly and was removed — don't resurrect it.
- Background removal originally used `@imgly/background-removal` WASM — **failed on iOS Safari**, replaced with Remove.bg REST. Don't go back to browser WASM.
- The old CSP blocked `api.remove.bg` (connect-src) — that's why BG removal "failed" on the user's phone even with the flow correct. Fixed in PR #3.
- Rarity is random at catch; CP is deterministic from id hash + rarity so it never changes on re-render.

### Known issues / next steps

1. Production domain 404 mystery — find the real production URL (Vercel dashboard or `vercel ls`/API locally).
2. End-to-end test on a real phone with real API keys (Remove.bg + SumoPod vision) hasn't happened yet.
3. localStorage will fill up with many cats (dataUrls are heavy); consider IndexedDB or image compression if it becomes a problem.
4. `screenProcessing` (file-picker fallback path) still uses the old X/✓/↺ preview without the catch animation — fine, but inconsistent.
