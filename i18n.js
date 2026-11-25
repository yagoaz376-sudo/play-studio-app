// Play Studio — English / Portuguese. The app is written in English; this layer swaps the text on screen (text nodes,
// title, aria-label, placeholder) for its Portuguese version when PT is on. Effect, style and preset names stay as
// they are (proper names). Anything not in the dictionary stays in English, so a missing entry never breaks a screen.
(function () {
  "use strict";
  const PT = {
    // navigation and top bar
    "Stage": "Palco", "Effects": "Efeitos", "Setup": "Ajustes", "Mapper": "Mapeador", "Offline": "Desconectado",
    "Not connected": "Desconectado", "edited": "editado", "Save": "Salvar", "Saving…": "Salvando…",
    "Sections": "Seções", "Connection and MIDI monitor": "Conexão e monitor MIDI", "Previous preset": "Preset anterior",
    "All presets": "Todos os presets", "Next preset": "Próximo preset",
    "Save this preset on the pedal (presses STORE, then STORE again to confirm)": "Salvar este preset no pedal (aperta STORE e STORE de novo pra confirmar)",
    "Undo (Ctrl+Z)": "Desfazer (Ctrl+Z)", "Undo": "Desfazer", "Light / dark theme": "Tema claro / escuro", "Toggle theme": "Trocar tema",
    "Language": "Idioma", "Close": "Fechar", "Edit effect": "Editar efeito",
    // effects / stage
    "Vocal": "Voz", "Guitar": "Guitarra", "vocal": "voz", "guitar": "guitarra", "Vocal effects": "Efeitos de voz", "Guitar effects": "Efeitos de guitarra",
    "Footswitch": "Footswitch", "Parameters": "Parâmetros", "Advanced": "Avançado", "Always on": "Sempre ligado", "State": "Estado",
    "Previous style": "Estilo anterior", "Next style": "Próximo estilo", "Shelf EQ": "EQ shelf", "Parametric EQ": "EQ paramétrico",
    "Drag or scroll the knobs. Shift = fine. Double-click = default.": "Arraste ou role os knobs. Shift = ajuste fino. Duplo clique = padrão.",
    "Confirm these in the Mapper to edit them": "Confirme no Mapeador para poder editar",
    "HIT on / off": "HIT liga / desliga", "Each tap holds HIT for 1.3 s, like holding the footswitch": "Cada toque segura o HIT por 1,3 s, como segurar o footswitch",
    "MUTE FX BETWEEN SONGS": "SILENCIA OS EFEITOS ENTRE AS MÚSICAS", "Mute FX between songs": "Silencia os efeitos entre as músicas",
    "FX MUTED · TAP TO SING": "EFEITOS MUDOS · TOQUE PRA CANTAR", "TAP AGAIN": "TOQUE DE NOVO",
    "Tap the beat: sets the preset's TEMPO, which every tempo-synced effect follows": "Toque no ritmo: define o ANDAMENTO do preset, que todos os efeitos sincronizados seguem",
    "Play Electric · protected mode.": "Play Electric · modo protegido.",
    "Only parameters confirmed in the Mapper can be changed; everything else is read-only.": "Só os parâmetros confirmados no Mapeador podem ser alterados; o resto é só leitura.",
    "Open Mapper": "Abrir Mapeador",
    // pedal view
    "The pedal's own buttons.": "Os botões do próprio pedal.",
    "Each one presses the real button over USB (hold = hold). Watch the pedal's screen. In SETUP, stay away from the MIDI settings.": "Cada um aperta o botão de verdade pela USB (segurar = segurar). Acompanhe a tela do pedal. No SETUP, não mexa nos ajustes de MIDI.",
    "knob": "knob", "Footswitches": "Footswitches", "hold = TALK": "segurar = TALK", "▼ + ▲ hold": "segurar ▼ + ▲",
    "Front left arrow": "Seta esquerda", "Front right arrow": "Seta direita", "Control knob: drag, scroll or use the arrow keys": "Knob: arraste, role ou use as setas",
    "Knob one step left": "Knob um passo para a esquerda", "Knob one step right": "Knob um passo para a direita",
    "Holds ▼ and ▲ together (enter / leave Loop mode)": "Segura ▼ e ▲ juntos (entra / sai do modo Loop)",
    // mix / setup
    "global · applies to every preset": "global · vale para todos os presets", "Setup groups": "Grupos de ajustes",
    // connect gate + drawer
    "Connect your pedal": "Conecte seu pedal", "Connect the Play Acoustic / Play Electric by USB.": "Ligue o Play Acoustic / Play Electric pela USB.",
    "Quit VoiceSupport": "Feche o VoiceSupport", "if it is open (it corrupts SysEx).": "se estiver aberto (ele corrompe o SysEx).",
    "Use": "Use", "Chrome or Edge": "Chrome ou Edge", "and allow MIDI with SysEx when asked.": "e permita MIDI com SysEx quando pedir.",
    "Leave the pedal on its preset screen.": "Deixe o pedal na tela de presets.", "Connect": "Conectar",
    "Try with a simulated Play Acoustic": "Testar com um Play Acoustic simulado", "… or Play Electric": "… ou Play Electric",
    "Asking for MIDI access…": "Pedindo acesso ao MIDI…", "This browser has no Web MIDI. Use Chrome or Edge, or the MidiWeb app on iPad / iPhone.": "Este navegador não tem Web MIDI. Use Chrome ou Edge, ou o app MidiWeb no iPad / iPhone.",
    "iPad / iPhone: open this page in the": "iPad / iPhone: abra esta página no app", "app, with SysEx turned on.": "com o SysEx ativado.",
    "Connection": "Conexão", "Output": "Saída", "Input": "Entrada", "Connect / retry": "Conectar / tentar de novo", "Re-read pedal": "Reler o pedal",
    "MIDI monitor": "Monitor MIDI", "Pause": "Pausar", "Resume": "Continuar", "Clear": "Limpar", "Copy": "Copiar", "Copied": "Copiado", "Couldn't copy": "Não deu pra copiar",
    "Status": "Status", "Pedal": "Pedal", "SysEx channel": "Canal SysEx", "Identity": "Identidade", "Round trip": "Ida e volta", "Mode": "Modo",
    "simulated pedal": "pedal simulado", "real pedal": "pedal real",
    "Pedal disconnected": "Pedal desconectado", "Choose the Play Acoustic's MIDI ports": "Escolha as portas MIDI do pedal",
    "No MIDI ports: connect the pedal by USB": "Nenhuma porta MIDI: ligue o pedal pela USB",
    "No Web MIDI in this browser (iPad: use a Web MIDI browser app)": "Este navegador não tem Web MIDI (iPad: use um app de navegador com Web MIDI)",
    "Connected, but the pedal didn't identify itself: protected mode": "Conectado, mas o pedal não se identificou: modo protegido",
    // edit with Claude
    "Edit with Claude": "Editar com o Claude", "Export all presets": "Exportar todos os presets", "Read all presets first": "Leia todos os presets primeiro","Copy this preset, paste it in Claude and say what you want.": "Copie este preset, cole no Claude e diga o que você quer.",
    "Copy Claude's whole answer and paste it below.": "Copie a resposta inteira do Claude e cole aqui embaixo.",
    "Check the list of changes, apply, listen. Save keeps them.": "Confira a lista de mudanças, aplique e ouça. O Salvar guarda no preset.",
    "Copy preset for Claude": "Copiar preset para o Claude", "Paste Claude's answer here": "Cole aqui a resposta do Claude", "Claude's answer": "Resposta do Claude",
    "Preset text": "Texto do preset", "Review changes": "Conferir mudanças", "Apply to the pedal": "Aplicar no pedal", "Ignored": "Ignorado",
    "Copied. Paste it in Claude and say what you want.": "Copiado. Cole no Claude e diga o que você quer.",
    "Select all the text below and copy it.": "Selecione todo o texto abaixo e copie.",
    "No changes found in that text. Paste Claude's whole answer (with the json block).": "Não achei mudanças nesse texto. Cole a resposta inteira do Claude (com o bloco json).",
    "Nothing to change: the pedal already has these values.": "Nada pra mudar: o pedal já está com esses valores.",
    // presets
    "Presets": "Presets", "Connected: reading all presets for the list…": "Conectado: lendo todos os presets pra montar a lista…", "Read all presets": "Ler todos os presets", "Stop": "Parar", "Couldn't read the preset number": "Não deu pra ler o número do preset",
    "Reading all presets changes presets on the pedal, so unsaved edits on this preset will be lost. Continue?": "Ler todos os presets troca o preset do pedal, então as edições não salvas deste preset vão se perder. Continuar?",
    "Read all presets needs the preset number, which isn't verified on the Play Electric yet.": "Ler todos os presets precisa do número do preset, que ainda não foi verificado no Play Electric.",
    "The pedal didn't change preset. Is it on its preset screen?": "O pedal não trocou de preset. Ele está na tela de presets?",
    "Saved on the pedal (STORE, STORE). Check the pedal's screen.": "Salvo no pedal (STORE, STORE). Confira a tela do pedal.",
    "Saved: pressed STORE twice (experimental on the Play Electric). Check the pedal's screen.": "Salvo: apertei STORE duas vezes (experimental no Play Electric). Confira a tela do pedal.",
    // toasts / errors
    "Not connected to the pedal": "Pedal não conectado", "Not mapped yet: confirm it in the Mapper first": "Ainda sem mapa: confirme no Mapeador primeiro",
    "This parameter is protected": "Este parâmetro é protegido", "Nothing to undo": "Nada pra desfazer",
    "Sent a HIT footswitch press (experimental on the Play Electric)": "Enviei um toque no footswitch HIT (experimental no Play Electric)",
    "TALK: holds HIT for 1.3 s (experimental on the Play Electric)": "TALK: segura o HIT por 1,3 s (experimental no Play Electric)",
    "⚠ USB control will stop working after the pedal is switched off.": "⚠ O controle pela USB vai parar de funcionar quando o pedal for desligado.",
    ". Fix it on the pedal (SETUP › MIDI) before turning it off.": ". Corrija no pedal (SETUP › MIDI) antes de desligar.",
    "MIDI locked": "MIDI travado", "MIDI locked:": "MIDI travado:",
    "MIDI CTRL, FILTER, SYSEXID and the channels are left out on purpose: changing them can lock out USB control.": "MIDI CTRL, FILTER, SYSEXID e os canais ficam de fora de propósito: mudar isso pode travar o controle pela USB.",
    "Simulated: GUITAR REVERB LEVEL +3 on the pedal": "Simulado: GUITAR REVERB LEVEL +3 no pedal",
    // mapper
    "Finds which parameter ID is which.": "Descobre qual ID é cada parâmetro.",
    "Reading never changes anything on the pedal. While mapping, don't touch the pedal's MIDI settings.": "Ler nunca muda nada no pedal. Enquanto mapeia, não mexa nos ajustes de MIDI do pedal.",
    "Read everything": "Ler tudo", "Reads all 948 parameter IDs once (read-only).": "Lê os 948 IDs de parâmetro uma vez (só leitura).",
    "Read all": "Ler tudo", "Read all again": "Ler tudo de novo", "Change ONE thing on the pedal": "Mude UMA coisa no pedal",
    "Turn a knob or switch an effect on the pedal itself. The app re-reads and lists what changed.": "Gire um knob ou ligue um efeito no próprio pedal. O app relê e lista o que mudou.",
    "Check now": "Verificar agora", "Simulate a knob turn": "Simular um giro de knob", "Say what it was": "Diga o que foi",
    "Pick the matching control and confirm. Confirmed parameters become editable.": "Escolha o controle certo e confirme. Os confirmados ficam editáveis.",
    "Changes found": "Mudanças encontradas", "Confirmed": "Confirmados", "Export map": "Exportar mapa", "Import map": "Importar mapa",
    "The pedal isn't answering reads. Check the connection and that VoiceSupport is closed.": "O pedal não está respondendo às leituras. Confira a conexão e se o VoiceSupport está fechado.",
    "Reading stopped": "Leitura parada", "Checking for changes…": "Procurando mudanças…", "No new changes found": "Nenhuma mudança nova",
    "Same ID on the Play Acoustic": "Mesmo ID no Play Acoustic", "What did you change?": "O que você mudou?", "Confirm": "Confirmar",
    "Remove from this list": "Tirar desta lista", "Remove": "Remover", "Choose what you changed first": "Escolha primeiro o que você mudou",
    "Choose…": "Escolha…", "Something else… (name it)": "Outra coisa… (dê um nome)", "Ignore: changes by itself": "Ignorar: muda sozinho",
    "No confirmed parameters yet.": "Nenhum parâmetro confirmado ainda.", "this is…": "isto é…",
    // section and group titles
    "INPUT": "ENTRADA", "OUTPUT": "SAÍDA", "SYSTEM": "SISTEMA", "GUITAR ANTI-FEEDBACK": "ANTI-MICROFONIA DA GUITARRA", "MIC CONTROL": "CONTROLE DO MIC",
    "PRODUCT INFO": "INFORMAÇÕES",
    // parameter labels (effect names such as HARMONY, DELAY, REVERB, uMOD, AMP stay)
    "CONTROL": "CONTROLE", "STYLE": "ESTILO", "LEVEL": "NÍVEL", "KEY": "TOM", "DELAY STYLE": "ESTILO DO DELAY", "REVERB STYLE": "ESTILO DO REVERB",
    "uMOD STYLE": "ESTILO DO uMOD", "DECAY": "DURAÇÃO", "SHIFT": "TRANSPOSIÇÃO", "GENDER": "GÊNERO", "FILTER": "FILTRO", "SPEED": "VELOCIDADE",
    "SCALE": "ESCALA", "HUMANIZE": "HUMANIZAR", "TEMPO": "ANDAMENTO", "ROUTING": "ROTEAMENTO", "GAIN": "GANHO", "GATE THRESHOLD": "LIMIAR DO GATE",
    "REVERB LEVEL": "NÍVEL DO REVERB", "REVERB DECAY": "DURAÇÃO DO REVERB", "DELAY LEVEL": "NÍVEL DO DELAY", "UMOD LEVEL": "NÍVEL DO uMOD",
    "AMOUNT": "QUANTIDADE", "LOW GAIN": "GANHO GRAVE", "HI GAIN": "GANHO AGUDO", "LOW FREQ": "FREQ. GRAVE", "HI FREQ": "FREQ. AGUDA",
    "PARA 1 FREQ": "FREQ. PARAM. 1", "PARA 2 FREQ": "FREQ. PARAM. 2", "PARA 1 WIDTH": "LARGURA PARAM. 1", "PARA 2 WIDTH": "LARGURA PARAM. 2",
    "PARA 1 GAIN": "GANHO PARAM. 1", "PARA 2 GAIN": "GANHO PARAM. 2", "THRESHOLD": "LIMIAR", "RATIO": "TAXA", "ATTACK": "ATAQUE", "RELEASE": "LIBERAÇÃO",
    "MAKEUP GAIN": "GANHO DE COMPENSAÇÃO", "MAKEUP": "COMPENSAÇÃO", "AMBIENCE": "AMBIÊNCIA", "REVERB PRE DLY": "PRÉ-DELAY DO REVERB", "DEPTH": "PROFUNDIDADE",
    "GUITAR LEVEL": "NÍVEL DA GUITARRA", "HEADPHONE LEVEL": "NÍVEL DO FONE", "LOOP LEVEL": "NÍVEL DO LOOP", "OUT LEVEL": "NÍVEL DE SAÍDA",
    "USB IN LEVEL": "NÍVEL DE ENTRADA USB", "USB OUT LEVEL": "NÍVEL DE SAÍDA USB", "USB LEVEL": "NÍVEL USB",
    "TONE STYLE": "ESTILO DE TIMBRE", "GUITAR": "GUITARRA", "PITCH CORRECTION": "CORREÇÃO DE AFINAÇÃO", "HEADPHONE LIM": "LIMITE DO FONE",
    "VOCAL CANCEL": "CANCELAR VOZ", "LEAD MUTE": "MUDO DA VOZ PRINCIPAL", "LCD CONTRAST": "CONTRASTE DO LCD", "TUNE REFERENCE": "REFERÊNCIA DE AFINAÇÃO",
    "UP/DN FUNCTION": "FUNÇÃO ▲/▼", "AUX TO MAIN OUT": "AUX NA SAÍDA PRINCIPAL", "LEAD DELAY": "ATRASO DA VOZ", "AUX IN TYPE": "TIPO DA ENTRADA AUX",
    "GLOBAL KEY": "TOM GLOBAL", "GUITAR GATE": "GATE DA GUITARRA", "GLOBAL TEMPO": "ANDAMENTO GLOBAL", "MIC BOOST": "GANHO DO MIC",
    "ROOMSENSE LOCUT": "CORTE DE GRAVES DO ROOMSENSE", "BODYREZ EDITING": "EDIÇÃO DO BODYREZ", "PHASE INVERT": "INVERTER FASE", "NOTCH GAIN": "GANHO DO NOTCH",
    "LOW CUT": "CORTE DE GRAVES", "NOTCH FREQ": "FREQ. DO NOTCH", "GLOBAL GUITAR FX": "EFEITOS DE GUITARRA GLOBAIS", "GUITAR BOOST AMT": "QTD. DE BOOST DA GUITARRA",
    "SWITCH-6 MODE": "MODO DO SWITCH-6", "MP76 CONTROL": "CONTROLE DO MP76", "MP75 CONTROL": "CONTROLE DO MP75", "MP76 TOP": "MP76 CIMA",
    "MP76 BOTTOM": "MP76 BAIXO", "MP76 LEFT": "MP76 ESQUERDA", "MP76 RIGHT": "MP76 DIREITA", "UNDO": "DESFAZER", "LOOP FEEDBACK": "FEEDBACK DO LOOP",
    // generic option names (style names stay)
    "OFF": "DESL", "ON": "LIG", "DEFAULT": "PADRÃO", "CUSTOM": "PERSONALIZADO", "NONE": "NENHUM", "BASIC": "BÁSICO", "ADVANCED": "AVANÇADO",
    "VOCAL": "VOZ", "ALL": "TODOS", "STEREO": "ESTÉREO", "DUAL MONO": "MONO DUPLO", "LIVE": "AO VIVO", "TRACKS": "FAIXAS", "SET KEY": "DEFINIR TOM",
    "LEAD": "VOZ", "LEAD + GUITAR": "VOZ + GUITARRA", "LEAD + AUX": "VOZ + AUX", "VOCAL + GUITAR": "VOZ + GUITARRA", "GUITAR + AUX": "GUITARRA + AUX",
    "LOOP MODE": "MODO LOOP", "AMBIENT": "AMBIENTE", "AMBIENT/AUTO": "AMBIENTE/AUTO", "DYNAMIC MIC": "MIC DINÂMICO", "CONDENSER MIC": "MIC CONDENSADOR",
    "FLAT": "PLANO", "VOICE/GUITAR (DI)": "VOZ/GUITARRA (DI)",
  };
  const RX = [
    [/^(\d+) not mapped$/, "$1 sem mapa"],
    [/^(.+): tap = on\/off · hold = edit$/, "$1: toque = liga/desliga · segure = editar"],
    [/^Going to preset (.+)… \(now (.+)\)$/, "Indo para o preset $1… (agora $2)"],
    [/^Reading presets…(.*)$/, "Lendo presets…$1"],
    [/^Reading (\S+) of (\S+)… (\d+) answered · ~(\d+) s left$/, "Lendo $1 de $2… $3 responderam · ~$4 s restantes"],
    [/^Read (\d+) parameters\. Now change one thing on the pedal\.$/, "Li $1 parâmetros. Agora mude uma coisa no pedal."],
    [/^Imported (\d+) parameters$/, "Importei $1 parâmetros"],
    [/^Couldn't import: (.*)$/, "Não deu pra importar: $1"],
    [/^Remove (\S+) from the map\?$/, "Remover $1 do mapa?"],
    [/^No Play Acoustic answered on (.+)$/, "Nenhum pedal respondeu em $1"],
    [/^Checking (.+)…$/, "Verificando $1…"],
    [/^MIDI access refused: (.*)$/, "Acesso ao MIDI recusado: $1"],
    [/^Play Electric \(0x71\) · protected$/, "Play Electric (0x71) · protegido"],
    [/^Connected: Play Electric \(protected mode\)$/, "Conectado: Play Electric (modo protegido)"],
    [/^Connected: Play Acoustic$/, "Conectado: Play Acoustic"],
    [/^Stopped after (\d+) presets(.*)$/, "Parei depois de $1 presets$2"],
    [/^(\d+) presets(?: · (\d+) may be outdated)?(?: · read (.+))?$/, (m, n, s, d) => `${n} presets${s ? ` · ${s} podem estar desatualizados` : ""}${d ? ` · lidos em ${d}` : ""}`],
    [/^no presets read yet$/, "nenhum preset lido ainda"],
    [/^Read (\d+) presets in (\d+) s$/, "Li $1 presets em $2 s"],
    [/^(\d+) changes$/, "$1 mudanças"],
    [/^Exported (\d+) presets$/, "Exportei $1 presets"],
    [/^Exported (\d+) presets \(file saved, also copied\)$/, "Exportei $1 presets (arquivo salvo e também copiado)"],
    [/^Exported (\d+) presets \(file saved\)$/, "Exportei $1 presets (arquivo salvo)"],
    [/^Applied (\d+) changes\. Listen, then press Save to keep them \(Undo goes back\)\.$/, "Apliquei $1 mudanças. Ouça e aperte Salvar pra guardar (Desfazer volta)."],
    [/^Preset from a (Play \w+) \("(.*)"\): only the vocal effects are brought over\.$/, 'Preset de um $1 ("$2"): só os efeitos de voz são trazidos.'],
    [/^Applied (\d+) changes: press Save to keep them$/, "Apliquei $1 mudanças: aperte Salvar pra guardar"],
    [/^That text was made for "(.*)"; the pedal is now on "(.*)"\.$/, 'Esse texto foi feito pro preset "$1"; o pedal agora está no "$2".'],
    [/^(.+): not an effect this pedal has \(or it isn't editable\)$/, "$1: efeito que este pedal não tem (ou não é editável)"],
    [/^(.+): unknown parameter$/, "$1: parâmetro desconhecido"],
    [/^(.+): "(.*)" isn't an option$/, '$1: "$2" não é uma opção'],
    [/^(.+): (.+) is outside (.+)…(.+)$/, "$1: $2 está fora de $3…$4"],
  ];
  const KEEP_ONLY = new Set(["Not connected", "Offline"]);   // inside translate="no" (preset names, MIDI log) only these status texts change

  let lang = "en";
  try { const s = localStorage.getItem("ps-lang"); if (s === "pt" || s === "en") lang = s; } catch {}

  function tr(s) {
    if (lang !== "pt" || !s) return s;
    const k = s.trim(); if (!k) return s;
    let out = PT[k];
    if (out == null) for (const [re, f] of RX) if (re.test(k)) { out = k.replace(re, f); break; }
    return out == null ? s : s.replace(k, out);
  }
  const ORIG = new WeakMap(), LAST = new WeakMap(), AORIG = new WeakMap();
  const noTr = n => { const el = n.nodeType === 1 ? n : n.parentElement; return !!(el && el.closest('[translate="no"], script, style, textarea')); };
  function doText(n) {
    const cur = n.data, src = LAST.get(n) === cur ? ORIG.get(n) : cur;
    const out = noTr(n) && !KEEP_ONLY.has(src.trim()) ? src : tr(src);
    ORIG.set(n, src); LAST.set(n, out); if (out !== cur) n.data = out;
  }
  const ATTRS = ["title", "aria-label", "placeholder"];
  function doAttrs(el) {
    if (noTr(el)) return;
    let m = AORIG.get(el); if (!m) AORIG.set(el, m = {});
    for (const a of ATTRS) {
      if (!el.hasAttribute(a)) continue;
      const cur = el.getAttribute(a), rec = m[a], src = rec && rec.out === cur ? rec.src : cur, out = tr(src);
      m[a] = { src, out }; if (out !== cur) el.setAttribute(a, out);
    }
  }
  function walk(root) {
    if (root.nodeType === 3) return doText(root);
    if (root.nodeType !== 1) return;
    doAttrs(root);
    const it = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let n = it.nextNode(); n; n = it.nextNode()) n.nodeType === 3 ? doText(n) : doAttrs(n);
  }
  let busy = false;
  const mo = new MutationObserver(list => {
    if (busy) return; busy = true;
    try {
      for (const r of list) {
        if (r.type === "characterData") doText(r.target);
        else if (r.type === "attributes") doAttrs(r.target);
        else for (const n of r.addedNodes) walk(n);
      }
    } finally { busy = false; }
  });
  function paintToggle() {
    for (const b of document.querySelectorAll("[data-lang]")) b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
    document.documentElement.lang = lang === "pt" ? "pt-BR" : "en";
  }
  function set(l) {
    lang = l === "pt" ? "pt" : "en";
    try { localStorage.setItem("ps-lang", lang); } catch {}
    walk(document.body); paintToggle();
  }
  function start() {
    walk(document.body); paintToggle();
    mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    document.addEventListener("click", e => { const b = e.target.closest("[data-lang]"); if (b) set(b.dataset.lang); });
  }
  window.PSI18N = { t: tr, set, get lang() { return lang; } };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", start) : start();
})();
