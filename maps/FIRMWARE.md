# Play Electric: what the firmware says

`maps/pe-firmware-params.json` holds the parameter table read straight from the stock firmware **PlayElectric 1.3.00 Build 34**. It has names, ranges, defaults and value lists for 919 IDs. It was regenerated with:

```
node tools/pe-firmware-extract.js "PlayElectric 1.3.00 Build34.syx" > maps/pe-firmware-params.json
```

The .syx file is TC-Helicon's property, so it is not in this repo. The stock file comes from the oddeyez.se editor, at `/app/firmware/PlayElectric%201.3.00%20Build34.syx`. Its SHA-256 is `0cb2cd9b…1b16`. The method comes from open-acoustic `docs/ANALYSIS.md`.

## Trust
- The table agrees with **all 43 IDs** confirmed by hand on a real Play Electric, in name and in range.
- It also explains things seen on the unit:
  - the master/follower pairs (`hi` = follower);
  - reverb DECAY 1..290;
  - the 17 guitar uMOD styles.
- It caught one bug in the hand-made map: the vocal DELAY STYLE list was missing **DOTTED 1/4** at position 5. This is now fixed.
- Value lists are only included where they are anchored and checked. The firmware stores no per-list counts.

## New, still to confirm on the pedal
| ID | Name | Range | Notes |
|---|---|---|---|
| 0x000 | AMP (style) | 0..25 | CLEAN BRIT … DISTORTION PEDAL, ACOUSTIC, ACOUSTIC SHAPE. DARK OD PEDAL = 22, as in the manual. 0x001 is a second, image-less copy. |
| 0x05C / 0x05D / 0x05E / 0x05F | BASS / MID / MID FREQ / TREBLE | ±9 dB; MID FREQ 87..174 (frequency table) | Electric-only. Most likely the amp tone page. |
| 0x313 (+0x314) | DRIVE | −9..60 | **confirmed** |
| 0x315 (+0x316) | LEVEL | −40..18 dB | **confirmed** |
| 0x309 / 0x30A | PRE GAIN / POST GAIN | | Set by the amp model. **Not the amp style.** Don't write to them. |
| 0x32F | BOOST | 0..1 | |
| 0x2FA | COMPRESSOR STYLE | 0..4 | SUBTLE TUBE, SUBTLE SUSTAIN, SUSTAIN ATTACK, SUSTAIN POP, PUMPING |
| 0x2FC (+0x2FD) | COMPRESSOR AMOUNT | 0..100 | |
| 0x300 (+0x301) | COMPRESSOR MAKEUP | 0..24 dB | |
| 0x2F9 | GUITAR GATE | −81..0 | |
| 0x32B / 0x32D | COMPRESSOR / AMP on-off | | **confirmed** |

The Play Electric uses the Play Acoustic's IDs + 2 for the first block, because AMP was inserted at 0x000/0x001. Later blocks move by other amounts, so the Acoustic map can't be reused as it is.

## Pictures
`maps/pe-images.js` holds the AMP and COMPRESSOR style pictures, taken from the same firmware:

```
node tools/pe-images-extract.js "PlayElectric 1.3.00 Build34.syx" > maps/pe-images.js
```

Where they come from in the firmware:
- the image table sits at load X:439EAA and holds 146 entries;
- the style-picture sets sit at X:439A7C (set 8 = AMP, set 10 = COMPRESSOR), with their entries 2 ahead of the table.

OD PEDAL, DARK OD PEDAL and DISTORTION PEDAL point at 36×36 icons whose pixels aren't in the file. They show the pedal-with-cable picture instead.

## Never written on the Play Electric
These are enforced in app.js as `NEVER_PE`:
- 0x255 MIDI CTRL, 0x256 MIDI CHAN, 0x257 CC CHAN, 0x258 FILTER, 0x259 SYSEXID;
- 0x272–0x279 and 0x386–0x389, the utility/sensor flags;
- 0x2D7–0x2DA, the send/erase preset and clean-bank commands.

The Play Acoustic's 0x278–0x27C are different things on the Electric. They stay blocked too, through pa-link.

## Added later (2026-11-25, on the user's Play Electric)
- Advanced parameters taken from the firmware table and checked by reading them on the pedal. They also match the preset data where the preset stores them.
  - Voice: HARMONY SCALE 0x07E, HUMANIZE 0x077, DELAY FILTER 0x167, TRANSDUCER ROUTING 0x227 / GAIN 0x22C / GATE THRESHOLD 0x065.
  - Guitar: REVERB PRE DLY 0x181, DELAY FILTER 0x168, uMOD DEPTH 0x126, uMOD LEVEL 0x0DF.
- SWITCH-3 SWITCH 1/2/3 = **0x34A / 0x34B / 0x34C**.
  - These are the registers the pedal shows. 0x331–0x333 are copies: writing 0x331 alone doesn't change the screen.
  - They take the Electric's 31-item list, LOOP REC/PLAY … MIDI CC 107.
- Preset data (`45 bank num`) is a header plus 4 packets. Each packet holds a chunk byte, 25 values of 4 bytes (encode28) and a checksum.
  - `PE_SLOTS` in app.js maps each slot to its ID. All 47 mapped preset values decode, and were checked on 3 presets.
  - `45 00 00` returns the edit buffer, unsaved edits included.
- Not mapped yet: PORTAMENTO (0x342?), SWITCH-6, MP75 CONTROL (0x27C, blocked by pa-link because the Acoustic uses that ID for SYSEXID).

## The preset parameter table (found 2026-11-25)
- The firmware holds the list of parameters a preset stores, in packet order. On PE 1.3.00 it sits at X:441933C and has 79 IDs:
  0x000, 0x02F, 0x03F, 0x045, 0x050, 0x065, 0x071, 0x07B, 0x07E, 0x0A3, 0x0C2 … 0x32D, 0x340–0x349.
- It agrees with every slot found by matching presets on the unit, and app.js uses it as PE_SLOT_IDS.
- It also corrects HUMANIZE: the stored one is 0x341 (0x077 "HUMANIZE AMOUNT" isn't stored). It adds PORTAMENTO at 0x342.
- **Play Acoustic**: the same table in PA 1.3.00 at X:436842. It has 118 IDs (5 packets) and app.js uses it as PA_SLOT_IDS.
  It was found from its likeness to the Electric's table. It hasn't been checked on a real Acoustic yet.

## Frequency controls 0..240 (2026-11-26)
- LOW / HI / PARA FREQ (BodyRez), AutoShape LB/HB, MID FREQ and other 0..240 "frequency table" controls have 241 steps from 20 Hz to 20 kHz. That's 3 decades × 80, which is 1/24 octave per step: **f = 20 × 10^(v/80)**.
- The firmware has no stored table to confirm this. It formats the value at run time ("%4.0f Hz", " KHz").
- The Electric's amp MID FREQ range 87..174 comes out as 244 Hz … 2.95 kHz, a typical amp mid band. So the formula is likely right.
- It hasn't been read off a pedal's screen yet, so the app shows these values as "≈".
- The BodyRez PARA WIDTH list is in octaves (NARROW, 0.11 … 8.77, WIDE). The app's EQ curve uses Q = √(2^bw) / (2^bw − 1).

## Menu tables and the pedal's own pages (2026-11-26)
- The menu tree of PE 1.3.00 is a 4-word top-level list at load X:43749B: `{title, page data, 0, 0}`. Page data starts at X:4372DB and holds 8-word sub-page entries `{title, item list, variant, 0, flags, …}`. Item lists are 18 words (3 rows × `{row, 0, param L, param R, -, -}`); **0x35D = empty cell**. These are run addresses: **run = load + 0x3ADE96** in this record. Titles are strings at run − 0x2A270, like the parameter names.
- Pages in the order ◀ ▶ walk them (entries with the same title are variants the pedal picks between, and take one place):
  - **Effects (VOCAL FX):** HARMONY, DOUBLE, DELAY (×2: TEMPO / DELAY TIME advanced), REVERB, HARDTUNE, TRANSDUCER, uMOD. EffectsAdvanced has the same 8 entries.
  - **GuitarFX:** GUITAR AMP (or GUITAR AMP (BOOST), with DRIVE 0x317 / LEVEL 0x319), GUITAR COMPRESSOR, GUITAR uMOD (MIX 0x28D, SPEED 0x12A), GUITAR DELAY (×2), GUITAR REVERB. GuitarAdvanced: AMP = TREBLE 0x05F, MID 0x05D, MID FREQ 0x05E, BASS 0x05C; DELAY = TEMPO or DELAY TIME, DLY FILTER STYLE 0x168, DIVISION 0x340.
  - **Mixer:** MIX 1/2 (LEVEL 0x0C4, HEADPHONE LEVEL 0x0B2, LOOP LEVEL 0x290, AUX 0x252 or ROOMSENSE 0x253 or none, OUT LEVEL 0x0B1) and MIX 2/2 (0x0C8, 0x0CA, 0x0C9). There are 3 variants of the block, like on the Acoustic.
  - **Setup:** INPUT, OUTPUT, GUITAR, SYSTEM (page 2 shows SWITCH-6 MODE or SWITCH-3 MODE), SWITCH-3 / SWITCH-6, MIC CONTROL (MP76 CONTROL 0x339, MP75 CONTROL 0x27C, MP76 TOP/BOTTOM/LEFT/RIGHT 0x350/0x34E/0x34F/0x34D), LOOP, PRODUCT INFO.
  - Others: Home, Splash, FrontTest, SetKey, Looper, Genre, Store, practice, Tuner.
- Seen on the user's Electric:
  - A menu button reopens the page used last: VOCAL FX opened on uMOD.
  - The pages don't wrap: ▶ on uMOD stays on uMOD.
  - So BACK, BACK, menu button, ◀ × (pages − 1), ▶ × index always lands on the right page. Confirmed for DOUBLE and GUITAR REVERB.
  - The app's "Pedal" toggle (Effects view) does exactly this. It never presses the knob or SETUP. It checks 0x282 around the first arrow, and doesn't press arrows while the preset has unsaved edits.
