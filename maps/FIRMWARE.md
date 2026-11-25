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
