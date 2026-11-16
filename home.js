/* home.js — shows the next few events on the Home page. */
(function () {
  "use strict";
  var box = document.getElementById("home-events");
  if (!box || !window.AAG) return;
  var HOW_MANY = 3; // ✏️ change to show more or fewer

  window.AAG.loadEvents().then(function (result) {
    var events = window.AAG.getUpcoming(result.rows).slice(0, HOW_MANY);
    box.replaceChildren();
    if (!events.length) {
      box.textContent = "No upcoming events right now. Check back soon!";
      return;
    }
    var ul = document.createElement("ul");
    ul.className = "card-list card-list--grid";
    events.forEach(function (ev) {
      var li = document.createElement("li");
      li.appendChild(window.AAG.renderCard(ev));
      ul.appendChild(li);
    });
    box.appendChild(ul);
  });
})();
