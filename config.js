/* =========================================================
   SITE SETTINGS — this is the only file most people need to edit.
   Change the text between the "quotes", save, and refresh.
   ========================================================= */

// ✏️ 1. Your published Google Sheet (CSV link).
//    In Google Sheets: File → Share → Publish to web → choose the sheet → "Comma-separated values (.csv)" → Publish.
//    Paste the link between the quotes. Leave it empty ("") to use data/events.json instead.
var SHEET_CSV_URL = "";

// ✏️ 2. The Google Form people use to suggest an event.
var GOOGLE_FORM_URL = "https://forms.gle/REPLACE_WITH_YOUR_FORM";

// ✏️ 3. Backup event list, used if the sheet link is empty or doesn't load.
var FALLBACK_JSON_URL = "data/events.json";

// ✏️ 4. Where the map starts (London) and how zoomed in it is.
var MAP_CENTRE = [51.5072, -0.1276];
var MAP_ZOOM = 10;

/* ---- You don't need to edit below this line ---- */
window.AAG_CONFIG = {
  SHEET_CSV_URL: SHEET_CSV_URL,
  GOOGLE_FORM_URL: GOOGLE_FORM_URL,
  FALLBACK_JSON_URL: FALLBACK_JSON_URL,
  MAP_CENTRE: MAP_CENTRE,
  MAP_ZOOM: MAP_ZOOM
};
