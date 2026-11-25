// Play Electric-only pages (AMP, COMPRESSOR). Names, ranges and lists come from the stock firmware
// (maps/pe-firmware-params.json) and were checked on a real Play Electric (maps/FIRMWARE.md).
// Cells use virtual ids 0x1000 + device id: they are above every real id, so on a Play Acoustic they are never
// read or written; on a Play Electric the built-in map (maps/play-electric.json) points each one at its device id.
(function () {
  const OFFON = ["OFF", "ON"], IMG = window.PE_STYLE_IMAGES || { amp: [], comp: [] };   // maps/pe-images.js
  window.PA_MENUS["PE GUITAR"] = { pages: [
    { title: "PE GUITAR AMP", layout: "image", images: IMG.amp,
      control: { param: "0x132D", label: "CONTROL", min: 0, max: 1, format: "list", values: OFFON, default: 1 },
      rows: [
        [{ param: "0x1000", label: "AMP", min: 0, max: 25, format: "list", default: 0, values: ["CLEAN BRIT", "CALI CLEAN", "UK CLEAN",
          "DEEP CLEAN", "BRIGHT SWITCH", "WARM", "LITTLE THING", "CHICKEN PICKER", "BRIT OD", "AC CRUNCH", "CHUNKY BRIT", "LIL CHAMPION",
          "CHIME DRIVE", "2X12 COMBO", "4X12 CRUNCH", "SWAMPTONE", "NASALTONE", "BROWN", "SCOOPED", "METALLIC", "DARK MATTER", "OD PEDAL",
          "DARK OD PEDAL", "DISTORTION PEDAL", "ACOUSTIC", "ACOUSTIC SHAPE"] }, null],
        [{ param: "0x1313", label: "DRIVE", min: -9, max: 60, format: "number", default: 0 },
         { param: "0x1315", label: "LEVEL", min: -40, max: 18, format: "number", default: 0 }],
      ] },
    { title: "PE GUITAR COMPRESSOR", layout: "image", images: IMG.comp,
      control: { param: "0x132B", label: "CONTROL", min: 0, max: 1, format: "list", values: OFFON, default: 0 },
      rows: [
        [{ param: "0x12FA", label: "STYLE", min: 0, max: 4, format: "list", default: 0,
           values: ["SUBTLE TUBE", "SUBTLE SUSTAIN", "SUSTAIN ATTACK", "SUSTAIN POP", "PUMPING"] }, null],
        [{ param: "0x12FC", label: "AMOUNT", min: 0, max: 100, format: "%", default: 0 },
         { param: "0x1300", label: "MAKEUP", min: 0, max: 24, format: "dB", default: 0 }],
      ] },
  ] };
})();
