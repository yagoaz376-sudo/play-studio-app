// Play Acoustic Remote: menu layout for the virtual front panel (firmware 1.4.00).
// Edit freely: everything between the first { and the last } is plain JSON (double quotes, no trailing commas).
// Generated once from the firmware menu tables (tools/menu_dump.py) and checked against photos of the unit.
// Keys: see tools/MENUS-FORMAT.md. After saving, reload tools/pa-remote.html.
window.PA_MENUS = {
  "VOCAL": { "button": "VOCAL FX", "pages": [
    { "title": "HARMONY", "layout": "image", "control": {"param": "0x2CE", "label": "CONTROL", "min": 0, "max": 2, "format": "list", "values": ["OFF", "ON", "HIT"], "default": 0}, "images": [92, 93, 101, 102, 106, 84, 99, 98, 100, 95, 94, 103, 91, 86, 85, 88, 89, 108, 107, 110, 111, 97, 104, 96, 107, 112, 85, 90, 105], "rows": [
      [ {"param": "0x06B", "label": "STYLE", "min": 0, "max": 27, "format": "list", "values": ["HIGH", "HIGHER", "LOW", "LOWER", "OCTAVE UP", "OCTAVE DOWN", "HIGH & LOW ", "HIGH & HIGHER", "HIGH & LOWER", "HIGHER & LOWER", "HIGHER & LOW", "LOWER & LOW", "OCT DOWN & UP", "OCT DOWN & HIGHER", "OCT DOWN & HIGH", "OCT DOWN & LOW", "OCT DOWN & LOWER", "OCT UP & HIGHER", "OCT UP & HIGH", "OCT UP & LOW", "OCT UP & LOWER", "+7 SEMITONES", "-5 SEMITONES", "+7 &-5 SEMITONES", "+12 &+7 SEMITONES", "+12 &-5 SEMITONES", "-12 &+7 SEMITONES", "-12 &-5 SEMITONES"], "default": 0},
        null ],
      [ {"param": "0x0B9", "label": "LEVEL", "min": -36, "max": 0, "format": "dB", "default": 0},
        {"param": "0x075", "label": "KEY", "min": 0, "max": 12, "format": "list", "values": ["AUTO", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"], "default": 0} ],
      [ null,
        null ]
    ] },
    { "title": "DOUBLE", "layout": "image", "control": {"param": "0x2CF", "label": "CONTROL", "min": 0, "max": 2, "format": "list", "values": ["OFF", "ON", "HIT"], "default": 0}, "images": [34, 29, 36, 38, 33, 31, 30, 37, 35, 32], "rows": [
      [ {"param": "0x09D", "label": "STYLE", "min": 0, "max": 9, "format": "list", "values": ["1 VOICE TIGHT", "1 VOICE LOOSE", "2 VOICES TIGHT", "2 VOICES LOOSE", "SHOUT", "1 VOICE OCT UP", "1 VOICE OCT DOWN", "2 VOICES OCT UP", "2 VOICES OCT DN", "OCT UP & OCT DN"], "default": 1},
        null ],
      [ {"param": "0x0BA", "label": "LEVEL", "min": -36, "max": 0, "format": "dB", "default": 0},
        null ],
      [ null,
        null ]
    ] },
    { "title": "DELAY", "layout": "image", "control": {"param": "0x2CC", "label": "CONTROL", "min": 0, "max": 2, "format": "list", "values": ["OFF", "ON", "HIT"], "default": 0}, "images": [24, 15, 28, 13, 14, 28, 25, 23, 23, 23, 17, 18, 19, 20, 21, 22, 26, 26], "rows": [
      [ {"param": "0x150", "label": "DELAY STYLE", "min": 0, "max": 17, "format": "list", "values": ["QUARTER", "EIGHTH", "TRIPLET", "DOTTED 1/8", "DOTTED 1/4", "1/4 TRIPLET", "SIXTEENTH", "PING PONG 1", "PING PONG 2", "PING PONG 3", "MULTITAP 1", "MULTITAP 2", "MULTITAP 3", "MULTITAP 4", "MULTITAP 5", "MULTITAP 6", "CLASSIC SLAP", "SET TIME"], "default": 0},
        null ],
      [ {"param": "0x0D4", "label": "LEVEL", "min": -51, "max": 0, "format": "dB", "default": 0},
        {"param": "0x167", "label": "FEEDBACK", "min": 0, "max": 100, "format": "number", "default": 50} ],
      [ null,
        null ]
    ] },
    { "title": "REVERB", "layout": "image", "control": {"param": "0x2CD", "label": "CONTROL", "min": 0, "max": 2, "format": "list", "values": ["OFF", "ON", "HIT"], "default": 0}, "images": [118, 118, 118, 118, 118, 118, 118, 118, 117, 117, 117, 119, 119, 119, 119, 119, 119, 119, 116, 116, 116, 116, 115, 115, 115, 115, 120, 120], "rows": [
      [ {"param": "0x19A", "label": "REVERB STYLE", "min": 0, "max": 27, "format": "list", "values": ["SMOOTH PLATE", "REFLECTION PLATE", "THIN PLATE", "BRIGHT PLATE", "REAL PLATE", "REAL PLATE LONG", "JAZZ PLATE", "QUICK PLATE", "SOFT HALL", "AMSTERDAM HALL", "BROADWAY HALL", "SNAPPY ROOM", "LIBRARY", "DARK ROOM", "MUSIC CLUB", "STUDIO ROOM", "BOUNCY ROOM", "COZY CORNER", "BRIGHT CHAMBER", "WOODEN CHAMBER", "ST. JOSEPH CHURCH", "DOME CHAPEL", "HOCKEY ARENA", "MUSEUM", "INDOOR ARENA", "WAREHOUSE", "THIN SPRING", "FULL SPRING"], "default": 0},
        null ],
      [ {"param": "0x0D5", "label": "LEVEL", "min": -51, "max": 0, "format": "dB", "default": 0},
        {"param": "0x19F", "label": "DECAY", "min": 1, "max": 290, "format": "time", "fmt": {"points": [[1, 0.01], [84, 0.84], [146, 5.2], [290, 20]]}, "default": 100} ],
      [ null,
        null ]
    ] },
    { "title": "HARDTUNE", "layout": "image", "control": {"param": "0x2D1", "label": "CONTROL", "min": 0, "max": 2, "format": "list", "values": ["OFF", "ON", "HIT"], "default": 0}, "images": [82, 78, 83, 81, 81, 79, 80], "rows": [
      [ {"param": "0x266", "label": "STYLE", "min": 0, "max": 6, "format": "list", "values": ["POP", "COUNTRY GLISS", "ROBOT", "CORRECT NATURAL", "CORRECT CHROMATIC", "DRONE", "GENDER BENDER"], "default": 1},
        null ],
      [ {"param": "0x26B", "label": "SHIFT", "min": -36, "max": 36, "format": "number", "default": 0},
        {"param": "0x271", "label": "GENDER", "min": -50, "max": 50, "format": "number", "default": 0} ],
      [ null,
        null ]
    ] },
    { "title": "TRANSDUCER", "layout": "image", "control": {"param": "0x2D0", "label": "CONTROL", "min": 0, "max": 2, "format": "list", "values": ["OFF", "ON", "HIT"], "default": 0}, "images": [133, 136, 135, 134, 134, 132, 124, 125], "rows": [
      [ {"param": "0x249", "label": "STYLE", "min": 0, "max": 7, "format": "list", "values": ["MEGAPHONE", "RADIO", "ON THE PHONE", "OVERDRIVE", "BUZZ CUT", "STACK", "TWEED", "COMBO"], "default": 1},
        null ],
      [ {"param": "0x24B", "label": "DRIVE", "min": 0, "max": 100, "format": "number", "default": 0},
        {"param": "0x263", "label": "FILTER", "min": 0, "max": 100, "format": "number", "default": 50} ],
      [ null,
        null ]
    ] },
    { "title": "uMOD", "layout": "image", "control": {"param": "0x2CB", "label": "CONTROL", "min": 0, "max": 2, "format": "list", "values": ["OFF", "ON", "HIT"], "default": 0}, "images": [146, 146, 146, 141, 141, 141, 141, 143, 143, 144, 144, 144, 144, 144, 145, 145, 145, 145, 145, 147, 147, 142, 142, 140], "rows": [
      [ {"param": "0x124", "label": "uMOD STYLE", "min": 0, "max": 23, "format": "list", "values": ["MICROMOD CLONE", "MICROMOD WIDER", "THICKEN", "LIGHT CHORUS", "MEDIUM CHORUS", "WIDE CHORUS", "MONO CHORUS", "FAST ROTOR", "PANNER", "FLANGER ", "FLANGE FEEDBACK", "FLANGE NEGATIVE", "MONO FLANGE", "SOFT FLANGE", "TUBE", "UP TUBE", "DOWN TUBE", "DOWN & UP TUBE", "RISE AND FALL", "AUTO WAH", "UNDERWATER", "CYLON MONO", "CYLON STEREO", "ALIEN VOICEOVER"], "default": 0},
        null ],
      [ {"param": "0x0D3", "label": "LEVEL", "min": -51, "max": 0, "format": "dB", "default": 0},
        {"param": "0x130", "label": "SPEED", "min": 5, "max": 1000, "format": "scale", "fmt": {"mul": 0.01, "unit": "Hz", "dec": 2}, "default": 150} ],
      [ null,
        null ]
    ] }
  ] },
  "VOCAL ADV": { "button": "VOCAL FX (advanced)", "pages": [
    { "title": "HARMONY", "rows": [
      [ {"param": "0x078", "label": "SCALE", "min": 0, "max": 5, "format": "list", "values": ["MAJ1", "MAJ2", "MAJ3", "MIN1", "MIN2", "MIN3"], "default": 1},
        {"param": "0x071", "label": "HUMANIZE", "min": 0, "max": 100, "format": "number", "default": 0} ],
      [ {"param": "0x093", "label": "PORTAMENTO", "min": 0, "max": 200, "format": "number", "default": 0},
        null ],
      [ null,
        null ]
    ] },
    { "title": "DELAY", "rows": [
      [ {"param": "0x17D", "label": "FILTER", "min": 0, "max": 12, "format": "list", "values": ["DIGITAL", "TAPE", "ANALOG", "RADIO", "MEGAPHONE", "CELL PHONE", "LO-FI", "HI CUT 1", "HI CUT 2", "HI CUT 3", "LOW CUT 1", "LOW CUT 2", "LOW CUT 3"], "default": 0},
        {"param": "0x158", "label": "TEMPO", "min": 45, "max": 300, "format": "BPM", "default": 120} ],
      [ null,
        null ],
      [ null,
        null ]
    ] },
    { "title": "TRANSDUCER", "rows": [
      [ {"param": "0x24A", "label": "ROUTING", "min": 0, "max": 1, "format": "list", "values": ["OUTPUT", "FX"], "default": 1},
        {"param": "0x24F", "label": "GAIN", "min": -20, "max": 20, "format": "dB", "default": 0} ],
      [ {"param": "0x05E", "label": "GATE THRESHOLD", "min": -61, "max": 0, "format": "dB", "default": -40},
        null ],
      [ null,
        null ]
    ] }
  ] },
  "GUITAR": { "button": "GUITAR FX", "pages": [
    { "title": "GUITAR REVERB", "layout": "image", "control": {"param": "0x355", "label": "CONTROL", "min": 0, "max": 1, "format": "list", "values": ["OFF", "ON"], "default": 1}, "images": [77, 77, 77, 77, 77, 77, 77, 77, 118, 118, 118, 118, 118, 118, 118, 118, 117, 117, 117, 119, 119, 119, 119, 119, 119, 119, 116, 116, 116, 116, 115, 115, 115, 115, 120, 120], "showWhen": {"0x362": 0}, "rows": [
      [ {"param": "0x19B", "label": "REVERB", "min": 0, "max": 35, "format": "list", "values": ["HALL", "PLATE", "ROOM", "CHURCH", "SPRING", "AMBIENCE", "LOFI", "TILE", "SMOOTH PLATE", "REFLECTION PLATE", "THIN PLATE", "BRIGHT PLATE", "REAL PLATE", "REAL PLATE LONG", "JAZZ PLATE", "QUICK PLATE", "SOFT HALL", "AMSTERDAM HALL", "BROADWAY HALL", "SNAPPY ROOM", "LIBRARY", "DARK ROOM", "MUSIC CLUB", "STUDIO ROOM", "BOUNCY ROOM", "COZY CORNER", "BRIGHT CHAMBER", "WOODEN CHAMBER", "ST. JOSEPH CHURCH", "DOME CHAPEL", "HOCKEY ARENA", "MUSEUM", "INDOOR ARENA", "WAREHOUSE", "THIN SPRING", "FULL SPRING"], "default": 1},
        null ],
      [ {"param": "0x0D8", "label": "REVERB LEVEL", "min": -51, "max": 0, "format": "dB", "default": 0},
        {"param": "0x1A0", "label": "REVERB DECAY", "min": 1, "max": 290, "format": "time", "fmt": {"points": [[1, 0.01], [84, 0.84], [146, 5.2], [290, 20]]}, "default": 100} ],
      [ null,
        null ]
    ] },
    { "title": "GUITAR DELAY", "layout": "image", "control": {"param": "0x353", "label": "CONTROL", "min": 0, "max": 1, "format": "list", "values": ["OFF", "ON"], "default": 1}, "images": [123, 123, 123, 123, 123, 123, 123, 16, 24, 13, 23, 23, 18, 26, 133, 120], "showWhen": {"0x362": 0}, "rows": [
      [ {"param": "0x151", "label": "DELAY", "min": 0, "max": 15, "format": "list", "values": ["FLASHBACK 2290", "FLASHBACK ANALOG", "FLASHBACK TAPE", "FLASHBACK LOFI", "FLASHBACK SLAP", "EDGE-Y MOD", "ANALOG MODUL8R", "HALF", "QUARTER", "DOTTED 1/8", "PING PONG", "PING PONG FX", "MULTITAP", "300 MS", "LONG & THIN", "REVERB TANK"], "default": 0},
        null ],
      [ {"param": "0x0D7", "label": "DELAY LEVEL", "min": -51, "max": 0, "format": "dB", "default": 0},
        {"param": "0x168", "label": "FEEDBACK", "min": 0, "max": 100, "format": "number", "default": 50} ],
      [ null,
        null ]
    ] },
    { "title": "GUITAR uMOD", "layout": "image", "control": {"param": "0x357", "label": "CONTROL", "min": 0, "max": 1, "format": "list", "values": ["OFF", "ON"], "default": 1}, "images": [11, 11, 11, 141, 141, 141], "showWhen": {"0x362": 0}, "rows": [
      [ {"param": "0x125", "label": "uMOD", "min": 0, "max": 5, "format": "list", "values": ["CHORUS 12:00", "CHORUS FAST", "CHORUS SLOW", "SILKY DETUNE", "MEDIUM DETUNE", "MONO CHORUS"], "default": 0},
        null ],
      [ {"param": "0x0D6", "label": "UMOD LEVEL", "min": -51, "max": 0, "format": "dB", "default": 0},
        {"param": "0x131", "label": "SPEED", "min": 5, "max": 1000, "format": "scale", "fmt": {"mul": 0.01, "unit": "Hz", "dec": 2}, "default": 150} ],
      [ null,
        null ]
    ] },
    { "title": "BODYREZ EQ", "layout": "image", "images": [10, 42, 9, 4, 5, 6, 7, 8], "showWhen": {"0x362": 0}, "rows": [
      [ {"param": "0x2AD", "label": "STYLE", "min": 0, "max": 7, "format": "list", "values": ["CUSTOM", "FLAT", "JUST COMP", "BODYREZ 1", "BODYREZ 2", "BODYREZ 3", "BODYREZ 4", "BODYREZ 5"], "default": 3},
        null ],
      [ {"param": "0x2AF", "label": "AMOUNT", "min": 0, "max": 10, "format": "number", "default": 10},
        {"param": "0x2B3", "label": "LOW GAIN", "min": -12, "max": 12, "format": "dB", "default": 0} ],
      [ {"param": "0x2B7", "label": "HI GAIN", "min": -12, "max": 12, "format": "dB", "default": 0},
        null ]
    ] },
    { "title": "GUITAR REVERB", "layout": "image", "control": {"param": "0x355", "label": "CONTROL", "min": 0, "max": 1, "format": "list", "values": ["OFF", "ON"], "default": 1}, "images": [77, 77, 77, 77, 77, 77, 77, 77, 118, 118, 118, 118, 118, 118, 118, 118, 117, 117, 117, 119, 119, 119, 119, 119, 119, 119, 116, 116, 116, 116, 115, 115, 115, 115, 120, 120], "showWhen": {"0x362": 1}, "rows": [
      [ {"param": "0x19B", "label": "REVERB", "min": 0, "max": 35, "format": "list", "values": ["HALL", "PLATE", "ROOM", "CHURCH", "SPRING", "AMBIENCE", "LOFI", "TILE", "SMOOTH PLATE", "REFLECTION PLATE", "THIN PLATE", "BRIGHT PLATE", "REAL PLATE", "REAL PLATE LONG", "JAZZ PLATE", "QUICK PLATE", "SOFT HALL", "AMSTERDAM HALL", "BROADWAY HALL", "SNAPPY ROOM", "LIBRARY", "DARK ROOM", "MUSIC CLUB", "STUDIO ROOM", "BOUNCY ROOM", "COZY CORNER", "BRIGHT CHAMBER", "WOODEN CHAMBER", "ST. JOSEPH CHURCH", "DOME CHAPEL", "HOCKEY ARENA", "MUSEUM", "INDOOR ARENA", "WAREHOUSE", "THIN SPRING", "FULL SPRING"], "default": 1},
        null ],
      [ {"param": "0x0D8", "label": "REVERB LEVEL", "min": -51, "max": 0, "format": "dB", "default": 0},
        {"param": "0x1A0", "label": "REVERB DECAY", "min": 1, "max": 290, "format": "time", "fmt": {"points": [[1, 0.01], [84, 0.84], [146, 5.2], [290, 20]]}, "default": 100} ],
      [ null,
        null ]
    ] },
    { "title": "GUITAR DELAY", "layout": "image", "control": {"param": "0x353", "label": "CONTROL", "min": 0, "max": 1, "format": "list", "values": ["OFF", "ON"], "default": 1}, "images": [123, 123, 123, 123, 123, 123, 123, 16, 24, 13, 23, 23, 18, 26, 133, 120], "showWhen": {"0x362": 1}, "rows": [
      [ {"param": "0x151", "label": "DELAY", "min": 0, "max": 15, "format": "list", "values": ["FLASHBACK 2290", "FLASHBACK ANALOG", "FLASHBACK TAPE", "FLASHBACK LOFI", "FLASHBACK SLAP", "EDGE-Y MOD", "ANALOG MODUL8R", "HALF", "QUARTER", "DOTTED 1/8", "PING PONG", "PING PONG FX", "MULTITAP", "300 MS", "LONG & THIN", "REVERB TANK"], "default": 0},
        null ],
      [ {"param": "0x0D7", "label": "DELAY LEVEL", "min": -51, "max": 0, "format": "dB", "default": 0},
        {"param": "0x168", "label": "FEEDBACK", "min": 0, "max": 100, "format": "number", "default": 50} ],
      [ null,
        null ]
    ] },
    { "title": "GUITAR uMOD", "layout": "image", "control": {"param": "0x357", "label": "CONTROL", "min": 0, "max": 1, "format": "list", "values": ["OFF", "ON"], "default": 1}, "images": [11, 11, 11, 141, 141, 141], "showWhen": {"0x362": 1}, "rows": [
      [ {"param": "0x125", "label": "uMOD", "min": 0, "max": 5, "format": "list", "values": ["CHORUS 12:00", "CHORUS FAST", "CHORUS SLOW", "SILKY DETUNE", "MEDIUM DETUNE", "MONO CHORUS"], "default": 0},
        null ],
      [ {"param": "0x0D6", "label": "UMOD LEVEL", "min": -51, "max": 0, "format": "dB", "default": 0},
        {"param": "0x131", "label": "SPEED", "min": 5, "max": 1000, "format": "scale", "fmt": {"mul": 0.01, "unit": "Hz", "dec": 2}, "default": 150} ],
      [ null,
        null ]
    ] },
    { "title": "BODYREZ EQ", "layout": "image", "images": [10, 42, 9, 4, 5, 6, 7, 8], "showWhen": {"0x362": 1}, "rows": [
      [ {"param": "0x2AD", "label": "STYLE", "min": 0, "max": 7, "format": "list", "values": ["CUSTOM", "FLAT", "JUST COMP", "BODYREZ 1", "BODYREZ 2", "BODYREZ 3", "BODYREZ 4", "BODYREZ 5"], "default": 3},
        null ],
      [ {"param": "0x2AF", "label": "AMOUNT", "min": 0, "max": 10, "format": "number", "default": 10},
        {"param": "0x2B3", "label": "LOW GAIN", "min": -12, "max": 12, "format": "dB", "default": 0} ],
      [ {"param": "0x2B7", "label": "HI GAIN", "min": -12, "max": 12, "format": "dB", "default": 0},
        null ]
    ] },
    { "title": "BODYREZ SHELF EQ", "showWhen": {"0x362": 1}, "rows": [
      [ {"param": "0x033", "label": "LOW FREQ", "min": 0, "max": 240, "format": "number", "default": 140},
        {"param": "0x051", "label": "HI FREQ", "min": 0, "max": 240, "format": "number", "default": 140} ],
      [ {"param": "0x2B3", "label": "LOW GAIN", "min": -12, "max": 12, "format": "dB", "default": 0},
        {"param": "0x2B7", "label": "HI GAIN", "min": -12, "max": 12, "format": "dB", "default": 0} ],
      [ null,
        null ]
    ] },
    { "title": "BODYREZ PARAMETRIC EQ", "showWhen": {"0x362": 1}, "rows": [
      [ {"param": "0x032", "label": "PARA 1 FREQ", "min": 0, "max": 240, "format": "number", "default": 140},
        {"param": "0x050", "label": "PARA 2 FREQ", "min": 0, "max": 240, "format": "number", "default": 140} ],
      [ {"param": "0x038", "label": "PARA 1 WIDTH", "min": 0, "max": 32, "format": "list", "values": ["NARROW", "0.11", "0.12", "0.14", "0.18", "0.22", "0.25", "0.28", "0.31", "0.35", "0.40", "0.46", "0.54", "0.63", "0.74", "0.87", "1.00", "1.18", "1.36", "1.56", "1.79", "2.04", "2.34", "2.68", "3.09", "3.58", "4.16", "4.84", "5.64", "6.57", "7.61", "8.77", "WIDE"], "default": 16},
        {"param": "0x056", "label": "PARA 2 WIDTH", "min": 0, "max": 32, "format": "list", "values": ["NARROW", "0.11", "0.12", "0.14", "0.18", "0.22", "0.25", "0.28", "0.31", "0.35", "0.40", "0.46", "0.54", "0.63", "0.74", "0.87", "1.00", "1.18", "1.36", "1.56", "1.79", "2.04", "2.34", "2.68", "3.09", "3.58", "4.16", "4.84", "5.64", "6.57", "7.61", "8.77", "WIDE"], "default": 16} ],
      [ {"param": "0x2B1", "label": "PARA 1 GAIN", "min": -12, "max": 12, "format": "dB", "default": 0},
        {"param": "0x2B5", "label": "PARA 2 GAIN", "min": -12, "max": 12, "format": "dB", "default": 0} ]
    ] },
    { "title": "BODYREZ COMPRESSOR", "showWhen": {"0x362": 1}, "rows": [
      [ {"param": "0x2BB", "label": "THRESHOLD", "min": -30, "max": 0, "format": "dB", "default": 0},
        {"param": "0x32A", "label": "RATIO", "min": 0, "max": 14, "format": "list", "values": ["1.0", "1.1", "1.2", "1.4", "1.6", "1.8", "2.0", "2.5", "3.2", "4.0", "5.6", "8.0", "16", "32", "64"], "default": 5} ],
      [ {"param": "0x32D", "label": "ATTACK", "min": 0, "max": 19, "format": "number", "default": 0},
        {"param": "0x32E", "label": "RELEASE", "min": 0, "max": 19, "format": "number", "default": 9} ],
      [ {"param": "0x2BD", "label": "MAKEUP GAIN", "min": 0, "max": 12, "format": "dB", "default": 0},
        {"param": "0x2B9", "label": "AMBIENCE", "min": -21, "max": 0, "format": "dB", "default": 0} ]
    ] }
  ] },
  "GUITAR ADV": { "button": "GUITAR FX (advanced)", "pages": [
    { "title": "GUITAR REVERB", "rows": [
      [ {"param": "0x1A3", "label": "REVERB PRE DLY", "min": 0, "max": 100, "format": "ms", "default": 50},
        null ],
      [ null,
        null ],
      [ null,
        null ]
    ] },
    { "title": "GUITAR DELAY", "rows": [
      [ {"param": "0x158", "label": "TEMPO", "min": 45, "max": 300, "format": "BPM", "default": 120},
        {"param": "0x17E", "label": "FILTER", "min": 0, "max": 12, "format": "list", "values": ["DIGITAL", "TAPE", "ANALOG", "RADIO", "MEGAPHONE", "CELL PHONE", "LO-FI", "HI CUT 1", "HI CUT 2", "HI CUT 3", "LOW CUT 1", "LOW CUT 2", "LOW CUT 3"], "default": 0} ],
      [ null,
        null ],
      [ null,
        null ]
    ] },
    { "title": "GUITAR uMOD", "rows": [
      [ {"param": "0x12C", "label": "DEPTH", "min": 0, "max": 100, "format": "%", "default": 0},
        null ],
      [ null,
        null ],
      [ null,
        null ]
    ] }
  ] },
  "MIX": { "button": "MIX", "pages": [
    { "title": "MIX", "showWhen": {"0x295": 1}, "rows": [
      [ {"param": "0x0BB", "label": "GUITAR LEVEL", "min": -36, "max": 0, "format": "dB", "default": 0},
        {"param": "0x0BE", "label": "HEADPHONE LEVEL", "min": -36, "max": 0, "format": "dB", "default": 0} ],
      [ {"param": "0x2AC", "label": "LOOP LEVEL", "min": -36, "max": 0, "format": "dB", "default": 0},
        null ],
      [ {"param": "0x275", "label": "AUX", "min": -61, "max": 0, "format": "dB", "default": -5},
        {"param": "0x0BC", "label": "OUT LEVEL", "min": -36, "max": 0, "format": "dB", "default": 0} ]
    ] },
    { "title": "MIX", "showWhen": {"0x295": 1}, "rows": [
      [ {"param": "0x0BF", "label": "USB IN LEVEL", "min": -36, "max": 0, "format": "dB", "default": 0},
        {"param": "0x0C1", "label": "HARMONY", "min": -36, "max": 6, "format": "dB", "default": 0} ],
      [ {"param": "0x0BD", "label": "USB OUT LEVEL", "min": -36, "max": 0, "format": "dB", "default": 0},
        {"param": "0x0C0", "label": "DELAY/REVERB", "min": -36, "max": 6, "format": "dB", "default": 0} ],
      [ null,
        null ]
    ] },
    { "title": "MIX", "showWhen": {"0x295": 0}, "rows": [
      [ {"param": "0x0BB", "label": "GUITAR LEVEL", "min": -36, "max": 0, "format": "dB", "default": 0},
        {"param": "0x0BE", "label": "HEADPHONE LEVEL", "min": -36, "max": 0, "format": "dB", "default": 0} ],
      [ {"param": "0x2AC", "label": "LOOP LEVEL", "min": -36, "max": 0, "format": "dB", "default": 0},
        null ],
      [ {"param": "0x276", "label": "ROOMSENSE", "min": -36, "max": 0, "format": "dB", "default": -36},
        {"param": "0x0BC", "label": "OUT LEVEL", "min": -36, "max": 0, "format": "dB", "default": 0} ]
    ] },
    { "title": "MIX", "showWhen": {"0x295": 0}, "rows": [
      [ {"param": "0x0BF", "label": "USB IN LEVEL", "min": -36, "max": 0, "format": "dB", "default": 0},
        {"param": "0x0C1", "label": "HARMONY", "min": -36, "max": 6, "format": "dB", "default": 0} ],
      [ {"param": "0x0BD", "label": "USB OUT LEVEL", "min": -36, "max": 0, "format": "dB", "default": 0},
        {"param": "0x0C0", "label": "DELAY/REVERB", "min": -36, "max": 6, "format": "dB", "default": 0} ],
      [ null,
        null ]
    ] }
  ] },
  "SETUP": { "button": "SETUP", "pages": [
    { "title": "INPUT", "rows": [
      [ {"param": "0x272", "label": "INPUT", "min": 0, "max": 6, "format": "list", "values": ["DYNAMIC MIC", "CONDENSER MIC", "MP-75 MIC", "E835FX MIC", "MP-76 MIC", "USB", "ROOMSENSE"], "default": 0},
        null ],
      [ {"param": "0x2A7", "label": "ROOMSENSE", "min": 0, "max": 1, "format": "list", "values": ["AMBIENT", "AMBIENT/AUTO"], "default": 0},
        {"param": "0x2A9", "label": "TONE STYLE", "min": 0, "max": 8, "format": "list", "values": ["OFF", "NORMAL", "LESS BRIGHT", "NORM + WARMTH", "MORE COMP", "NORM NO GATE", "LESS BRIGHT NG", "WARMTH NG", "MORE COMP NG"], "default": 1} ],
      [ {"param": "0x283", "label": "GUITAR", "min": -31, "max": 24, "format": "dB", "default": 5},
        {"param": "0x270", "label": "PITCH CORRECTION", "min": 0, "max": 100, "format": "OFF/%", "default": 0} ]
    ] },
    { "title": "OUTPUT", "rows": [
      [ {"param": "0x0E9", "label": "OUTPUT", "min": 0, "max": 3, "format": "list", "values": ["VOICE/GUITAR (DI)", "STEREO", "MONO", "DAW TRACKING"], "default": 0},
        {"param": "0x312", "label": "HEADPHONE LIM", "min": -61, "max": 0, "format": "dB", "default": 0} ],
      [ {"param": "0x317", "label": "VOCAL CANCEL", "min": 0, "max": 1, "format": "list", "values": ["OFF", "ON"], "default": 0},
        {"param": "0x28D", "label": "LEAD MUTE", "min": 0, "max": 1, "format": "list", "values": ["OFF", "ON"], "default": 0} ],
      [ null,
        null ]
    ] },
    { "title": "SYSTEM", "rows": [
      [ {"param": "0x29F", "label": "LCD CONTRAST", "min": 0, "max": 5, "format": "number", "default": 2},
        {"param": "0x281", "label": "TUNE REFERENCE", "min": 840, "max": 920, "format": "Hz/2", "default": 880} ],
      [ {"param": "0x2A0", "label": "UP/DN FUNCTION", "min": 0, "max": 1, "format": "list", "values": ["LOOPING", "SET KEY"], "default": 0},
        {"param": "0x2AB", "label": "AUX TO MAIN OUT", "min": 0, "max": 1, "format": "list", "values": ["OFF", "ON"], "default": 1} ],
      [ {"param": "0x28C", "label": "LEAD DELAY", "min": 0, "max": 2, "format": "list", "values": ["NONE", "VOICE SYNC", "AUTO"], "default": 0},
        {"param": "0x2AA", "label": "AUX IN TYPE", "min": 0, "max": 1, "format": "list", "values": ["LIVE", "TRACKS"], "default": 1} ]
    ] },
    { "title": "SYSTEM", "rows": [
      [ {"param": "0x287", "label": "GLOBAL KEY", "min": 0, "max": 1, "format": "list", "values": ["OFF", "ON"], "default": 0},
        {"param": "0x329", "label": "GUITAR GATE", "min": -81, "max": 0, "format": "dB", "default": -81} ],
      [ {"param": "0x28B", "label": "GLOBAL TEMPO", "min": 0, "max": 1, "format": "list", "values": ["OFF", "ON"], "default": 0},
        {"param": "0x352", "label": "MIC BOOST", "min": 0, "max": 2, "format": "list", "values": ["OFF", "LOW", "HIGH"], "default": 1} ],
      [ {"param": "0x35A", "label": "ROOMSENSE LOCUT", "min": 0, "max": 112, "format": "curve", "fmt": {"points": [[0, 20], [56, 101], [80, 202], [112, 508]], "unit": "Hz"}, "default": 32},
        {"param": "0x362", "label": "BODYREZ EDITING", "min": 0, "max": 1, "format": "list", "values": ["BASIC", "ADVANCED"], "default": 0} ]
    ] },
    { "title": "GUITAR ANTI-FEEDBACK", "rows": [
      [ {"param": "0x347", "label": "PHASE INVERT", "min": 0, "max": 1, "format": "list", "values": ["OFF", "ON"], "default": 0},
        {"param": "0x03F", "label": "NOTCH GAIN", "min": -12, "max": 12, "format": "dB", "default": 0} ],
      [ {"param": "0x348", "label": "LOW CUT", "min": 0, "max": 86, "format": "curve", "fmt": {"points": [[0, 20], [81, 207], [86, 240]], "unit": "Hz"}, "default": 38},
        {"param": "0x05A", "label": "NOTCH FREQ", "min": 45, "max": 97, "format": "number", "default": 69} ],
      [ null,
        null ]
    ] },
    { "title": "SYSTEM", "showWhen": {"0x39F": 1}, "rows": [
      [ {"param": "0x286", "label": "GLOBAL GUITAR FX", "min": 0, "max": 1, "format": "list", "values": ["OFF", "ON"], "default": 1},
        null ],
      [ {"param": "0x349", "label": "GUITAR BOOST AMT", "min": 0, "max": 9, "format": "dB", "default": 6},
        null ],
      [ {"param": "0x39F", "label": "FOOTSWITCH", "min": 0, "max": 1, "format": "list", "values": ["SWITCH-3", "SWITCH-6"], "default": 1},
        {"param": "0x3A0", "label": "SWITCH-6 MODE", "min": 0, "max": 2, "format": "list", "values": ["DEFAULT", "GUITAR", "CUSTOM"], "default": 0} ]
    ] },
    { "title": "SYSTEM", "showWhen": {"0x39F": 0}, "rows": [
      [ {"param": "0x286", "label": "GLOBAL GUITAR FX", "min": 0, "max": 1, "format": "list", "values": ["OFF", "ON"], "default": 1},
        null ],
      [ {"param": "0x349", "label": "GUITAR BOOST AMT", "min": 0, "max": 9, "format": "dB", "default": 6},
        null ],
      [ {"param": "0x39F", "label": "FOOTSWITCH", "min": 0, "max": 1, "format": "list", "values": ["SWITCH-3", "SWITCH-6"], "default": 1},
        {"param": "0x35B", "label": "CONTROL", "min": 0, "max": 1, "format": "list", "values": ["LOOP MODE", "CUSTOM"], "default": 1} ]
    ] },
    { "title": "SWITCH-3", "showWhen": {"0x39F": 0}, "rows": [
      [ {"param": "0x393", "label": "SWITCH 1", "min": 0, "max": 29, "format": "list", "values": ["LOOP REC/PLAY", "LOOP STOP/ERASE", "LOOP UNDO", "LOOP START/STOP", "1 BTN LOOPER", "TAP TEMPO", "HARMONY", "HARM MOMENT", "DELAY", "DELAY MOMENT", "uMOD", "TRANSDUCER", "HARDTUNE", "DOUBLING", "REVERB", "GTR BOOST", "GTR UMOD", "GTR DELAY", "GTR REVERB", "GTR PHASE", "SET KEY", "HIT", "PRESET DOWN", "PRESET UP", "MIDI CC 102", "MIDI CC 103", "MIDI CC 104", "MIDI CC 105", "MIDI CC 106", "MIDI CC 107"], "default": 0},
        null ],
      [ {"param": "0x394", "label": "SWITCH 2", "min": 0, "max": 29, "format": "list", "values": ["LOOP REC/PLAY", "LOOP STOP/ERASE", "LOOP UNDO", "LOOP START/STOP", "1 BTN LOOPER", "TAP TEMPO", "HARMONY", "HARM MOMENT", "DELAY", "DELAY MOMENT", "uMOD", "TRANSDUCER", "HARDTUNE", "DOUBLING", "REVERB", "GTR BOOST", "GTR UMOD", "GTR DELAY", "GTR REVERB", "GTR PHASE", "SET KEY", "HIT", "PRESET DOWN", "PRESET UP", "MIDI CC 102", "MIDI CC 103", "MIDI CC 104", "MIDI CC 105", "MIDI CC 106", "MIDI CC 107"], "default": 1},
        null ],
      [ {"param": "0x395", "label": "SWITCH 3", "min": 0, "max": 29, "format": "list", "values": ["LOOP REC/PLAY", "LOOP STOP/ERASE", "LOOP UNDO", "LOOP START/STOP", "1 BTN LOOPER", "TAP TEMPO", "HARMONY", "HARM MOMENT", "DELAY", "DELAY MOMENT", "uMOD", "TRANSDUCER", "HARDTUNE", "DOUBLING", "REVERB", "GTR BOOST", "GTR UMOD", "GTR DELAY", "GTR REVERB", "GTR PHASE", "SET KEY", "HIT", "PRESET DOWN", "PRESET UP", "MIDI CC 102", "MIDI CC 103", "MIDI CC 104", "MIDI CC 105", "MIDI CC 106", "MIDI CC 107"], "default": 2},
        null ]
    ] },
    { "title": "SWITCH-6", "showWhen": {"0x39F": 1}, "rows": [
      [ {"param": "0x3A7", "label": "SWITCH 1", "min": 0, "max": 29, "format": "list", "values": ["LOOP REC/PLAY", "LOOP STOP/ERASE", "LOOP UNDO", "LOOP START/STOP", "1 BTN LOOPER", "TAP TEMPO", "HARMONY", "HARM MOMENT", "DELAY", "DELAY MOMENT", "uMOD", "TRANSDUCER", "HARDTUNE", "DOUBLING", "REVERB", "GTR BOOST", "GTR UMOD", "GTR DELAY", "GTR REVERB", "GTR PHASE", "SET KEY", "HIT", "PRESET DOWN", "PRESET UP", "MIDI CC 102", "MIDI CC 103", "MIDI CC 104", "MIDI CC 105", "MIDI CC 106", "MIDI CC 107"], "default": 0},
        {"param": "0x3A8", "label": "SWITCH 2", "min": 0, "max": 29, "format": "list", "values": ["LOOP REC/PLAY", "LOOP STOP/ERASE", "LOOP UNDO", "LOOP START/STOP", "1 BTN LOOPER", "TAP TEMPO", "HARMONY", "HARM MOMENT", "DELAY", "DELAY MOMENT", "uMOD", "TRANSDUCER", "HARDTUNE", "DOUBLING", "REVERB", "GTR BOOST", "GTR UMOD", "GTR DELAY", "GTR REVERB", "GTR PHASE", "SET KEY", "HIT", "PRESET DOWN", "PRESET UP", "MIDI CC 102", "MIDI CC 103", "MIDI CC 104", "MIDI CC 105", "MIDI CC 106", "MIDI CC 107"], "default": 2} ],
      [ {"param": "0x3A9", "label": "SWITCH 3", "min": 0, "max": 29, "format": "list", "values": ["LOOP REC/PLAY", "LOOP STOP/ERASE", "LOOP UNDO", "LOOP START/STOP", "1 BTN LOOPER", "TAP TEMPO", "HARMONY", "HARM MOMENT", "DELAY", "DELAY MOMENT", "uMOD", "TRANSDUCER", "HARDTUNE", "DOUBLING", "REVERB", "GTR BOOST", "GTR UMOD", "GTR DELAY", "GTR REVERB", "GTR PHASE", "SET KEY", "HIT", "PRESET DOWN", "PRESET UP", "MIDI CC 102", "MIDI CC 103", "MIDI CC 104", "MIDI CC 105", "MIDI CC 106", "MIDI CC 107"], "default": 4},
        {"param": "0x3AA", "label": "SWITCH 4", "min": 0, "max": 29, "format": "list", "values": ["LOOP REC/PLAY", "LOOP STOP/ERASE", "LOOP UNDO", "LOOP START/STOP", "1 BTN LOOPER", "TAP TEMPO", "HARMONY", "HARM MOMENT", "DELAY", "DELAY MOMENT", "uMOD", "TRANSDUCER", "HARDTUNE", "DOUBLING", "REVERB", "GTR BOOST", "GTR UMOD", "GTR DELAY", "GTR REVERB", "GTR PHASE", "SET KEY", "HIT", "PRESET DOWN", "PRESET UP", "MIDI CC 102", "MIDI CC 103", "MIDI CC 104", "MIDI CC 105", "MIDI CC 106", "MIDI CC 107"], "default": 6} ],
      [ {"param": "0x3AB", "label": "SWITCH 5", "min": 0, "max": 29, "format": "list", "values": ["LOOP REC/PLAY", "LOOP STOP/ERASE", "LOOP UNDO", "LOOP START/STOP", "1 BTN LOOPER", "TAP TEMPO", "HARMONY", "HARM MOMENT", "DELAY", "DELAY MOMENT", "uMOD", "TRANSDUCER", "HARDTUNE", "DOUBLING", "REVERB", "GTR BOOST", "GTR UMOD", "GTR DELAY", "GTR REVERB", "GTR PHASE", "SET KEY", "HIT", "PRESET DOWN", "PRESET UP", "MIDI CC 102", "MIDI CC 103", "MIDI CC 104", "MIDI CC 105", "MIDI CC 106", "MIDI CC 107"], "default": 7},
        {"param": "0x3AC", "label": "SWITCH 6", "min": 0, "max": 29, "format": "list", "values": ["LOOP REC/PLAY", "LOOP STOP/ERASE", "LOOP UNDO", "LOOP START/STOP", "1 BTN LOOPER", "TAP TEMPO", "HARMONY", "HARM MOMENT", "DELAY", "DELAY MOMENT", "uMOD", "TRANSDUCER", "HARDTUNE", "DOUBLING", "REVERB", "GTR BOOST", "GTR UMOD", "GTR DELAY", "GTR REVERB", "GTR PHASE", "SET KEY", "HIT", "PRESET DOWN", "PRESET UP", "MIDI CC 102", "MIDI CC 103", "MIDI CC 104", "MIDI CC 105", "MIDI CC 106", "MIDI CC 107"], "default": 4} ]
    ] },
    { "title": "MIC CONTROL", "rows": [
      [ {"param": "0x39A", "label": "MP76 CONTROL", "min": 0, "max": 1, "format": "list", "values": ["DEFAULT", "CUSTOM"], "default": 0},
        {"param": "0x29E", "label": "MP75 CONTROL", "min": 0, "max": 3, "format": "number", "default": 0} ],
      [ {"param": "0x39E", "label": "MP76 TOP", "min": 0, "max": 17, "format": "list", "values": ["PRESET DOWN", "PRESET UP", "HIT", "HIT & TALK", "HIT & TAP", "LOOP", "LOOP STOP/CLEAR", "LOOP UNDO", "TAP TEMPO", "uMOD", "DELAY", "DELAY MOMENT", "REVERB", "HARMONY", "HARM MOMENT", "DOUBLING", "TRANSDUCER", "HARDTUNE"], "default": 0},
        {"param": "0x39C", "label": "MP76 BOTTOM", "min": 0, "max": 17, "format": "list", "values": ["PRESET DOWN", "PRESET UP", "HIT", "HIT & TALK", "HIT & TAP", "LOOP", "LOOP STOP/CLEAR", "LOOP UNDO", "TAP TEMPO", "uMOD", "DELAY", "DELAY MOMENT", "REVERB", "HARMONY", "HARM MOMENT", "DOUBLING", "TRANSDUCER", "HARDTUNE"], "default": 0} ],
      [ {"param": "0x39D", "label": "MP76 LEFT", "min": 0, "max": 17, "format": "list", "values": ["PRESET DOWN", "PRESET UP", "HIT", "HIT & TALK", "HIT & TAP", "LOOP", "LOOP STOP/CLEAR", "LOOP UNDO", "TAP TEMPO", "uMOD", "DELAY", "DELAY MOMENT", "REVERB", "HARMONY", "HARM MOMENT", "DOUBLING", "TRANSDUCER", "HARDTUNE"], "default": 0},
        {"param": "0x39B", "label": "MP76 RIGHT", "min": 0, "max": 17, "format": "list", "values": ["PRESET DOWN", "PRESET UP", "HIT", "HIT & TALK", "HIT & TAP", "LOOP", "LOOP STOP/CLEAR", "LOOP UNDO", "TAP TEMPO", "uMOD", "DELAY", "DELAY MOMENT", "REVERB", "HARMONY", "HARM MOMENT", "DOUBLING", "TRANSDUCER", "HARDTUNE"], "default": 0} ]
    ] },
    { "title": "LOOP", "rows": [
      [ {"param": "0x11B", "label": "INPUT", "min": 0, "max": 5, "format": "list", "values": ["VOCAL", "GUITAR", "AUX", "VOCAL + GUITAR", "GUITAR + AUX", "ALL"], "default": 5},
        null ],
      [ {"param": "0x2A2", "label": "UNDO", "min": 0, "max": 1, "format": "list", "values": ["OFF", "ON"], "default": 1},
        null ],
      [ {"param": "0x2A1", "label": "LOOP FEEDBACK", "min": 0, "max": 100, "format": "%", "default": 98},
        null ]
    ] },
    { "title": "PRODUCT INFO", "text": ["FIRMWARE VERSION: \u2014", "SERIAL NUMBER: \u2014", "MANUFACTURE DATE: \u2014"] }
  ] }
};
