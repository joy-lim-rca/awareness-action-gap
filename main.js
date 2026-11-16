/* main.js — runs on every page: mobile menu, dark-mode button,
   highlighting the current page in the menu, and config links. */
(function () {
  "use strict";

  // 1. Mark the current page in the menu
  var here = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".site-nav a").forEach(function (a) {
    if (a.getAttribute("href") === here) a.setAttribute("aria-current", "page");
  });

  // 2. Mobile menu button
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
  }

  // 3. Dark / light mode button (remembers your choice)
  var root = document.documentElement;
  var themeBtn = document.querySelector(".theme-toggle");
  function currentTheme() {
    var set = root.getAttribute("data-theme");
    if (set) return set;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function labelThemeButton() {
    if (!themeBtn) return;
    var next = currentTheme() === "dark" ? "light" : "dark";
    themeBtn.textContent = next === "dark" ? "◐ Dark mode" : "◑ Light mode";
    themeBtn.setAttribute("aria-label", "Switch to " + next + " mode");
  }
  if (themeBtn) {
    labelThemeButton();
    themeBtn.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("aag-theme", next); } catch (e) { /* storage blocked: fine */ }
      labelThemeButton();
      document.dispatchEvent(new CustomEvent("aag:themechange"));
    });
  }

  // 4. Fill in links that come from config.js (e.g. the Google Form)
  var cfg = window.AAG_CONFIG || {};
  document.querySelectorAll("[data-config-link]").forEach(function (a) {
    var url = cfg[a.getAttribute("data-config-link")];
    if (url) a.setAttribute("href", url);
    if (!url || /REPLACE/i.test(url)) {
      var note = document.createElement("p");
      note.className = "form-note";
      note.textContent = "Note for the team: the form link isn't set yet. Add it in js/config.js.";
      a.insertAdjacentElement("afterend", note);
    }
  });

  // 5. Footer year
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();
