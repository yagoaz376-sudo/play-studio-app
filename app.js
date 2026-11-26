// Play Studio — editor for the TC-Helicon Play Acoustic / Play Electric over USB-MIDI SysEx.
// Protocol, menu data and the MIDI link come from github.com/michaelbeyhs/open-acoustic (see vendor/).
//
// Safety rules (enforced here, on top of pa-link.js's own BLOCKED list):
//  • Only IDs that appear as a control in the menu data (plus HIT) can ever be written — an allowlist.
//  • MIDI CTRL / FILTER / SYSEXID / MIDI+CC channel, the AUX sensor and the preset-number register are never written.
//  • Play Electric (product 0x71): the Play Acoustic map is NOT trusted. Nothing is read or written by Acoustic IDs;
//    only IDs the user confirmed in the Mapper (by changing that control on the pedal) become readable/editable.
//  • Values shown always come from the pedal. Until read, a control shows "··" and is inert.
(function () {
  "use strict";
  const M = window.PA_MENUS, IM = window.PA_IMAGES || {}, PP = window.PA_PARAMS || {}, L = window.PALink;
  const $ = s => document.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const hex = s => parseInt(s, 16), hx = n => "0x" + n.toString(16).toUpperCase().padStart(3, "0");
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const delay = ms => new Promise(r => setTimeout(r, ms));
  const tt = s => (window.PSI18N ? window.PSI18N.t(s) : s);   // for text that never reaches the page (confirm dialogs); see i18n.js
  const SIM = new URLSearchParams(location.search).has("sim");
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem((SIM ? "ps-sim-" : "ps-") + k)); return v ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem((SIM ? "ps-sim-" : "ps-") + k, JSON.stringify(v)); } catch {} },
  };

  // ── ids ─────────────────────────────────────────────────────────────────
  const ID = { PRESET: 0x2A4, HIT: 0x2A8, AUX_SENSE: 0x295, BODYREZ_EDIT: 0x362, FOOTSWITCH: 0x39F };
  // Never written. The MIDI ones on every model; the AUX sensor and the preset register are Play Acoustic meanings of
  // those IDs (on a Play Electric 0x2A4 is the HardTune on/off, found on a real unit), so they only apply there.
  const NEVER_ALWAYS = new Set([0x278, 0x279, 0x27A, 0x27B, 0x27C]), NEVER_PA = new Set([ID.AUX_SENSE, ID.PRESET]);
  const NEVER = new Set([...NEVER_ALWAYS, ...NEVER_PA]);
  // Play Electric (from its firmware, maps/FIRMWARE.md): MIDI CTRL, MIDI CHAN, CC CHAN, FILTER, SYSEXID, the
  // sensor/utility flags and the preset-erase/bank commands. Never written, whatever the map says.
  const NEVER_PE = new Set([0x255, 0x256, 0x257, 0x258, 0x259, ...Array.from({ length: 8 }, (_, i) => 0x272 + i), 0x2D7, 0x2D8, 0x2D9, 0x2DA, 0x386, 0x387, 0x388, 0x389, 0x282]);
  const MAX_ID = 0x3B3;

  // every control cell in the menu data, by id (first definition wins; duplicates are identical)
  const CELLS = new Map();
  const cellsOf = p => (p ? (p.rows || []).flat().filter(Boolean) : []);
  for (const m of Object.values(M)) for (const p of m.pages) for (const c of [p.control, ...cellsOf(p)]) if (c && !CELLS.has(hex(c.param))) CELLS.set(hex(c.param), c);
  CELLS.set(ID.HIT, { param: "0x2A8", label: "HIT", min: 0, max: 1, format: "list", values: ["OFF", "ON"], default: 0 });
  for (const id of NEVER) CELLS.delete(id);   // belt and braces: none of them is a menu control today
  const cellOf = el => CELLS.get(hex(el.dataset.param));
  const pagesOf = (menu, title) => M[menu].pages.filter(p => p.title === title);

  const MIX_IDS = new Set(M.MIX.pages.flatMap(p => cellsOf(p).map(c => hex(c.param))));
  const SETUP_IDS = new Set(M.SETUP.pages.flatMap(p => cellsOf(p).map(c => hex(c.param))));
  const GLOBAL = new Set([...MIX_IDS, ...SETUP_IDS, ID.HIT, ID.AUX_SENSE]);   // not part of a preset

  // ── device mode + Play Electric map ─────────────────────────────────────
  let MODE = null;   // "pa" | "pe" once the pedal identified itself
  const mapKey = () => "map-" + (MODE === "pe" ? "71" : "70");
  let MAPD = { entries: {}, ignored: [] };   // entries: { "<id>": { pa: "0x0D8" | null, name } }
  let paToDev = new Map();                   // PA cell id → device id (Play Electric only)
  // The map = the built-in one for this model (maps/builtin-maps.js, made on a real pedal) + what this user confirmed
  // or removed in the Mapper (saved in the browser). Saved copies of built-in entries never override a newer built-in
  // map; only entries the user confirmed themselves (user: true) or built-in ones they removed do.
  function loadMap() {
    const raw = store.get(mapKey(), null) || {};
    const builtin = MODE === "pe" && window.PS_BUILTIN_MAPS && window.PS_BUILTIN_MAPS["71"] || { entries: {}, ignored: [] };
    const okId = i => Number.isInteger(i) && i >= 0 && i <= MAX_ID;
    MAPD = { entries: {}, ignored: [], removed: Array.isArray(raw.removed) ? raw.removed.filter(okId) : [] };
    const take = (k, e, user) => {   // validate: whole-number id in range, a name, pa a known menu cell
      const id = Number(k);
      if (!okId(id) || !e || typeof e.name !== "string") return;
      const ent = { pa: typeof e.pa === "string" && CELLS.has(hex(e.pa)) ? e.pa : null, name: e.name.slice(0, 60) };
      const vals = cleanValues(e.values); if (vals) ent.values = vals;
      const sc = cleanScale(e); if (sc) Object.assign(ent, sc);
      if (typeof e.label === "string" && e.label.trim()) ent.label = e.label.trim().slice(0, 24);   // the Electric's own name for the control
      if (user) ent.user = true;
      MAPD.entries[id] = ent;
    };
    for (const [k, e] of Object.entries(builtin.entries || {})) take(k, e, false);
    if (raw.entries && typeof raw.entries === "object")
      for (const [k, e] of Object.entries(raw.entries)) if (e && (e.user || !(k in (builtin.entries || {})))) take(k, e, true);
    for (const id of MAPD.removed) delete MAPD.entries[id];
    MAPD.ignored = [...new Set([...(builtin.ignored || []), ...(Array.isArray(raw.ignored) ? raw.ignored : [])])].filter(okId);
    paToDev = new Map(Object.entries(MAPD.entries).filter(([, e]) => e.pa && CELLS.has(hex(e.pa))).map(([dev, e]) => [hex(e.pa), +dev]));
    applyOverrides();
  }
  // A map entry may carry its own list of values (the Play Electric's lists differ, e.g. its delay styles start with
  // HALF). Those replace the Play Acoustic names and range on the menu cell while a Play Electric is connected.
  function cleanValues(v) {
    if (!Array.isArray(v) || !v.length || v.length > 128) return null;
    const out = v.map(s => typeof s === "string" ? s.slice(0, 40) : null);
    return out.every(s => s) ? out : null;
  }
  // …or its own range and number scale (the Electric's reverb decay: seconds = value / 10 − 9, found on a real unit)
  function cleanScale(e) {
    const out = {}, int = x => Number.isInteger(x) && Math.abs(x) <= 65535;
    if (int(e.min) && int(e.max) && e.min < e.max) { out.min = e.min; out.max = e.max; }
    if (e.scale && typeof e.scale === "object") {
      const s = e.scale, num = x => typeof x === "number" && Number.isFinite(x);
      if (num(s.mul) && (s.add == null || num(s.add)) && (s.dec == null || int(s.dec)) && (s.unit == null || (typeof s.unit === "string" && s.unit.length <= 6)))
        out.scale = { mul: s.mul, add: s.add ?? 0, dec: s.dec ?? 1, unit: s.unit ?? "" };
    }
    return Object.keys(out).length ? out : null;
  }
  const ALL_CELLS = Object.values(M).flatMap(m => m.pages.flatMap(p => [p.control, ...cellsOf(p)])).filter(Boolean);
  function applyOverrides() {
    const ov = new Map();
    if (MODE === "pe") for (const e of Object.values(MAPD.entries)) if (e.pa && (e.values || e.scale || e.min != null || e.label)) ov.set(hex(e.pa), e);
    for (const c of ALL_CELLS) {
      if (!c.__orig) c.__orig = { values: c.values, min: c.min, max: c.max, format: c.format, fmt: c.fmt, label: c.label };
      Object.assign(c, c.__orig);
      const e = ov.get(hex(c.param)); if (!e) continue;
      if (e.values) { c.values = e.values; c.min = 0; c.max = e.values.length - 1; }
      if (e.min != null) { c.min = e.min; c.max = e.max; }
      if (e.label) c.label = e.label;
      if (e.scale) { c.format = "scale"; c.fmt = { mul: e.scale.mul, add: e.scale.add, dec: e.scale.dec, unit: e.scale.unit }; }
    }
  }
  // a map change changes which device id a control writes to: drop undo steps and queued writes made before it
  const saveMap = () => { store.set(mapKey(), MAPD); loadMap(); clearHistory(); resetWrites(); };
  // the device id for a menu cell: itself on the Play Acoustic, the confirmed one (or none) on the Play Electric
  const rid = c => { const id = hex(c.param); return MODE === "pe" ? (paToDev.get(id) ?? null) : id; };
  const writable = id => Number.isInteger(id) && id >= 0 && id <= MAX_ID && !NEVER_ALWAYS.has(id) && !(MODE !== "pe" && NEVER_PA.has(id)) && !(MODE === "pe" && NEVER_PE.has(id)) && !L.isBlocked(id)
    && (MODE === "pe" ? [...paToDev.values()].includes(id) : MODE === "pa" && CELLS.has(id));

  // ── model: values read from the pedal ───────────────────────────────────
  const V = new Map();                 // device id → value
  const valOf = paId => { const c = CELLS.get(paId); const id = c ? rid(c) : (MODE === "pe" ? null : paId); return id == null ? undefined : V.get(id); };
  const P = { num: null, name: null, edited: false, fav: null, genre: null };   // fav: the current preset is a Favorite (from the pedal)
  const clamp = (c, v) => Math.max(c.min, Math.min(c.max, Math.round(v)));

  // ── value formats (same rules as open-acoustic views.js) ────────────────
  const trim = (n, d) => (+(+n).toFixed(d)).toString();
  function lerp(pts, v) {
    if (!pts || !pts.length) return v; if (v <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) if (v <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + (y1 - y0) * (v - x0) / (x1 - x0); }
    return pts[pts.length - 1][1];
  }
  // The 0..240 frequency controls (BodyRez LOW / HI / PARA FREQ, the Electric's AutoShape and MID FREQ…) step 1/24
  // octave from 20 Hz to 20 kHz: 241 values = 3 decades × 80. Not read off a pedal's screen yet, hence the "≈".
  // (Check: the Electric's amp MID FREQ range 87..174 comes out as 244 Hz..2.95 kHz, a typical amp mid band.)
  const freqOf = v => 20 * Math.pow(10, v / 80);
  const hzText = f => f >= 1000 ? trim(f / 1000, f >= 10000 ? 1 : 2) + " kHz" : Math.round(f) + " Hz";
  const isFreq = c => c && !c.values && c.min === 0 && c.max === 240 && /FREQ$/.test(c.label);
  function fmt(c, v) {
    if (v == null) return "··";
    if (c.values) return c.values[v - c.min] ?? String(v);
    if (isFreq(c)) return "≈" + hzText(freqOf(v));
    const o = c.fmt || {};
    switch (c.format) {
      case "dB": return (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v) + " dB";
      case "%": return v + "%";
      case "Hz/2": return (v / 2).toFixed(1) + " Hz";
      case "OFF/%": return v ? v + "%" : "OFF";
      case "BPM": return v + " BPM";
      case "ms": return v + " ms";
      case "scale": return trim(v * (o.mul ?? .01) + (o.add ?? 0), o.dec ?? 2) + " " + (o.unit ?? "Hz");
      case "time": { const s = o.points ? lerp(o.points, v) : v / 10; return s < 1 ? Math.round(s * 1000) + " ms" : trim(s, s < 10 ? 1 : 0) + " s"; }
      case "curve": return trim(lerp(o.points, v), o.dec ?? 0) + (o.unit ? " " + o.unit : "");
      default: return (c.min < 0 && v > 0 ? "+" : "") + String(v).replace("-", "−");
    }
  }

  // ── toasts ──────────────────────────────────────────────────────────────
  function toast(text, kind = "", ms = 2600) {
    const t = document.createElement("div"); t.className = "toast glass " + kind; t.textContent = text;
    $("#toasts").appendChild(t); setTimeout(() => t.remove(), ms);
    while ($("#toasts").children.length > 3) $("#toasts").firstChild.remove();
  }
  let ncT = 0;
  const notConnected = () => { if (performance.now() - ncT > 1500) { ncT = performance.now(); toast("Not connected to the pedal", "warn"); } };

  // ── writes: model first, then the pedal (coalesced per parameter) ───────
  const touched = new Map(), pending = new Map(); let flushT = 0;
  // epoch changes whenever what's on screen stops describing the pedal (preset change, reconnect, re-read):
  // anything started before it (a drag, a queued write, a read-back) is dropped
  let epoch = 0;
  const recent = id => touched.has(id) && performance.now() - touched.get(id) < 1500;
  function flush() {
    clearTimeout(flushT); flushT = 0;
    const sent = [];
    for (const [id, v] of pending) if (L.ready && writable(id) && L.set(id, v)) sent.push(id);
    pending.clear();
    if (sent.length) readBackSoon(sent);
  }
  addEventListener("pagehide", flush);
  // read written values back, so the screen shows what the pedal really holds (it may clamp or ignore a value)
  const backIds = new Set(); let backT = 0;
  function readBackSoon(ids) {
    for (const id of ids) backIds.add(id);
    clearTimeout(backT);
    backT = setTimeout(async () => {
      const e = epoch, ids = [...backIds].filter(id => performance.now() - (touched.get(id) || 0) >= 350);
      for (const id of ids) backIds.delete(id);
      for (const id of ids) {
        const v = await L.get(id);
        if (e !== epoch || v == null || performance.now() - (touched.get(id) || 0) < 350) continue;
        if (V.get(id) !== v) { V.set(id, v); paint(); }
      }
      if (backIds.size) readBackSoon([]);
    }, 400);
  }
  function resetWrites() { clearTimeout(flushT); flushT = 0; pending.clear(); touched.clear(); backIds.clear(); clearTimeout(backT); epoch++; endDrags(); }
  const STRUCT_IDS = new Set([ID.BODYREZ_EDIT, ID.FOOTSWITCH]);
  // ── Genre: which presets the pedal steps through (its GENRE button). Picking one on the pedal is GENRE, the knob
  // (one click per genre), GENRE again (checked on a real Play Electric, 2026-11-25); the register then holds the
  // genre's number. The preset list follows the genre, so it is read again afterwards. ─────────────────────────
  const GENRE_REG = () => MODE === "pe" ? 0x283 : 0x2A5;
  const GENRES = () => MODE === "pe"
    ? ["ALL", "FAVORITE", "SHOWCASE", "SONGS & ARTISTS", "POP", "ROCK", "ALTERNATIVE", "COUNTRY", "HIP HOP/RAP", "EDM", "ECHO", "DOUBLING", "REVERB", "HARMONY", "HARDTUNE", "MEGAPHONE", "EXTREME", "CHARACTER", "BLUES"]   // from its firmware
    : ((PP[0x2A5] && PP[0x2A5][4]) || ["ALL", "FAVORITE"]);
  const genreLabel = g => g === "ALL" ? "All presets" : g === "FAVORITE" ? "★ Favorites" : g;
  const inGenre = (e, g = P.genre) => !g || (e.flags == null ? (g === 1 ? e.fav === true : true) : ((e.flags >>> (g - 1)) & 1) === 1);
  const visibleNums = () => Object.entries(lib.presets).filter(([, e]) => inGenre(e)).map(([n]) => +n).sort((a, b) => a - b);
  async function readGenre() { const g = await L.get(GENRE_REG()); if (g != null) { P.genre = g; paintPicker(); } return g; }
  async function setGenre(t) {
    if (!L.ready) return notConnected();
    if (walking || stepping) { paintPicker(); return toast("Wait: the app is reading the presets", "warn"); }
    walking = true; LIB.busy = true; paintPicker();
    let cur = null;
    try {
      cur = await L.get(GENRE_REG());
      for (let round = 0; round < 3 && cur != null && cur !== t && L.ready; round++) {
        $("#lib-status").textContent = `Changing genre to ${genreLabel(GENRES()[t] || t)}…`;
        await L.press(L.EVT.back); await delay(350);
        await L.press(0x01); await delay(600);                     // GENRE: opens the list
        const d = t - cur;
        for (let i = 0; i < Math.abs(d); i++) { L.inject(0xAE, 0x00, d > 0 ? 0x01 : 0x00); await delay(300); }
        await L.press(0x01); await delay(1000);                    // GENRE again: picks it
        cur = await L.get(GENRE_REG());
      }
    } finally { walking = false; LIB.busy = false; }
    if (cur != null) P.genre = cur;
    if (cur !== t) { paintPicker(); return toast(GENRES()[t] === "FAVORITE" ? "No Favorites genre: tag a preset with ★ first" : "The pedal didn't change genre. Is it on its preset screen?", "warn", 4500); }
    toast(`Genre: ${genreLabel(GENRES()[t] || t)}`, "", 2500);
    presetChanged(null); paintPicker();   // the pedal jumped to that genre's first preset
  }

  // ── ★ Favorite: press the pedal's own FAVORITE button (BACK first, so it acts on the preset screen and never on a
  // menu cell), then read the preset header again to show what the pedal now says ─────────────────────────────
  let favBusy = false;
  async function toggleFav() {
    if (!L.ready) return notConnected(); if (favBusy || stepping) return;
    if (walking) return toast("Wait: the app is reading the presets", "warn");
    favBusy = true; paintChrome();
    try {
      const was = P.fav;
      await L.press(L.EVT.back); await delay(250);
      await L.press(0x00); await delay(450);
      const info = await L.presetInfo(); if (!info) return;
      P.fav = info.fav;
      for (const b of $$("[data-fav]")) { b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); }
      if (P.num != null && lib.presets[P.num]) { lib.presets[P.num].fav = info.fav; saveLib(); paintPicker(); }
      if (was != null && info.fav === was) toast("The pedal didn't confirm the change: check FAV on its screen", "warn", 4000);
      else toast(info.fav ? "★ Added to favorites" : "Removed from favorites");
    } finally { favBusy = false; paintChrome(); }
  }

  // ── tap tempo (Stage) ───────────────────────────────────────────────────
  // One TEMPO per preset (45–300 BPM) drives every tempo-synced effect (vocal and guitar delay). The average of the
  // last taps sets it; a pause of more than 2 s starts a new count.
  const TEMPO = 0x158;
  let taps = [];
  function tapTempo() {
    const c = CELLS.get(TEMPO), b = $("#tap2");
    if (b) { b.classList.remove("beat"); void b.offsetWidth; b.classList.add("beat"); }
    if (!c) return; if (!L.ready) return notConnected();
    const now = performance.now();
    if (taps.length && now - taps[taps.length - 1] > 2000) taps = [];
    taps.push(now); if (taps.length > 6) taps.shift();
    if (taps.length < 2) { tapHint = "TAP AGAIN"; return paintChrome(); }
    const bpm = Math.round(60000 / ((taps[taps.length - 1] - taps[0]) / (taps.length - 1)));
    tapHint = null; setParam(c, Math.max(c.min, Math.min(c.max, bpm))); paintChrome();
  }
  let tapHint = null;

  function setParam(c, v, { undoable = true } = {}) {
    if (!c) return;
    if (!L.ready) return notConnected();
    const id = rid(c);
    if (id == null) return toast("Not mapped yet: confirm it in the Mapper first", "warn");
    if (!writable(id)) return toast("This parameter is protected", "warn");
    if (V.get(id) == null) return;   // never write a parameter whose current value hasn't been read from the pedal
    v = clamp(c, v);
    if (!Number.isFinite(v) || V.get(id) === v) return;
    if (undoable) record(c, id);
    if (ab) abEnd();
    V.set(id, v); touched.set(id, performance.now());
    pending.set(id, v); if (!flushT) flushT = setTimeout(flush, 30);
    const paId = hex(c.param);
    if (!GLOBAL.has(paId)) { P.edited = true; fresh = false; }
    if (STRUCT_IDS.has(paId)) render(); else paint();
  }

  // undo: one step per gesture (changes within 600 ms count as one)
  const history = []; let group = null, lastRec = 0;
  function record(c, id) {
    const now = performance.now();
    if (!group || now - lastRec > 600) { group = new Map(); history.push(group); if (history.length > 100) history.shift(); }
    if (!group.has(id)) group.set(id, { c, v: V.get(id) }); lastRec = now;
  }
  function undo() {
    if (!L.ready) return notConnected();
    const g = history.pop(); group = null;
    if (!g) return toast("Nothing to undo");
    for (const { c, v } of g.values()) if (v != null) setParam(c, v, { undoable: false });
    paint();
  }
  const clearHistory = () => { history.length = 0; group = null; };

  // ── effects (signal order, as in open-acoustic views.js) ────────────────
  const FXDEF = [
    { id: "hardtune", side: "voz", name: "HardTune", menu: "VOCAL", title: "HARDTUNE" },
    { id: "transducer", side: "voz", name: "Transducer", menu: "VOCAL", title: "TRANSDUCER", adv: ["VOCAL ADV", "TRANSDUCER"] },
    { id: "double", side: "voz", name: "Double", menu: "VOCAL", title: "DOUBLE" },
    { id: "harmony", side: "voz", name: "Harmony", menu: "VOCAL", title: "HARMONY", adv: ["VOCAL ADV", "HARMONY"] },
    { id: "umod", side: "voz", name: "uMOD", menu: "VOCAL", title: "uMOD" },
    { id: "delay", side: "voz", name: "Delay", menu: "VOCAL", title: "DELAY", adv: ["VOCAL ADV", "DELAY"] },
    { id: "reverb", side: "voz", name: "Reverb", menu: "VOCAL", title: "REVERB" },
    { id: "bodyrez", side: "gtr", name: "BodyRez", menu: "GUITAR", title: "BODYREZ EQ", extra: [["BODYREZ SHELF EQ", "Shelf EQ"], ["BODYREZ PARAMETRIC EQ", "Parametric EQ"]], always: true, only: "pa" },
    { id: "comp", side: "gtr", name: "Comp", menu: "GUITAR", title: "BODYREZ COMPRESSOR", always: true, img: 9, only: "pa" },
    { id: "comp", side: "gtr", name: "Comp", menu: "PE GUITAR", title: "PE GUITAR COMPRESSOR", only: "pe" },   // Play Electric: compressor before the amp
    { id: "amp", side: "gtr", name: "Amp", menu: "PE GUITAR", title: "PE GUITAR AMP", only: "pe" },
    { id: "umod", side: "gtr", name: "uMOD", menu: "GUITAR", title: "GUITAR uMOD", adv: ["GUITAR ADV", "GUITAR uMOD"] },
    { id: "delay", side: "gtr", name: "Delay", menu: "GUITAR", title: "GUITAR DELAY", adv: ["GUITAR ADV", "GUITAR DELAY"] },
    { id: "reverb", side: "gtr", name: "Reverb", menu: "GUITAR", title: "GUITAR REVERB", adv: ["GUITAR ADV", "GUITAR REVERB"] },
  ].map(d => ({ ...d, key: d.side + "-" + d.id }));
  // a page is shown when its showWhen settings match the pedal (unknown counts as 0, the factory value)
  const visible = p => !p.showWhen || Object.entries(p.showWhen).every(([k, v]) => (valOf(hex(k)) ?? 0) === v);
  function fxView(d) {
    const pg = pagesOf(d.menu, d.title).find(visible); if (!pg) return null;
    const cs = cellsOf(pg), style = d.img ? null : cs.find(c => c.values && c.values.length > 3) || null;
    const seen = new Set(cs.map(c => hex(c.param)));
    const groups = [["Parameters", cs.filter(c => c !== style)]];
    for (const [t, label] of d.extra || []) { const p = pagesOf(d.menu, t).find(visible); if (p) groups.push([label, cellsOf(p).filter(c => !seen.has(hex(c.param)) && seen.add(hex(c.param)))]); }
    if (d.adv) groups.push(["Advanced", cellsOf(pagesOf(...d.adv)[0]).filter(c => !seen.has(hex(c.param)) && seen.add(hex(c.param)))]);
    return { ...d, control: d.always ? null : pg.control || null, style, groups: groups.filter(g => g[1].length), images: pg.images || [] };
  }
  const fxList = () => FXDEF.filter(d => !d.only || d.only === (MODE === "pe" ? "pe" : "pa")).map(fxView).filter(Boolean);
  const stateName = (f) => { if (f.always) return "always"; const v = valOf(hex(f.control.param)); return v == null ? "unk" : (["off", "on", "hit"][v] || "unk"); };
  function imgOf(f) {
    if (f.img != null) return f.img;
    const sv = f.style ? valOf(hex(f.style.param)) : null;
    return (sv != null ? f.images[sv - f.style.min] : null) ?? f.images[0];
  }

  // ── control markup (values are painted separately by paint()) ───────────
  const chev = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="${d < 0 ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}"/></svg>`;
  const ARC = 122.5;   // 270° of r=26
  function knobHTML(c) {
    return `<div class="knob unk" data-kind="knob" data-param="${c.param}">
      <span class="lbl" title="${esc(c.label)}">${esc(c.label)}</span>
      <div class="dial" role="slider" tabindex="0" aria-label="${esc(c.label)}" aria-valuemin="${c.min}" aria-valuemax="${c.max}">
        <svg viewBox="0 0 58 58" aria-hidden="true"><circle cx="29" cy="29" r="26" fill="none" stroke="var(--faint)" stroke-opacity=".25" stroke-width="4" stroke-linecap="round" stroke-dasharray="${ARC} 400" transform="rotate(135 29 29)"/>
        <circle class="arc" cx="29" cy="29" r="26" fill="none" stroke="var(--fx, var(--accent))" stroke-width="4" stroke-linecap="round" stroke-dasharray="0 400" transform="rotate(135 29 29)"/></svg>
        <div class="cap"></div></div>
      <span class="val mono">··</span></div>`;
  }
  const optionsHTML = c => c.values.map((t, i) => `<option value="${c.min + i}">${esc(t)}</option>`).join("");
  function rowHTML(c) {
    let ctl;
    if (c.values && c.values.length <= 3) ctl = `<div class="seg unk" data-kind="seg" data-param="${c.param}" role="group" aria-label="${esc(c.label)}">${c.values.map((t, i) => `<button type="button" data-i="${i}" aria-pressed="false">${esc(t)}</button>`).join("")}</div>`;
    else if (c.values) ctl = `<div class="sel unk" data-kind="select" data-param="${c.param}"><select aria-label="${esc(c.label)}">${optionsHTML(c)}</select></div>`;
    else ctl = `<div class="slide unk" data-kind="slide" data-param="${c.param}"><input type="range" min="${c.min}" max="${c.max}" step="1" aria-label="${esc(c.label)}"><span class="val mono">··</span></div>`;
    return `<div class="srow"><span class="slbl">${esc(c.label)}</span>${ctl}</div>`;
  }
  const art = n => IM[n] ? `<i class="art" style="--m:url('${IM[n]}')"></i>` : `<i class="art"></i>`;

  // ── rendering ───────────────────────────────────────────────────────────
  let selKey = store.get("sel", "voz-harmony"), view = store.get("view", "palco"), gsel = 0;
  let lastSig = "";
  const sig = () => JSON.stringify([MODE, selKey, gsel, Object.keys(MAPD.entries).length, [...paToDev], valOf(ID.BODYREZ_EDIT) ?? 0, valOf(ID.FOOTSWITCH) ?? 0, valOf(ID.AUX_SENSE) ?? 0]);
  // Rebuild the DOM only when the structure changed (never under a finger that is dragging); otherwise just repaint.
  function render(force = false) {
    const s = sig();
    if (force || (s !== lastSig && !drags.size)) { lastSig = s; buildChains(); buildDetail(); buildMix(); buildSetup(); buildStage(); if (popKey) buildPop(); }
    paint();   // a structural change during a drag is applied when the drag ends (see wireKnobs)
  }
  function buildChains() {
    const fx = fxList();
    if (!fx.some(f => f.key === selKey)) selKey = fx[0].key;
    for (const side of ["voz", "gtr"]) $("#chain-" + side).innerHTML = fx.filter(f => f.side === side).map(f =>
      `<button type="button" class="fx" role="tab" data-kind="chip" data-fx="${f.key}" ${f.control ? `data-param="${f.control.param}"` : ""} aria-selected="${f.key === selKey}" title="${esc(f.name)}" style="--fx:var(--c-${f.id})"><span class="nm">${esc(f.name)}</span><span class="led"></span></button>`).join("");
  }
  function buildDetail() { const f = fxList().find(x => x.key === selKey); fillDetail($("#detail"), f); }
  // The effect panel (Effects view, and the Stage popup): state, style, picture and every parameter of one effect.
  function fillDetail(d, f) {
    d.style.setProperty("--fx", `var(--c-${f.id})`);
    const unmapped = MODE === "pe" ? [f.control, f.style, ...f.groups.flatMap(g => g[1])].filter(c => c && rid(c) == null).length : 0;
    const state = f.always ? `<div class="always">Always on</div>`
      : `<div class="seg unk" data-kind="seg" data-param="${f.control.param}" role="group" aria-label="State">${f.control.values.map((t, i) => `<button type="button" data-i="${i}" data-v="${i}" aria-pressed="false">${esc(t)}</button>`).join("")}</div>`;
    const style = f.style ? `<div class="style unk" data-kind="style" data-param="${f.style.param}"><button type="button" class="step" data-d="-1" aria-label="Previous style">${chev(-1)}</button>
        <label><span class="cap-lbl">${esc(f.style.label)}</span><select aria-label="${esc(f.style.label)}">${optionsHTML(f.style)}</select></label>
        <button type="button" class="step" data-d="1" aria-label="Next style">${chev(1)}</button></div>` : "";
    d.innerHTML = `<div class="d-side">
        <div class="d-title"><i class="sw"></i><h2>${esc(f.name)}</h2><small class="cap-lbl">${f.side === "voz" ? "vocal" : "guitar"}</small></div>
        ${unmapped ? `<span class="badge" title="Confirm these in the Mapper to edit them">${unmapped} not mapped</span>` : ""}
        <div class="lcd">${art(imgOf(f))}</div>${state}${style}
        ${f.id === "bodyrez" ? eqHTML() : ""}
        <p class="hint">Drag or scroll the knobs. Shift = fine. Double-click = default.</p></div>
      <div class="d-params">${f.groups.map(([t, cs]) => { const nums = cs.filter(c => !c.values), lists = cs.filter(c => c.values);
        return `${f.groups.length > 1 ? `<div class="group-lbl cap-lbl">${esc(t)}</div>` : ""}${nums.length ? `<div class="knobs">${nums.map(knobHTML).join("")}</div>` : ""}${lists.length ? `<div class="rows">${lists.map(rowHTML).join("")}</div>` : ""}`; }).join("")}</div>`;
    d.dataset.fxbox = f.key;   // paint() keeps the picture and the state of this box up to date
    wireKnobs(d);
  }
  // ── BodyRez EQ curve (Play Acoustic): low + high shelf and two peaking bands, RBJ biquads at 48 kHz ──
  const EQ_W = 300, EQ_H = 120, EQ_DB = 15;
  const eqX = f => Math.log10(f / 20) / 3 * EQ_W, eqY = db => EQ_H / 2 - db / EQ_DB * (EQ_H / 2 - 6);
  function eqHTML() {
    const grid = [100, 1000, 10000].map(f => `<line x1="${eqX(f)}" x2="${eqX(f)}" y1="0" y2="${EQ_H}"/><text x="${eqX(f) + 3}" y="${EQ_H - 4}">${f >= 1000 ? f / 1000 + "k" : f}</text>`).join("");
    return `<figure class="eqgraph" data-eq="1" aria-label="EQ curve"><svg viewBox="0 0 ${EQ_W} ${EQ_H}" preserveAspectRatio="none"><g class="eq-grid">${grid}<line class="zero" x1="0" x2="${EQ_W}" y1="${eqY(0)}" y2="${eqY(0)}"/></g><path class="eq-fill"/><path class="eq-line"/><g class="eq-dots"></g></svg><figcaption>EQ ≈ (approximate curve)</figcaption></figure>`;
  }
  function biquad(type, f0, db, q) {
    const A = Math.pow(10, db / 40), w0 = 2 * Math.PI * f0 / 48000, cw = Math.cos(w0), sw = Math.sin(w0);
    if (type === "peak") { const al = sw / (2 * q); return [1 + al * A, -2 * cw, 1 - al * A, 1 + al / A, -2 * cw, 1 - al / A]; }
    const al = sw / 2 * Math.SQRT2, sA = 2 * Math.sqrt(A) * al;
    if (type === "low") return [A * ((A + 1) - (A - 1) * cw + sA), 2 * A * ((A - 1) - (A + 1) * cw), A * ((A + 1) - (A - 1) * cw - sA), (A + 1) + (A - 1) * cw + sA, -2 * ((A - 1) + (A + 1) * cw), (A + 1) + (A - 1) * cw - sA];
    return [A * ((A + 1) + (A - 1) * cw + sA), -2 * A * ((A - 1) + (A + 1) * cw), A * ((A + 1) + (A - 1) * cw - sA), (A + 1) - (A - 1) * cw + sA, 2 * ((A - 1) - (A + 1) * cw), (A + 1) - (A - 1) * cw - sA];
  }
  function magDb([b0, b1, b2, a0, a1, a2], f) {
    const w = 2 * Math.PI * f / 48000, c1 = Math.cos(w), s1 = Math.sin(w), c2 = Math.cos(2 * w), s2 = Math.sin(2 * w);
    const nr = b0 + b1 * c1 + b2 * c2, ni = -(b1 * s1 + b2 * s2), dr = a0 + a1 * c1 + a2 * c2, di = -(a1 * s1 + a2 * s2);
    return 10 * Math.log10((nr * nr + ni * ni) / (dr * dr + di * di));
  }
  function drawEqs() {
    const box = $(".eqgraph[data-eq]"); if (!box) return;
    const f = fxList().find(x => x.id === "bodyrez"); if (!f) return;
    const cs = f.groups.flatMap(g => g[1]), cell = l => cs.find(c => c.label === l), val = l => { const c = cell(l), id = c && rid(c); return id == null ? null : V.get(id); };
    const oct = l => { const c = cell(l), v = val(l); if (!c || v == null) return 1; const t = c.values[v - c.min]; return t === "NARROW" ? .1 : t === "WIDE" ? 10 : parseFloat(t) || 1; };
    const qOf = bw => Math.sqrt(Math.pow(2, bw)) / (Math.pow(2, bw) - 1);
    const bands = [["low", "LOW FREQ", "LOW GAIN"], ["high", "HI FREQ", "HI GAIN"], ["peak", "PARA 1 FREQ", "PARA 1 GAIN", "PARA 1 WIDTH"], ["peak", "PARA 2 FREQ", "PARA 2 GAIN", "PARA 2 WIDTH"]]
      .map(([t, fl, gl, wl]) => { const fv = val(fl), g = val(gl); return fv == null || g == null ? null : { t, f0: freqOf(fv), g, q: wl ? qOf(oct(wl)) : .707 }; }).filter(Boolean);
    box.classList.toggle("unk", !bands.length);
    const pts = []; for (let i = 0; i <= 120; i++) { const fr = 20 * Math.pow(10, 3 * i / 120);
      let db = 0; for (const b of bands) db += magDb(biquad(b.t, b.f0, b.g, b.q), fr);
      pts.push([eqX(fr), eqY(Math.max(-EQ_DB, Math.min(EQ_DB, db)))]); }
    const line = "M" + pts.map(p => p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" L");
    box.querySelector(".eq-line").setAttribute("d", line);
    box.querySelector(".eq-fill").setAttribute("d", line + ` L${EQ_W} ${eqY(0)} L0 ${eqY(0)} Z`);
    box.querySelector(".eq-dots").innerHTML = bands.map(b => `<circle cx="${eqX(b.f0).toFixed(1)}" cy="${eqY(Math.max(-EQ_DB, Math.min(EQ_DB, b.g))).toFixed(1)}" r="3.2"/>`).join("");
  }
  function buildMix() {
    const cs = [...new Map(M.MIX.pages.filter(visible).flatMap(cellsOf).map(c => [hex(c.param), c])).values()]
      .filter(c => MODE !== "pe" || rid(c) != null);   // the Electric's Mix has no USB OUT LEVEL etc.: show only what it has
    $("#mix").innerHTML = cs.map(knobHTML).join(""); wireKnobs($("#mix"));
  }
  function setupGroups() {
    const seen = new Set(), out = [];
    for (const p of M.SETUP.pages) {
      if (!p.rows || !visible(p)) continue;
      const cs = cellsOf(p).filter(c => (MODE !== "pe" || rid(c) != null) && !seen.has(hex(c.param)) && seen.add(hex(c.param))); if (!cs.length) continue;
      const g = out.find(o => o[0] === p.title); g ? g[1].push(...cs) : out.push([p.title, cs]);
    }
    return out;
  }
  function buildSetup() {
    const groups = setupGroups(); if (gsel >= groups.length) gsel = 0;
    $("#groups").innerHTML = groups.map(([t, cs], i) => `<button type="button" role="tab" aria-selected="${i === gsel}" data-g="${i}">${esc(t)} <span class="cap-lbl" style="float:right">${cs.length}</span></button>`).join("")
      + (MODE === "pe" ? "" : `<div class="locked"><b>MIDI locked</b>MIDI CTRL, FILTER, SYSEXID and the channels are left out on purpose: changing them can lock out USB control.</div>`);   // the Electric has no MIDI page
    const [t, cs] = groups[gsel];
    $("#group").innerHTML = `<h2>${esc(t)} <span class="cap-lbl" style="margin-left:8px">global</span></h2><div class="rows">${cs.map(rowHTML).join("")}</div>`
      + (MODE === "pe" ? "" : `<p class="locked-sm"><b>MIDI locked:</b> MIDI CTRL, FILTER, SYSEXID and the channels are left out on purpose.</p>`);   // phones (the side card is hidden there)
    const selBtn = $("#groups [aria-selected='true']"); if (selBtn && selBtn.scrollIntoView && innerWidth <= 700) selBtn.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
  function buildStage() {
    // effects with an on/off, plus the always-on ones that have something to drag (the Acoustic's BodyRez and Comp,
    // as in open-acoustic's Stage): those can't be switched or held, only dragged
    const fx = fxList().filter(f => f.control || levelCell(f));
    const pad = f => !f.control ? `<button type="button" class="tile always" data-always="1" data-fx="${f.key}" aria-pressed="true" title="${esc(f.name)}: always on · drag sideways = ${esc(levelCell(f).label)}" style="--fx:var(--c-${f.id})"><span class="tflag"><small>ON</small><span class="tl"></span></span>${art(imgOf(f))}<span class="tname"><b>${esc(f.name)}</b></span></button>`
      : `<button type="button" class="tile" data-kind="tile" data-fx="${f.key}" data-param="${f.control.param}" aria-pressed="false" title="${esc(f.name)}: tap = on/off · hold = on only while held · drag sideways = its main control" style="--fx:var(--c-${f.id})"><span class="tflag"><small>··</small><span class="tl"></span></span>${art(imgOf(f))}<span class="tname"><b>${esc(f.name)}</b></span></button>`;
    $("#tiles").innerHTML = [["Vocal", "voz"], ["Guitar", "gtr"]].map(([label, side]) =>
      { const row = fx.filter(f => f.side === side), n = row.length <= 5 ? row.length : Math.ceil(row.length / 2);   // phones: up to 5 in one row, else two rows
        return `<div class="stage-row"><span class="cap-lbl">${label}</span><div class="stage-links" style="--n:${n}">${row.map(pad).join("")}</div></div>`; }).join("")
      + `<div class="stage-row"><span class="cap-lbl">Footswitch</span><div class="stage-links"><button type="button" class="hitbar" id="hit2" aria-pressed="false"><i></i>HIT</button>`
      + `<button type="button" class="hitbar talkbar tapbar" id="tap2" title="Tap the beat: sets the preset's TEMPO, which every tempo-synced effect follows"><span class="tk"><i></i>TAP</span><small></small></button>`
      + `<button type="button" class="hitbar talkbar" id="talk2" aria-pressed="false" title="Each tap holds HIT for 1.3 s, like holding the footswitch"><span class="tk"><i></i>TALK</span><small></small></button>`
      + `<button type="button" class="hitbar talkbar loopbar" id="loop2" aria-pressed="false"></button></div></div>`;
    $("#tap2").addEventListener("pointerdown", e => { if (e.button > 0) return; e.preventDefault(); tapTempo(); });   // on touch-down: taps land on the beat
    $("#tap2").addEventListener("keydown", e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); tapTempo(); } }); paintLoop();
    // Stage gestures (editing lives in Effects):
    //   tap = on/off (the click handler)
    //   hold = momentary: the effect flips while the finger stays down and flips back on release (no undo step, and
    //          it doesn't count as an edit)
    //   drag sideways = the effect's level, with a bar on the tile (one undo step per drag)
    // A hold or a drag never also toggles. Vertical moves are left to page scrolling (touch-action: pan-y).
    for (const t of $$("#tiles .tile")) {
      let timer = 0, x0 = 0, y0 = 0, mode = null, orig = null, wasEdited = false, lvl = null, lv0 = 0;
      const fxOf = () => fxList().find(x => x.key === t.dataset.fx);
      t.addEventListener("pointerdown", e => {
        if (e.button > 0 || !L.ready) return; t.__held = false; x0 = e.clientX; y0 = e.clientY; mode = "press";
        timer = setTimeout(() => {
          if (mode !== "press" || t.dataset.always) return;   // always-on effects have no on/off to hold
          const c = cellOf(t), id = c && rid(c), v = id == null ? undefined : V.get(id); if (v == null) return;
          mode = "momentary"; t.__held = true; orig = v; wasEdited = P.edited; t.classList.add("momentary");
          setParam(c, v > 0 ? 0 : (lastOn.get(hex(c.param)) ?? 1), { undoable: false });
        }, 220);
      });
      t.addEventListener("pointermove", e => {
        if (!mode) return;
        const dx = e.clientX - x0, dy = e.clientY - y0;
        if (mode === "press" && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
          clearTimeout(timer);
          const f = fxOf(); lvl = f && levelCell(f); const id = lvl && rid(lvl);
          if (!lvl || id == null || V.get(id) == null) { mode = null; t.__held = true; return toast("This effect has no level to drag", "", 1600); }
          mode = "level"; t.__held = true; lv0 = V.get(id); x0 = e.clientX;
          try { t.setPointerCapture(e.pointerId); } catch {}
          t.classList.add("leveling"); showLevel(t, lvl);
        } else if (mode === "press" && Math.abs(dy) > 10) { clearTimeout(timer); mode = null; }
        if (mode === "level") {
          const span = (lvl.max - lvl.min) || 1, w = Math.max(180, t.offsetWidth * 1.5);
          setParam(lvl, Math.round(lv0 + (e.clientX - x0) / w * span)); showLevel(t, lvl);
        }
      });
      const end = () => {
        clearTimeout(timer);
        if (mode === "momentary") { setParam(cellOf(t), orig, { undoable: false }); P.edited = wasEdited; paintChrome(); }
        if (mode === "level") hideLevelSoon(t);
        mode = null; t.classList.remove("momentary", "leveling");
      };
      t.addEventListener("pointerup", end); t.addEventListener("pointercancel", end);
      t.addEventListener("pointerleave", () => { if (mode !== "level") end(); });
      t.addEventListener("contextmenu", e => e.preventDefault());   // no long-press menu on touch screens
      t.addEventListener("keydown", e => { if ((e.key === "e" || e.key === "E" || (e.key === "Enter" && e.shiftKey))) { e.preventDefault(); openPop(t.dataset.fx); } });   // keyboard: E or Shift+Enter edits
    }
  }
  // the parameter a sideways drag changes on a Stage tile: each effect's most useful one live (as in open-acoustic's
  // Stage SWIPE table: HardTune SHIFT, Transducer DRIVE; the Electric's Amp DRIVE and Comp AMOUNT), else its level
  const SWIPE = { hardtune: ["SHIFT"], transducer: ["DRIVE"], amp: ["DRIVE"], comp: ["AMOUNT", "MAKEUP GAIN", "MAKEUP"], bodyrez: ["AMOUNT"] };
  function levelCell(f) {
    const cs = f.groups.flatMap(g => g[1]).filter(c => c && !(c.values && c.values.length) && rid(c) != null);
    for (const label of SWIPE[f.id] || []) { const c = cs.find(x => x.label === label); if (c) return c; }
    return cs.find(c => c.label === "LEVEL") || cs.find(c => /LEVEL$/.test(c.label)) || cs.find(c => c.label === "MIX") || cs.find(c => c.label === "AMOUNT") || null;
  }
  function showLevel(t, c) {
    let o = t.querySelector(".tlevel");
    if (!o) { o = document.createElement("span"); o.className = "tlevel"; o.innerHTML = "<i></i><em></em>"; t.appendChild(o); }
    clearTimeout(t.__lvT); o.classList.add("show");
    const v = V.get(rid(c)), p = v == null ? 0 : (v - c.min) / ((c.max - c.min) || 1);
    o.querySelector("i").style.width = (p * 100).toFixed(1) + "%";
    o.querySelector("em").textContent = c.label + " " + fmt(c, v);
  }
  function hideLevelSoon(t) { clearTimeout(t.__lvT); t.__lvT = setTimeout(() => { const o = t.querySelector(".tlevel"); if (o) o.classList.remove("show"); }, 900); }
  // the effect editor popup (keyboard: E on a Stage tile)
  let popKey = null;
  // CONTROL value an effect had when it was last on (1 = ON, 2 = HIT), per menu control id; reset per preset
  const lastOn = new Map();
  function buildPop() {
    const f = popKey && fxList().find(x => x.key === popKey);
    if (!f) { closePop(); return; }
    fillDetail($("#pop-detail"), f);
  }
  function openPop(key) { if (!L.ready) return notConnected(); popKey = key; $("#fxpop").hidden = false; buildPop(); paint(); }
  function closePop() { popKey = null; $("#fxpop").hidden = true; $("#pop-detail").innerHTML = ""; delete $("#pop-detail").dataset.fxbox; }

  // paint: push current values into whatever is on screen
  function paint() {
    drawEqs();
    for (const el of $$("[data-kind]")) {
      const kind = el.dataset.kind;
      if (kind === "chip" && !el.dataset.param) { el.dataset.state = "always"; continue; }
      const c = cellOf(el); if (!c) continue;
      const id = rid(c), v = id == null ? undefined : V.get(id), unk = v == null || !L.ready;
      if (kind !== "chip" && kind !== "tile") {
        el.classList.toggle("unk", unk);
        // inert for keyboard too, not only for the mouse
        for (const f of el.querySelectorAll("button, select, input")) f.disabled = unk;
        const dial = el.querySelector(".dial"); if (dial) dial.tabIndex = unk ? -1 : 0;
      }
      switch (kind) {
        case "knob": {
          const t = unk ? 0 : (v - c.min) / ((c.max - c.min) || 1), t0 = c.min < 0 && c.max > 0 ? -c.min / (c.max - c.min) : 0;
          const a = unk ? 0 : Math.min(t0, t), b = unk ? 0 : Math.max(t0, t), arc = el.querySelector(".arc");
          arc.setAttribute("stroke-dasharray", `${(ARC * (b - a)).toFixed(1)} 400`); arc.setAttribute("stroke-dashoffset", (-ARC * a).toFixed(1));
          el.querySelector(".cap").style.setProperty("--a", (-135 + 270 * t) + "deg");
          el.querySelector(".val").textContent = fmt(c, unk ? null : v);
          const dial = el.querySelector(".dial"); if (unk) dial.removeAttribute("aria-valuenow"); else { dial.setAttribute("aria-valuenow", v); dial.setAttribute("aria-valuetext", fmt(c, v)); }
          break;
        }
        case "seg": for (const b of el.querySelectorAll("button")) b.setAttribute("aria-pressed", !unk && c.min + +b.dataset.i === v); break;
        case "select": case "style": { const s = el.querySelector("select"); if (!unk && document.activeElement !== s) s.value = String(v); if (unk) s.selectedIndex = -1; break; }
        case "slide": { const r = el.querySelector("input"); if (!unk) { r.value = v; r.style.setProperty("--p", ((v - c.min) / ((c.max - c.min) || 1) * 100) + "%"); } el.querySelector(".val").textContent = fmt(c, unk ? null : v); break; }
        case "chip": el.dataset.state = unk ? "unk" : (["off", "on", "hit"][v] || "unk"); popOnChange(el, el.dataset.state); break;
        case "tile": el.setAttribute("aria-pressed", !unk && v > 0); el.classList.toggle("unk", unk); el.dataset.state = unk ? "unk" : (["off", "on", "hit"][v] || "unk"); popOnChange(el, el.dataset.state);
          if (!unk && v > 0) lastOn.set(hex(c.param), v);   // remember ON vs HIT for the next tap
          { const hm = !unk && v === 0 && lastOn.get(hex(c.param)) === 2; el.classList.toggle("hitmode", hm);
            el.querySelector("small").textContent = unk ? "··" : hm ? "HIT · OFF" : (c.values[v - c.min] ?? v); }
          break;
      }
    }
    // pictures follow each effect's style; panels and tiles show the effect's state
    const fx = fxList(), byKey = new Map(fx.map(f => [f.key, f]));
    const setArt = (el, f) => { if (!el) return; const n = imgOf(f); el.style.setProperty("--m", IM[n] ? `url('${IM[n]}')` : "none"); };
    for (const box of $$("[data-fxbox]")) { const f = byKey.get(box.dataset.fxbox); if (!f) continue; setArt(box.querySelector(".lcd .art"), f); box.dataset.state = stateName(f); }
    for (const t of $$(".tile[data-fx]")) { const f = byKey.get(t.dataset.fx); if (f) setArt(t.querySelector(".art"), f); }
    paintChrome();
  }
  function paintChrome() {
    const ready = L.ready;
    const num = P.num == null ? "" : String(P.num), name = !ready ? "Not connected" : (P.name || (P.name === "" ? "(no name)" : "Reading…"));
    $("#p-num").textContent = num; $("#s-num").textContent = num; $("#p-num").hidden = !num; $("#s-num").hidden = !num;
    $("#p-name").textContent = name; $("#s-name").textContent = name;
    $("#p-edited").hidden = !P.edited;
    // Save is always there while connected (edits made on the pedal itself aren't seen by the app); it stands out
    // once something was edited here.
    $("#s-edit").hidden = !ready;
    for (const b of $$("[data-fav]")) { b.hidden = !ready || P.name == null; b.setAttribute("aria-pressed", String(P.fav === true)); b.classList.toggle("busy", favBusy); }
    for (const b of $$("[data-ab]")) { b.hidden = !ready || !(P.edited || ab); const side = ab ? ab.side : "B"; b.dataset.side = side; b.classList.toggle("busy", abBusy);
      b.setAttribute("aria-pressed", String(side === "A")); b.title = side === "A" ? "Playing A, the saved preset. Tap for B, your edit." : "Playing B, your edit. Tap for A, the saved preset."; }
    for (const b of $$("[data-save]")) { b.hidden = b.closest("#s-edit") ? false : !ready; b.classList.toggle("dirty", P.edited && !saving && !justSaved); b.classList.toggle("saving", saving); b.classList.toggle("done", justSaved && !saving); b.disabled = saving;
      const lb = b.querySelector(".sv-lbl"); if (lb) lb.textContent = saving ? "Saving…" : justSaved ? "Saved" : "Save"; }
    const hitC = CELLS.get(ID.HIT), hitId = rid(hitC), hv = hitId == null ? undefined : V.get(hitId);
    for (const b of [$("#hit"), $("#hit2")]) if (b) { b.setAttribute("aria-pressed", hv === 1); popOnChange(b, hv == null ? "unk" : String(hv)); b.title = hitId == null ? "Sends a HIT footswitch press (state unknown on this pedal)" : "HIT on / off"; }
    document.body.classList.toggle("talking", ready && talkOn);   // TALK on: everything greys out except TALK
    const tb = $("#tap2"); if (tb) { const bpm = valOf(TEMPO); tb.querySelector("small").textContent = tapHint || (bpm == null ? "TAP TEMPO" : bpm + " BPM"); }
    for (const b of [$("#talk"), $("#talk2")]) if (b) { b.setAttribute("aria-pressed", talkOn); popOnChange(b, String(talkOn)); b.classList.toggle("sending", talkSending); const s = b.querySelector("small"); if (s) s.textContent = talkOn ? "FX MUTED · TAP TO SING" : "MUTE FX BETWEEN SONGS"; }
    $("#undo").setAttribute("aria-disabled", history.length ? "false" : "true");
    paintNote(); document.body.dataset.mode = MODE || "";
    $("#gate").hidden = ready;
    const short = !ready ? "Offline" : MODE === "pe" ? "Play Electric" : "Play Acoustic";
    $("#conn-name").innerHTML = esc(short).replace(" ", "<br>");
    for (const d of [$("#conn-dot"), $("#drw-dot")]) d.style.background = ready ? "var(--on)" : L.status === "connecting" ? "var(--warn)" : "var(--faint)";
    if (!ready && !$("#picker").hidden) $("#picker").hidden = true;
    if (!ready && popKey) closePop();
    const cur = $("#plist [aria-current]"); if (!$("#picker").hidden && (cur ? +cur.dataset.preset : null) !== P.num) paintPicker();
  }

  // ── knobs: drag / wheel / keys / double-click ───────────────────────────
  const drags = new Map();   // dial → end function
  function endDrags() { for (const end of [...drags.values()]) end(); }
  function wireKnobs(root) {
    for (const k of $$(".knob", root)) {
      const d = k.querySelector(".dial"), c = cellOf(k); if (d.__w) continue; d.__w = true;
      const cur = () => { const id = rid(c); return id == null ? undefined : V.get(id); };
      let y0 = null, v0 = 0, e0 = 0;
      const end = () => { if (y0 == null) return; y0 = null; drags.delete(d); if (!drags.size && sig() !== lastSig) render(); };
      d.addEventListener("pointerdown", e => {
        const v = cur(); if (v == null || e.button > 0) return;
        y0 = e.clientY; v0 = v; e0 = epoch; drags.set(d, end); try { d.setPointerCapture(e.pointerId); } catch {} e.preventDefault();
      });
      d.addEventListener("pointermove", e => {
        if (y0 == null) return;
        if (e0 !== epoch || cur() == null) return end();   // the preset changed under the finger: stop, write nothing
        setParam(c, v0 + (y0 - e.clientY) * (c.max - c.min) / (e.shiftKey ? 600 : 180));
      });
      d.addEventListener("pointerup", end); d.addEventListener("pointercancel", end); d.addEventListener("lostpointercapture", end);
      d.addEventListener("wheel", e => { const v = cur(); if (v == null) return; e.preventDefault(); setParam(c, v + (e.deltaY < 0 ? 1 : -1) * (e.shiftKey ? 10 : 1)); }, { passive: false });
      d.addEventListener("keydown", e => {
        const v = cur(); if (v == null) return;
        const m = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 10, PageDown: -10 }[e.key];
        if (m) { e.preventDefault(); setParam(c, v + m * (e.shiftKey && Math.abs(m) === 1 ? 10 : 1)); }
        else if (e.key === "Home") { e.preventDefault(); setParam(c, c.min); } else if (e.key === "End") { e.preventDefault(); setParam(c, c.max); }
      });
      d.addEventListener("dblclick", () => { if (cur() != null && c.default != null) setParam(c, c.default); });
    }
  }

  // ── reading the pedal ───────────────────────────────────────────────────
  let gen = 0, paintQ = 0, connN = 0;   // connN: one per connection (gen changes on every re-read)
  const schedulePaint = () => { if (!paintQ) paintQ = requestAnimationFrame(() => { paintQ = 0; render(); }); };
  function readIds() {
    if (MODE === "pe") return [...new Set(paToDev.values())];
    const first = [ID.HIT, ID.AUX_SENSE, ID.BODYREZ_EDIT, ID.FOOTSWITCH, ...FXDEF.flatMap(d => pagesOf(d.menu, d.title).flatMap(p => [p.control, cellsOf(p).find(c => c.values && c.values.length > 3)])).filter(Boolean).map(c => hex(c.param))];
    return [...new Set([...first, ...CELLS.keys()])].filter(id => id <= MAX_ID);   // Electric-only virtual cells are never read here
  }
  // ── preset library (Play Acoustic): every preset's stored values, kept on this device ──
  // Filled by "Read all presets" and by every full read right after a preset change. A preset change then shows the
  // saved values at once, and the pedal is still read in the background, so the screen always ends on the pedal's
  // real values. A STORE seen on the pedal makes every older entry stale (that preset may have changed).
  // (Same approach as open-acoustic views.js.)
  const LIB_KEY = () => "lib-" + (MODE === "pe" ? "71" : "70");
  const blankLib = () => ({ presets: {}, storeAt: 0, pcOffset: null, pcWorks: null, readAt: 0, wraps: null });
  let lib = blankLib();
  function loadLib() {
    const raw = store.get(LIB_KEY(), null); lib = blankLib(); const okIds = new Set(presetIds());
    if (!raw || typeof raw.presets !== "object" || !raw.presets) return;
    for (const [k, e] of Object.entries(raw.presets)) {
      const n = Number(k);
      if (!Number.isInteger(n) || n < 0 || n > 65535 || !e || !Array.isArray(e.vals)) continue;
      lib.presets[n] = { name: typeof e.name === "string" ? e.name.slice(0, 15) : "", t: Number(e.t) || 0, fav: typeof e.fav === "boolean" ? e.fav : null, flags: Number.isInteger(e.flags) ? e.flags : null,
        vals: e.vals.filter(p => Array.isArray(p) && Number.isInteger(p[0]) && Number.isInteger(p[1]) && okIds.has(p[0])) };
    }
    lib.storeAt = Number(raw.storeAt) || 0; lib.readAt = Number(raw.readAt) || 0;
    lib.pcOffset = Number.isInteger(raw.pcOffset) ? raw.pcOffset : null;
    lib.pcWorks = typeof raw.pcWorks === "boolean" ? raw.pcWorks : null;
    lib.wraps = typeof raw.wraps === "boolean" ? raw.wraps : null;
  }
  const saveLib = () => store.set(LIB_KEY(), lib);
  const libEntry = n => { const e = lib.presets[n]; return e && e.t > lib.storeAt ? e : null; };
  const presetIds = () => MODE === "pe" ? [...new Set([...paToDev].filter(([pa]) => !GLOBAL.has(pa)).map(([, dev]) => dev))]
    : [...CELLS.keys()].filter(id => !GLOBAL.has(id) && id <= MAX_ID);
  const presetVals = () => presetIds().filter(id => V.has(id)).map(id => [id, V.get(id)]);
  function libPut(n, name, vals, fav = null, save = true) { const old = lib.presets[n]; lib.presets[n] = { name: name || "", t: Date.now(), vals, fav: fav ?? old?.fav ?? null, flags: old?.flags ?? null }; if (save) { saveLib(); paintPicker(); } }   // "read all" saves once at the end

  // fresh = the pedal just loaded a preset and nothing was edited since: what we read is the stored preset
  let fresh = false, lastProg = null, walking = false;
  // The preset-number register: 0x2A4 on the Play Acoustic, 0x282 on the Play Electric (checked on a real unit,
  // 2026-11-25). On the Electric it is only right after the first preset change since power-up (it read 1 on
  // preset 3), so until a change has been seen (numOk) the app doesn't trust it and refreshes it with ▶ ◀ first.
  const PRESET_REG = () => MODE === "pe" ? 0x282 : ID.PRESET;
  let numOk = false;
  async function syncAll() {
    if (!L.ready) return; const g = ++gen; const alive = () => g === gen && L.ready;
    let n = await L.get(PRESET_REG()); if (!alive()) return;
    if (MODE === "pe" && !numOk) n = null;   // not trusted yet (see PRESET_REG)
    if (n != null) {
      P.num = n;
      // learn how Program Change numbers relate to preset numbers (only from a Program Change the pedal just sent)
      if (MODE === "pa" && lastProg != null && lib.pcOffset !== n - lastProg) { lib.pcOffset = n - lastProg; saveLib(); }
    }
    lastProg = null;
    const info = await L.presetInfo(); if (!alive()) return; const nm = info ? info.name : null; if (info) P.fav = info.fav;
    // The Play Electric sends no Program Change when its preset changes (seen on a real unit, 2026-11-25), so a new
    // preset shows up as a new name here: treat it as a preset change (drop old values, re-read).
    if (MODE === "pe" && !walking && P.name && nm && nm !== P.name) { presetChanged(null); return; }
    P.name = nm ?? "";   // "" = no name / no answer
    // Electric, number not confirmed yet: show the saved list's number when the name is unique there
    if (MODE === "pe" && !numOk && nm) { const m = Object.entries(lib.presets).filter(([, e]) => e.name === nm); if (m.length === 1) P.num = +m[0][0]; }
    paintChrome();
    const got = await L.getBatch(readIds(), { alive, each: (id, v) => { if (!recent(id)) { V.set(id, v); schedulePaint(); } } });
    if (got && alive() && fresh && n != null) libPut(n, P.name, presetVals(), info ? info.fav : null);   // keep it for next time
  }
  let syncT = 0; const syncSoon = ms => { clearTimeout(syncT); syncT = setTimeout(syncAll, ms); };
  // a preset change on the pedal: show it from the library if we have it, else "··"; then read it from the pedal
  // a preset change on the pedal: show it from the saved list at once when its number is known (from the Program
  // Change, or because the app went there itself), else "··"; then read it from the pedal to confirm
  function presetChanged(prog, knownNum = null) {
    gen++; resetWrites(); P.edited = false; P.name = null; clearHistory(); fresh = true; lastOn.clear(); numOk = true; ab = null;
    const keep = new Set(presetIds());
    if (MODE === "pe" && valOf(0x286) === 1) for (const f of fxList()) if (f.side === "gtr")   // GLOBAL GUITAR FX on: guitar is global
      for (const c of [f.control, f.style, ...f.groups.flatMap(g => g[1])]) { const id = c && rid(c); if (id != null) keep.delete(id); }
    for (const id of [...V.keys()]) if (keep.has(id) || MODE !== "pe" && !GLOBAL.has(id)) V.delete(id);
    P.num = null;
    const num = knownNum ?? (MODE === "pa" && prog != null && lib.pcOffset != null ? prog + lib.pcOffset : null), e = num != null ? libEntry(num) : null;
    if (num != null) P.num = num;
    P.fav = e ? e.fav : null;
    const live = liveIds();   // ids that a global setting overrides: don't show the preset's stored copy
    if (e) { P.name = e.name; for (const [id, v] of e.vals) if (!live.has(id)) V.set(id, v); }
    render(); syncSoon(30);
  }
  function liveIds() {
    const live = new Set();
    if (valOf(0x286) === 1) for (const f of fxList()) if (f.side === "gtr")   // GLOBAL GUITAR FX on
      for (const c of [f.control, f.style, ...f.groups.flatMap(g => g[1])]) { const id = c && rid(c); if (id != null) live.add(id); }
    if (valOf(0x287) === 1) { const k = CELLS.get(0x075), id = k && rid(k); if (id != null) live.add(id); }   // GLOBAL KEY on
    return live;
  }

  // ── A/B: hear the preset as it's stored on the pedal (A) against the edit (B) ──
  // A reads the stored preset (45 bank num, which doesn't load it) and writes only the parameters that differ;
  // B writes the edit back. Editing anything while comparing keeps what's playing and ends the comparison.
  let ab = null, abBusy = false;   // ab = { side: "A" | "B", ids, stored: Map, edited: Map }
  function abWrite(src) {
    for (const id of ab.ids) { const v = src.get(id); V.set(id, v); touched.set(id, performance.now()); pending.set(id, v); }
    flush(); render();
  }
  async function toggleAB() {
    if (!L.ready) return notConnected(); if (abBusy || saving || walking || stepping) return;
    abBusy = true; paintChrome();
    try {
      if (!ab) {
        if (!P.edited) return toast("Edit something first: A/B compares your edit with the saved preset");
        const g = gen; let n = P.num, info = null;
        if (n == null && MODE === "pe") {   // number not confirmed yet (no preset change since connecting): finding it by
          // stepping would drop the edit, so take the register's number only if that stored preset has this name
          const r = await L.get(PRESET_REG()), i = r ? await L.presetInfo(r, 1200, true) : null;
          if (g !== gen) return;
          if (i && P.name && i.name === P.name) { n = r; info = i; P.num = r; }
        }
        if (n == null) return toast("Couldn't tell which preset this is. Change preset once on the pedal, then try again.", "warn");
        if (!info) info = await L.presetInfo(n, 1200, true);
        if (g !== gen || P.num !== n) return;
        if (!info || !info.data) return toast("Couldn't read the saved preset. Try again.", "warn");
        const stored = new Map(decodeSlots(info.data)), live = liveIds();
        const ids = [...stored.keys()].filter(id => !live.has(id) && writable(id) && V.get(id) != null && V.get(id) !== stored.get(id));
        if (!ids.length) return toast("Your edit sounds the same as the saved preset");
        ab = { side: "B", ids, stored, edited: new Map(ids.map(id => [id, V.get(id)])) };
      }
      ab.side = ab.side === "B" ? "A" : "B";
      abWrite(ab.side === "A" ? ab.stored : ab.edited);
      toast(ab.side === "A" ? "A · the saved preset" : "B · your edit", "", 1400);
    } finally { abBusy = false; paintChrome(); }
  }
  const abEnd = () => { if (ab) { ab = null; paintChrome(); } };

  let stepping = false;
  // a preset step confirmed: Program Change on the Acoustic; on the Electric (which sends none) the register moves
  const armStep = (prev, ms) => MODE === "pa" ? waitProgram(ms) : (async () => {
    const t0 = performance.now(); await delay(70);   // the press itself takes ~60 ms; then check often (each read ~10 ms)
    while (performance.now() - t0 < ms && L.ready) { const v = await L.get(PRESET_REG()); if (v != null && v !== prev) return v; await delay(35); }
    return null;
  })();
  // make the Electric's register trustworthy: one step forward and back (lands on the same preset)
  // ▶ then ◀ (lands on the same preset); at the end of the list (the Electric doesn't wrap, and a genre such as
  // Favorites can be short) ▶ can't move, so ◀ then ▶ is tried instead.
  async function refreshNum() {
    if (MODE !== "pe" || numOk) return true;
    const pair = async (a, b) => {
      let cur = await L.get(PRESET_REG()), w = armStep(cur, 2000); await L.press(a); if ((await w) == null) return false;
      cur = await L.get(PRESET_REG()); w = armStep(cur, 2000); await L.press(b); return (await w) != null;
    };
    for (let attempt = 0; attempt < 2 && L.ready; attempt++) {   // right after connecting the pedal can still be busy: try twice
      if (await pair(L.EVT.next, L.EVT.prev) || await pair(L.EVT.prev, L.EVT.next)) { numOk = true; return true; }
      await delay(1200);
    }
    return false;
  }
  const waitProgram = ms => new Promise(res => { const off = L.on("program", p => { off(); clearTimeout(t); res(p); }); const t = setTimeout(() => { off(); res(null); }, ms); });
  async function stepPreset(d) {
    if (!L.ready) return notConnected(); if (stepping || walking) return; stepping = true;
    try {
      const code = d > 0 ? L.EVT.next : L.EVT.prev;
      // Play Acoustic: its Program Change confirms the step. Play Electric sends none: its preset-number register
      // moves instead (~0.1–0.3 s; waiting for a Program Change cost 0.9 s per step). The name is the last check,
      // for the rare case where a stale register already held the new number.
      const name0 = MODE === "pe" ? await L.presetName() : null;
      const once = async (pre) => {
        const r0 = MODE === "pe" ? await L.get(PRESET_REG()) : null;
        const w = MODE === "pe" ? armStep(r0, 1200) : waitProgram(900);
        if (pre) { await L.press(L.EVT.back); await delay(150); }
        await L.press(code);
        const got = await w; if (got != null) return MODE === "pe" ? got : true;
        if (MODE !== "pe") return null;
        const n = await L.presetName(); return n != null && n !== name0 ? await L.get(PRESET_REG()) : null;
      };
      let r = await once(false);
      // no preset change: the pedal is probably inside a menu, where ◀ ▶ change pages. BACK, then try once more.
      if (r == null) r = await once(true);
      if (r != null) { if (MODE === "pe") presetChanged(null, r); return; }
      toast("The pedal didn't change preset. Is it on its preset screen?", "warn", 3500);
    } finally { stepping = false; }
  }
  function toggleHit() {
    if (!L.ready) return notConnected();
    const c = CELLS.get(ID.HIT), id = rid(c);
    if (id != null) { const v = V.get(id); if (v == null) return; setParam(c, v ? 0 : 1); return; }
    L.press(L.EVT.hit); toast("Sent a HIT footswitch press (experimental on the Play Electric)");
  }

  // TALK works like open-acoustic's Stage view: the pedal's talk mode is a held HIT switch, so every tap on TALK
  // sends a 1.3 s hold of HIT (press, the "still held" stream the hardware sends, release) and flips the on/off
  // shown here. The pedal has no known parameter for TALK, so that state is the app's own count of taps.
  // Every tap counts at once: the button flips immediately, and the holds go out one after another until the
  // pedal (pedalTalk = how many holds it got, as on/off) matches the button. Two quick taps = on then off.
  let talkOn = false, pedalTalk = false, talkSending = false, peTalkHint = false;
  function talk() {
    if (!L.ready) return notConnected(); if (walking) return;
    talkOn = !talkOn; paintChrome(); sendTalk();
  }
  async function sendTalk() {
    if (talkSending) return;   // the running loop picks the new state up
    talkSending = true; paintChrome();
    try {
      while (L.ready && pedalTalk !== talkOn) {
        // Per the Play Electric manual: HOLD the HIT footswitch to enter TALK (or TALK/Tuner with a guitar plugged in),
        // and while in TALK a single TAP of HIT returns to normal operation.
        if (!pedalTalk) { const release = L.hold(L.EVT.hit); try { await delay(1300); } finally { release(); } }
        else await L.press(L.EVT.hit);
        pedalTalk = !pedalTalk;
        await delay(250);   // a short gap so two presses are never read as one
      }
    } finally { talkSending = false; paintChrome(); }
    if (MODE === "pe" && !peTalkHint) { peTalkHint = true; toast("TALK: holds HIT for 1.3 s (experimental on the Play Electric)"); }
    const hitId = rid(CELLS.get(ID.HIT));
    if (hitId != null && L.ready) { await delay(300); const v = await L.get(hitId); if (v != null && L.ready) { V.set(hitId, v); paint(); } }   // in case the hold changed HIT
  }

  // ── Pedal view: the pedal's own buttons, knob and footswitches (front-panel event injection, SysEx 55) ──
  // Codes from open-acoustic docs/SYSEX.md (confirmed on a Play Acoustic). A button sends press (00) on touch,
  // the "still held" stream (02, every 200 ms, like the hardware) while held, and release (01) on lift, so the
  // pedal makes its own tap / hold distinction (e.g. HIT hold = TALK, footswitch holds for the looper).
  const KNOB = { up: 0x01, down: 0x00 };
  function wirePedalPanel() {
    for (const b of $$("#v-pedal [data-ev]")) {
      const code = parseInt(b.dataset.ev, 16); let timer = 0, n = 0, down = false;
      const start = e => {
        if (!L.ready) return notConnected(); if (walking || down) return;
        down = true; b.classList.add("down"); n = 0;
        L.inject(0xDB, code, 0x00);
        timer = setInterval(() => { if (++n > 40) { clearInterval(timer); return; } L.inject(0xDB, code, 0x02); }, 200);
        try { b.setPointerCapture(e.pointerId); } catch {}
      };
      const end = () => { if (!down) return; down = false; clearInterval(timer); b.classList.remove("down"); L.inject(0xDB, code, 0x01); afterPanel(code); };
      b.addEventListener("pointerdown", e => { if (e.button > 0) return; e.preventDefault(); start(e); });
      b.addEventListener("pointerup", end); b.addEventListener("pointercancel", end); b.addEventListener("lostpointercapture", end);
      b.addEventListener("contextmenu", e => e.preventDefault());
      b.addEventListener("keydown", e => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); if (!L.ready) return notConnected(); if (walking) return; L.press(code).then(() => afterPanel(code)); } });
    }
    // the knob: drag up/down (one click per 18 px), scroll, arrow keys, or the − / + buttons
    const k = $("#pknob"); let y0 = null, acc = 0, angle = 0;
    const turn = d => {
      if (!L.ready) return notConnected(); if (walking) return;
      L.inject(0xAE, 0x00, d > 0 ? KNOB.up : KNOB.down);
      angle += d * 18; k.style.setProperty("--ang", angle + "deg"); afterPanel(null);
    };
    k.addEventListener("pointerdown", e => { if (e.button > 0) return; y0 = e.clientY; acc = 0; try { k.setPointerCapture(e.pointerId); } catch {} e.preventDefault(); });
    k.addEventListener("pointermove", e => { if (y0 == null) return; acc += y0 - e.clientY; y0 = e.clientY; while (Math.abs(acc) >= 18) { turn(Math.sign(acc)); acc -= Math.sign(acc) * 18; } });
    const kend = () => { y0 = null; }; k.addEventListener("pointerup", kend); k.addEventListener("pointercancel", kend);
    k.addEventListener("wheel", e => { e.preventDefault(); turn(e.deltaY < 0 ? 1 : -1); }, { passive: false });
    k.addEventListener("keydown", e => { const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key]; if (d) { e.preventDefault(); turn(d); } });
    for (const b of $$("#v-pedal [data-knob]")) b.addEventListener("click", () => turn(+b.dataset.knob));
    // LOOP: hold DOWN and UP together to enter Loop mode (sends both presses, the "held" stream for both for 1.5 s,
    // then both releases). In Loop mode ▼ = play/rec/overdub (hold: undo), ▲ = stop (hold: erase), and HIT is EXIT:
    // holding ▼+▲ again does NOT leave (seen on a real Electric, 2026-11-25). The pedal doesn't report Loop mode over
    // USB (no register, no message), so the app keeps the state itself: the second tap sends HIT to leave.
    // (the click goes through the delegated handler: #loop-btn on the Pedal view, #loop2 in the footswitch row)
  }
  let loopBusy = false;
  async function toggleLoop() {
      if (!L.ready) return notConnected(); if (walking || loopBusy) return;
      loopBusy = true; paintLoop();
      try {
        if (loopOn) { await L.press(L.EVT.hit); loopOn = false; }
        else {
          L.inject(0xDB, L.EVT.fswDown, 0x00); L.inject(0xDB, L.EVT.fswUp, 0x00);
          const t = setInterval(() => { L.inject(0xDB, L.EVT.fswDown, 0x02); L.inject(0xDB, L.EVT.fswUp, 0x02); }, 200);
          try { await delay(1500); } finally { clearInterval(t); L.inject(0xDB, L.EVT.fswDown, 0x01); L.inject(0xDB, L.EVT.fswUp, 0x01); }
          loopOn = true;
        }
      } finally { loopBusy = false; paintLoop(); }
      afterPanel(null);
  }
  // after using the pedal's controls: re-read (a knob turn inside a menu changes a value) and check the MIDI guard
  let loopOn = false;   // Loop mode, as far as the app knows (the pedal doesn't say)
  function paintLoop() {
    const title = loopOn ? "In Loop mode: HIT is EXIT. Left Loop on the pedal? Tap HIT on the pedal instead." : "Holds ▼ and ▲ together (enters Loop mode)";
    const b = $("#loop-btn");
    if (b) { b.setAttribute("aria-pressed", loopOn); b.classList.toggle("down", loopBusy); b.title = title;
      b.innerHTML = loopOn ? 'EXIT LOOP <small>sends HIT</small>' : 'LOOP <small>▼ + ▲ hold</small>'; }
    const b2 = $("#loop2");
    if (b2) { b2.setAttribute("aria-pressed", loopOn); b2.classList.toggle("sending", loopBusy); b2.title = title;
      b2.innerHTML = loopOn ? '<span class="tk"><i></i>EXIT LOOP</span><small>SENDS HIT</small>' : '<span class="tk"><i></i>LOOP</span><small>▼ + ▲ HOLD</small>'; }
  }
  let afterT = 0;
  function afterPanel(code) {
    if (code === L.EVT.store) { lib.storeAt = Date.now(); saveLib(); }
    if (code !== L.EVT.hit) fresh = false;
    clearTimeout(afterT); afterT = setTimeout(() => { syncSoon(10); checkMidiGuard(); }, 700);
  }

  // ── Save: store the edited preset on the pedal, in its own place ──
  // Same as on the hardware: STORE opens the store screen with the current preset as the destination, a second STORE
  // confirms. BACK afterwards is harmless on the preset screen and cancels if the pedal is still on the store screen.
  let saving = false;
  let justSaved = false, justSavedT = 0;   // a short green "Saved" on the button after a save
  async function savePreset() {
    if (!L.ready) return notConnected(); if (saving || walking || stepping) return;
    saving = true; paintChrome(); flush();
    try {
      await delay(150);
      await L.press(L.EVT.store); await delay(700);
      await L.press(L.EVT.store); await delay(700);
      await L.press(L.EVT.back); await delay(300);
      P.edited = false; fresh = true; clearHistory(); ab = null;
      lib.storeAt = Date.now(); saveLib();
      justSaved = true; clearTimeout(justSavedT); justSavedT = setTimeout(() => { justSaved = false; paintChrome(); }, 1800);
      toast("Saved on the pedal (STORE, STORE). Check the pedal's screen.", "", 3500);   // confirmed on a real Electric: the stored preset changes
      syncSoon(50);   // re-read; a fresh, unedited read also refreshes this preset in the library
    } finally { saving = false; paintChrome(); }
  }

  // ── MIDI guard: MIDI CTRL = MIDI, or FILTER = SYSEX / PC+SYSEX, locks USB control out after the next power-up.
  // The app never writes them, but the pedal's own knob (real or from the Pedal view) can. Reading is harmless,
  // so after controls are used the app reads both and shows a red warning while either is in a locking value.
  // (Play Acoustic IDs; on a Play Electric those IDs are unconfirmed, so the guard stays off there.)
  // read only: Acoustic 0x278 / 0x27B, Electric 0x255 / 0x258 (from its firmware; it has no MIDI page on the pedal)
  const MIDI_CTRL = () => MODE === "pe" ? 0x255 : 0x278, MIDI_FILTER = () => MODE === "pe" ? 0x258 : 0x27B;
  const CTRL_NAMES = ["MERGE", "MIDI", "USB"], FILTER_NAMES = ["NONE", "PRGCHANGE", "SYSEX", "PC+SYSEX"];
  let guardBusy = false;
  async function checkMidiGuard() {
    if (!MODE || !L.ready || guardBusy) return; guardBusy = true;
    try {
      const ctrl = await L.get(MIDI_CTRL()), filt = await L.get(MIDI_FILTER());
      const bad = [];
      if (ctrl === 1) bad.push(`MIDI CTRL is <b>MIDI</b> (set it back to USB or MERGE)`);
      if (filt === 2 || filt === 3) bad.push(`FILTER is <b>${FILTER_NAMES[filt]}</b> (set it back to NONE)`);
      const a = $("#midi-alarm");
      a.hidden = !bad.length;
      if (bad.length) a.innerHTML = `<b>⚠ USB control will stop working after the pedal is switched off.</b> ${bad.join(" · ")}. ${MODE === "pe" ? "The Electric has no MIDI page: a factory reset (hold both arrows while powering up) restores it." : "Fix it on the pedal (SETUP › MIDI) before turning it off."} <span class="cap-lbl">now: CTRL ${CTRL_NAMES[ctrl] ?? "?"} · FILTER ${FILTER_NAMES[filt] ?? "?"}</span>`;
    } finally { guardBusy = false; }
  }

  // ── going to a preset, reading all presets (Play Acoustic) ──────────────
  // Jump: Program Change if the pedal accepts it (tried once, then remembered), else step with the front arrows.
  const LIB = { cancel: false, busy: false };
  // Move the pedal to preset n: one fast burst of arrow presses (no waiting for each preset), then read where it
  // landed and correct; a confirmed one-step-at-a-time walk is the fallback. Going round the end of the list is only
  // used on a pedal that was seen to wrap (the Play Electric stops at its last preset). Returns where it ended.
  async function moveTo(n) {
    let cur = await L.get(PRESET_REG()); if (cur == null || cur === n) return cur;
    if (MODE === "pa" && lib.pcOffset != null && lib.pcWorks !== false && n - lib.pcOffset >= 0 && n - lib.pcOffset < 128) {
      L.programChange(n - lib.pcOffset); await delay(350); cur = await L.get(PRESET_REG());
      const ok = cur === n; if (lib.pcWorks !== ok) { lib.pcWorks = ok; saveLib(); }
    }
    const nums = Object.keys(lib.presets).map(Number), lo = Math.min(...nums), hi = Math.max(...nums), span = hi - lo + 1;
    const roundTrip = lib.wraps === true && nums.length === span && n >= lo && n <= hi;
    for (let round = 0; round < 4 && cur != null && cur !== n && !LIB.cancel && L.ready; round++) {
      const vis = visibleNums(), ia = vis.indexOf(cur), ib = vis.indexOf(n);
      let d = ia >= 0 && ib >= 0 ? ib - ia : n - cur;   // the arrows only step through the current genre
      if (roundTrip && !(P.genre > 0) && Math.abs(d) > span / 2) d = d > 0 ? d - span : d + span;
      $("#lib-status").textContent = `Going to preset ${n}… (now ${cur})`;
      // The knob steps presets on the preset screen like the arrows, but one event per click, so it can go ~10x
      // faster. Inside a menu the knob would change a value, so BACK first.
      // Spacing: the pedal ACCELERATES knob clicks that come faster than ~20 ms apart (real Electric, 2026-11-25:
      // 10 clicks 12 ms apart moved 15 presets, and a 71-preset jump overshot 49 → 140 → 110 → 125 before landing).
      // 25 ms apart moved exactly 70 of 70, both ways (~1.8 s), so a jump lands in one burst.
      if (round === 0) { await L.press(L.EVT.back); await delay(250); }
      for (let i = 0; i < Math.abs(d) && !LIB.cancel && L.ready; i++) { L.inject(0xAE, 0x00, d > 0 ? 0x01 : 0x00); await delay(25); }
      // the number register catches up a moment later: wait until it stops moving
      let last = null;
      for (let k = 0; k < 20 && L.ready; k++) { await delay(150); const v = await L.get(PRESET_REG()); if (v != null && v === last) break; last = v; }
      cur = last;
    }
    let guard = 0;
    while (cur != null && cur !== n && guard++ < 400 && !LIB.cancel && L.ready) {
      $("#lib-status").textContent = `Going to preset ${n}… (now ${cur})`;
      const w = armStep(cur, 1500); await L.press(n > cur ? L.EVT.next : L.EVT.prev);
      if ((await w) == null) { toast("The pedal didn't change preset. Is it on its preset screen?", "warn", 3500); break; }
      cur = await L.get(PRESET_REG());
    }
    return cur;
  }
  async function gotoPreset(n) {
    if (!L.ready) return notConnected(); if (!MODE || walking || stepping) return;
    walking = true; LIB.busy = true; LIB.cancel = false; paintPicker();
    let landed = null;
    try {
      if (!(await refreshNum())) toast("The pedal didn't change preset. Is it on its preset screen?", "warn", 3500);
      else landed = await moveTo(n);
    } finally { walking = false; LIB.busy = false; lastProg = null; presetChanged(null, landed); paintPicker(); }
  }
  // Read every preset's name (and, on the Play Acoustic, all its values) by stepping with ▶ until the list comes
  // round to the start, or, on a pedal that stops at its last preset, until the end and then with ◀ from the start
  // down to the first one. Then back to the start. Unsaved edits on the current preset are lost.
  // Play Electric preset data: slot k (25 values per packet, packets in order) holds parameter PE_SLOT_IDS[k]. This is
  // the firmware's own preset parameter table (PE 1.3.00, X:441933C), and it agrees with every slot found on a real
  // unit by matching presets (2026-11-25). Only mapped parameters are used (decodeSlots checks presetIds()).
  const PE_SLOT_IDS = [0x000, 0x02F, 0x03F, 0x045, 0x050, 0x065, 0x071, 0x07B, 0x07E, 0x0A3, 0x0C2, 0x0C3,
    0x0DC, 0x0DD, 0x0DE, 0x0E0, 0x0E1, 0x0E4, 0x0E5, 0x0E6, 0x0E8, 0x0E9, 0x11E, 0x11F,
    0x129, 0x12A, 0x148, 0x149, 0x14D, 0x14E, 0x14F, 0x151, 0x152, 0x158, 0x159, 0x167,
    0x168, 0x178, 0x179, 0x17D, 0x17E, 0x226, 0x227, 0x228, 0x22C, 0x240, 0x243, 0x248,
    0x24E, 0x28D, 0x29E, 0x29F, 0x2A0, 0x2A1, 0x2A2, 0x2A3, 0x2A4, 0x2FA, 0x2FC, 0x300,
    0x313, 0x315, 0x317, 0x319, 0x325, 0x327, 0x329, 0x32B, 0x32D, 0x340, 0x341, 0x342,
    0x343, 0x344, 0x345, 0x346, 0x347, 0x348, 0x349];
  const PE_SLOTS = Object.fromEntries(PE_SLOT_IDS.map((id, k) => [k, id]));
  // Play Acoustic: the same kind of table in PA 1.3.00 (X:436842, 118 ids, 5 packets). Found in the firmware by its
  // likeness to the Electric's; not yet checked against a real Acoustic.
  const PA_SLOT_IDS = [0x000, 0x02C, 0x02D, 0x032, 0x033, 0x038, 0x039, 0x04A, 0x04B, 0x050, 0x051, 0x056,
    0x057, 0x05E, 0x06B, 0x071, 0x075, 0x078, 0x093, 0x094, 0x09D, 0x0B9, 0x0BA, 0x0D3,
    0x0D4, 0x0D5, 0x0D6, 0x0D7, 0x0D8, 0x0D9, 0x0DE, 0x0DF, 0x0E0, 0x0E1, 0x0E2, 0x0E3,
    0x0E4, 0x124, 0x125, 0x12C, 0x131, 0x150, 0x151, 0x153, 0x158, 0x159, 0x15A, 0x15D,
    0x15E, 0x167, 0x168, 0x17D, 0x17E, 0x182, 0x186, 0x18A, 0x18E, 0x19A, 0x19B, 0x19F,
    0x1A0, 0x1A3, 0x249, 0x24A, 0x24B, 0x24F, 0x263, 0x266, 0x26B, 0x271, 0x2AD, 0x2AF,
    0x2B1, 0x2B3, 0x2B5, 0x2B7, 0x2B9, 0x2BB, 0x2BD, 0x2CB, 0x2CC, 0x2CD, 0x2CE, 0x2CF,
    0x2D0, 0x2D1, 0x353, 0x355, 0x357, 0x361, 0x363, 0x364, 0x365, 0x366, 0x367, 0x368,
    0x369, 0x36A, 0x36B, 0x36D, 0x36F, 0x371, 0x373, 0x375, 0x377, 0x379, 0x37B, 0x37D,
    0x37F, 0x381, 0x383, 0x385, 0x387, 0x389, 0x38B, 0x38D, 0x38F, 0x391];
  if (SIM) { window.PS_SIM_TABLE_PE = PE_SLOT_IDS; window.PS_SIM_TABLE_PA = PA_SLOT_IDS; }   // the simulator sends packets in this order
  function decodeSlots(data) {
    if (!MODE || !Array.isArray(data)) return [];
    const table = MODE === "pe" ? PE_SLOT_IDS : PA_SLOT_IDS;
    const flat = data.flatMap(p => p || []), ok = new Set(presetIds()), out = [];
    table.forEach((id, k) => { if (ok.has(id) && flat[k] != null) out.push([id, flat[k]]); });
    return out;
  }
  // The list: ask the pedal for each stored preset's header by number (name, ★, genres). The pedal stays where it
  // is and nothing is heard; ~25 ms per preset. Values already saved for a preset are kept when its name is the same.
  async function scanPresets() {
    if (!L.ready) return notConnected(); if (!MODE || walking || stepping || LIB.busy) return;
    LIB.busy = true; LIB.reading = true; LIB.cancel = false; paintPicker();
    const t0 = performance.now(), found = {}; let misses = 0, count = 0;
    try {
      for (let n = 1; n <= 512 && misses < 3 && !LIB.cancel && L.ready; n++) {
        const info = await L.presetInfo(n, misses ? 400 : 700, true);
        if (!info) { misses++; continue; }
        misses = 0; count++;
        const old = lib.presets[n];
        // values: the decoded vocal values (Electric), on top of anything saved earlier for this preset
        const keep = new Map(old && old.name === info.name ? old.vals : []);
        for (const [id, v] of decodeSlots(info.data)) keep.set(id, v);
        found[n] = { name: info.name, t: Date.now(), fav: info.fav, flags: info.flags, vals: [...keep] };
        if (count % 20 === 0) $("#lib-status").textContent = `Reading presets… ${count}`;
      }
      if (count && !LIB.cancel) { lib.presets = found; lib.readAt = Date.now(); lib.storeAt = Math.min(lib.storeAt, lib.readAt - 1); saveLib(); }
    } finally {
      LIB.busy = false; LIB.reading = false; paintPicker();
      if (!count && !LIB.cancel) toast("The pedal didn't send its preset list", "warn", 3500);
      else if (count) toast(`Read ${count} presets in ${Math.max(1, Math.round((performance.now() - t0) / 1000))} s`, "", 3000);
    }
  }
  // Values of some presets (for an export): step the pedal to each one and read it, then go back. Only the
  // presets without saved values are visited.
  async function readValues(nums) {
    if (!nums.length) return true;
    if (!L.ready || walking || stepping) return false;
    walking = true; LIB.busy = true; LIB.reading = true; LIB.cancel = false; paintPicker();
    const ids = presetIds(); let start = null, done = 0;
    try {
      if (!(await refreshNum())) return false;
      start = await L.get(PRESET_REG());
      for (const n of nums) {
        if (LIB.cancel || !L.ready) break;
        $("#lib-status").textContent = `Reading values… ${done + 1} / ${nums.length}`;
        if ((await moveTo(n)) !== n) continue;
        const vals = []; const got = await L.getBatch(ids, { window: 48, alive: () => !LIB.cancel && L.ready, each: (id, v) => vals.push([id, v]) });
        if (got && lib.presets[n]) { lib.presets[n].vals = vals; lib.presets[n].t = Date.now(); done++; }
      }
      saveLib();
    } finally {
      walking = false; LIB.reading = false;
      if (start != null && L.ready) { LIB.busy = false; await gotoPreset(start); } else { LIB.busy = false; presetChanged(null); }
      paintPicker();
    }
    return !LIB.cancel;
  }
  async function readAllPresets() {
    if (!L.ready) return notConnected(); if (!MODE || walking || stepping) return;
    if (P.edited && !confirm(tt("Reading all presets changes presets on the pedal, so unsaved edits on this preset will be lost. Continue?"))) return;
    walking = true; LIB.busy = true; LIB.reading = true; LIB.cancel = false; paintPicker();
    const quit = msg => { walking = false; LIB.busy = false; LIB.reading = false; paintPicker(); toast(msg, "warn", 3500); };
    if (!(await refreshNum())) return quit("The pedal didn't change preset. Is it on its preset screen?");
    const start = await L.get(PRESET_REG()); if (start == null) return quit("Couldn't read the preset number");
    const t0 = performance.now(), known = Object.keys(lib.presets).length || null, seen = new Set(), ids = presetIds();
    let count = 0, cur = start, failed = false;
    const tell = () => {
      const per = count ? (performance.now() - t0) / count : null, left = known && per ? Math.max(0, known - count) * per / 1000 : null;
      $("#lib-status").textContent = `Reading presets… ${count}${known ? " / " + known : ""}${left != null ? ` · ~${left < 90 ? Math.round(left) + " s" : Math.round(left / 60) + " min"} left` : ""}`;
      $("#lib-bar").hidden = !known; if (known) $("#lib-bar i").style.width = Math.min(100, count / known * 100) + "%";
    };
    const step = async code => {   // one confirmed step; null = the pedal didn't move (end of the list, or not on the preset screen)
      const w = armStep(cur, 1500); await L.press(code); const prog = await w;
      if (prog == null) return null;
      const n = MODE === "pe" ? prog : await L.get(PRESET_REG()); return n == null ? null : { n, prog };   // Electric: armStep already read the new number
    };
    const take = async (n, prog) => {   // read the preset the pedal is on now
      seen.add(n); cur = n;
      if (MODE === "pa" && prog != null && lib.pcOffset !== n - prog) lib.pcOffset = n - prog;   // Program Change number → preset number
      const info = await L.presetInfo(), name = info ? info.name : null, vals = [];
      const got = ids.length ? await L.getBatch(ids, { window: 48, alive: () => !LIB.cancel && L.ready, each: (id, v) => vals.push([id, v]) }) : {};   // 64 in flight tested OK on a real Electric
      if (!got) return false;
      libPut(n, name ?? "", vals, info ? info.fav : null, false); count++; tell(); return true;
    };
    try {
      tell();
      let ended = false;
      for (let i = 0; i < 600 && !LIB.cancel && L.ready; i++) {   // forward
        const r = await step(L.EVT.next);
        if (!r) { ended = true; break; }
        if (r.n === start) { lib.wraps = true; if (!(await take(r.n, r.prog))) failed = true; break; }   // came round: the start preset, as stored
        if (seen.has(r.n)) break;
        if (!(await take(r.n, r.prog))) { failed = true; break; }
      }
      // Stopped at the last preset (no wrap), possibly at once when the start IS the last one (e.g. the last Favorite):
      // read the start and everything below it with ◀. refreshNum already proved the pedal moves.
      if (ended && !LIB.cancel && L.ready) {
        lib.wraps = false;
        cur = count ? await moveTo(start) : start;
        if (cur === start && await take(start, null)) {
          for (let i = 0; i < 600 && !LIB.cancel && L.ready; i++) {
            const r = await step(L.EVT.prev);
            if (!r || seen.has(r.n)) break;
            if (!(await take(r.n, r.prog))) { failed = true; break; }
          }
        }
      }
      if (!failed && !LIB.cancel) {
        lib.readAt = Date.now(); lib.storeAt = Math.min(lib.storeAt, lib.readAt - 1);
        // a complete read is the list: drop presets the pedal no longer shows (e.g. another genre)
        for (const k of Object.keys(lib.presets)) if (!seen.has(+k)) delete lib.presets[k];
        paintPicker();
      }
      saveLib();
    } finally {
      walking = false; LIB.reading = false;
      if (cur !== start && L.ready) { LIB.busy = false; await gotoPreset(start); }   // gotoPreset re-reads at the end
      else { LIB.busy = false; lastProg = null; presetChanged(null, cur); }
      paintPicker();
      if (failed && !count) toast("The pedal didn't change preset. Is it on its preset screen?", "warn", 3500);
      else toast(LIB.cancel ? `Stopped after ${count} presets` : `Read ${count} presets in ${Math.round((performance.now() - t0) / 1000)} s`, "", 3500);
    }
  }
  function paintPicker() {
    const pk = $("#picker"); if (!pk || pk.hidden) return;
    let ents; const pa = !!MODE; ents = Object.entries(lib.presets).map(([n, e]) => [+n, e]).filter(([, e]) => inGenre(e)).sort((a, b) => a[0] - b[0]);
    const stale = ents.filter(([n]) => !libEntry(n)).length;
    $("#lib-info").textContent = !pa ? "" : ents.length ? `${ents.length} presets${stale ? ` · ${stale} may be outdated` : ""}${lib.readAt ? " · read " + new Date(lib.readAt).toLocaleDateString() : ""}` : "no presets read yet";
    $("#lib-read").hidden = !pa || LIB.busy;
    const gs = $("#genre-sel");
    if (gs) {
      const names = GENRES(), sig = MODE + names.length;
      if (gs.dataset.sig !== sig) { gs.innerHTML = names.map((g, i) => `<option value="${i}">${esc(genreLabel(g))}</option>`).join(""); gs.dataset.sig = sig; }
      if (P.genre != null && document.activeElement !== gs) gs.value = String(P.genre);
      gs.disabled = LIB.busy || P.genre == null;
    }
    $("#lib-export").hidden = !ents.length; $("#lib-export").disabled = LIB.busy;
    $("#lib-cancel").hidden = !LIB.busy; if (!LIB.busy) $("#lib-bar").hidden = true; $("#pick-close").hidden = LIB.busy;
    if (LIB.reading) {   // while reading: one calm "loading" panel; the whole list appears when it's done
      if (!$("#plist .plist-loading")) $("#plist").innerHTML = `<div class="plist-loading" role="status"><i class="pl-spin" aria-hidden="true"></i><b>Reading the pedal's presets…</b><small>The pedal steps through them; the list appears when it's done.</small></div>`;
      return;
    }
    if (!LIB.busy) $("#lib-status").textContent = ents.length ? "Tap a preset to go to it." : "Read all presets once (about 2 s each) to see every preset here and switch instantly.";
    const q = ($("#plist-q")?.value || "").trim().toUpperCase();
    $(".psearch").hidden = !Object.keys(lib.presets).length;
    if (q) ents = ents.filter(([n, e]) => String(n) === q || (e.name || "").toUpperCase().includes(q));
    if (q && !ents.length) { $("#plist").innerHTML = `<p class="plist-empty">No preset matches “${esc(q)}”.</p>`; return; }
    $("#plist").innerHTML = ents.map(([n, e]) => `<button type="button" class="pitem" data-preset="${n}" ${n === P.num ? 'aria-current="true"' : ""} ${LIB.busy ? "disabled" : ""}>
      <span class="mono">${n}</span><b>${esc(e.name || "(no name)")}</b>${e.fav ? '<i class="fav" title="Favorite">★</i>' : ""}${libEntry(n) ? "" : `<small class="badge">outdated</small>`}</button>`).join("");
  }
  function openPicker() { if (!L.ready) return notConnected(); $("#picker").hidden = false; paintPicker(); if (!walking) readGenre(); }

  // ── Edit with Claude: copy the preset as text, paste Claude's answer back, review, apply ──
  // The text lists every parameter of this preset that the app may write, with its current value and the allowed
  // options/range, so an AI (or a person) can answer with just the changes. Nothing reaches the pedal before the
  // musician has reviewed the list; every change then goes through setParam (allowlist, range, read-before-write).
  const devName = () => MODE === "pe" ? "Play Electric" : "Play Acoustic";
  function claudeIndex() {   // "Vocal Harmony" → { "STYLE": cell, … }; the same order and names for export and import
    const out = new Map(), seen = new Set();
    for (const f of fxList()) {
      const name = (f.side === "voz" ? "Vocal " : "Guitar ") + f.name, cells = new Map();
      for (const c of [f.control, f.style, ...f.groups.flatMap(g => g[1])]) {
        if (!c || seen.has(hex(c.param))) continue;
        const id = rid(c); if (id == null || !writable(id) || V.get(id) == null) continue;
        seen.add(hex(c.param));
        const base = c === f.style ? "STYLE" : c === f.control ? "CONTROL" : c.label.toUpperCase();   // same words on every effect
        let k = base, n = 2; while (cells.has(k)) k = base + " " + n++;
        cells.set(k, c);
      }
      if (cells.size) out.set(name, cells);
    }
    return out;
  }
  function claudeText() {
    const fx = {};
    for (const [name, cells] of claudeIndex()) {
      fx[name] = {};
      for (const [k, c] of cells) {
        const v = V.get(rid(c));
        fx[name][k] = c.values ? { value: c.values[v - c.min], options: c.values } : { value: v, range: [c.min, c.max], shows: fmt(c, v) };
      }
    }
    const data = { device: devName(), preset: P.name || "", number: P.num, effects: fx };
    return `PLAY STUDIO PRESET — ${devName()}${P.num != null ? " — preset " + P.num : ""} "${P.name || ""}"

You are helping a musician edit this preset of a TC-Helicon ${devName()} (vocal + guitar effects pedal).
Below is every parameter the editor can change, grouped by effect, with its current value.
- List parameters: answer with one of the exact names in "options".
- Number parameters: answer with a whole number inside "range" ("shows" is how the pedal displays the current value; DECAY, TIME and similar values are raw steps, not seconds).
- CONTROL is the effect's state: OFF, ON or HIT (HIT = on only while the HIT footswitch is active).
Talk to the musician in their language. Explain your idea briefly, then give ONE json code block with ONLY what should change, for example:
{"changes": {"Vocal Harmony": {"STYLE": "LOW", "LEVEL": -10}, "Vocal Reverb": {"CONTROL": "ON"}}}

\`\`\`json
${JSON.stringify(data, null, 1)}
\`\`\`
`;
  }
  async function claudeCopy() {
    if (!L.ready) return notConnected();
    const text = claudeText(), out = $("#claude-out");
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch {}
    out.value = text; out.hidden = ok;   // no clipboard (some iPad browsers): show it to copy by hand
    if (!ok) { out.focus(); out.select(); }
    $("#claude-copied").textContent = ok ? "Copied. Paste it in Claude and say what you want." : "Select all the text below and copy it.";
  }
  let claudePlan = [];
  function claudeReview() {
    const raw = $("#claude-in").value, list = $("#claude-list"); claudePlan = []; $("#claude-apply").hidden = true;
    const block = (raw.match(/```(?:json)?\s*([\s\S]*?)```/g) || []).map(b => b.replace(/```(?:json)?/g, "").trim()).reverse().find(b => b.includes("{")) || raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    let data; try { data = JSON.parse(block); } catch { list.innerHTML = `<p class="warnline">No changes found in that text. Paste Claude's whole answer (with the json block).</p>`; return; }
    const changes = data && typeof data === "object" ? (data.changes || data.effects || data) : null;
    if (!changes || typeof changes !== "object") { list.innerHTML = `<p class="warnline">No changes found in that text. Paste Claude's whole answer (with the json block).</p>`; return; }
    const idx = claudeIndex(), find = (m, k) => { const K = String(k).trim().toUpperCase(); for (const [n, x] of m) if (n.toUpperCase() === K) return [n, x]; return null; };
    // A preset copied from the other model (Acoustic ↔ Electric): bring only the vocal effects (the guitar sections
    // are different hardware), and convert numbers by what the pedal shows (e.g. "2.3 s"), since the raw steps differ.
    const cross = typeof data.device === "string" && /^Play (Acoustic|Electric)$/.test(data.device) && data.device !== devName();
    const num = s => {   // "470 ms" → {x: 0.47, unit: "s"}, "−14 dB" → {x: -14, unit: "dB"}
      const m = String(s).replace("−", "-").match(/-?\d+(?:\.\d+)?/); if (!m) return null;
      let x = +m[0], unit = String(s).replace(/[-−+\d.\s]/g, "");
      if (unit === "ms") { x /= 1000; unit = "s"; } else if (unit === "kHz") { x *= 1000; unit = "Hz"; }
      return { x, unit };
    };
    const byShows = (c, shows) => {
      const want = num(shows); if (!want) return null;
      let best = null, bd = Infinity;
      for (let v = c.min; v <= c.max; v++) { const h = num(fmt(c, v)); if (!h || h.unit !== want.unit) continue; const d = Math.abs(h.x - want.x); if (d < bd) { bd = d; best = v; } }
      return best;
    };
    const rows = [], bad = [];
    let skippedGtr = 0;
    for (const [fxName, params] of Object.entries(changes)) {
      if (cross && /^guitar\b/i.test(fxName)) { skippedGtr++; continue; }
      const fx = find(idx, fxName);
      if (!fx || !params || typeof params !== "object") { bad.push(`${fxName}: not an effect this pedal has (or it isn't editable)`); continue; }
      for (const [pk, want0] of Object.entries(params)) {
        const p = find(fx[1], pk); if (!p) { bad.push(`${fx[0]} · ${pk}: unknown parameter`); continue; }
        const c = p[1], cur = V.get(rid(c)); let want = want0 && typeof want0 === "object" && "value" in want0 ? want0.value : want0, v;
        if (c.values) { const i = c.values.findIndex(s => s.trim().toUpperCase() === String(want).trim().toUpperCase()); if (i < 0) { bad.push(`${fx[0]} · ${p[0]}: "${want}" isn't an option`); continue; } v = c.min + i; }
        else {
          v = cross && want0 && typeof want0 === "object" && want0.shows != null ? byShows(c, want0.shows) : Number(want);
          if (!Number.isInteger(v) || v < c.min || v > c.max) { bad.push(`${fx[0]} · ${p[0]}: ${want} is outside ${c.min}…${c.max}`); continue; }
        }
        if (v === cur) continue;
        claudePlan.push({ c, v }); rows.push(`<li><span>${esc(fx[0])} · <b>${esc(p[0])}</b></span><span class="mono">${esc(fmt(c, cur))} → <b>${esc(fmt(c, v))}</b></span></li>`);
      }
    }
    const other = cross ? `<p class="warnline">Preset from a ${esc(data.device)} ("${esc(data.preset || "")}"): only the vocal effects are brought over.</p>`
      : data.preset && P.name && String(data.preset).trim() !== P.name.trim() ? `<p class="warnline">That text was made for "${esc(data.preset)}"; the pedal is now on "${esc(P.name)}".</p>` : "";
    list.innerHTML = other + (rows.length ? `<p class="cap-lbl">${rows.length} changes</p><ul class="clist">${rows.join("")}</ul>` : `<p>Nothing to change: the pedal already has these values.</p>`)
      + (bad.length ? `<p class="cap-lbl">Ignored</p><ul class="clist bad">${bad.map(s => `<li>${esc(s)}</li>`).join("")}</ul>` : "");
    $("#claude-apply").hidden = !claudePlan.length;
  }
  function claudeApply() {
    if (!L.ready) return notConnected();
    for (const { c, v } of claudePlan) setParam(c, v);
    const n = claudePlan.length; claudePlan = []; $("#claude-apply").hidden = true;
    $("#claude-list").innerHTML = `<p>Applied ${n} changes. Listen, then press Save to keep them (Undo goes back).</p>`;
    paint(); toast(`Applied ${n} changes: press Save to keep them`);
  }
  // ── Export all presets: every preset in the library (read with "Read all presets") as one JSON file ──
  // Same effect / parameter names as "Edit with Claude", so a single preset from it can also be pasted there.
  // Lists are written as their option name, numbers as {value, shows} (shows = what the pedal displays, used to
  // convert between models). Only reads the saved list: nothing is sent to the pedal.
  // the Export button opens a small sheet: all presets, or Favorites only
  function openExport() {
    const ents = Object.values(lib.presets).filter(e => inGenre(e)), nFav = ents.filter(e => e.fav === true).length;
    $("#exp-all-n").textContent = `${ents.length} presets`;
    $("#exp-fav-n").textContent = nFav ? `${nFav} presets` : "No presets tagged ★ yet";
    $("[data-export='fav']").disabled = !nFav;
    $("#export-sheet").hidden = false;
  }
  async function exportAll(favOnly = false) {
    const pick = () => Object.entries(lib.presets).map(([n, e]) => [+n, e]).filter(([, e]) => inGenre(e) && (!favOnly || e.fav === true)).sort((a, b) => a[0] - b[0]);
    const missing = pick().filter(([, e]) => !(e.vals && e.vals.length)).map(([n]) => n);
    if (missing.length) {
      toast(`Reading the values of ${missing.length} presets first (the pedal steps through them)…`, "", 4000);
      if (!(await readValues(missing))) return toast("Export stopped", "warn");
    }
    const ents = pick().filter(([, e]) => e.vals && e.vals.length);
    if (!ents.length) return toast(favOnly ? "No favorite presets found (tag them with FAVORITE, then read all presets again)" : "Read all presets first", "warn", 4500);
    const fx = fxList();
    const presets = ents.map(([n, e]) => {
      const vm = new Map(e.vals), effects = {}, seen = new Set();
      for (const f of fx) {
        const o = {};
        for (const c of [f.control, f.style, ...f.groups.flatMap(g => g[1])]) {
          if (!c || seen.has(hex(c.param))) continue;
          const id = rid(c); if (id == null || !vm.has(id)) continue;
          seen.add(hex(c.param));
          const base = c === f.style ? "STYLE" : c === f.control ? "CONTROL" : c.label.toUpperCase();
          let k = base, i = 2; while (k in o) k = base + " " + i++;
          const v = vm.get(id); o[k] = c.values ? (c.values[v - c.min] ?? v) : { value: v, shows: fmt(c, v) };
        }
        if (Object.keys(o).length) effects[(f.side === "voz" ? "Vocal " : "Guitar ") + f.name] = o;
      }
      return { number: n, name: e.name || "", favorite: e.fav === true, effects };
    });
    const day = new Date().toISOString().slice(0, 10);
    const data = { format: "play-studio-presets", version: 1, device: devName(), exported: new Date().toISOString(), favoritesOnly: favOnly, count: presets.length, presets };
    const text = JSON.stringify(data), fname = `play-presets-${devName().replace(/\s+/g, "-").toLowerCase()}${favOnly ? "-favorites" : ""}-${day}.json`;
    const file = new File([text], fname, { type: "application/json" });
    let copied = false; try { await navigator.clipboard.writeText(text); copied = true; } catch {}
    if (navigator.canShare && navigator.canShare({ files: [file] })) {   // phones / iPad: share sheet (WhatsApp, Files, e-mail…)
      try { await navigator.share({ files: [file], title: fname }); toast(`Exported ${presets.length} presets`); return; }
      catch (e) { if (e && e.name === "AbortError") return; }
    }
    const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = fname; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
    toast(copied ? `Exported ${presets.length} presets (file saved, also copied)` : `Exported ${presets.length} presets (file saved)`, "", 4500);
  }
  function openClaude() { if (!L.ready) return notConnected(); $("#picker").hidden = true; $("#claude").hidden = false; $("#claude-copied").textContent = ""; $("#claude-out").hidden = true; }

  // the protected-mode note (Effects, Mix, Setup, Pedal): a real Play Electric can dismiss it for good; a link that
  // didn't identify the pedal (a Bluetooth adapter) offers "It's a Play Acoustic", which unlocks full editing
  function paintNote() {
    const n = $("#pe-note"), unid = L.ready && MODE === "pe" && !L.identityMsg && L.pid !== 0x71;
    n.hidden = !L.ready || MODE !== "pe" || (!unid && store.get("pe-note-off", false));
    if (n.hidden) return;
    n.classList.toggle("warn", unid);
    $("#pe-note-t").textContent = unid ? "Pedal not identified · protected mode." : "Play Electric · protected mode.";
    $("#pe-note-s").textContent = unid ? "A Bluetooth adapter can hide which pedal it is. If it's a Play Acoustic, say so to edit everything." : "Only parameters confirmed in the Mapper can be changed; everything else is read-only.";
    $("#pe-note-go").textContent = unid ? "It's a Play Acoustic" : "Open Mapper";
    $("#pe-note-x").hidden = unid;
  }
  function trustAcoustic() {
    if (!L.out || !L.inp) return;
    const t = store.get("trust-pa", {}); t[L.out.name] = true; store.set("trust-pa", t);
    toast("Remembered: this adapter is a Play Acoustic. Reconnecting…", "", 2500);
    L.use(L.out.id, L.inp.id, L.ble);   // reconnects; the ready handler now trusts it
  }

  // ── link events ─────────────────────────────────────────────────────────
  L.on("ready", () => {
    // Full Acoustic editing only for a pedal that really identified itself as a Play Acoustic.
    // A Play Electric, or a link with no identity reply (e.g. Bluetooth "unconfirmed"), gets the protected mode.
    // A Bluetooth adapter (WIDI…) can swallow the identity reply: the user can say once that it's a Play Acoustic,
    // remembered per adapter (port name).
    const unconfirmed = !L.identityMsg && L.pid !== 0x71, trusted = unconfirmed && !!(store.get("trust-pa", {})[L.out && L.out.name]);
    const confirmedPA = L.pid === 0x70 && (!!L.identityMsg || trusted);
    MODE = confirmedPA ? "pa" : "pe"; loadMap(); loadLib(); walking = false; lastProg = null; fresh = false; talkOn = false; pedalTalk = false; loopOn = false; paintLoop();
    gen++; resetWrites(); V.clear(); P.num = null; P.name = null; P.edited = false; clearHistory(); ab = null;
    MAPS.base.clear(); MAPS.changes.clear(); MAPS.stop = false; MAPS.again = false;
    $("#midi-alarm").hidden = true;
    render(true); syncAll(); checkMidiGuard(); renderMapper(); renderDrawer();
    // Every connection of a Play Acoustic reads all presets, so the list is always current (the user asked for it).
    // It walks the pedal through every preset and comes back; "Stop" in the preset list ends it early.
    const conn = ++connN; P.genre = null; setTimeout(() => { if (conn === connN && L.ready) readGenre(); }, 1200);
    numOk = MODE === "pa";
    if (confirmedPA || L.pid === 0x71) {
      setTimeout(() => { if (conn === connN && L.ready && !walking && !stepping) scanPresets(); }, 1500);
    }
    toast(L.pid === 0x71 ? "Connected: Play Electric (protected mode)" : confirmedPA ? (trusted ? "Connected: Play Acoustic (you confirmed it)" : "Connected: Play Acoustic") : "Connected, but the pedal didn't identify itself: protected mode", confirmedPA || L.pid === 0x71 ? "" : "warn", 4000);
  });
  L.on("status", () => { $("#gate-status").textContent = L.message; paintChrome(); renderDrawer(); if (!L.ready) { MAPS.stop = true; resetWrites(); $("#midi-alarm").hidden = true; paint(); } });
  L.on("ports", () => renderDrawer());
  L.on("program", p => { lastProg = p; if (!walking) presetChanged(p); });
  const NAV = new Set([L.EVT.next, L.EVT.prev, L.EVT.fswUp, L.EVT.fswDown]);
  let hitT = 0, guardT = 0;
  L.on("panel", e => {
    if (e.e0 === 0xDB && e.e1 === L.EVT.store && e.e2 === 0x00) { lib.storeAt = Date.now(); saveLib(); paintPicker(); }   // STORE may change any preset
    if (e.self || walking) return;
    if (!(e.e0 === 0xDB && (NAV.has(e.e1) || e.e1 === L.EVT.hit))) fresh = false;   // something changed on the unit
    if (e.e0 === 0xDB && NAV.has(e.e1)) {   // preset buttons: on the Acoustic the Program Change that follows handles it;
      if (MODE === "pe" && e.e2 === 0x01) syncSoon(400);   // the Electric sends none, so re-read (a new name = new preset)
      return;
    }
    const hitId = rid(CELLS.get(ID.HIT));
    if (hitId != null && e.e0 === 0xDB && e.e1 === L.EVT.hit) {   // HIT on the unit: only HIT changes
      clearTimeout(hitT); hitT = setTimeout(async () => { const v = await L.get(hitId); if (v != null) { V.set(hitId, v); paint(); } }, 150); return;
    }
    syncSoon(e.e0 === 0xAE ? 500 : 250);   // a knob or another control was used on the pedal itself
    clearTimeout(guardT); guardT = setTimeout(checkMidiGuard, 900);   // …which could have been in SETUP › MIDI
    if (MAPS.base.size) { clearTimeout(MAPS.autoT); MAPS.autoT = setTimeout(checkChanges, 900); }
  });

  // ── MIDI monitor ────────────────────────────────────────────────────────
  const LOG = []; let logPaused = false, logQ = 0;
  const hexs = d => d.map(b => b.toString(16).toUpperCase().padStart(2, "0")).join(" ");
  function describe(d) {
    if (d[0] === 0xF0 && d[1] === 0x7E) return d[4] === 0x01 ? "identity request" : "identity reply";
    if (d[0] === 0xF0 && d[3] === 0x38) { const cmd = d[6], id = (d[7] << 7) | d[8];
      return { 0x22: `set/value ${hx(id)}`, 0x47: `get ${hx(id)}`, 0x45: "request preset name", 0x20: "preset header", 0x55: "panel event" }[cmd] || "TC SysEx " + cmd.toString(16); }
    if ((d[0] & 0xF0) === 0xC0) return "program change " + d[1];
    if ((d[0] & 0xF0) === 0xB0) return `CC ${d[1]} = ${d[2]}`;
    return "";
  }
  L.on("raw", ({ dir, data }) => {
    if (logPaused) return;
    LOG.push({ dir, t: new Date().toLocaleTimeString(), line: hexs(data), what: describe(data) }); if (LOG.length > 400) LOG.splice(0, LOG.length - 400);
    if (!$("#drawer").hidden && !logQ) logQ = requestAnimationFrame(() => { logQ = 0; paintLog(); });
  });
  function paintLog() {
    const el = $("#log"), atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 20;
    el.innerHTML = LOG.map(l => `<div class="${l.dir}">${l.t} ${l.dir === "in" ? "←" : "→"} ${esc(l.line)}${l.what ? `  · ${esc(l.what)}` : ""}</div>`).join("");
    if (atEnd) el.scrollTop = el.scrollHeight;
  }
  function renderDrawer() {
    const ports = L.ports(), ch = L.choice();
    const fill = (sel, list, cur) => { sel.innerHTML = list.length ? list.map(p => `<option value="${esc(p.id)}" ${p.id === cur ? "selected" : ""}>${esc(p.name)}</option>`).join("") : `<option value="">(no ports)</option>`; };
    fill($("#port-out"), ports.outputs, ch.out); fill($("#port-in"), ports.inputs, ch.inp);
    const rows = [["Status", L.message], ["Pedal", !L.ready ? "—" : MODE === "pe" ? "Play Electric (0x71) · protected" : "Play Acoustic (0x70)"],
      ["SysEx channel", L.ready ? hx(L.ch).replace("0x0", "0x") : "—"], ["Identity", L.identityMsg ? hexs(L.identityMsg) : "—"],
      ["Round trip", L.readMs != null ? L.readMs.toFixed(1) + " ms" : "—"], ["Mode", SIM ? "simulated pedal" : "real pedal"]];
    $("#drw-kv").innerHTML = rows.map(([k, v]) => `<span>${esc(k)}</span><span class="${k === "Identity" ? "mono" : ""}">${esc(v)}</span>`).join("");
  }

  // ── Mapper ──────────────────────────────────────────────────────────────
  const MAPS = { base: new Map(), scanning: false, stop: false, changes: new Map(), autoT: 0 };   // changes: id → {from, to}
  const CHOICES = (() => {   // "this is…" options: every menu control, grouped like the app
    const groups = [], used = new Set();
    const add = (label, cells) => { const cs = cells.filter(c => c && !used.has(hex(c.param)) && used.add(hex(c.param))); if (cs.length) groups.push([label, cs]); };
    for (const d of FXDEF) {
      const pages = [...pagesOf(d.menu, d.title), ...(d.extra || []).flatMap(([t]) => pagesOf(d.menu, t)), ...(d.adv ? pagesOf(...d.adv) : [])];
      add(`${d.side === "voz" ? "Vocal" : "Guitar"} › ${d.name}`, pages.flatMap(p => [p.control, ...cellsOf(p)]));
    }
    add("Mix", M.MIX.pages.flatMap(cellsOf));
    for (const p of M.SETUP.pages) add("Setup › " + p.title, cellsOf(p));
    add("Footswitch", [CELLS.get(ID.HIT)]);
    return groups;
  })();
  const choiceHTML = suggest => `<option value="">Choose…</option>` + CHOICES.map(([g, cs]) => `<optgroup label="${esc(g)}">${cs.map(c => `<option value="${c.param}" ${hex(c.param) === suggest ? "selected" : ""}>${esc(c.label)} · ${esc(g)}</option>`).join("")}</optgroup>`).join("")
    + `<optgroup label="Other"><option value="other">Something else… (name it)</option><option value="ignore">Ignore: changes by itself</option></optgroup>`;
  const hint = id => { const p = PP[id]; return p ? `${p[0]} (${p[1]}…${p[2]}${p[3] && p[3] !== "number" && p[3] !== "list" ? " " + p[3] : ""})` : "unknown"; };

  async function scanAll() {
    if (!L.ready) return notConnected(); if (MAPS.scanning) return;
    MAPS.scanning = true; MAPS.stop = false; renderMapper();
    const base = new Map(), t0 = performance.now(); let done = false;
    try {
      // blocks of 64 IDs, each read pipelined (L.getBatch); progress after each block
      for (let start = 0; start <= MAX_ID; start += 64) {
        if (MAPS.stop || !L.ready) break;
        const ids = []; for (let id = start; id <= Math.min(MAX_ID, start + 63); id++) ids.push(id);
        const got = await L.getBatch(ids, { alive: () => !MAPS.stop && L.ready });
        if (!got) break;
        for (const [id, v] of Object.entries(got)) base.set(+id, v);
        if (start === 0 && base.size === 0) { toast("The pedal isn't answering reads. Check the connection and that VoiceSupport is closed.", "warn", 5000); break; }
        const last = Math.min(MAX_ID, start + 63), left = (performance.now() - t0) / (last + 1) * (MAX_ID - last) / 1000;
        $("#scan-bar i").style.width = ((last + 1) / (MAX_ID + 1) * 100).toFixed(1) + "%";
        $("#st1-p").textContent = `Reading ${hx(last)} of ${hx(MAX_ID)}… ${base.size} answered · ~${Math.ceil(left)} s left`;
        if (last === MAX_ID) done = true;
      }
    } finally {
      MAPS.scanning = false;
      if (done) { MAPS.base = base; MAPS.changes.clear(); toast(`Read ${base.size} parameters. Now change one thing on the pedal.`, "", 4000); }
      else if (MAPS.stop) toast("Reading stopped");
      renderMapper();
    }
  }
  async function checkChanges() {
    if (!L.ready || !MAPS.base.size) return;
    if (MAPS.scanning) { MAPS.again = true; return; }   // something changed during a pass: check again right after it
    MAPS.again = false;
    MAPS.scanning = true; renderMapper(); $("#st1-p").textContent = "Checking for changes…";
    let found = 0;
    try {
      const now = await L.getBatch([...MAPS.base.keys()], { alive: () => L.ready && !MAPS.stop }) || {};
      for (const [k, v] of Object.entries(now)) {
        const id = +k, was = MAPS.base.get(id);
        if (v !== was) {
          MAPS.base.set(id, v);
          if (MAPD.ignored.includes(id) || MAPD.entries[id]) continue;
          const ch = MAPS.changes.get(id); MAPS.changes.set(id, { from: ch ? ch.from : was, to: v }); found++;
        }
      }
    } finally {
      MAPS.scanning = false; MAPS.stop = false; renderMapper();
      if (MAPS.again) setTimeout(checkChanges, 50); else if (!found) toast("No new changes found");
    }
  }
  function renderMapper() {
    const has = MAPS.base.size > 0;
    $("#scan-btn").hidden = MAPS.scanning; $("#scan-stop").hidden = !MAPS.scanning; $("#scan-bar").hidden = !MAPS.scanning && !has;
    $("#check-btn").disabled = !has || MAPS.scanning;
    $("#st1").classList.toggle("done", has); $("#scan-btn").textContent = has ? "Read all again" : "Read all";
    if (!MAPS.scanning) $("#st1-p").textContent = has ? `${MAPS.base.size} parameters read. Ready to watch for changes.` : "Reads all 948 parameter IDs once (read-only).";
    $("#sim-turn").hidden = !window.simPedal;
    const rows = [...MAPS.changes].sort((a, b) => a[0] - b[0]);
    $("#chg-count").textContent = rows.length ? rows.length : "";
    $("#changes").innerHTML = rows.length ? rows.map(([id, ch]) => {
      const guess = CELLS.has(id) ? id : null;
      return `<div class="row" data-id="${id}"><span class="mono">${hx(id)}</span><span class="chg mono">${ch.from} → <em>${ch.to}</em></span>
        <span class="hint" title="Same ID on the Play Acoustic">${esc(hint(id))}</span>
        <div class="sel sm"><select aria-label="What did you change?">${choiceHTML(guess)}</select></div>
        <span class="acts"><button type="button" class="btn primary" data-act="confirm">Confirm</button><button type="button" class="btn" data-act="drop" title="Remove from this list">✕</button></span></div>`; }).join("")
      : `<div class="empty">${has ? "Nothing yet. Change one control on the pedal." : "Read everything first (step 1)."}</div>`;
    const ents = Object.entries(MAPD.entries).sort((a, b) => a[0] - b[0]);
    $("#map-count").textContent = ents.length ? ents.length : "";
    $("#maplist").innerHTML = ents.length ? ents.map(([id, e]) => `<div class="row" data-id="${id}"><span class="mono">${hx(+id)}</span><span>${esc(e.name)}${e.pa ? ` <span class="cap-lbl">· editable</span>` : ` <span class="cap-lbl">· named only</span>`}</span><button type="button" class="btn" data-act="unmap" title="Remove">✕</button></div>`).join("")
      : `<div class="empty">No confirmed parameters yet.</div>`;
  }
  function confirmChange(row) {
    const id = +row.dataset.id, choice = row.querySelector("select").value, ch = MAPS.changes.get(id);
    if (!choice) return toast("Choose what you changed first", "warn");
    if (choice === "ignore") { if (!MAPD.ignored.includes(id)) MAPD.ignored.push(id); }
    else if (choice === "other") {
      const name = (prompt("Name for " + hx(id) + " (what did you change?)") || "").trim().slice(0, 60);
      if (!name) return;
      MAPD.entries[id] = { pa: null, name, user: true }; MAPD.removed = (MAPD.removed || []).filter(x => x !== id);
    } else {
      const c = CELLS.get(hex(choice)); if (!c) return;
      for (const [k, e] of Object.entries(MAPD.entries)) if (e.pa && hex(e.pa) === hex(c.param)) delete MAPD.entries[k];   // one device id per control
      const g = CHOICES.find(([, cs]) => cs.includes(c));
      MAPD.entries[id] = { pa: c.param, name: `${c.label} (${g ? g[0] : ""})`, user: true }; MAPD.removed = (MAPD.removed || []).filter(x => x !== id);
      if (ch && MODE === "pe") V.set(id, ch.to);   // we know its current value
    }
    MAPS.changes.delete(id); saveMap(); render(); renderMapper();
    toast(choice === "ignore" ? `${hx(id)} will be ignored` : `${hx(id)} confirmed`);
  }
  function exportMap() {
    const data = { app: "Play Studio", format: 1, device: MODE === "pe" ? "Play Electric" : "Play Acoustic", identity: L.identityMsg ? hexs(L.identityMsg) : null, created: new Date().toISOString(), entries: MAPD.entries, ignored: MAPD.ignored };
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = (MODE === "pe" ? "play-electric" : "play-acoustic") + "-map.json"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  async function importMap(file) {
    try {
      if (!L.ready || !MODE) throw new Error("connect the pedal first, so the map goes to the right model");
      const d = JSON.parse(await file.text());
      if (!d || typeof d.entries !== "object") throw new Error("not a Play Studio map");
      const want = MODE === "pe" ? "Play Electric" : "Play Acoustic";
      if (d.device !== want) throw new Error(`this map is for a ${d.device || "different pedal"}, but a ${want} is connected`);
      let n = 0;
      for (const [k, e] of Object.entries(d.entries)) {
        const id = +k; if (!Number.isInteger(id) || id < 0 || id > MAX_ID || !e || typeof e.name !== "string") continue;
        const pa = typeof e.pa === "string" && CELLS.has(hex(e.pa)) ? e.pa : null;
        if (pa) for (const [k2, e2] of Object.entries(MAPD.entries)) if (e2.pa && hex(e2.pa) === hex(pa)) delete MAPD.entries[k2];
        MAPD.entries[id] = { pa, name: e.name.slice(0, 60), user: true }; MAPD.removed = (MAPD.removed || []).filter(x => x !== id); const vals = cleanValues(e.values); if (vals) MAPD.entries[id].values = vals; const sc = cleanScale(e); if (sc) Object.assign(MAPD.entries[id], sc); n++;
      }
      for (const id of Array.isArray(d.ignored) ? d.ignored : []) if (Number.isInteger(id) && id >= 0 && id <= MAX_ID && !MAPD.ignored.includes(id)) MAPD.ignored.push(id);
      saveMap(); render(); renderMapper(); if (L.ready) syncSoon(50);
      toast(`Imported ${n} parameters`);
    } catch (err) { toast("Couldn't import: " + err.message, "warn", 4000); }
  }

  // ── UI wiring ───────────────────────────────────────────────────────────
  function setView(v) {
    view = v; store.set("view", v); document.body.dataset.view = v;
    for (const b of $$(".rail nav button")) { if (b.dataset.view === v) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); }
    for (const s of $$(".view")) s.hidden = s.id !== "v-" + v;
    updateFades();
    if (v === "mapa") renderMapper();
  }
  document.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b || b.disabled) return;
    const host = b.closest("[data-kind]");
    if (host && host.dataset.kind === "seg" && b.dataset.i != null) { const c = cellOf(host); return setParam(c, c.min + +b.dataset.i); }
    if (host && host.dataset.kind === "style" && b.dataset.d) {
      const c = cellOf(host), id = rid(c), v = id == null ? undefined : V.get(id); if (v == null) return;
      const n = c.max - c.min + 1; return setParam(c, c.min + ((v - c.min + +b.dataset.d) % n + n) % n);
    }
    if (b.dataset.kind === "chip") { selKey = b.dataset.fx; store.set("sel", selKey); return render(); }
    if (b.dataset.kind === "tile" && b.__held) { b.__held = false; return; }   // that was a hold or a level drag, not a tap
    if (b.dataset.always) { if (b.__held) { b.__held = false; return; }
      const f = fxList().find(x => x.key === b.dataset.fx), c = f && levelCell(f);
      return toast(`${f ? f.name : "This effect"} is always on. Drag sideways to change ${c ? c.label : "it"}.`, "", 2200); }
    if (b.dataset.kind === "tile") {
      // tap = on/off, but an effect set to HIT stays a HIT effect: it goes HIT ↔ OFF, never to plain ON
      const c = cellOf(b), id = rid(c), v = id == null ? undefined : V.get(id);
      if (id == null) return setParam(c, 0); if (v == null) return;
      if (v > 0) { lastOn.set(hex(c.param), v); return setParam(c, 0); }
      return setParam(c, lastOn.get(hex(c.param)) ?? 1);
    }
    if (b.dataset.step) { if (b.__held) { b.__held = false; return; } return stepPreset(+b.dataset.step); }
    if (b.dataset.save) return savePreset();
    if (b.id === "pe-note-x") { store.set("pe-note-off", true); return paintNote(); }
    if (b.id === "pe-note-go") { if (!L.identityMsg && L.pid !== 0x71) return trustAcoustic(); return setView("mapa"); }
    if (b.dataset.ab) return toggleAB();
    if (b.dataset.preset != null) return gotoPreset(+b.dataset.preset);
    if (b.id === "open-picker" || b.id === "open-picker2") return openPicker();
    if (b.id === "pick-close") { $("#picker").hidden = true; return; }
    if (b.id === "claude-open") return openClaude();
    if (b.id === "lib-export") return openExport();
    if (b.dataset.export) { $("#export-sheet").hidden = true; if (b.dataset.export !== "cancel") exportAll(b.dataset.export === "fav"); return; }
    if (b.dataset.fav) return toggleFav();
    if (b.id === "claude-close") { $("#claude").hidden = true; return; }
    if (b.id === "claude-copy") return claudeCopy();
    if (b.id === "claude-review") return claudeReview();
    if (b.id === "claude-apply") return claudeApply();
    if (b.id === "pop-close") return closePop();
    if (b.id === "lib-read") return scanPresets();
    if (b.id === "lib-cancel") { LIB.cancel = true; return; }
    if (b.id === "hit" || b.id === "hit2") return toggleHit();
    if (b.id === "talk" || b.id === "talk2") return talk();
    if (b.id === "loop-btn" || b.id === "loop2") return toggleLoop();
    if (b.dataset.view) return setView(b.dataset.view);
    if (b.dataset.goto) return setView(b.dataset.goto);
    if (b.dataset.g != null) { gsel = +b.dataset.g; return render(); }
    const row = b.closest(".row[data-id]");
    if (row && b.dataset.act === "confirm") return confirmChange(row);
    if (row && b.dataset.act === "drop") { MAPS.changes.delete(+row.dataset.id); return renderMapper(); }
    if (row && b.dataset.act === "unmap") { const id = +row.dataset.id; if (!confirm(tt(`Remove ${hx(id)} from the map?`))) return; delete MAPD.entries[id]; MAPD.removed = [...new Set([...(MAPD.removed || []), id])]; saveMap(); if (MODE === "pe") V.delete(id); render(); return renderMapper(); }
    switch (b.id) {
      case "undo": return undo();
      case "theme": { const r = document.documentElement, dark = r.dataset.theme ? r.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches; r.dataset.theme = dark ? "light" : "dark"; try { localStorage.setItem("ps-theme", r.dataset.theme); } catch {} return; }
      case "gate-connect": return connect();
      case "conn-btn": $("#drawer").hidden = !$("#drawer").hidden; renderDrawer(); paintLog(); return;
      case "drw-close": $("#drawer").hidden = true; return;
      case "drw-connect": {
        const o = $("#port-out").value, i = $("#port-in").value, ble = /widi|bluetooth|\bble\b/i.test($("#port-out").selectedOptions[0]?.text + " " + $("#port-in").selectedOptions[0]?.text);
        if (L.access && o && i) L.use(o, i, ble); else connect(); return;
      }
      case "drw-resync": if (!L.ready) return notConnected(); V.clear(); render(); return syncSoon(10);
      case "log-pause": logPaused = !logPaused; b.textContent = logPaused ? "Resume" : "Pause"; return;
      case "log-clear": LOG.length = 0; return paintLog();
      case "log-copy": { const txt = LOG.map(l => `${l.t} ${l.dir === "in" ? "<-" : "->"} ${l.line}${l.what ? "  " + l.what : ""}`).join("\n"); navigator.clipboard?.writeText(txt).then(() => toast("Copied"), () => toast("Couldn't copy", "warn")); return; }
      case "scan-btn": return scanAll();
      case "scan-stop": MAPS.stop = true; return;
      case "check-btn": return checkChanges();
      case "sim-turn": if (window.simPedal) { window.simPedal.turn(0x0D8, 3); toast("Simulated: GUITAR REVERB LEVEL +3 on the pedal"); } return;
      case "map-export": return exportMap();
      case "map-import": return $("#map-file").click();
    }
  });
  document.addEventListener("change", e => {
    const t = e.target;
    if (t.id === "map-file") { if (t.files[0]) importMap(t.files[0]); t.value = ""; return; }
    const host = t.closest("[data-kind]");
    if (host && (host.dataset.kind === "select" || host.dataset.kind === "style") && t.tagName === "SELECT") setParam(cellOf(host), +t.value);
  });
  document.addEventListener("input", e => {
    const host = e.target.closest("[data-kind='slide']");
    if (host) { setParam(cellOf(host), +e.target.value); }
  });
  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z" && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); undo(); }
    if (e.key === "Escape") { $("#export-sheet").hidden = true; $("#drawer").hidden = true; $("#claude").hidden = true; if (!LIB.busy) $("#picker").hidden = true; if (popKey) closePop(); }
  });
  $("#picker").addEventListener("click", e => { if (e.target === e.currentTarget && !LIB.busy) e.currentTarget.hidden = true; });
  $("#genre-sel").addEventListener("change", e => { const t = +e.target.value; if (t !== P.genre) setGenre(t); });
  $("#export-sheet").addEventListener("click", e => { if (e.target === e.currentTarget) e.currentTarget.hidden = true; });
  // search: type to filter, Enter goes to the first match
  $("#plist-q").addEventListener("input", () => paintPicker());
  $("#plist-q").addEventListener("keydown", e => {
    if (e.key === "Enter") { const b = $("#plist .pitem"); if (b) { e.preventDefault(); b.click(); } }
    if (e.key === "Escape" && e.target.value) { e.stopPropagation(); e.target.value = ""; paintPicker(); }
  });
  // hold a preset arrow (top bar or Stage) for half a second: jump 10 presets in the current list
  for (const b of $$("[data-step]")) {
    let t = 0;
    const cancel = () => clearTimeout(t);
    b.addEventListener("pointerdown", e => {
      if (e.button > 0) return; b.__held = false; cancel();
      t = setTimeout(async () => {
        b.__held = true;
        if (!L.ready || walking || stepping) return;
        let cur = P.num;
        if (cur == null) { if (!(await refreshNum())) return; cur = await L.get(PRESET_REG()); }   // number not known yet: confirm it first
        const vis = visibleNums(), i = vis.indexOf(cur); if (i < 0 || !vis.length) return;
        const j = Math.max(0, Math.min(vis.length - 1, i + 10 * +b.dataset.step));
        if (j !== i) { toast(`Going to preset ${vis[j]}…`, "", 1500); gotoPreset(vis[j]); }
      }, 500);
    });
    for (const ev of ["pointerup", "pointerleave", "pointercancel"]) b.addEventListener(ev, cancel);
    b.addEventListener("contextmenu", e => e.preventDefault());
  }
  $("#claude").addEventListener("click", e => { if (e.target === e.currentTarget) e.currentTarget.hidden = true; });
  $("#fxpop").addEventListener("click", e => { if (e.target === e.currentTarget) closePop(); });

  async function connect(auto = false) {
    $("#gate-status").textContent = "Asking for MIDI access…";
    const ok = await L.start({ auto });
    if (!ok) $("#gate-status").textContent = L.message;
    renderDrawer();
  }

  // ── liquid glass: the light inside a control follows the finger / pointer ──
  // Sets --mx / --my (percent of the control) and .lit on the control under the pointer; on touch the light
  // stays a moment after the finger lifts, like a reflection fading.
  const LIVE = ".fx, .tile, .hitbar, .btn, .arrow, .icon-btn, .big-arrow, .hit, .pitem, .style .step, .pbtn";
  let liveEl = null, liveQ = 0, lx = 0, ly = 0, liveT = 0;
  const lightAt = () => {
    liveQ = 0; if (!liveEl) return;
    const r = liveEl.getBoundingClientRect(); if (!r.width || !r.height) return;
    liveEl.style.setProperty("--mx", ((lx - r.left) / r.width * 100).toFixed(1) + "%");
    liveEl.style.setProperty("--my", ((ly - r.top) / r.height * 100).toFixed(1) + "%");
  };
  function track(e) {
    lx = e.clientX; ly = e.clientY;
    const el = e.target && e.target.closest ? e.target.closest(LIVE) : null;
    if (el !== liveEl) { if (liveEl) liveEl.classList.remove("lit"); liveEl = el; if (el) el.classList.add("lit"); }
    clearTimeout(liveT);
    if (e.type === "pointerdown") lightAt();   // a touch lights up exactly where the finger landed
    else if (!liveQ) liveQ = requestAnimationFrame(lightAt);
  }
  document.addEventListener("pointermove", track, { passive: true });
  document.addEventListener("pointerdown", track, { passive: true });
  document.addEventListener("pointerup", e => {
    if (e.pointerType === "mouse") return;
    clearTimeout(liveT); liveT = setTimeout(() => { if (liveEl) liveEl.classList.remove("lit"); liveEl = null; }, 350);
  }, { passive: true });
  document.documentElement.addEventListener("pointerleave", () => { if (liveEl) liveEl.classList.remove("lit"); liveEl = null; });
  // a short swell when an effect's state changes (from a tap here or from the pedal)
  function popOnChange(el, state) {
    const prev = el.dataset.prevState; el.dataset.prevState = state;
    if (prev == null || prev === state || prev === "unk" || state === "unk") return;
    el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop");
  }
  document.addEventListener("animationend", e => { if (e.animationName === "pop") e.target.classList.remove("pop"); });

  // ── scroll fades: no scrollbars; an edge fades out only while there is more content beyond it ──
  const SCROLLERS = ".links, .d-params, .plist, .table, .log, .groups, #group, .fxpop-card .detail, .stage-links, .chains";
  const FADE = "28px";
  function updateFade(el) {
    const sx = el.scrollWidth - el.clientWidth > 2, sy = el.scrollHeight - el.clientHeight > 2;
    const l = sx && el.scrollLeft > 2, r = sx && el.scrollLeft < el.scrollWidth - el.clientWidth - 2;
    const t = sy && el.scrollTop > 2, b = sy && el.scrollTop < el.scrollHeight - el.clientHeight - 2;
    el.style.setProperty("--fl", l ? FADE : "0px"); el.style.setProperty("--fr", r ? FADE : "0px");
    el.style.setProperty("--ft", t ? FADE : "0px"); el.style.setProperty("--fb", b ? FADE : "0px");
    el.classList.toggle("faded", l || r || t || b);
  }
  let fadeQ = 0;
  const updateFades = () => { if (!fadeQ) fadeQ = requestAnimationFrame(() => { fadeQ = 0; for (const el of $$(SCROLLERS)) updateFade(el); }); };
  document.addEventListener("scroll", e => { const el = e.target; if (el instanceof Element && el.matches(SCROLLERS)) updateFade(el); }, { capture: true, passive: true });
  addEventListener("resize", updateFades);
  // content changes (views built, values painted, lists filled) can change what overflows
  new MutationObserver(updateFades).observe(document.body, { childList: true, subtree: true });

  // ── start ───────────────────────────────────────────────────────────────
  try { const t = localStorage.getItem("ps-theme"); if (t === "light" || t === "dark") document.documentElement.dataset.theme = t; } catch {}
  loadMap(); render(true); setView(["editor", "mix", "ajustes", "palco", "pedal", "mapa"].includes(view) ? view : "palco"); wirePedalPanel(); renderMapper(); renderDrawer();
  if (SIM) connect(true);
  else if (navigator.permissions && navigator.requestMIDIAccess) navigator.permissions.query({ name: "midi", sysex: true }).then(r => { if (r.state === "granted") connect(true); }).catch(() => {});
  if (!navigator.requestMIDIAccess) $("#gate-status").textContent = "This browser has no Web MIDI. Use Chrome or Edge, or the MidiWeb app on iPad / iPhone.";
  window.PlayStudio = { V, P, get MODE() { return MODE; }, MAPS, MAPD: () => MAPD, render, syncAll, fxList: () => fxList(), rid: c => rid(c),
    saveMap: () => { saveMap(); render(true); renderMapper(); } };   // apply a map edited from the console without reloading   // for debugging in the console
})();
