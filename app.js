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
  const P = { num: null, name: null, edited: false };
  const clamp = (c, v) => Math.max(c.min, Math.min(c.max, Math.round(v)));

  // ── value formats (same rules as open-acoustic views.js) ────────────────
  const trim = (n, d) => (+(+n).toFixed(d)).toString();
  function lerp(pts, v) {
    if (!pts || !pts.length) return v; if (v <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) if (v <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + (y1 - y0) * (v - x0) / (x1 - x0); }
    return pts[pts.length - 1][1];
  }
  function fmt(c, v) {
    if (v == null) return "··";
    if (c.values) return c.values[v - c.min] ?? String(v);
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
        <p class="hint">Drag or scroll the knobs. Shift = fine. Double-click = default.</p></div>
      <div class="d-params">${f.groups.map(([t, cs]) => { const nums = cs.filter(c => !c.values), lists = cs.filter(c => c.values);
        return `${f.groups.length > 1 ? `<div class="group-lbl cap-lbl">${esc(t)}</div>` : ""}${nums.length ? `<div class="knobs">${nums.map(knobHTML).join("")}</div>` : ""}${lists.length ? `<div class="rows">${lists.map(rowHTML).join("")}</div>` : ""}`; }).join("")}</div>`;
    d.dataset.fxbox = f.key;   // paint() keeps the picture and the state of this box up to date
    wireKnobs(d);
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
      + `<div class="locked"><b>MIDI locked</b>MIDI CTRL, FILTER, SYSEXID and the channels are left out on purpose: changing them can lock out USB control.</div>`;
    const [t, cs] = groups[gsel];
    $("#group").innerHTML = `<h2>${esc(t)} <span class="cap-lbl" style="margin-left:8px">global</span></h2><div class="rows">${cs.map(rowHTML).join("")}</div>`
      + `<p class="locked-sm"><b>MIDI locked:</b> MIDI CTRL, FILTER, SYSEXID and the channels are left out on purpose.</p>`;   // phones (the side card is hidden there)
    const selBtn = $("#groups [aria-selected='true']"); if (selBtn && selBtn.scrollIntoView && innerWidth <= 700) selBtn.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
  function buildStage() {
    const fx = fxList().filter(f => f.control);
    const pad = f => `<button type="button" class="tile" data-kind="tile" data-fx="${f.key}" data-param="${f.control.param}" aria-pressed="false" title="${esc(f.name)}: tap = on/off · hold = edit" style="--fx:var(--c-${f.id})"><span class="tflag"><small>··</small><span class="tl"></span></span>${art(imgOf(f))}<span class="tname"><b>${esc(f.name)}</b></span></button>`;
    $("#tiles").innerHTML = [["Vocal", "voz"], ["Guitar", "gtr"]].map(([label, side]) =>
      `<div class="stage-row"><span class="cap-lbl">${label}</span><div class="stage-links">${fx.filter(f => f.side === side).map(pad).join("")}</div></div>`).join("")
      + `<div class="stage-row"><span class="cap-lbl">Footswitch</span><div class="stage-links"><button type="button" class="hitbar" id="hit2" aria-pressed="false"><i></i>HIT</button>`
      + `<button type="button" class="hitbar talkbar tapbar" id="tap2" title="Tap the beat: sets the preset's TEMPO, which every tempo-synced effect follows"><span class="tk"><i></i>TAP</span><small></small></button>`
      + `<button type="button" class="hitbar talkbar" id="talk2" aria-pressed="false" title="Each tap holds HIT for 1.3 s, like holding the footswitch"><span class="tk"><i></i>TALK</span><small></small></button></div></div>`;
    $("#tap2").addEventListener("pointerdown", e => { if (e.button > 0) return; e.preventDefault(); tapTempo(); });   // on touch-down: taps land on the beat
    $("#tap2").addEventListener("keydown", e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); tapTempo(); } });
    // tap = on/off (the click handler); hold 450 ms = open this effect's editor. A hold never also toggles.
    for (const t of $$("#tiles .tile")) {
      let timer = 0, x0 = 0, y0 = 0;
      const cancel = () => clearTimeout(timer);
      t.addEventListener("pointerdown", e => {
        if (e.button > 0) return; t.__held = false; x0 = e.clientX; y0 = e.clientY;
        timer = setTimeout(() => { t.__held = true; openPop(t.dataset.fx); }, 450);
      });
      t.addEventListener("pointermove", e => { if (Math.hypot(e.clientX - x0, e.clientY - y0) > 10) cancel(); });
      t.addEventListener("pointerup", cancel); t.addEventListener("pointercancel", cancel); t.addEventListener("pointerleave", cancel);
      t.addEventListener("contextmenu", e => e.preventDefault());   // no long-press menu on touch screens
      t.addEventListener("keydown", e => { if ((e.key === "e" || e.key === "E" || (e.key === "Enter" && e.shiftKey))) { e.preventDefault(); openPop(t.dataset.fx); } });   // keyboard: E or Shift+Enter edits
    }
  }
  // the effect editor popup (Stage → hold a tile)
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
    $("#s-edit").hidden = !ready; $("#s-edit .edited").hidden = !P.edited;
    for (const b of $$("[data-save]")) { b.hidden = b.closest("#s-edit") ? false : !ready; b.classList.toggle("quiet", !P.edited); b.disabled = saving; b.textContent = saving ? "Saving…" : "Save"; }
    const hitC = CELLS.get(ID.HIT), hitId = rid(hitC), hv = hitId == null ? undefined : V.get(hitId);
    for (const b of [$("#hit"), $("#hit2")]) if (b) { b.setAttribute("aria-pressed", hv === 1); popOnChange(b, hv == null ? "unk" : String(hv)); b.title = hitId == null ? "Sends a HIT footswitch press (state unknown on this pedal)" : "HIT on / off"; }
    document.body.classList.toggle("talking", ready && talkOn);   // TALK on: everything greys out except TALK
    const tb = $("#tap2"); if (tb) { const bpm = valOf(TEMPO); tb.querySelector("small").textContent = tapHint || (bpm == null ? "TAP TEMPO" : bpm + " BPM"); }
    for (const b of [$("#talk"), $("#talk2")]) if (b) { b.setAttribute("aria-pressed", talkOn); popOnChange(b, String(talkOn)); b.classList.toggle("sending", talkSending); const s = b.querySelector("small"); if (s) s.textContent = talkOn ? "FX MUTED · TAP TO SING" : "MUTE FX BETWEEN SONGS"; }
    $("#undo").setAttribute("aria-disabled", history.length ? "false" : "true");
    $("#pe-note").hidden = MODE !== "pe";
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
    const raw = store.get(LIB_KEY(), null); lib = blankLib();
    if (!raw || typeof raw.presets !== "object" || !raw.presets) return;
    for (const [k, e] of Object.entries(raw.presets)) {
      const n = Number(k);
      if (!Number.isInteger(n) || n < 0 || n > 65535 || !e || !Array.isArray(e.vals)) continue;
      lib.presets[n] = { name: typeof e.name === "string" ? e.name.slice(0, 15) : "", t: Number(e.t) || 0,
        vals: e.vals.filter(p => Array.isArray(p) && Number.isInteger(p[0]) && Number.isInteger(p[1]) && CELLS.has(p[0]) && !GLOBAL.has(p[0])) };
    }
    lib.storeAt = Number(raw.storeAt) || 0; lib.readAt = Number(raw.readAt) || 0;
    lib.pcOffset = Number.isInteger(raw.pcOffset) ? raw.pcOffset : null;
    lib.pcWorks = typeof raw.pcWorks === "boolean" ? raw.pcWorks : null;
    lib.wraps = typeof raw.wraps === "boolean" ? raw.wraps : null;
  }
  const saveLib = () => store.set(LIB_KEY(), lib);
  const libEntry = n => { const e = lib.presets[n]; return e && e.t > lib.storeAt ? e : null; };
  const presetVals = () => [...CELLS.keys()].filter(id => !GLOBAL.has(id) && V.has(id)).map(id => [id, V.get(id)]);
  function libPut(n, name, vals) { lib.presets[n] = { name: name || "", t: Date.now(), vals }; saveLib(); paintPicker(); }

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
    const nm = await L.presetName(); if (!alive()) return;
    // The Play Electric sends no Program Change when its preset changes (seen on a real unit, 2026-11-25), so a new
    // preset shows up as a new name here: treat it as a preset change (drop old values, re-read).
    if (MODE === "pe" && !walking && P.name && nm && nm !== P.name) { presetChanged(null); return; }
    P.name = nm ?? ""; paintChrome();   // "" = no name / no answer
    const got = await L.getBatch(readIds(), { alive, each: (id, v) => { if (!recent(id)) { V.set(id, v); schedulePaint(); } } });
    if (got && alive() && fresh && n != null) libPut(n, P.name, MODE === "pa" ? presetVals() : []);   // keep it for next time (Electric: name only)
  }
  let syncT = 0; const syncSoon = ms => { clearTimeout(syncT); syncT = setTimeout(syncAll, ms); };
  // a preset change on the pedal: show it from the library if we have it, else "··"; then read it from the pedal
  function presetChanged(prog) {
    gen++; resetWrites(); P.edited = false; P.name = null; clearHistory(); fresh = true; lastOn.clear(); numOk = true;
    if (MODE === "pe") P.num = null;
    for (const id of [...V.keys()]) if (MODE === "pe" || !GLOBAL.has(id)) V.delete(id);
    if (MODE === "pa") {
      P.num = null;
      const num = prog != null && lib.pcOffset != null ? prog + lib.pcOffset : null, e = num != null ? libEntry(num) : null;
      if (e) { P.num = num; P.name = e.name; for (const [id, v] of e.vals) V.set(id, v); }
    }
    render(); syncSoon(30);
  }
  let stepping = false;
  // a preset step confirmed: Program Change on the Acoustic; on the Electric (which sends none) the register moves
  const armStep = (prev, ms) => MODE === "pa" ? waitProgram(ms) : (async () => {
    const t0 = performance.now(); await delay(150);
    while (performance.now() - t0 < ms && L.ready) { const v = await L.get(PRESET_REG()); if (v != null && v !== prev) return v; await delay(120); }
    return null;
  })();
  // make the Electric's register trustworthy: one step forward and back (lands on the same preset)
  async function refreshNum() {
    if (MODE !== "pe" || numOk) return true;
    let cur = await L.get(PRESET_REG()); let w = armStep(cur, 2000); await L.press(L.EVT.next); if ((await w) == null) return false;
    cur = await L.get(PRESET_REG()); w = armStep(cur, 2000); await L.press(L.EVT.prev); if ((await w) == null) return false;
    numOk = true; return true;
  }
  const waitProgram = ms => new Promise(res => { const off = L.on("program", p => { off(); clearTimeout(t); res(p); }); const t = setTimeout(() => { off(); res(null); }, ms); });
  async function stepPreset(d) {
    if (!L.ready) return notConnected(); if (stepping || walking) return; stepping = true;
    try {
      const code = d > 0 ? L.EVT.next : L.EVT.prev;
      // Play Acoustic: a Program Change confirms the step. Play Electric sends none, so compare the preset name.
      const name0 = MODE === "pe" ? await L.presetName() : null;
      const changed = async w => { if ((await w) != null) return true; if (MODE !== "pe") return false; const n = await L.presetName(); return n != null && n !== name0; };
      let w = waitProgram(900); await L.press(code);
      if (await changed(w)) { if (MODE === "pe") presetChanged(null); return; }
      // no preset change: the pedal is probably inside a menu, where ◀ ▶ change pages. BACK, then try once more.
      w = waitProgram(900); await L.press(L.EVT.back); await delay(150); await L.press(code);
      if (await changed(w)) { if (MODE === "pe") presetChanged(null); return; }
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
    if (MODE === "pa" && L.ready) { await delay(300); const v = await L.get(ID.HIT); if (v != null && L.ready) { V.set(ID.HIT, v); paint(); } }   // in case the hold changed HIT
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
    // LOOP: per the manual, hold DOWN and UP together to enter / leave Loop mode. Sends both presses, the "held"
    // stream for both for 1.5 s, then both releases. In Loop mode ▼ = play/rec/overdub (hold: undo), ▲ = stop (hold: erase).
    const lb = $("#loop-btn");
    if (lb) lb.addEventListener("click", async () => {
      if (!L.ready) return notConnected(); if (walking || lb.classList.contains("down")) return;
      lb.classList.add("down");
      L.inject(0xDB, L.EVT.fswDown, 0x00); L.inject(0xDB, L.EVT.fswUp, 0x00);
      const t = setInterval(() => { L.inject(0xDB, L.EVT.fswDown, 0x02); L.inject(0xDB, L.EVT.fswUp, 0x02); }, 200);
      try { await delay(1500); } finally { clearInterval(t); L.inject(0xDB, L.EVT.fswDown, 0x01); L.inject(0xDB, L.EVT.fswUp, 0x01); lb.classList.remove("down"); }
      afterPanel(null);
    });
  }
  // after using the pedal's controls: re-read (a knob turn inside a menu changes a value) and check the MIDI guard
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
  async function savePreset() {
    if (!L.ready) return notConnected(); if (saving || walking || stepping) return;
    saving = true; paintChrome(); flush();
    try {
      await delay(150);
      await L.press(L.EVT.store); await delay(700);
      await L.press(L.EVT.store); await delay(700);
      await L.press(L.EVT.back); await delay(300);
      P.edited = false; fresh = true; clearHistory();
      lib.storeAt = Date.now(); saveLib();
      toast(MODE === "pe" ? "Saved: pressed STORE twice (experimental on the Play Electric). Check the pedal's screen." : "Saved on the pedal (STORE, STORE). Check the pedal's screen.", "", 3500);
      syncSoon(50);   // re-read; a fresh, unedited read also refreshes this preset in the library
    } finally { saving = false; paintChrome(); }
  }

  // ── MIDI guard: MIDI CTRL = MIDI, or FILTER = SYSEX / PC+SYSEX, locks USB control out after the next power-up.
  // The app never writes them, but the pedal's own knob (real or from the Pedal view) can. Reading is harmless,
  // so after controls are used the app reads both and shows a red warning while either is in a locking value.
  // (Play Acoustic IDs; on a Play Electric those IDs are unconfirmed, so the guard stays off there.)
  const MIDI_CTRL = 0x278, MIDI_FILTER = 0x27B;
  const CTRL_NAMES = ["MERGE", "MIDI", "USB"], FILTER_NAMES = ["NONE", "PRGCHANGE", "SYSEX", "PC+SYSEX"];
  let guardBusy = false;
  async function checkMidiGuard() {
    if (MODE !== "pa" || !L.ready || guardBusy) return; guardBusy = true;
    try {
      const ctrl = await L.get(MIDI_CTRL), filt = await L.get(MIDI_FILTER);
      const bad = [];
      if (ctrl === 1) bad.push(`MIDI CTRL is <b>MIDI</b> (set it back to USB or MERGE)`);
      if (filt === 2 || filt === 3) bad.push(`FILTER is <b>${FILTER_NAMES[filt]}</b> (set it back to NONE)`);
      const a = $("#midi-alarm");
      a.hidden = !bad.length;
      if (bad.length) a.innerHTML = `<b>⚠ USB control will stop working after the pedal is switched off.</b> ${bad.join(" · ")}. Fix it on the pedal (SETUP › MIDI) before turning it off. <span class="cap-lbl">now: CTRL ${CTRL_NAMES[ctrl] ?? "?"} · FILTER ${FILTER_NAMES[filt] ?? "?"}</span>`;
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
      let d = n - cur; if (roundTrip && Math.abs(d) > span / 2) d = d > 0 ? d - span : d + span;
      $("#lib-status").textContent = `Going to preset ${n}… (now ${cur})`;
      const code = d > 0 ? L.EVT.next : L.EVT.prev;
      for (let i = 0; i < Math.abs(d) && !LIB.cancel && L.ready; i++) { await L.press(code); await delay(70); }
      await delay(MODE === "pe" ? 700 : 450); cur = await L.get(PRESET_REG());
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
    try {
      if (!(await refreshNum())) toast("The pedal didn't change preset. Is it on its preset screen?", "warn", 3500);
      else await moveTo(n);
    } finally { walking = false; LIB.busy = false; lastProg = null; presetChanged(null); paintPicker(); }
  }
  // Read every preset's name (and, on the Play Acoustic, all its values) by stepping with ▶ until the list comes
  // round to the start, or, on a pedal that stops at its last preset, until the end and then with ◀ from the start
  // down to the first one. Then back to the start. Unsaved edits on the current preset are lost.
  async function readAllPresets() {
    if (!L.ready) return notConnected(); if (!MODE || walking || stepping) return;
    if (P.edited && !confirm(tt("Reading all presets changes presets on the pedal, so unsaved edits on this preset will be lost. Continue?"))) return;
    walking = true; LIB.busy = true; LIB.cancel = false; paintPicker();
    const quit = msg => { walking = false; LIB.busy = false; paintPicker(); toast(msg, "warn", 3500); };
    if (!(await refreshNum())) return quit("The pedal didn't change preset. Is it on its preset screen?");
    const start = await L.get(PRESET_REG()); if (start == null) return quit("Couldn't read the preset number");
    const t0 = performance.now(), known = Object.keys(lib.presets).length || null, seen = new Set(), ids = MODE === "pa" ? readIds().filter(id => CELLS.has(id) && !GLOBAL.has(id)) : [];   // Electric: names only
    let count = 0, cur = start, failed = false;
    const tell = () => {
      const per = count ? (performance.now() - t0) / count : null, left = known && per ? Math.max(0, known - count) * per / 1000 : null;
      $("#lib-status").textContent = `Reading presets… ${count}${known ? " / " + known : ""}${left != null ? ` · ~${left < 90 ? Math.round(left) + " s" : Math.round(left / 60) + " min"} left` : ""}`;
      $("#lib-bar").hidden = !known; if (known) $("#lib-bar i").style.width = Math.min(100, count / known * 100) + "%";
    };
    const step = async code => {   // one confirmed step; null = the pedal didn't move (end of the list, or not on the preset screen)
      const w = armStep(cur, 1500); await L.press(code); const prog = await w;
      if (prog == null) return null;
      const n = await L.get(PRESET_REG()); return n == null ? null : { n, prog };
    };
    const take = async (n, prog) => {   // read the preset the pedal is on now
      seen.add(n); cur = n;
      if (MODE === "pa" && prog != null && lib.pcOffset !== n - prog) lib.pcOffset = n - prog;   // Program Change number → preset number
      const name = await L.presetName(), vals = [];
      const got = ids.length ? await L.getBatch(ids, { alive: () => !LIB.cancel && L.ready, each: (id, v) => vals.push([id, v]) }) : {};
      if (!got) return false;
      libPut(n, name ?? "", vals); count++; tell(); return true;
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
      if (ended && !count) failed = true;   // didn't move at all: not on the preset screen
      if (ended && count && !LIB.cancel && L.ready) {   // stopped at the last preset: no wrap; read the start and below it with ◀
        lib.wraps = false;
        cur = await moveTo(start);
        if (cur === start && await take(start, null)) {
          for (let i = 0; i < 600 && !LIB.cancel && L.ready; i++) {
            const r = await step(L.EVT.prev);
            if (!r || seen.has(r.n)) break;
            if (!(await take(r.n, r.prog))) { failed = true; break; }
          }
        }
      }
      if (!failed && !LIB.cancel) { lib.readAt = Date.now(); lib.storeAt = Math.min(lib.storeAt, lib.readAt - 1); }
      saveLib();
    } finally {
      walking = false;
      if (cur !== start && L.ready) { LIB.busy = false; await gotoPreset(start); }   // gotoPreset re-reads at the end
      else { LIB.busy = false; lastProg = null; presetChanged(null); }
      paintPicker();
      if (failed && !count) toast("The pedal didn't change preset. Is it on its preset screen?", "warn", 3500);
      else toast(LIB.cancel ? `Stopped after ${count} presets` : `Read ${count} presets in ${Math.round((performance.now() - t0) / 1000)} s`, "", 3500);
    }
  }
  function paintPicker() {
    const pk = $("#picker"); if (!pk || pk.hidden) return;
    const pa = !!MODE, ents = Object.entries(lib.presets).map(([n, e]) => [+n, e]).sort((a, b) => a[0] - b[0]);
    const stale = ents.filter(([n]) => !libEntry(n)).length;
    $("#lib-info").textContent = !pa ? "" : ents.length ? `${ents.length} presets${stale ? ` · ${stale} may be outdated` : ""}${lib.readAt ? " · read " + new Date(lib.readAt).toLocaleDateString() : ""}` : "no presets read yet";
    $("#lib-read").hidden = !pa || LIB.busy; $("#lib-cancel").hidden = !LIB.busy; if (!LIB.busy) $("#lib-bar").hidden = true; $("#pick-close").hidden = LIB.busy;
    if (!LIB.busy) $("#lib-status").textContent = ents.length ? "Tap a preset to go to it." : "Read all presets once (about 2 s each) to see every preset here and switch instantly.";
    $("#plist").innerHTML = ents.map(([n, e]) => `<button type="button" class="pitem" data-preset="${n}" ${n === P.num ? 'aria-current="true"' : ""} ${LIB.busy ? "disabled" : ""}>
      <span class="mono">${n}</span><b>${esc(e.name || "(no name)")}</b>${libEntry(n) ? "" : `<small class="badge">outdated</small>`}</button>`).join("");
  }
  function openPicker() { if (!L.ready) return notConnected(); $("#picker").hidden = false; paintPicker(); }

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
    const rows = [], bad = [];
    for (const [fxName, params] of Object.entries(changes)) {
      const fx = find(idx, fxName);
      if (!fx || !params || typeof params !== "object") { bad.push(`${fxName}: not an effect this pedal has (or it isn't editable)`); continue; }
      for (const [pk, want0] of Object.entries(params)) {
        const p = find(fx[1], pk); if (!p) { bad.push(`${fx[0]} · ${pk}: unknown parameter`); continue; }
        const c = p[1], cur = V.get(rid(c)); let want = want0 && typeof want0 === "object" && "value" in want0 ? want0.value : want0, v;
        if (c.values) { const i = c.values.findIndex(s => s.trim().toUpperCase() === String(want).trim().toUpperCase()); if (i < 0) { bad.push(`${fx[0]} · ${p[0]}: "${want}" isn't an option`); continue; } v = c.min + i; }
        else { v = Number(want); if (!Number.isInteger(v) || v < c.min || v > c.max) { bad.push(`${fx[0]} · ${p[0]}: ${want} is outside ${c.min}…${c.max}`); continue; } }
        if (v === cur) continue;
        claudePlan.push({ c, v }); rows.push(`<li><span>${esc(fx[0])} · <b>${esc(p[0])}</b></span><span class="mono">${esc(fmt(c, cur))} → <b>${esc(fmt(c, v))}</b></span></li>`);
      }
    }
    const other = data.preset && P.name && String(data.preset).trim() !== P.name.trim() ? `<p class="warnline">That text was made for "${esc(data.preset)}"; the pedal is now on "${esc(P.name)}".</p>` : "";
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
  function openClaude() { if (!L.ready) return notConnected(); $("#picker").hidden = true; $("#claude").hidden = false; $("#claude-copied").textContent = ""; $("#claude-out").hidden = true; }

  // ── link events ─────────────────────────────────────────────────────────
  L.on("ready", () => {
    // Full Acoustic editing only for a pedal that really identified itself as a Play Acoustic.
    // A Play Electric, or a link with no identity reply (e.g. Bluetooth "unconfirmed"), gets the protected mode.
    const confirmedPA = L.pid === 0x70 && !!L.identityMsg;
    MODE = confirmedPA ? "pa" : "pe"; loadMap(); loadLib(); walking = false; lastProg = null; fresh = false; talkOn = false; pedalTalk = false;
    gen++; resetWrites(); V.clear(); P.num = null; P.name = null; P.edited = false; clearHistory();
    MAPS.base.clear(); MAPS.changes.clear(); MAPS.stop = false; MAPS.again = false;
    $("#midi-alarm").hidden = true;
    render(true); syncAll(); checkMidiGuard(); renderMapper(); renderDrawer();
    // Every connection of a Play Acoustic reads all presets, so the list is always current (the user asked for it).
    // It walks the pedal through every preset and comes back; "Stop" in the preset list ends it early.
    const conn = ++connN;
    numOk = MODE === "pa";
    if (confirmedPA || L.pid === 0x71) {
      setTimeout(() => { if (conn === connN && L.ready && !walking && !stepping && !P.edited) { toast("Connected: reading all presets for the list…", "", 4000); readAllPresets(); } }, 3000);
    }
    toast(L.pid === 0x71 ? "Connected: Play Electric (protected mode)" : confirmedPA ? "Connected: Play Acoustic" : "Connected, but the pedal didn't identify itself: protected mode", confirmedPA || L.pid === 0x71 ? "" : "warn", 4000);
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
    if (MODE === "pa" && e.e0 === 0xDB && e.e1 === L.EVT.hit) {   // HIT on the unit: only HIT changes
      clearTimeout(hitT); hitT = setTimeout(async () => { const v = await L.get(ID.HIT); if (v != null) { V.set(ID.HIT, v); paint(); } }, 150); return;
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
    if (b.dataset.kind === "tile" && b.__held) { b.__held = false; return; }   // that was a hold: the editor opened
    if (b.dataset.kind === "tile") {
      // tap = on/off, but an effect set to HIT stays a HIT effect: it goes HIT ↔ OFF, never to plain ON
      const c = cellOf(b), id = rid(c), v = id == null ? undefined : V.get(id);
      if (id == null) return setParam(c, 0); if (v == null) return;
      if (v > 0) { lastOn.set(hex(c.param), v); return setParam(c, 0); }
      return setParam(c, lastOn.get(hex(c.param)) ?? 1);
    }
    if (b.dataset.step) return stepPreset(+b.dataset.step);
    if (b.dataset.save) return savePreset();
    if (b.dataset.preset != null) return gotoPreset(+b.dataset.preset);
    if (b.id === "open-picker" || b.id === "open-picker2") return openPicker();
    if (b.id === "pick-close") { $("#picker").hidden = true; return; }
    if (b.id === "claude-open") return openClaude();
    if (b.id === "claude-close") { $("#claude").hidden = true; return; }
    if (b.id === "claude-copy") return claudeCopy();
    if (b.id === "claude-review") return claudeReview();
    if (b.id === "claude-apply") return claudeApply();
    if (b.id === "pop-close") return closePop();
    if (b.id === "lib-read") return readAllPresets();
    if (b.id === "lib-cancel") { LIB.cancel = true; return; }
    if (b.id === "hit" || b.id === "hit2") return toggleHit();
    if (b.id === "talk" || b.id === "talk2") return talk();
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
    if (e.key === "Escape") { $("#drawer").hidden = true; $("#claude").hidden = true; if (!LIB.busy) $("#picker").hidden = true; if (popKey) closePop(); }
  });
  $("#picker").addEventListener("click", e => { if (e.target === e.currentTarget && !LIB.busy) e.currentTarget.hidden = true; });
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
  window.PlayStudio = { V, P, get MODE() { return MODE; }, MAPS, MAPD: () => MAPD, render, syncAll,
    saveMap: () => { saveMap(); render(true); renderMapper(); } };   // apply a map edited from the console without reloading   // for debugging in the console
})();
