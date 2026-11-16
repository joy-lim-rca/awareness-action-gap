/* data.js — loads the event list and works out dates.
   You normally don't need to edit this file.
   - Tries the Google Sheet (SHEET_CSV_URL in config.js) first
   - Falls back to events.json if that is empty or fails
   - Hides past events; recurring events ("Thursdays") always show */
(function () {
  "use strict";
  var AAG = (window.AAG = window.AAG || {});

  /* ---------- CSV reader (handles quotes, commas and new lines inside cells) ---------- */
  function parseCSV(text) {
    text = String(text).replace(/^﻿/, "");
    var rows = [], row = [], field = "", inQuotes = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
        } else { field += c; }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field); field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); rows.push(row); row = []; field = "";
      } else {
        field += c;
      }
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    rows = rows.filter(function (r) { return r.some(function (cell) { return cell.trim() !== ""; }); });
    if (!rows.length) return [];
    var headers = rows[0].map(function (h) { return h.trim().toLowerCase().replace(/\s+/g, "_"); });
    return rows.slice(1).map(function (r) {
      var o = {};
      headers.forEach(function (h, j) { if (h) o[h] = (r[j] || "").trim(); });
      return o;
    });
  }

  /* ---------- Small helpers ---------- */
  function str(v) { return v === undefined || v === null ? "" : String(v).trim(); }

  function yesNo(v) {
    var t = str(v).toLowerCase();
    if (["yes", "y", "true", "1"].indexOf(t) > -1) return "yes";
    if (["no", "n", "false", "0"].indexOf(t) > -1) return "no";
    return "unknown";
  }

  function cleanType(v) {
    var t = str(v).toLowerCase();
    if (t.indexOf("talk") === 0) return "Talk";
    if (t.indexOf("work") === 0) return "Workshop";
    if (t.indexOf("vol") === 0) return "Volunteering";
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : "Other";
  }

  function costKind(v) {
    var t = str(v).toLowerCase();
    if (!t || t === "unknown") return "unknown";
    if (t === "0" || t === "£0" || t.indexOf("free") > -1) return "free";
    return "paid";
  }

  // Accepts "2026-11-13 12:00", "2026-11-13T12:00", "2026-11-13",
  // and the UK style Google Sheets sometimes outputs: "13/11/2026 12:00:00"
  function parseDate(s) {
    s = str(s);
    var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T]+(\d{1,2})[:.](\d{2}))?/);
    var y, mo, d, h, mi;
    if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; h = m[4]; mi = m[5]; }
    else {
      m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2})[:.](\d{2}))?/);
      if (!m) return null;
      d = +m[1]; mo = +m[2]; y = +m[3]; h = m[4]; mi = m[5];
    }
    var hasTime = h !== undefined;
    return { date: new Date(y, mo - 1, d, hasTime ? +h : 0, hasTime ? +mi : 0), hasTime: hasTime };
  }

  // Accepts "12:30", "12.30", "12:30:00"
  function parseTime(s) {
    var m = str(s).match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?$/);
    return m ? { h: +m[1], m: +m[2] } : null;
  }

  function endOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59); }
  function atTime(day, t) { return new Date(day.getFullYear(), day.getMonth(), day.getDate(), t.h, t.m); }
  function sameDay(a, b) { return a.toDateString() === b.toDateString(); }

  // "Thursdays" → [4]; "Tuesdays and Fridays" → [2, 5]; "weekends" → [6, 0]
  function parseDays(text) {
    var t = str(text).toLowerCase(), days = [];
    var map = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
    (t.match(/\b(mon|tue|wed|thu|fri|sat|sun)/g) || []).forEach(function (k) {
      if (days.indexOf(map[k]) < 0) days.push(map[k]);
    });
    if (/weekend/.test(t)) days.push(6, 0);
    if (/weekday/.test(t)) days.push(1, 2, 3, 4, 5);
    if (/daily|every ?day/.test(t)) days.push(0, 1, 2, 3, 4, 5, 6);
    return days;
  }

  function nextRecurring(ev, now) {
    if (!ev.days.length) return null;
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (var i = 0; i < 14; i++) {
      var day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      if (ev.days.indexOf(day.getDay()) < 0) continue;
      var s = ev.startTime ? atTime(day, ev.startTime) : day;
      var e = ev.endTime ? atTime(day, ev.endTime) : endOfDay(day);
      if (e > now) return { start: s, end: e, hasTime: !!ev.startTime, endHasTime: !!ev.endTime };
    }
    return null;
  }

  /* ---------- Turn one row into an event ---------- */
  function buildEvent(row, now) {
    var title = str(row.title);
    if (!title) return null;
    var ev = {
      title: title,
      type: cleanType(row.type),
      location: str(row.location_name),
      postcode: str(row.postcode),
      link: str(row.link),
      note: str(row.note),
      costRaw: str(row.cost),
      cost: costKind(row.cost),
      beginner: yesNo(row.beginner_friendly),
      solo: yesNo(row.solo_ok),
      weWent: yesNo(row.we_went),
      recurringText: str(row.recurring)
    };

    if (ev.recurringText) {
      ev.kind = "recurring";
      ev.days = parseDays(ev.recurringText);
      ev.startTime = parseTime(row.start);
      ev.endTime = parseTime(row.end);
      ev.next = nextRecurring(ev, now);
      return ev;
    }

    var s = parseDate(row.start);
    if (!s) {
      console.warn("[events] Skipped \"" + title + "\": couldn't read the start date \"" + str(row.start) + "\". Use YYYY-MM-DD HH:MM.");
      return null;
    }
    var e = parseDate(row.end), et = parseTime(row.end), end;
    if (e) end = e.hasTime ? e.date : endOfDay(e.date);
    else if (et) end = atTime(s.date, et);
    else end = endOfDay(s.date); // no end given: keep it visible until the end of that day

    ev.kind = "dated";
    ev.next = { start: s.date, end: end, hasTime: s.hasTime, endHasTime: !!((e && e.hasTime) || et) };
    return ev;
  }

  /* ---------- Upcoming events, grouped and sorted ---------- */
  // Rows with the same title + link become one card with several dates.
  AAG.getUpcoming = function (rows, now) {
    now = now || new Date();
    var groups = [], byKey = {};
    rows.forEach(function (row) {
      var ev = buildEvent(row, now);
      if (!ev) return;
      if (ev.kind === "dated") {
        if (ev.next.end < now) return; // past: hide it
        var key = (ev.title + "|" + ev.link).toLowerCase();
        if (byKey[key]) { byKey[key].dates.push(ev.next); return; }
        ev.dates = [ev.next];
        byKey[key] = ev;
      }
      groups.push(ev);
    });
    groups.forEach(function (g) {
      if (g.dates) { g.dates.sort(function (a, b) { return a.start - b.start; }); g.next = g.dates[0]; }
    });
    var far = 8.64e15;
    groups.sort(function (a, b) { return (a.next ? a.next.start : far) - (b.next ? b.next.start : far); });
    return groups;
  };

  /* ---------- Load from sheet, else events.json ---------- */
  AAG.loadEvents = async function () {
    var cfg = window.AAG_CONFIG || {};
    var sheet = str(cfg.SHEET_CSV_URL);
    if (sheet) {
      try {
        var res = await fetch(sheet, { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        var text = await res.text();
        if (/^\s*</.test(text)) throw new Error("got a web page, not CSV. Is the sheet published as CSV?");
        var rows = parseCSV(text);
        if (!rows.length) throw new Error("the sheet has no rows");
        return { rows: rows, source: "sheet" };
      } catch (err) {
        console.warn("[events] Couldn't load the Google Sheet (" + err.message + "). Using events.json instead.");
      }
    }
    try {
      var r = await fetch(cfg.FALLBACK_JSON_URL || "events.json", { cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      var data = await r.json();
      return { rows: Array.isArray(data) ? data : data.events || [], source: "json" };
    } catch (err2) {
      console.error("[events] Couldn't load events.json either:", err2.message);
      return { rows: [], source: "none" };
    }
  };

  /* ---------- Formatting ---------- */
  var thisYear = new Date().getFullYear();
  function fmtDay(d) {
    var opts = { weekday: "short", day: "numeric", month: "short" };
    if (d.getFullYear() !== thisYear) opts.year = "numeric";
    return d.toLocaleDateString("en-GB", opts);
  }
  function fmtTime(d) { return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }); }

  function formatOcc(o) {
    var s = fmtDay(o.start);
    var multi = !sameDay(o.start, o.end);
    if (multi) s += " – " + fmtDay(o.end);
    if (o.hasTime) {
      s += ", " + fmtTime(o.start);
      if (o.endHasTime && !multi) s += "–" + fmtTime(o.end);
    }
    return s;
  }
  AAG.formatOcc = formatOcc;

  AAG.whenText = function (ev) {
    if (ev.kind === "recurring") {
      var s = ev.recurringText;
      if (ev.startTime) {
        var t = function (x) { return String(x.h).padStart(2, "0") + ":" + String(x.m).padStart(2, "0"); };
        s += ", " + t(ev.startTime) + (ev.endTime ? "–" + t(ev.endTime) : "");
      }
      if (ev.next) s += " · next: " + fmtDay(ev.next.start);
      return s;
    }
    return formatOcc(ev.next);
  };

  AAG.costLabel = function (ev) {
    if (ev.cost === "free") return "Free";
    if (ev.cost === "paid") return /\d/.test(ev.costRaw) ? ev.costRaw : "Paid";
    return "Not checked yet";
  };

  AAG.safeUrl = function (u) {
    try {
      var url = new URL(u, location.href);
      return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
    } catch (e) { return null; }
  };

  // Turns "E17 [VERIFY POSTCODE]" into text with a highlighted [VERIFY…] label
  AAG.textWithFlags = function (text) {
    var frag = document.createDocumentFragment();
    str(text).split(/(\[VERIFY[^\]]*\])/i).forEach(function (part) {
      if (!part) return;
      if (/^\[VERIFY/i.test(part)) {
        var span = document.createElement("span");
        span.className = "verify";
        span.textContent = part;
        frag.appendChild(span);
      } else {
        frag.appendChild(document.createTextNode(part));
      }
    });
    return frag;
  };

  /* ---------- Event card (used on Home and Events pages) ---------- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  AAG.renderCard = function (ev, opts) {
    opts = opts || {};
    var card = el("article", "event-card");
    card.dataset.type = ev.type.toLowerCase();

    var top = el("div", "event-card__top");
    top.appendChild(el("span", "type-tag", ev.type));
    if (ev.kind === "recurring") top.appendChild(el("span", "type-tag type-tag--plain", "Regular"));
    card.appendChild(top);

    var h = el(opts.headingTag || "h3", "event-card__title");
    h.appendChild(AAG.textWithFlags(ev.title));
    card.appendChild(h);

    var facts = el("dl", "facts");
    function fact(label, content) {
      facts.appendChild(el("dt", null, label));
      var dd = el("dd");
      if (typeof content === "string") dd.textContent = content; else dd.appendChild(content);
      facts.appendChild(dd);
    }
    fact("When", AAG.whenText(ev));
    var where = document.createDocumentFragment();
    where.appendChild(AAG.textWithFlags(ev.location));
    if (ev.postcode) {
      where.appendChild(document.createTextNode(ev.location ? " · " : ""));
      where.appendChild(AAG.textWithFlags(ev.postcode));
    }
    fact("Where", where);
    fact("Cost", AAG.costLabel(ev));
    card.appendChild(facts);

    if (ev.dates && ev.dates.length > 1) {
      var det = el("details", "more-dates");
      det.appendChild(el("summary", null, "+" + (ev.dates.length - 1) + " more date" + (ev.dates.length > 2 ? "s" : "")));
      var ul = el("ul");
      ev.dates.slice(1).forEach(function (d) { ul.appendChild(el("li", null, formatOcc(d))); });
      det.appendChild(ul);
      card.appendChild(det);
    }

    if (ev.note) {
      var note = el("p", "event-card__note");
      note.appendChild(AAG.textWithFlags(ev.note));
      card.appendChild(note);
    }

    var badges = [];
    if (ev.beginner === "yes") badges.push(["First-timer friendly", "badge"]);
    if (ev.solo === "yes") badges.push(["Go solo OK", "badge"]);
    if (ev.weWent === "yes") badges.push(["We went", "badge badge--went"]);
    if (badges.length) {
      var bl = el("ul", "badges");
      bl.setAttribute("aria-label", "Badges");
      badges.forEach(function (b) { bl.appendChild(el("li", b[1], b[0])); });
      card.appendChild(bl);
    }

    var actions = el("div", "event-card__actions");
    var url = AAG.safeUrl(ev.link);
    if (url) {
      var a = el("a", null, "Event page ↗");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.appendChild(el("span", "visually-hidden", " for " + ev.title + " (opens in a new tab)"));
      actions.appendChild(a);
    }
    if (opts.onShowMap) {
      var b = el("button", "link-button", "Show on map");
      b.type = "button";
      b.addEventListener("click", function () { opts.onShowMap(ev); });
      actions.appendChild(b);
    }
    card.appendChild(actions);
    return card;
  };

  AAG.parseCSV = parseCSV; // exposed for testing
})();
