/* quiz.js — "Find your first step". Three questions → one suggestion.
   ✏️ To change the wording of results, edit RESULTS below. */
(function () {
  "use strict";
  var form = document.getElementById("quiz");
  if (!form) return;
  var out = document.getElementById("quiz-result");
  var err = document.getElementById("quiz-error");

  var RESULTS = {
    talk: {
      step: "Step 01 · Learn",
      title: "Start with a talk",
      text: "Sit back, listen, and see who else cares. No skills or kit needed, and it's one of the easiest things to go to on your own.",
      link: "events.html?type=talk",
      linkText: "See upcoming talks"
    },
    workshop: {
      step: "Step 02 · Try",
      title: "Try a hands-on workshop",
      text: "Fix a lamp, build a terrarium, learn a new skill. Doing something with your hands makes a huge topic feel small enough to hold.",
      link: "events.html?type=workshop",
      linkText: "See upcoming workshops"
    },
    volunteering: {
      step: "Step 03 · Do",
      title: "Get stuck in with volunteering",
      text: "Out in a garden or by a river with other people. You'll see the difference you made before you go home.",
      link: "events.html?type=volunteering",
      linkText: "See volunteering sessions"
    }
  };

  // Each answer adds points to one or more event types
  var POINTS = {
    time: {
      short: { talk: 1, workshop: 1 },
      half: { workshop: 1, volunteering: 1 },
      regular: { volunteering: 2 }
    },
    company: {
      solo: { talk: 1 },
      friends: { volunteering: 1, workshop: 1 }
    },
    style: {
      learn: { talk: 3 },
      make: { workshop: 3 },
      outdoors: { volunteering: 3 }
    }
  };
  var ORDER = ["talk", "workshop", "volunteering"]; // ties go to the gentlest step

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var answers = {}, missing = null;
    ["time", "company", "style"].forEach(function (q) {
      var picked = form.querySelector('input[name="' + q + '"]:checked');
      if (picked) answers[q] = picked.value;
      else if (!missing) missing = q;
    });
    if (missing) {
      err.textContent = "Pick one answer for each question, then try again.";
      form.querySelector('input[name="' + missing + '"]').focus();
      return;
    }
    err.textContent = "";

    var score = { talk: 0, workshop: 0, volunteering: 0 };
    Object.keys(answers).forEach(function (q) {
      var add = POINTS[q][answers[q]] || {};
      Object.keys(add).forEach(function (k) { score[k] += add[k]; });
    });
    var best = ORDER.reduce(function (a, b) { return score[b] > score[a] ? b : a; });
    var r = RESULTS[best];

    var tips = [];
    if (answers.company === "solo") tips.push("Going on your own? Look for the “Go solo OK” badge. Lots of people turn up alone, and that's completely normal.");
    if (answers.company === "friends") tips.push("Bring a friend. It's easier to go together, and more fun to talk about afterwards.");
    if (answers.time === "regular") tips.push("Want something regular? Look for events marked “Regular”. That's step 04: Join.");
    tips.push("Not sure? You can leave early. Nobody will mind.");

    out.replaceChildren();
    var step = document.createElement("p"); step.className = "step-num"; step.textContent = r.step;
    var h = document.createElement("h2"); h.textContent = r.title;
    var p = document.createElement("p"); p.textContent = r.text;
    var ul = document.createElement("ul");
    tips.forEach(function (t) { var li = document.createElement("li"); li.textContent = t; ul.appendChild(li); });
    var row = document.createElement("div"); row.className = "btn-row";
    var a = document.createElement("a"); a.className = "btn btn-primary"; a.href = r.link; a.textContent = r.linkText + " →";
    var all = document.createElement("a"); all.className = "btn btn-secondary"; all.href = "events.html"; all.textContent = "See everything";
    row.append(a, all);
    out.append(step, h, p, ul, row);
    out.hidden = false;
    out.focus();
  });
})();
