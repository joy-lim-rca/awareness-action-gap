/* events.js — the Events page: filters, list and map.
   Postcodes are turned into map positions with postcodes.io
   (free, no key) and remembered in the browser so it's fast next time. */
(function () {
  "use strict";
  var AAG = window.AAG;
  var cfg = window.AAG_CONFIG || {};
  var list = document.getElementById("events-list");
  if (!list || !AAG) return;

  var form = document.getElementById("filters");
  var countEl = document.getElementById("results-count");
  var sourceEl = document.getElementById("data-source");
  var views = document.querySelector(".events-views");
  var mapNote = document.getElementById("map-note");
  var viewButtons = document.querySelectorAll("[data-view-btn]");

  var all = [];
  var geo = {};
  var map = null, markerLayer = null, firstFit = true;

  /* ---------- Filters (also saved in the page address) ---------- */
  var params = new URLSearchParams(location.search);
  var state = {
    type: (params.get("type") || "all").toLowerCase(),
    when: params.get("when") || "any",
    cost: params.get("cost") || "any",
    beginner: params.get("beginner") === "yes"
  };

  function applyStateToForm() {
    var t = form.querySelector('input[name="type"][value="' + state.type + '"]');
    (t || form.querySelector('input[name="type"][value="all"]')).checked = true;
    form.elements.when.value = state.when;
    form.elements.cost.value = state.cost;
    form.elements.beginner.checked = state.beginner;
  }

  function readForm() {
    var t = form.querySelector('input[name="type"]:checked');
    state.type = t ? t.value : "all";
    state.when = form.elements.when.value;
    state.cost = form.elements.cost.value;
    state.beginner = form.elements.beginner.checked;
    var p = new URLSearchParams();
    if (state.type !== "all") p.set("type", state.type);
    if (state.when !== "any") p.set("when", state.when);
    if (state.cost !== "any") p.set("cost", state.cost);
    if (state.beginner) p.set("beginner", "yes");
    var qs = p.toString();
    history.replaceState(null, "", qs ? "?" + qs : location.pathname);
  }

  function matches(ev) {
    if (state.type !== "all" && ev.type.toLowerCase() !== state.type) return false;
    if (state.cost !== "any" && ev.cost !== state.cost) return false;
    if (state.beginner && ev.beginner !== "yes") return false;
    if (state.when !== "any" && ev.next) {
      var days = state.when === "week" ? 7 : 30;
      if (ev.next.start > new Date(Date.now() + days * 864e5)) return false;
    }
    return true;
  }

  /* ---------- List ---------- */
  function render() {
    var shown = all.filter(matches);
    list.replaceChildren();

    if (!shown.length) {
      var box = document.createElement("div");
      box.className = "empty-state";
      var p = document.createElement("p");
      p.textContent = all.length ? "Nothing matches those filters right now." : "No upcoming events yet. Check back soon, or suggest one!";
      box.appendChild(p);
      if (all.length && (state.beginner || state.cost !== "any")) {
        var p2 = document.createElement("p");
        p2.textContent = "Some events haven't been checked yet (cost, beginner-friendly), so they don't show up when those filters are on.";
        box.appendChild(p2);
      }
      if (all.length) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "btn btn-secondary";
        b.textContent = "Clear filters";
        b.addEventListener("click", function () { form.reset(); onFormChange(); });
        box.appendChild(b);
      }
      list.appendChild(box);
    } else {
      var ul = document.createElement("ul");
      ul.className = "card-list";
      shown.forEach(function (ev) {
        var li = document.createElement("li");
        var hasPin = !!geo[normPostcode(ev.postcode)];
        ev._card = AAG.renderCard(ev, { onShowMap: hasPin && map ? showOnMap : null });
        li.appendChild(ev._card);
        ul.appendChild(li);
      });
      list.appendChild(ul);
    }

    countEl.textContent = "Showing " + shown.length + " event" + (shown.length === 1 ? "" : "s");
    updateMarkers(shown);
  }

  function onFormChange() { readForm(); render(); }

  /* ---------- Postcodes → coordinates (postcodes.io) ---------- */
  var CACHE_KEY = "aag-postcodes-v1";
  var FULL = /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/;
  var OUTCODE = /^[A-Z]{1,2}\d[A-Z\d]?$/;

  function normPostcode(p) {
    return String(p || "").replace(/\[.*?\]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
  }
  function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; } catch (e) { return {}; }
  }
  function writeCache(c) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch (e) { /* storage blocked: fine */ }
  }

  async function geocode(postcodes) {
    var cache = readCache();
    var need = postcodes.filter(function (p, i) { return p && postcodes.indexOf(p) === i && !cache[p]; });
    var full = need.filter(function (p) { return FULL.test(p); });
    var outs = need.filter(function (p) { return OUTCODE.test(p); });
    var aliases = {}; // full postcode → area, when the full one can't be found

    // Full postcodes: one request for up to 100 at a time
    for (var i = 0; i < full.length; i += 100) {
      try {
        var res = await fetch("https://api.postcodes.io/postcodes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postcodes: full.slice(i, i + 100) })
        });
        var data = await res.json();
        (data.result || []).forEach(function (r) {
          if (r.result) cache[normPostcode(r.query)] = { lat: r.result.latitude, lng: r.result.longitude, approx: false };
        });
      } catch (e) { console.warn("[map] Postcode lookup failed:", e.message); }
    }

    // Postcodes not found: maybe retired ("terminated") — postcodes.io still knows where they were.
    // If not, fall back to the area (first half of the postcode) as an approximate pin.
    await Promise.all(full.filter(function (p) { return !cache[p]; }).map(async function (p) {
      try {
        var res = await fetch("https://api.postcodes.io/terminated_postcodes/" + encodeURIComponent(p));
        if (res.ok) {
          var t = (await res.json()).result;
          cache[p] = { lat: t.latitude, lng: t.longitude, approx: false };
          console.warn("[map] Postcode " + p + " is no longer in use (retired " + t.month_terminated + "/" + t.year_terminated + "). Please check the venue's current postcode.");
          return;
        }
      } catch (e) { /* try the area next */ }
      var out = p.split(" ")[0];
      if (!OUTCODE.test(out)) return;
      if (!cache[out] && outs.indexOf(out) < 0) outs.push(out);
      aliases[p] = out;
      console.warn("[map] Postcode not found: " + p + ". Showing the approximate area (" + out + ") instead.");
    }));

    // Partial postcodes like "BR3": use the centre of that postcode area
    await Promise.all(outs.map(async function (p) {
      try {
        var res = await fetch("https://api.postcodes.io/outcodes/" + encodeURIComponent(p));
        if (!res.ok) throw new Error("HTTP " + res.status);
        var data = await res.json();
        if (data.result && data.result.latitude) cache[p] = { lat: data.result.latitude, lng: data.result.longitude, approx: true };
      } catch (e) { console.warn("[map] Area lookup failed for " + p + ":", e.message); }
    }));
    Object.keys(aliases).forEach(function (p) {
      var area = cache[aliases[p]];
      if (area) cache[p] = { lat: area.lat, lng: area.lng, approx: true };
    });

    need.filter(function (p) { return !FULL.test(p) && !OUTCODE.test(p); })
      .forEach(function (p) { console.warn("[map] \"" + p + "\" doesn't look like a UK postcode."); });

    writeCache(cache);
    return cache;
  }

  /* ---------- Map ---------- */
  function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

  function initMap() {
    if (!window.L) {
      mapNote.textContent = "The map couldn't load. Everything is still in the list.";
      return;
    }
    map = L.map("map", { scrollWheelZoom: false }).setView(cfg.MAP_CENTRE || [51.5072, -0.1276], cfg.MAP_ZOOM || 10);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    markerLayer = L.layerGroup().addTo(map);
  }

  function popupFor(ev, g) {
    var div = document.createElement("div");
    var s = document.createElement("strong");
    s.textContent = ev.title;
    div.appendChild(s);
    var p = document.createElement("p");
    p.className = "popup-meta";
    p.textContent = ev.type + " · " + AAG.whenText(ev) + (g.approx ? " · approximate area" : "");
    div.appendChild(p);
    var url = AAG.safeUrl(ev.link);
    if (url) {
      var a = document.createElement("a");
      a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
      a.textContent = "Event page ↗";
      div.appendChild(a);
    }
    return div;
  }

  function updateMarkers(shown) {
    if (!markerLayer) return;
    markerLayer.clearLayers();
    var pts = [], missing = 0, approx = 0;
    var colours = { talk: cssVar("--type-talk"), workshop: cssVar("--type-workshop"), volunteering: cssVar("--type-volunteering") };
    shown.forEach(function (ev) {
      ev._marker = null;
      var g = geo[normPostcode(ev.postcode)];
      if (!g) { missing++; return; }
      if (g.approx) approx++;
      var m = L.circleMarker([g.lat, g.lng], {
        radius: g.approx ? 12 : 9,
        color: cssVar("--ink"),
        weight: 2,
        dashArray: g.approx ? "4 3" : null,
        fillColor: colours[ev.type.toLowerCase()] || cssVar("--ink"),
        fillOpacity: 0.9
      });
      m.bindPopup(popupFor(ev, g));
      m.on("click", function () { highlightCard(ev); });
      m.addTo(markerLayer);
      ev._marker = m;
      pts.push([g.lat, g.lng]);
    });
    if (pts.length && firstFit) { map.fitBounds(pts, { padding: [30, 30], maxZoom: 13 }); firstFit = false; }

    var notes = [];
    if (approx) notes.push("Dashed circles show an approximate area, because we only have part of the postcode.");
    if (missing) notes.push(missing + " event" + (missing === 1 ? " isn't" : "s aren't") + " on the map because the postcode couldn't be found.");
    mapNote.textContent = notes.join(" ");
  }

  function highlightCard(ev) {
    document.querySelectorAll(".event-card.is-highlighted").forEach(function (c) { c.classList.remove("is-highlighted"); });
    if (ev._card) ev._card.classList.add("is-highlighted");
  }

  function showOnMap(ev) {
    if (!map || !ev._marker) return;
    setView("map");
    map.invalidateSize();
    map.setView(ev._marker.getLatLng(), 14, { animate: false });
    ev._marker.openPopup();
    highlightCard(ev);
    if (window.matchMedia("(max-width: 59.99rem)").matches) {
      document.getElementById("map").scrollIntoView({ block: "start" });
    }
  }

  /* ---------- List / map toggle (small screens) ---------- */
  function setView(v) {
    views.dataset.view = v;
    viewButtons.forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.viewBtn === v)); });
    if (v === "map" && map) setTimeout(function () { map.invalidateSize(); }, 0);
  }
  viewButtons.forEach(function (b) { b.addEventListener("click", function () { setView(b.dataset.viewBtn); }); });
  window.addEventListener("resize", function () { if (map) map.invalidateSize(); });

  /* ---------- Start ---------- */
  applyStateToForm();
  form.addEventListener("change", onFormChange);
  form.addEventListener("submit", function (e) { e.preventDefault(); });
  form.addEventListener("reset", function () { setTimeout(onFormChange, 0); });
  document.addEventListener("aag:themechange", function () { render(); });

  initMap();
  countEl.textContent = "Loading events…";

  AAG.loadEvents().then(async function (result) {
    all = AAG.getUpcoming(result.rows);
    sourceEl.textContent = {
      sheet: "Events loaded from our shared Google Sheet.",
      json: "Events loaded from the backup list (events.json).",
      none: "Sorry, the events couldn't be loaded. Please try again later."
    }[result.source];
    render();
    if (map) {
      geo = await geocode(all.map(function (ev) { return normPostcode(ev.postcode); }));
      render();
    }
  });
})();
