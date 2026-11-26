// ─────────────────────────────────────────────────────────────────────────────────────────────
// Copied from github.com/michaelbeyhs/open-acoustic (tools/pa-link.js, commit 79a6e8d, 2026-11-19).
// Play Studio patches, each marked "PLAY STUDIO": a "raw" event for the MIDI monitor (in + out),
// the raw identity reply kept in L.identityMsg, MIDI CHAN / CC CHAN / SYSEXID added to BLOCKED, and L.scan
// (ask every MIDI port for its identity when no port name matches).
// Everything else is unchanged.
// ─────────────────────────────────────────────────────────────────────────────────────────────
// Play Acoustic link: Web MIDI + the firmware's built-in SysEx commands, with no UI.
// Shared by the touch views (tools/views). The protocol is the one pa-remote.html uses (see docs/SYSEX.md):
//   identity  F0 7E 7F 06 01 F7                      → reply names TC-Helicon 00 01 38, product 70/71
//   set       F0 00 01 38 <ch> <pid> 22 <id hi> <id lo> <28-bit value> F7
//   get       … 47 <id hi> <id lo> F7                  → reply … 22 <id> <value>
//   preset    … 45 00 00 F7                            → reply … 20 … with the current preset's 15-byte name
//   panel     … 55 01 01 00 00 00 = echo panel events; … 55 02 <e0 e1 e2> = inject one (press/hold/release)
(function () {
  const PA_PORT = /play\s*acoustic|play\s*electric|helicon/i, BLE_PORT = /widi|bluetooth|\bble\b/i;
  // Never written: refused by the firmware, or able to lock USB SysEx out until a factory reset (MIDI CTRL, FILTER).
  // PLAY STUDIO: + 0x279 MIDI CHAN, 0x27A CC CHAN, 0x27C SYSEXID (not dangerous for USB SysEx, but no reason to touch them)
  const BLOCKED = new Set([0x95, 0x96, 0x97, 0x98, 0x26D, 0x26E, 0x278, 0x279, 0x27A, 0x27B, 0x27C]);
  const EVT = { next: 0x04, prev: 0x05, store: 0x03, back: 0x06, hit: 0x0B, fswUp: 0x0C, fswDown: 0x0D };
  const delay = ms => new Promise(r => setTimeout(r, ms));
  const dec28 = (p, o) => { let v = (p[o] << 21) | (p[o + 1] << 14) | (p[o + 2] << 7) | p[o + 3]; if (v >= (1 << 27)) v -= (1 << 28); return v; };
  const enc28 = v => { if (v < 0) v += (1 << 28); return [(v >> 21) & 0x7f, (v >> 14) & 0x7f, (v >> 7) & 0x7f, v & 0x7f]; };
  // the simulated pedal (views/?sim) keeps its own saved data, so it never mixes with a real pedal's
  const pre = () => (window.simPedal ? "sim-" : "");
  const store = { get(k) { try { return JSON.parse(localStorage.getItem(pre() + k)); } catch { return null; } }, set(k, v) { try { localStorage.setItem(pre() + k, JSON.stringify(v)); } catch {} } };

  const L = { status: "off", message: "Not connected", ble: false, out: null, inp: null, access: null, ch: 0, pid: 0x70, ready: false };
  const subs = {};
  L.on = (t, f) => { (subs[t] ||= new Set()).add(f); return () => subs[t].delete(f); };
  const emit = (t, d) => (subs[t] || []).forEach(f => { try { f(d); } catch (e) { console.error(e); } });
  const say = (status, message) => { L.status = status; L.message = message; emit("status", { status, message }); };

  // ── incoming ────────────────────────────────────────────────────────────
  const waiters = new Set();
  function collect(ms, count, pred) {
    return new Promise(res => { const got = []; const h = m => { if (pred(m)) { got.push(m); if (got.length >= count) done(); } };
      const done = () => { clearTimeout(t); waiters.delete(h); res(got); }; const t = setTimeout(done, ms); waiters.add(h); });
  }
  const selfEchoes = [];
  function onMsg(e) {
    const d = e.data; if (!d || !d.length) return;
    emit("raw", { dir: "in", data: [...d] });   // PLAY STUDIO
    if (d[0] === 0xF0) for (const h of [...waiters]) h(d);
    if (d[0] === 0xF0 && d[3] === 0x38 && d[6] === 0x55 && d.length >= 12) {
      const v = dec28(d, 7), t = performance.now(), i = selfEchoes.findIndex(s => s.k === v && t - s.t < 1000);
      if (i >= 0) selfEchoes.splice(i, 1);
      emit("panel", { e0: (v >> 16) & 0xFF, e1: (v >> 8) & 0xFF, e2: v & 0xFF, self: i >= 0 });
      return;
    }
    if ((d[0] & 0xF0) === 0xC0) { L.pcChannel = d[0] & 0x0F; emit("program", d[1]); }
  }

  // ── ports + identity ────────────────────────────────────────────────────
  function readIdentity(m) {
    for (let i = 0; i <= 2; i++) {
      if (m[i] === 0xF0 && m[i + 1] === 0x7E && m[i + 3] === 0x06 && m[i + 4] === 0x02 && m[i + 5] === 0x00 && m[i + 6] === 0x01 && m[i + 7] === 0x38 && (m[i + 8] === 0x70 || m[i + 8] === 0x71)) return { ch: m[i + 2], pid: m[i + 8] };
      if (m[i] === 0xF0 && m[i + 1] === 0x00 && m[i + 2] === 0x01 && m[i + 3] === 0x38 && (m[i + 5] === 0x70 || m[i + 5] === 0x71) && m[i + 6] === 0x7E && m[i + 7] === 0x7F) return { ch: m[i + 4], pid: m[i + 5] };
    }
    return null;
  }
  L.ports = () => L.access ? { outputs: [...L.access.outputs.values()].map(p => ({ id: p.id, name: p.name })), inputs: [...L.access.inputs.values()].map(p => ({ id: p.id, name: p.name })) } : { outputs: [], inputs: [] };
  L.choice = () => ({ out: L.out && L.out.id, inp: L.inp && L.inp.id, ble: L.ble });

  // Ask for MIDI. auto = on page load: stay quiet when the browser has no Web MIDI.
  L.start = async ({ auto } = {}) => {
    if (!navigator.requestMIDIAccess) { say("nomidi", "No Web MIDI in this browser (iPad: use a Web MIDI browser app)"); return false; }
    try { L.access = await navigator.requestMIDIAccess({ sysex: true }); }
    catch (e) { say("off", auto ? "Not connected" : "MIDI access refused: " + e.message); return false; }
    // PLAY STUDIO: a pedal switched off and on again must drop the link and reconnect. The original only re-picked
    // ports when ours were gone, and left L.ready true while the pedal was off (seen on a real Play Electric).
    let reT = 0;
    L.access.onstatechange = () => {
      emit("ports", L.ports());
      const gone = !L.out || !L.inp || L.out.state === "disconnected" || L.inp.state === "disconnected";
      if (gone && L.ready) { L.ready = false; bindGen++; say("off", "Pedal disconnected"); }
      clearTimeout(reT);   // ports come and go in bursts: wait for them to settle, then (re)connect
      reT = setTimeout(() => { if (!L.ready && L.status !== "connecting") autoPick(); }, 600);
    };
    autoPick(); return true;
  };
  // PLAY STUDIO: when no port has a known name (an iPad or an interface can rename it), ask every port who it is.
  async function autoPick() {
    const saved = store.get("pa-ports") || {};
    const pick = (list, savedId) => list.find(p => p.id === savedId) || list.find(p => PA_PORT.test(p.name)) || list.find(p => BLE_PORT.test(p.name)) || null;
    const { outputs, inputs } = L.ports(), o = pick(outputs, saved.out), i = pick(inputs, saved.inp);
    if (!outputs.length || !inputs.length) { say("off", "No MIDI ports: connect the pedal by USB"); emit("ports", L.ports()); return; }
    if (o && i) { const gen = bindGen + 1; await L.use(o.id, i.id, saved.ble ?? (BLE_PORT.test(o.name) || BLE_PORT.test(i.name))); if (L.ready || gen !== bindGen) return; }
    await L.scan();
  }
  // Send the standard identity request (F0 7E 7F 06 01 F7, harmless for any MIDI device) to one output at a time
  // and listen on every input; the first input that answers like a Play pedal is paired with that output.
  L.scan = async () => {
    const gen = ++bindGen;
    if (L.inp) L.inp.onmidimessage = null;
    L.ready = false; L.out = L.inp = null;
    const outs = [...L.access.outputs.values()], ins = [...L.access.inputs.values()];
    say("connecting", "Looking for the pedal on every MIDI port…");
    let hit = null;
    for (const inp of ins) inp.onmidimessage = e => { if (!hit && e.data && readIdentity(e.data)) hit = inp; };
    const stop = () => { for (const inp of ins) inp.onmidimessage = null; };
    for (const out of outs) {
      if (gen !== bindGen) return stop();
      hit = null;
      try { out.send([0xF0, 0x7E, 0x7F, 0x06, 0x01, 0xF7]); } catch { continue; }
      const ble = BLE_PORT.test(out.name), t = performance.now();
      while (!hit && performance.now() - t < (ble ? 2200 : 900) && gen === bindGen) await delay(20);
      if (hit && gen === bindGen) { stop(); return L.use(out.id, hit.id, ble || BLE_PORT.test(hit.name)); }
    }
    stop();
    if (gen === bindGen) { say("off", "No pedal answered on any MIDI port"); emit("ports", L.ports()); }
  };
  let bindGen = 0;
  L.use = async (outId, inId, ble) => {
    const gen = ++bindGen;
    if (L.inp) L.inp.onmidimessage = null;
    L.out = L.access.outputs.get(outId) || null; L.inp = L.access.inputs.get(inId) || null; L.ble = !!ble; L.ready = false;
    L.identityMsg = null;   // PLAY STUDIO: set again only by a real identity reply from this port
    // PLAY STUDIO: report every outgoing message to the monitor (wrapped once per port object)
    if (L.out && !L.out.__psWrapped) { const o = L.out, send0 = o.send; o.send = function (d, ts) { emit("raw", { dir: "out", data: [...d] }); return send0.call(this, d, ts); }; o.__psWrapped = true; }
    store.set("pa-ports", { out: outId, inp: inId, ble: L.ble }); emit("ports", L.ports());
    if (!L.out || !L.inp) { say("off", "Choose the Play Acoustic's MIDI ports"); return; }
    L.inp.onmidimessage = onMsg;
    say("connecting", `Checking ${L.out.name}…`);
    for (let a = 0; a < 3 && gen === bindGen; a++) {
      const r = collect(L.ble ? 2200 : 1200, 1, m => !!readIdentity(m));
      L.out.send([0xF0, 0x7E, 0x7F, 0x06, 0x01, 0xF7]);
      const got = await r; if (gen !== bindGen) return;
      if (got.length) { L.identityMsg = [...got[0]];   // PLAY STUDIO
        const id = readIdentity(got[0]); L.ch = id.ch; L.pid = id.pid; return ready(`Play ${L.pid === 0x71 ? "Electric" : "Acoustic"}`); }
      if (L.ble) { L.ch = 0x7F; L.pid = 0x70; return ready("Play Acoustic (via Bluetooth, unconfirmed)"); }
    }
    if (gen === bindGen) say("bad", `No Play Acoustic answered on ${L.out.name}`);
  };
  function ready(name) {
    L.ready = true; L.name = name;
    L.out.send([...hdr(), 0x55, 0x01, 0x01, 0x00, 0x00, 0x00, 0xF7]);   // echo the pedal's own panel events to us
    say("ready", name); emit("ready");
  }

  // ── commands ────────────────────────────────────────────────────────────
  const hdr = () => [0xF0, 0x00, 0x01, 0x38, L.ch, L.pid];
  L.isBlocked = id => BLOCKED.has(id);
  L.set = (id, v) => {
    if (!L.ready || BLOCKED.has(id)) return false;
    L.out.send([...hdr(), 0x22, (id >> 7) & 0x7F, id & 0x7F, ...enc28(Math.round(v)), 0xF7]); return true;
  };
  // Reads go one at a time: the pedal answers in order and a BLE link chokes on bursts.
  let chain = Promise.resolve();
  const queue = fn => (chain = chain.then(fn, fn));
  L.get = id => queue(async () => {
    if (!L.ready) return null;
    const p = collect(L.ble ? 1200 : 600, 1, m => m[0] === 0xF0 && m[3] === 0x38 && m[6] === 0x22 && ((m[7] << 7) | m[8]) === id);
    L.out.send([...hdr(), 0x47, (id >> 7) & 0x7F, id & 0x7F, 0xF7]);
    const t0 = performance.now(), r = await p;
    if (r.length) L.readMs = L.readMs == null ? performance.now() - t0 : L.readMs * .9 + (performance.now() - t0) * .1;   // average round trip
    return r.length ? dec28(r[0], 9) : null;
  });
  // Read many; `alive()` returning false abandons the rest (e.g. the preset changed meanwhile).
  L.getMany = async (ids, alive = () => true, each) => {
    const out = {};
    for (const id of ids) { if (!alive()) return null; const v = await L.get(id); if (v != null) { out[id] = v; each && each(id, v); } }
    return alive() ? out : null;
  };
  // PLAY STUDIO: pipelined reads over USB. Up to `window` requests in flight, replies matched by ID. On a real Play
  // Electric this read 880 parameters in 3.6 s instead of ~31 s one by one, with every reply received. It runs inside
  // the same queue as L.get, so it never interleaves with single reads. Bluetooth keeps one-at-a-time (L.getMany).
  L.getBatch = (ids, { alive = () => true, each, window = 16, timeout = 500 } = {}) => {
    if (L.ble) return L.getMany(ids, alive, each);
    return queue(async () => {
      if (!L.ready) return null;
      const out = {}, pending = new Set();
      const h = m => { if (m[0] === 0xF0 && m[3] === 0x38 && m[6] === 0x22) { const id = (m[7] << 7) | m[8]; if (pending.delete(id)) { const v = dec28(m, 9); out[id] = v; if (each) try { each(id, v); } catch (e) { console.error(e); } } } };
      waiters.add(h);
      try {
        for (let i = 0; i < ids.length; i += window) {
          if (!alive() || !L.ready) return null;
          const chunk = ids.slice(i, i + window);
          for (const id of chunk) { pending.add(id); L.out.send([...hdr(), 0x47, (id >> 7) & 0x7F, id & 0x7F, 0xF7]); }
          const t = performance.now();
          while (chunk.some(id => pending.has(id)) && performance.now() - t < timeout) await delay(3);
          for (const id of chunk) pending.delete(id);   // no answer in time: give up on those
        }
      } finally { waiters.delete(h); }
      return alive() ? out : null;
    });
  };
  // PLAY STUDIO: presetInfo also returns the header's flags word (bytes 26-29; bit 0 = Favorite, per docs/SYSEX.md)
  // PLAY STUDIO: n = 0 is the current edit buffer; n = 1… asks for that stored preset (bank n>>7, number n&127),
  // which the pedal answers without loading it (checked on a real Play Electric: 25 ms each, no reply past the last).
  // withData: also collect the data packets (21: chunk byte + 25 values × 4 bytes + checksum; 4 on the Electric)
  L.presetInfo = (n = 0, timeout = 1000, withData = false) => queue(async () => {
    if (!L.ready) return null;
    const K = L.pid === 0x71 ? 4 : 5;
    const p = collect(timeout, withData ? 1 + K : 1, m => m[0] === 0xF0 && m[3] === 0x38 && (m[6] === 0x20 && m.length >= 31 || withData && m[6] === 0x21 && m.length >= 109));
    L.out.send([...hdr(), 0x45, (n >> 7) & 0x7F, n & 0x7F, 0xF7]);
    const r = await p; if (!r.length) return null;
    const h0 = r.find(m => m[6] === 0x20) || r[0], raw = [...h0.slice(11, 26)], end = raw.indexOf(0);
    const name = String.fromCharCode(...(end < 0 ? raw : raw.slice(0, end)).filter(c => c >= 0x20 && c < 0x7F)).trim();
    const hd = r.find(m => m[6] === 0x20); if (!hd) return null;
    const flags = dec28(hd, 26);
    let data = null;
    if (withData) { data = []; for (const m of r) if (m[6] === 0x21) data[m[7]] = Array.from({ length: 25 }, (_, j) => dec28(m, 8 + 4 * j)); }
    return { name, flags, fav: (flags & 1) === 1, data };
  });
  L.presetName = async () => { const i = await L.presetInfo(); return i ? i.name : null; };
  // Panel events, as if a control on the unit was used. Our own echoes are flagged self:true on the "panel" event.
  L.inject = (e0, e1, e2) => {
    if (!L.ready) return false;
    const k = (e0 << 16) | (e1 << 8) | e2; selfEchoes.push({ k, t: performance.now() }); while (selfEchoes.length > 40) selfEchoes.shift();
    L.out.send([...hdr(), 0x55, 0x02, ...enc28(k), 0xF7]); return true;
  };
  // Program Change on the channel the pedal itself uses for them (learned from its own Program Change messages).
  L.programChange = prog => { if (!L.ready) return false; L.out.send([0xC0 | (L.pcChannel ?? 0), prog & 0x7F]); return true; };
  L.press = async code => { if (L.inject(0xDB, code, 0x00)) { await delay(60); L.inject(0xDB, code, 0x01); } };
  // Held button: the firmware recognises a hold from a stream of 02 events, like the hardware sends.
  L.hold = (code) => {
    if (!L.inject(0xDB, code, 0x00)) return () => {};
    let n = 0; const t = setInterval(() => { if (++n > 40) clearInterval(t); else L.inject(0xDB, code, 0x02); }, 200);
    return () => { clearInterval(t); L.inject(0xDB, code, 0x01); };
  };
  L.EVT = EVT; L.store = store; L.delay = delay;
  window.PALink = L;
})();
