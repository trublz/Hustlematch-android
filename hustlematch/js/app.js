/* HustleMatch app: router, quiz, matching engine, results, gig detail,
   saved gigs, compare, about pages, email capture. Tracker lives in tracker.js. */

"use strict";

/* ---------------- storage ---------------- */
const store = {
  get(k, fb) {
    try {
      const v = localStorage.getItem("hm_" + k);
      return v === null ? fb : JSON.parse(v);
    } catch (e) {
      return fb;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem("hm_" + k, JSON.stringify(v));
    } catch (e) {}
  },
};

/* ---------------- helpers ---------------- */
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function money(n) {
  return "$" + Math.round(n).toLocaleString("en-US");
}
let toastTimer = null;
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}
function cityMult(name) {
  const c = CITIES.find((x) => x.name === name);
  return c ? c.mult : 1;
}
function adjPay(gig, city) {
  return gig.basePay * cityMult(city || "Chicago");
}
function hoursNum(label) {
  if (label === "Under 10") return 8;
  if (label === "10–20") return 15;
  if (label === "20–30") return 25;
  return 35;
}
function goalNum(label) {
  if (label === "$500") return 500;
  if (label === "$1,000") return 1000;
  if (label === "$2,000") return 2000;
  return 3500;
}
function demandLabel(d) {
  return "🔥".repeat(d) + "☆".repeat(5 - d);
}

/* ---------------- matching engine ---------------- */
function matchScore(gig, ans) {
  let s = 0;
  // skills: 40
  if (!gig.skills.length) {
    s += 20;
  } else {
    const hit = gig.skills.filter((x) => (ans.skills || []).includes(x)).length;
    s += (40 * hit) / gig.skills.length;
  }
  // vehicle: 20
  const v = ans.vehicle;
  if (gig.vehicle === "none") s += 20;
  else if (gig.vehicle === "bike" && (v === "bike" || v === "car")) s += 20;
  else if (gig.vehicle === "car" && v === "car") s += 20;
  // startup budget: 15
  if (gig.startupCost <= ans.budget) s += 15;
  else s += Math.max(0, 15 * (1 - (gig.startupCost - ans.budget) / 500));
  // income goal fit: 15
  const projected = adjPay(gig, ans.city) * hoursNum(ans.hours) * 4.33;
  s += 15 * Math.min(1, projected / goalNum(ans.goal));
  // demand: 10
  s += 10 * (gig.demand / 5);
  // style + schedule bonuses: 5 each
  if (gig.styles.includes(ans.style)) s += 5;
  if (gig.schedule.includes(ans.schedule)) s += 5;
  return Math.min(100, Math.round(s));
}

function rankedGigs(ans) {
  return GIGS.map((g) => ({
    gig: g,
    score: matchScore(g, ans),
    proj: adjPay(g, ans.city) * hoursNum(ans.hours) * 4.33,
  })).sort((a, b) => b.score - a.score || b.proj - a.proj);
}

/* ---------------- router ---------------- */
let routeTimer = null; // for rotating hero word etc.
function route() {
  const mainNav = document.getElementById("mainNav");
  mainNav.classList.remove("open");
  clearInterval(routeTimer);
  window.scrollTo(0, 0);

  const hash = location.hash.replace(/^#\/?/, "");
  const parts = hash.split("/");
  const name = parts[0] || "";
  const view = document.getElementById("view");

  document.querySelectorAll("#mainNav a").forEach((a) => {
    a.classList.toggle("active", a.dataset.route === name);
  });
  const authLink = document.getElementById("authLink");
  if (authLink) {
    const prof = Auth.current();
    authLink.textContent = prof ? "👤 " + prof.name.split(" ")[0] : "Sign in";
    authLink.href = prof ? "#/profile" : "#/login";
    authLink.classList.toggle("active", name === "login" || name === "profile");
  }

  if (name === "") view.innerHTML = vHome();
  else if (name === "quiz") view.innerHTML = vQuiz();
  else if (name === "results") view.innerHTML = vResults();
  else if (name === "gig" && parts[1]) view.innerHTML = vGig(parts[1]);
  else if (name === "tracker") view.innerHTML = vTracker();
  else if (name === "saved") view.innerHTML = vSaved();
  else if (name === "compare") view.innerHTML = vCompare();
  else if (name === "about") view.innerHTML = vAbout(parts[1] || "");
  else if (name === "login") view.innerHTML = vLogin();
  else if (name === "profile") view.innerHTML = vProfile();
  else if (name === "resume") view.innerHTML = parts[1] === "builder" ? vResumeBuilder() : vResume();
  else if (name === "post-job") view.innerHTML = vPostJob();
  else view.innerHTML = vHome();

  afterRender(name, parts);
}

function afterRender(name, parts) {
  if (name === "") initHomeFx();
  if (name === "tracker" && window.HM_trackerInit) window.HM_trackerInit();
  if (name === "post-job") bindPostJob();
  if (name === "gig" && parts[1]) bindGigDelete(parts[1]);
  bindSaveButtons();
  bindEmailForms();
}

/* ---------------- shared bits ---------------- */
function gigCard(g, score, city) {
  const pay = adjPay(g, city);
  return (
    '<a class="card gig-card" href="#/gig/' + g.id + '">' +
    '<button class="save-btn" data-save="' + g.id + '" aria-label="Save gig">' + (isSaved(g.id) ? "❤️" : "🤍") + "</button>" +
    '<div class="gig-top">' +
    '<div class="gig-icon">' + g.icon + "</div>" +
    '<div><h3>' + esc(g.name) + '</h3><p style="margin:0">' + esc(g.platforms) + "</p></div>" +
    (score != null ? '<div class="ring" style="--p:' + score + '"><b>' + score + "%</b></div>" : "") +
    "</div>" +
    '<div class="badges">' +
    '<span class="badge pay">' + money(pay) + "/hr</span>" +
    '<span class="badge hot">' + demandLabel(g.demand) + " demand</span>" +
    '<span class="badge cat">' + esc(g.category) + "</span>" +
    (g.community ? '<span class="badge" style="background:rgba(61,220,132,.14);color:var(--green);border:1px solid var(--green)">👥 Employer post</span>' : "") +
    "</div>" +
    "<p>" + esc(g.tagline) + "</p>" +
    "</a>"
  );
}

function isSaved(id) {
  return store.get("saved", []).includes(id);
}
function toggleSave(id) {
  let s = store.get("saved", []);
  if (s.includes(id)) {
    s = s.filter((x) => x !== id);
    toast("Removed from saved gigs");
  } else {
    s.push(id);
    toast("Saved! Find it under Saved ❤️");
  }
  store.set("saved", s);
  document.querySelectorAll('[data-save="' + id + '"]').forEach((b) => {
    b.textContent = s.includes(id) ? "❤️" : "🤍";
    b.classList.toggle("saved", s.includes(id));
  });
  // also refresh compare picks if needed
  if (location.hash.includes("saved") || location.hash.includes("compare")) route();
}
function bindSaveButtons() {
  document.querySelectorAll("[data-save]").forEach((b) => {
    b.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleSave(b.dataset.save);
    };
  });
}
function emailForm(id, cta) {
  return (
    '<form class="email-capture" data-emailform id="' + id + '">' +
    '<div class="row"><input type="email" required placeholder="you@email.com" aria-label="Email" />' +
    '<button class="btn btn-primary" type="submit" style="flex:0 0 auto">' + esc(cta || "Send me gigs") + "</button></div>" +
    '<p style="font-size:12px;color:var(--muted)">Join 12,000+ hustlers getting weekly gig alerts. Unsubscribe anytime.</p>' +
    "</form>"
  );
}
function bindEmailForms() {
  document.querySelectorAll("[data-emailform]").forEach((f) => {
    f.onsubmit = (e) => {
      e.preventDefault();
      const em = f.querySelector("input").value.trim();
      if (!em) return;
      const list = store.get("emails", []);
      if (!list.includes(em)) list.push(em);
      store.set("emails", list);
      f.innerHTML = "<p>🎉 <b>You're in!</b> Watch your inbox for gig matches.</p>";
      toast("Subscribed!");
    };
  });
  const ff = document.getElementById("footerNews");
  if (ff && !ff.dataset.bound) {
    ff.dataset.bound = "1";
    ff.onsubmit = (e) => {
      e.preventDefault();
      const em = document.getElementById("footerEmail").value.trim();
      if (!em) return;
      const list = store.get("emails", []);
      if (!list.includes(em)) list.push(em);
      store.set("emails", list);
      ff.innerHTML = "<p style='color:var(--green);font-weight:700'>🎉 You're on the list!</p>";
    };
  }
}

/* ---------------- home ---------------- */
function vHome() {
  const trending = [...GIGS].sort((a, b) => b.demand - a.demand || b.basePay - a.basePay).slice(0, 4);
  return (
    '<div class="hero">' +
    '<div class="hero-icons">🚗 🛵 🐾 🎨</div>' +
    "<h1>Find the side hustle<br/>made for <span class=\"rot\" id=\"rotWord\">drivers</span></h1>" +
    "<p>Take a 60-second quiz and get matched with gigs that fit your skills, schedule and income goals. Then track every dollar you earn.</p>" +
    '<div class="hero-cta"><a class="btn btn-primary btn-big" href="#/quiz">Take the quiz ⚡</a>' +
    '<a class="btn btn-ghost btn-big" href="#/tracker">Open earnings tracker</a></div>' +
    '<div class="stats">' +
    '<div class="stat"><b data-count="' + GIGS.length + '">0</b><span>gigs ranked</span></div>' +
    '<div class="stat"><b><span data-count="10">0</span></b><span>cities covered</span></div>' +
    '<div class="stat"><b>$<span data-count="' +
    Math.max.apply(
      null,
      GIGS.map(function (g) {
        return g.basePay;
      })
    ) +
    '">0</span></b><span>top hourly rate</span></div>' +
    "</div></div>" +

    '<div class="section"><h2>How it works</h2><p class="sub">Three steps to your first payout.</p>' +
    '<div class="how-steps">' +
    '<div class="card"><div class="step-num">1</div><h3>Take the quiz</h3><p>8 quick questions about your city, skills, wheels and goals.</p></div>' +
    '<div class="card"><div class="step-num">2</div><h3>Get matched</h3><p>Our engine scores every gig for you and ranks your best fits.</p></div>' +
    '<div class="card"><div class="step-num">3</div><h3>Start earning</h3><p>Apply in one tap, then track every shift in the earnings tracker.</p></div>' +
    "</div></div>" +

    '<div class="section"><h2>🔥 Trending gigs</h2><p class="sub">Highest demand right now.</p>' +
    '<div class="grid grid-3">' + trending.map((g) => gigCard(g, null, "Chicago")).join("") + "</div></div>" +

    '<div class="section"><h2>Browse by category</h2><p class="sub">Jump straight to results.</p>' +
    '<div class="chips">' +
    CATEGORIES.filter((c) => c !== "All")
      .map((c) => '<a class="chip" href="#/results?cat=' + encodeURIComponent(c) + '">' + esc(c) + "</a>")
      .join("") +
    "</div></div>" +

    '<div class="section"><h2>💼 Hiring?</h2><p class="sub">Post your opening for free and reach local hustlers.</p>' +
    '<div class="chips"><a class="chip" href="#/post-job">💼 Post a job →</a></div></div>' +

    '<div class="section"><h2>💬 Hustlers love it</h2>' +
    '<div class="testis">' +
    '<div class="card testi">"The quiz matched me with Rover and I made $400 my first month just hanging out with dogs."<b>— Priya, Toronto</b></div>' +
    '<div class="card testi">"I compared DoorDash vs Amazon Flex side by side and picked the one that actually fits my schedule."<b>— Marcus, Chicago</b></div>' +
    '<div class="card testi">"The earnings tracker keeps me honest. Seeing the goal line gets me out the door."<b>— Dana, Phoenix</b></div>' +
    "</div></div>" +

    '<div class="cta-banner"><h2>Your best gig is 60 seconds away</h2>' +
    "<p>Free forever. No sign-up needed to get matched.</p>" +
    '<a class="btn btn-light btn-big" href="#/quiz">Match me now ⚡</a></div>'
  );
}
function initHomeFx() {
  const words = ["drivers", "walkers", "sitters", "freelancers", "deliverers", "tutors"];
  let i = 0;
  const el = document.getElementById("rotWord");
  if (el) {
    routeTimer = setInterval(() => {
      i = (i + 1) % words.length;
      el.textContent = words[i];
    }, 2000);
  }
  document.querySelectorAll("[data-count]").forEach((el2) => {
    const target = +el2.dataset.count;
    let cur = 0;
    const step = Math.max(1, Math.round(target / 30));
    const t = setInterval(() => {
      cur += step;
      if (cur >= target) {
        cur = target;
        clearInterval(t);
      }
      el2.textContent = cur;
    }, 40);
  });
}

/* ---------------- quiz ---------------- */
let quizState = { step: 0, answers: {} };
function vQuiz() {
  quizState = { step: 0, answers: {} };
  return '<div class="quiz-wrap" id="quizBox"></div>';
}
function renderQuizStep() {
  const box = document.getElementById("quizBox");
  if (!box) return;
  const q = QUIZ[quizState.step];
  const pct = Math.round((quizState.step / QUIZ.length) * 100);
  let body = "";
  if (q.type === "select") {
    body =
      '<select id="qInput">' +
      q.options.map((o) => '<option value="' + esc(o) + '">' + esc(o) + "</option>").join("") +
      "</select>";
  } else if (q.type === "single") {
    body =
      '<div class="opt-list">' +
      q.options
        .map((o) => {
          const v = typeof o === "string" ? o : o.v;
          const l = typeof o === "string" ? o : o.l;
          const sel = quizState.answers[q.key] === v ? " selected" : "";
          return '<button class="opt' + sel + '" data-val="' + esc(String(v)) + '">' + esc(l) + "</button>";
        })
        .join("") +
      "</div>";
  } else {
    const cur = quizState.answers[q.key] || [];
    body =
      '<div class="chips">' +
      q.options
        .map((o) => '<button class="chip' + (cur.includes(o) ? " selected" : "") + '" data-val="' + esc(o) + '">' + esc(o) + "</button>")
        .join("") +
      "</div>";
  }
  box.innerHTML =
    '<div class="progress"><i style="width:' + pct + '%"></i></div>' +
    '<div class="progress-label">Question ' + (quizState.step + 1) + " of " + QUIZ.length + "</div>" +
    '<h2 class="quiz-q">' + esc(q.q) + "</h2>" +
    (q.sub ? '<p class="quiz-sub">' + esc(q.sub) + "</p>" : "") +
    body +
    '<div class="quiz-nav">' +
    (quizState.step > 0 ? '<button class="btn btn-ghost" id="qBack">← Back</button>' : "<span></span>") +
    '<button class="btn btn-primary" id="qNext">' +
    (quizState.step === QUIZ.length - 1 ? "See my matches ⚡" : q.type === "multi" ? "Continue →" : "") +
    "</button></div>";

  box.querySelectorAll(".opt").forEach((b) => {
    b.onclick = () => {
      quizState.answers[q.key] = b.dataset.val === "" ? b.dataset.val : coerceVal(q, b.dataset.val);
      nextQuizStep();
    };
  });
  box.querySelectorAll(".chip").forEach((b) => {
    b.onclick = () => {
      const v = b.dataset.val;
      let cur = quizState.answers[q.key] || [];
      cur = cur.includes(v) ? cur.filter((x) => x !== v) : cur.concat([v]);
      quizState.answers[q.key] = cur;
      b.classList.toggle("selected");
    };
  });
  const back = document.getElementById("qBack");
  if (back) back.onclick = () => {
    quizState.step--;
    renderQuizStep();
  };
  document.getElementById("qNext").onclick = () => {
    if (q.type === "select") {
      const sel = document.getElementById("qInput");
      quizState.answers[q.key] = sel.value;
    }
    if (q.type === "multi" && !(quizState.answers[q.key] || []).length) {
      toast("Pick at least one 🙂");
      return;
    }
    nextQuizStep();
  };
  if (q.type === "single" && quizState.step === QUIZ.length - 1) {
    // last single question auto-advances on click already
  }
}
function coerceVal(q, v) {
  const opt = q.options.find((o) => typeof o !== "string" && String(o.v) === v);
  if (opt) return opt.v;
  return v;
}
function nextQuizStep() {
  if (quizState.step >= QUIZ.length - 1) {
    // normalize budget to number
    const a = quizState.answers;
    a.budget = Number(a.budget);
    store.set("quiz", a);
    location.hash = "#/results";
  } else {
    quizState.step++;
    renderQuizStep();
  }
}

/* ---------------- results ---------------- */
let resState = { cat: "All", sort: "match", q: "" };
function vResults() {
  const ans = store.get("quiz", null);
  if (!ans) {
    setTimeout(() => (location.hash = "#/quiz"), 50);
    return "<p class='center'>Take the quiz first! Redirecting…</p>";
  }
  const params = new URLSearchParams(location.hash.split("?")[1] || "");
  resState = {
    cat: params.get("cat") || "All",
    sort: params.get("sort") || "match",
    q: params.get("q") || "",
    shown: 24,
  };
  return '<div id="resBox"></div>';
}
function renderResults() {
  const box = document.getElementById("resBox");
  if (!box) return;
  const ans = store.get("quiz", null);
  if (!ans) return;
  let ranked = rankedGigs(ans);
  if (resState.cat !== "All") ranked = ranked.filter((r) => r.gig.category === resState.cat);
  if (resState.q) {
    const q = resState.q.toLowerCase();
    ranked = ranked.filter(
      (r) => r.gig.name.toLowerCase().includes(q) || r.gig.platforms.toLowerCase().includes(q)
    );
  }
  const sorters = {
    match: (a, b) => b.score - a.score,
    "pay-desc": (a, b) => adjPay(b.gig, ans.city) - adjPay(a.gig, ans.city),
    "pay-asc": (a, b) => adjPay(a.gig, ans.city) - adjPay(b.gig, ans.city),
    demand: (a, b) => b.gig.demand - a.gig.demand,
    cost: (a, b) => a.gig.startupCost - b.gig.startupCost,
  };
  ranked.sort(sorters[resState.sort] || sorters.match);

  const top = ranked[0];
  let html =
    "<h2>Your matches ⚡</h2>" +
    '<p class="sub">' +
    (top ? "Top pick: <b>" + esc(top.gig.name) + "</b> at " + top.score + "% — " + esc(ans.city) + " rates." : "No gigs match those filters.") +
    "</p>" +
    '<div class="cat-row">' +
    CATEGORIES.map(
      (c) => '<button class="chip' + (resState.cat === c ? " selected" : "") + '" data-cat="' + esc(c) + '">' + esc(c) + "</button>"
    ).join("") +
    "</div>" +
    '<div class="toolbar">' +
    '<input type="search" id="resSearch" placeholder="Search gigs…" value="' + esc(resState.q) + '" />' +
    '<select id="resSort">' +
    SORTS.map((s) => '<option value="' + s.v + '"' + (resState.sort === s.v ? " selected" : "") + ">" + esc(s.l) + "</option>").join("") +
    "</select></div>" +
    '<div class="grid grid-3" id="resGrid">';

  ranked.forEach((r, i) => {
    if (i >= resState.shown) return;
    html += gigCard(r.gig, r.score, ans.city);
    if ((i + 1) % 3 === 0 && i !== Math.min(resState.shown, ranked.length) - 1) html += '<div class="ad-slot">AD SPACE</div>';
  });
  html += "</div>";

  if (ranked.length > resState.shown) {
    html +=
      '<div class="center" style="margin:18px 0"><button class="btn btn-ghost btn-big" id="showMoreBtn">Show more (' +
      (ranked.length - resState.shown) +
      " remaining)</button></div>";
  }

  html +=
    '<div class="section"><div class="card"><h3>📧 Email me my matches</h3>' +
    "<p>Get your top gigs plus weekly new-hustle alerts.</p>" +
    emailForm("resEmail", "Email my matches") +
    "</div></div>";

  const cmp = store.get("compare", []);
  if (cmp.length) {
    html +=
      '<div class="compare-bar"><span>⚖️ <b>' + cmp.length + "</b> selected to compare</span>" +
      '<a class="btn btn-primary" href="#/compare">Compare now</a></div>';
  }
  box.innerHTML = html;

  box.querySelectorAll("[data-cat]").forEach((b) => {
    b.onclick = () => {
      resState.cat = b.dataset.cat;
      resState.shown = 24;
      syncResUrl();
      renderResults();
    };
  });
  document.getElementById("resSort").onchange = (e) => {
    resState.sort = e.target.value;
    resState.shown = 24;
    syncResUrl();
    renderResults();
  };
  document.getElementById("resSearch").oninput = (e) => {
    resState.q = e.target.value;
    resState.shown = 24;
    syncResUrl();
    // re-render grid only (keep focus): simple approach re-renders all but restores focus
    const pos = e.target.selectionStart;
    renderResults();
    const inp = document.getElementById("resSearch");
    inp.focus();
    inp.setSelectionRange(pos, pos);
  };
  box.querySelectorAll("[data-cmp]").forEach((b) => {
    b.onclick = () => toggleCompare(b.dataset.cmp);
  });
  const more = document.getElementById("showMoreBtn");
  if (more)
    more.onclick = () => {
      resState.shown += 24;
      renderResults();
    };
  bindSaveButtons();
  bindEmailForms();
}
function syncResUrl() {
  const p = new URLSearchParams();
  if (resState.cat !== "All") p.set("cat", resState.cat);
  if (resState.sort !== "match") p.set("sort", resState.sort);
  if (resState.q) p.set("q", resState.q);
  const qs = p.toString();
  history.replaceState(null, "", "#/results" + (qs ? "?" + qs : ""));
}
function toggleCompare(id) {
  let c = store.get("compare", []);
  if (c.includes(id)) c = c.filter((x) => x !== id);
  else {
    if (c.length >= 3) {
      toast("Compare up to 3 gigs — remove one first");
      return;
    }
    c.push(id);
  }
  store.set("compare", c);
  renderResults();
}
// hook: after results render, add compare checkboxes via delegation
const _origAfter = afterRender;
afterRender = function (name, parts) {
  _origAfter(name, parts);
  if (name === "quiz") renderQuizStep();
  if (name === "results") renderResults();
  if (name === "gig" && parts[1]) {
    const id = parts[1];
    const btn = document.getElementById("cmpBtn");
    if (btn) btn.onclick = () => toggleCompareGo(id);
  }
  if (name === "login") bindLogin();
  if (name === "profile") bindProfile();
  if (name === "resume" && parts[1] === "builder") renderRbStep();
  if (name === "resume" && parts[1] !== "builder") bindTemplates();
};
function toggleCompareGo(id) {
  toggleCompare(id);
  route();
}

/* ---------------- gig detail ---------------- */
function vGig(id) {
  const g = GIGS.find((x) => x.id === id);
  if (!g) return "<p class='center'>Gig not found. <a href='#/results'>Back to results</a></p>";
  const ans = store.get("quiz", null);
  const city = ans ? ans.city : "Chicago";
  const score = ans ? matchScore(g, ans) : null;
  const pay = adjPay(g, city);
  const similar = GIGS.filter((x) => x.id !== g.id && x.category === g.category).slice(0, 3);
  const inCmp = store.get("compare", []).includes(g.id);
  return (
    '<a href="#/results" style="font-size:14px">← Back to results</a>' +
    '<div class="detail-head" style="margin-top:12px"><div class="gig-icon">' + g.icon + "</div>" +
    "<div><h2 style='margin:0'>" + esc(g.name) + "</h2><p class='sub' style='margin:0'>" + esc(g.platforms) + "</p></div>" +
    (score != null ? '<div class="ring" style="--p:' + score + '"><b>' + score + "%</b></div>" : "") +
    "</div>" +
    '<div class="badges"><span class="badge pay">' + money(pay) + '/hr in ' + esc(city) + '</span>' +
    '<span class="badge hot">' + demandLabel(g.demand) + ' demand</span>' +
    '<span class="badge">' + esc(g.vehicleLabel) + '</span>' +
    '<span class="badge cat">' + esc(g.category) + "</span></div>" +
    "<p>" + esc(g.description) + "</p>" +
    '<div class="detail-stats">' +
    '<div class="dstat"><b>' + money(pay) + '</b><span>est. hourly</span></div>' +
    '<div class="dstat"><b>' + money(pay * 20) + '</b><span>per 20 hrs/week</span></div>' +
    '<div class="dstat"><b>' + (g.startupCost === 0 ? "Free" : money(g.startupCost)) + '</b><span>to start</span></div>' +
    '<div class="dstat"><b>' + "★".repeat(Math.min(5, Math.ceil(g.demand))) + '</b><span>demand</span></div>' +
    "</div>" +
    '<div class="procon"><div class="card"><h3>✅ Pros</h3><ul>' +
    g.pros.map((p) => "<li>" + esc(p) + "</li>").join("") +
    '</ul></div><div class="card"><h3>⚠️ Cons</h3><ul>' +
    g.cons.map((c) => "<li>" + esc(c) + "</li>").join("") +
    "</ul></div></div>" +
    '<div class="apply-box"><h3>🚀 Apply now</h3><p>Official sign-up pages. (Affiliate tracking can be added to these links later.)</p>' +
    '<div class="apply-links">' +
    g.apply.map((a) => '<a class="btn btn-primary" href="' + esc(a.url) + '" target="_blank" rel="noopener">' + esc(a.label) + " →</a>").join("") +
    "</div></div>" +
    (g.community
      ? '<div class="card" style="margin:0 0 20px;border-color:var(--green)"><h3>👥 Employer posting</h3>' +
        "<p><b>Contact:</b> " + esc(g.contact || "") + "</p>" +
        '<p class="sub" style="margin:0">Posted ' + esc(g.postedAt || "") + " · User-submitted, not verified by HustleMatch.</p>" +
        (g.mine ? '<div style="margin-top:10px"><button class="btn btn-ghost" id="delJobBtn">Delete this posting</button></div>' : "") +
        "</div>"
      : "") +
    '<div class="card" style="margin:0 0 20px"><h3>📝 Selling yourself?</h3><p>Most platforms make you write a profile bio. Our resume guide shows how to write one that gets picked — including tips for ' +
    esc(g.category) +
    ' gigs.</p><a class="btn btn-ghost" href="#/resume">Open resume guide</a></div>' +
    '<div class="row"><button class="btn btn-ghost" data-save="' + g.id + '">' + (isSaved(g.id) ? "❤️ Saved" : "🤍 Save gig") + "</button>" +
    '<button class="btn btn-ghost" id="cmpBtn">' + (inCmp ? "✓ In compare list" : "⚖️ Add to compare") + "</button></div>" +
    (similar.length
      ? '<div class="section"><h2>Similar gigs</h2><div class="grid grid-3">' +
        similar.map((s) => gigCard(s, ans ? matchScore(s, ans) : null, city)).join("") +
        "</div></div>"
      : "")
  );
}

/* ---------------- saved ---------------- */
function vSaved() {
  const saved = store.get("saved", []);
  const gigs = saved.map((id) => GIGS.find((g) => g.id === id)).filter(Boolean);
  const ans = store.get("quiz", null);
  const city = ans ? ans.city : "Chicago";
  let html = "<h2>❤️ Saved gigs</h2>";
  if (!gigs.length) {
    html += "<div class='card center'><p>No saved gigs yet.</p><a class='btn btn-primary' href='#/quiz'>Find gigs to save</a></div>";
  } else {
    html += '<div class="grid grid-3">' + gigs.map((g) => gigCard(g, ans ? matchScore(g, ans) : null, city)).join("") + "</div>";
    html +=
      '<div class="compare-bar"><span>Select up to 3 to compare side by side</span><a class="btn btn-primary" href="#/compare">Compare ⚖️</a></div>' +
      '<div class="section"><h3>Add / remove from compare</h3><div class="chips">' +
      gigs
        .map((g) => {
          const inC = store.get("compare", []).includes(g.id);
          return '<button class="chip' + (inC ? " selected" : "") + '" data-cmpick="' + g.id + '">' + esc(g.name) + "</button>";
        })
        .join("") +
      "</div></div>";
  }
  setTimeout(() => {
    document.querySelectorAll("[data-cmpick]").forEach((b) => {
      b.onclick = () => {
        toggleCompare(b.dataset.cmpick);
        route();
      };
    });
  }, 50);
  return html;
}

/* ---------------- compare ---------------- */
function vCompare() {
  const ids = store.get("compare", []).slice(0, 3);
  const gigs = ids.map((id) => GIGS.find((g) => g.id === id)).filter(Boolean);
  const ans = store.get("quiz", null);
  const city = ans ? ans.city : "Chicago";
  if (!gigs.length)
    return "<div class='card center'><h2>⚖️ Compare gigs</h2><p>Save some gigs first, then pick up to 3 to compare.</p><a class='btn btn-primary' href='#/results'>Browse gigs</a></div>";
  const rows = [
    { l: "Match score", f: (g) => (ans ? matchScore(g, ans) + "%" : "—"), n: (g) => (ans ? matchScore(g, ans) : -1), hi: true },
    { l: "Est. hourly pay", f: (g) => money(adjPay(g, city)), n: (g) => adjPay(g, city), hi: true },
    { l: "Demand", f: (g) => demandLabel(g.demand), n: (g) => g.demand, hi: true },
    { l: "Startup cost", f: (g) => (g.startupCost === 0 ? "Free" : money(g.startupCost)), n: (g) => -g.startupCost, hi: true },
    { l: "Vehicle", f: (g) => g.vehicleLabel, n: null, hi: false },
  ];
  let html = "<h2>⚖️ Side-by-side</h2><p class='sub'>Green = best value in that row.</p>";
  html += '<div style="overflow-x:auto"><table class="cmp-table"><tr><th></th>';
  gigs.forEach((g) => (html += "<th>" + g.icon + "<br/>" + esc(g.name) + "</th>"));
  html += "</tr>";
  rows.forEach((r) => {
    html += "<tr><td><b>" + r.l + "</b></td>";
    let best = -Infinity;
    if (r.hi) gigs.forEach((g) => (best = Math.max(best, r.n(g))));
    gigs.forEach((g) => {
      const isBest = r.hi && r.n(g) === best;
      html += '<td class="' + (isBest ? "best" : "") + '">' + r.f(g) + "</td>";
    });
    html += "</tr>";
  });
  html += "</table></div>";
  html += '<div class="row" style="margin-top:18px"><a class="btn btn-ghost" href="#/saved">← Back to saved</a></div>';
  return html;
}

/* ---------------- about ---------------- */
function vAbout(tab) {
  const tabs = [
    { v: "", l: "About" },
    { v: "faq", l: "FAQ" },
    { v: "privacy", l: "Privacy" },
    { v: "terms", l: "Terms" },
  ];
  let html =
    "<h2>About HustleMatch</h2>" +
    '<div class="cat-row">' +
    tabs.map((t) => '<a class="chip' + (tab === t.v ? " selected" : "") + '" href="#/about' + (t.v ? "/" + t.v : "") + '">' + t.l + "</a>").join("") +
    "</div>";
  if (tab === "faq") {
    html +=
      '<div class="faq">' +
      "<details><summary>Is HustleMatch free?</summary><p>Yes. Matching, gig details and the earnings tracker are free.</p></details>" +
      "<details><summary>How are matches calculated?</summary><p>We score every gig on your skills, vehicle, startup budget, income goal, demand and schedule fit, then rank them. Pay is adjusted for your city.</p></details>" +
      "<details><summary>Where is my data stored?</summary><p>On your own device. Nothing is uploaded anywhere in this version.</p></details>" +
      "<details><summary>Are the pay figures guaranteed?</summary><p>No — they're estimates based on typical gig earnings and vary by market, hours and effort.</p></details>" +
      "<details><summary>How do I advertise here?</summary><p>Email advertise@hustlematch.app with your gig platform and budget.</p></details>" +
      "</div>";
  } else if (tab === "privacy") {
    html +=
      '<div class="legal"><h3>Privacy Policy</h3>' +
      "<p>HustleMatch stores your quiz answers, saved gigs and earnings entries <b>only on your device</b>. We don't run accounts or servers in this version, so there's nothing to leak.</p>" +
      "<p>Email addresses you enter are kept on your device for now. A future version with accounts will publish a full data policy before collecting anything remotely.</p>" +
      "<h3>Ads</h3><p>Ad slots in the app are placeholders. If ads are enabled later, standard ad-network data practices will apply and be disclosed here.</p></div>";
  } else if (tab === "terms") {
    html +=
      '<div class="legal"><h3>Terms of Use</h3>' +
      "<p>HustleMatch provides gig information and estimates for entertainment and informational purposes only. Nothing here is financial, legal or employment advice.</p>" +
      "<p>Pay figures are estimates and vary widely. Always verify terms directly with the gig platform before signing up.</p>" +
      "<p>Use the app at your own risk. We're not liable for earnings, platform decisions or anything that happens on a gig.</p></div>";
  } else {
    html +=
      "<p>HustleMatch matches you with side hustles that fit your life — then helps you track every dollar. Built for hustlers, by hustlers.</p>" +
      '<div class="card"><h3>📬 Contact</h3><form data-emailform id="aboutContact"><label class="f-label">Name</label><input required placeholder="Your name" /><label class="f-label">Message</label><textarea rows="4" required placeholder="What is up?"></textarea><div style="margin-top:12px"><button class="btn btn-primary" type="submit">Send message</button></div></form><p style="font-size:12px;color:var(--muted)">Messages are stored on your device in this version.</p></div>';
  }
  return html;
}

/* ---------------- resume builder guide ---------------- */
const RESUME_TIPS_BY_CAT = {
  "Driving": [
    "Lead with your driving record: years licensed, clean record, and your rider rating if you have one.",
    "Name your vehicle (year, make, model) — clients and platforms filter on this.",
    "Mention local knowledge: neighborhoods, airport runs, event venues.",
  ],
  "Delivery": [
    "Quote your stats: deliveries per week, on-time rate, average rating.",
    "List your gear: insulated bags, phone mount, e-bike specs — it signals professionalism.",
    "Note your availability for peak pay windows (lunch/dinner rush, weekends).",
  ],
  "Home services": [
    "Before-and-after photos beat paragraphs. Link a simple photo album.",
    "List tools you own — clients hire the person who shows up ready.",
    "Name your specialties (IKEA assembly, TV mounting, drywall patching), not just 'handyman'.",
  ],
  "Pets": [
    "Certifications stand out: pet first aid/CPR takes a weekend and goes right at the top.",
    "Mention breed experience and sizes you're comfortable with.",
    "Reviews are currency — ask every happy client for one and quote the best lines.",
  ],
  "Freelance": [
    "Your portfolio link matters more than the resume itself — put it in the header.",
    "Niche down in your headline ('Thumbnails for finance YouTubers' beats 'graphic designer').",
    "Add 1–2 short client testimonials with names.",
  ],
  "Rental": [
    "Detail the car: year, mileage, features (CarPlay, backup cam). Photos sell it.",
    "Emphasize responsiveness — fast replies get bookings.",
    "Mention your cleaning routine between rentals.",
  ],
  "Restaurant": [
    "Name the cuisines and pace you handle — 'high-volume Friday nights' is a real skill.",
    "List certifications: food handler, Smart Serve (Ontario) for bartenders.",
    "Mention POS systems you know (Toast, Square) — managers filter on this.",
  ],
  "Trades": [
    "Lead with years on site and the trades you've worked — specificity beats 'general labor'.",
    "List tickets and safety certs: Working at Heights, WHMIS, forklift license.",
    "Mention tools you own — showing up ready wins jobs.",
  ],
  "Retail & Events": [
    "Highlight cash handling, POS systems, and any loss-prevention experience.",
    "For events: reliability is everything — mention a perfect attendance record.",
    "Brand ambassador gigs want energy — link a short intro video.",
  ],
  "Creative": [
    "Your portfolio link matters more than the resume — put it in the header.",
    "Name your tools: Lightroom, Premiere, Pro Tools, your camera body.",
    "Niche down: 'real estate photography' beats 'photographer'.",
  ],
  "Online": [
    "List every tool: Slack, Notion, Asana, CRMs, AI tools — clients search keywords.",
    "Prove remote discipline: 'self-managed across 4 time zones'.",
    "Typing speed (WPM) still matters for data entry and transcription.",
  ],
  "Care": [
    "Certifications are everything: First Aid/CPR, vulnerable sector check, ECE.",
    "Mention age groups and special-needs experience specifically.",
    "References from families carry more weight here than anywhere — ask for them.",
  ],
};

function vResume() {
  const toc = [
    ["#rs-why", "Why it matters"],
    ["#rs-steps", "Build it step by step"],
    ["#rs-gigs", "Tips by gig type"],
    ["#rs-dodont", "Do's & Don'ts"],
    ["#rs-words", "Power words"],
    ["#rs-check", "Final checklist"],
    ["#rs-templates", "✉️ Templates"],
  ];
  let html =
    "<h2>📝 Resume Builder</h2>" +
    '<p class="sub">Gig platforms <b>are</b> job applications — Rover, TaskRabbit and Upwork all make you sell yourself in writing. Here is how to write one that gets picked.</p>' +
    '<div class="cta-banner" style="margin:0 0 24px;padding:26px 20px"><h2 style="font-size:22px;margin:0 0 6px">✨ Want it built for you?</h2><p style="margin:0 0 14px">Answer a few questions and we will assemble your resume.</p><a class="btn btn-light" href="#/resume/builder">Build my resume →</a></div>' +
    '<div class="cat-row">' +
    toc.map((t) => '<a class="chip" href="' + t[0] + '">' + t[1] + "</a>").join("") +
    "</div>";

  html +=
    '<div class="card" id="rs-why"><h3>⚡ The 7-second truth</h3>' +
    "<p>Clients and recruiters scan for about <b>7 seconds</b> before deciding. They don't read duties — they hunt for <b>proof</b>: numbers, ratings, and specific skills. Every line of your resume should answer <i>'why should I pick you?'</i></p>" +
    "<p>For gig work, <b>merge</b> short contracts instead of listing each one. Group them under one heading like <b>'Independent Contractor — Self-Employed (2023–Present)'</b>, then bullet your wins with client names. You look established, not jumpy.</p></div>";

  const steps = [
    ["1", "Header", "Name, city, phone, email — plus one link: portfolio, LinkedIn, or your best platform profile. No full street address needed."],
    ["2", "Headline, not objective", "Skip 'seeking a position where…'. Use the formula: <b>[Role] + [Years] + [Proof]</b>.<br/><i>Example: 'Rideshare driver, 4 years, 4.96 rating across 3,200 trips in Toronto.'</i>"],
    ["3", "Skills snapshot", "6–9 skills matched to the gig you're chasing. Mirror the platform's own words (it helps with search and screening)."],
    ["4", "Experience with numbers", "Turn every duty into a metric: deliveries per week, on-time %, repeat-client rate, revenue handled. <i>'Delivered 120+ orders weekly with a 98% on-time rate'</i> beats <i>'responsible for deliveries'</i>."],
    ["5", "Reviews & proof", "One or two short client quotes with names. Screenshots of 5-star ratings work on profile-style platforms."],
    ["6", "Extras that pay", "Certifications (pet first aid, food safety), languages, tools you own, vehicle details. These are tiebreakers that win gigs."],
  ];
  html += '<div class="section" id="rs-steps"><h3>🔨 Build it step by step</h3><div class="grid">';
  steps.forEach((s) => {
    html += '<div class="card"><div class="step-num">' + s[0] + "</div><h3>" + s[1] + "</h3><p>" + s[2] + "</p></div>";
  });
  html += "</div></div>";

  html += '<div class="section" id="rs-gigs"><h3>🎯 Tips by gig type</h3>';
  Object.keys(RESUME_TIPS_BY_CAT).forEach((cat) => {
    html +=
      '<details class="faq" style="margin-bottom:10px"><summary style="font-weight:700;cursor:pointer">' +
      esc(cat) +
      "</summary><ul>" +
      RESUME_TIPS_BY_CAT[cat].map((t) => "<li>" + t + "</li>").join("") +
      "</ul></details>";
  });
  html += "</div>";

  const dos = [
    "One page (two max) — cut anything that doesn't match the gig",
    "Numbers on every other line: ratings, counts, percentages",
    "Keywords from the actual gig posting",
    "Clean, simple formatting — no tables, text boxes or fancy fonts",
    "PDF format, named: Firstname-Lastname-Resume.pdf",
  ];
  const donts = [
    "Objective statements ('seeking a position…')",
    "Listing 15 tiny gigs separately — merge them",
    "Unexplained gaps (one line: 'family care', 'travel' is fine)",
    "Photos, birth date, or full home address",
    "Lying about ratings or experience — platforms verify",
  ];
  html +=
    '<div class="section" id="rs-dodont"><h3>✅ ❌ Do\'s & Don\'ts</h3><div class="procon">' +
    '<div class="card"><h3>✅ Do</h3><ul>' + dos.map((d) => "<li>" + d + "</li>").join("") + "</ul></div>" +
    '<div class="card"><h3>❌ Don\'t</h3><ul>' + donts.map((d) => "<li>" + d + "</li>").join("") + "</ul></div>" +
    "</div></div>";

  const words = ["Delivered", "Managed", "Increased", "Maintained", "Resolved", "Trained", "Built", "Grew", "Streamlined", "Earned", "Completed", "Supported"];
  html +=
    '<div class="section" id="rs-words"><h3>💪 Power words</h3><p class="sub">Start bullets with these instead of "responsible for".</p><div class="chips">' +
    words.map((w) => '<span class="chip">' + w + "</span>").join("") +
    "</div></div>";

  const checks = [
    "Fits on one page?",
    "Headline has role + years + proof?",
    "Every bullet starts with a power word?",
    "Numbers in at least half the bullets?",
    "Skills match the gig posting's keywords?",
    "No typos (read it out loud once)?",
    "Saved as PDF with a professional filename?",
    "Someone else skimmed it for 7 seconds and got it?",
  ];
  html +=
    '<div class="section" id="rs-check"><div class="card"><h3>✔️ Final 30-second checklist</h3><ul>' +
    checks.map((c) => "<li>" + c + "</li>").join("") +
    "</ul></div></div>";

  html += vTemplates();

  html +=
    '<div class="cta-banner"><h2>Ready to get matched?</h2><p>Take the quiz and apply to gigs with your new resume.</p>' +
    '<a class="btn btn-light btn-big" href="#/quiz">Find my gigs ⚡</a></div>';
  return html;
}

/* ---------------- resume builder wizard ---------------- */
const RB_STEPS = ["Contact", "Headline", "Skills", "Experience", "Extras", "Preview"];
let rbState = null;
function rbGet() {
  if (!rbState) {
    rbState = store.get("resumeDoc", null) || {
      step: 0,
      data: {
        contact: { name: "", city: "", phone: "", email: "", link: "" },
        headline: { role: "", years: "", proof: "" },
        skills: [],
        exp: [],
        extras: { certs: "", langs: "", tools: "" },
      },
    };
  }
  return rbState;
}
function rbSave() {
  store.set("resumeDoc", rbState);
}
function vResumeBuilder() {
  rbGet();
  return '<div class="quiz-wrap" id="rbBox" style="max-width:720px"></div>';
}
function renderRbStep() {
  const box = document.getElementById("rbBox");
  if (!box) return;
  const st = rbGet();
  const i = st.step;
  const pct = Math.round((i / (RB_STEPS.length - 1)) * 100);
  let body = "";
  if (i === 0) body = rbStepContact();
  else if (i === 1) body = rbStepHeadline();
  else if (i === 2) body = rbStepSkills();
  else if (i === 3) body = rbStepExp();
  else if (i === 4) body = rbStepExtras();
  else body = rbStepPreview();
  box.innerHTML =
    '<div class="progress"><i style="width:' + pct + '%"></i></div>' +
    '<div class="progress-label">Step ' + (i + 1) + " of " + RB_STEPS.length + " — " + RB_STEPS[i] + "</div>" +
    body +
    (i < 5
      ? '<div class="quiz-nav">' +
        (i > 0 ? '<button class="btn btn-ghost" id="rbBack">← Back</button>' : "<span></span>") +
        '<button class="btn btn-primary" id="rbNext">' +
        (i === 4 ? "Preview my resume ✨" : "Continue →") +
        "</button></div>"
      : "");
  bindRbStep(i);
}
function rbStepContact() {
  const c = rbGet().data.contact;
  const f = (k, label, ph, type) =>
    '<label class="f-label">' + label + '</label><input id="rb_' + k + '" type="' + (type || "text") + '" value="' + esc(c[k] || "") + '" placeholder="' + ph + '" />';
  return (
    "<h2>📇 Your contact info</h2><p class='sub'>The basics — this goes at the top.</p>" +
    f("name", "Full name", "Alex Rivera") +
    f("city", "City", "Toronto") +
    f("phone", "Phone", "416-555-0100", "tel") +
    f("email", "Email", "you@email.com", "email") +
    f("link", "Link (portfolio, LinkedIn…)", "linkedin.com/in/you")
  );
}
function rbStepHeadline() {
  const h = rbGet().data.headline;
  return (
    "<h2>⚡ Your headline</h2><p class='sub'>Formula: <b>role + years + proof</b>.<br/><i>Example: 'Rideshare driver, 4 years — 4.96 rating across 3,200 trips'.</i></p>" +
    '<label class="f-label">Role / title</label><input id="rb_role" value="' + esc(h.role || "") + '" placeholder="Delivery driver" />' +
    '<label class="f-label">Years of experience</label><select id="rb_years">' +
    ["", "Less than 1", "1–2", "3–5", "5–10", "10+"]
      .map((y) => '<option value="' + y + '"' + (h.years === y ? " selected" : "") + ">" + (y || "Select…") + "</option>")
      .join("") +
    "</select>" +
    '<label class="f-label">Your proof (rating, numbers, big win)</label><input id="rb_proof" value="' + esc(h.proof || "") + '" placeholder="4.9 rating · 2,000+ deliveries" />'
  );
}
function rbStepSkills() {
  const cur = rbGet().data.skills;
  return (
    "<h2>🛠️ Your skills</h2><p class='sub'>Tap to pick, or add your own below.</p>" +
    '<div class="chips" id="rbSkillChips">' +
    SKILLS.map(
      (s) => '<button type="button" class="chip' + (cur.includes(s) ? " selected" : "") + '" data-skill="' + esc(s) + '">' + esc(s) + "</button>"
    ).join("") +
    "</div>" +
    '<div class="row" style="margin-top:14px"><input id="rbCustomSkill" placeholder="Add your own skill…" /><button class="btn btn-ghost" id="rbAddSkill" type="button" style="flex:0 0 auto">Add</button></div>'
  );
}
function rbStepExp() {
  const exps = rbGet().data.exp;
  let html =
    "<h2>💼 Experience</h2><p class='sub'>Add each role or major gig. Short contracts? Group them as one 'Self-Employed' entry (the guide's merge trick).</p>";
  if (exps.length) {
    html +=
      '<div class="shift-list" style="margin-bottom:14px">' +
      exps
        .map(
          (e, i) =>
            '<div class="shift"><span><b>' + esc(e.title) + "</b> · " + esc(e.company) + ' <span style="color:var(--muted)">' + esc(e.dates) + '</span></span><button class="del" data-expdel="' + i + '">×</button></div>'
        )
        .join("") +
      "</div>";
  }
  html +=
    '<div class="card"><h3>➕ Add entry</h3>' +
    '<label class="f-label">Job title</label><input id="rbE_title" placeholder="Delivery Driver" />' +
    '<label class="f-label">Company / platform</label><input id="rbE_company" placeholder="DoorDash (Self-employed)" />' +
    '<label class="f-label">Dates</label><input id="rbE_dates" placeholder="2022 – Present" />' +
    '<label class="f-label">Achievements (one per line — use numbers!)</label><textarea id="rbE_bullets" rows="3" placeholder="Completed 150+ deliveries weekly\nMaintained 4.9 star rating"></textarea>' +
    '<div style="margin-top:12px"><button class="btn btn-ghost btn-block" id="rbAddExp" type="button">Add this entry</button></div></div>';
  return html;
}
function rbStepExtras() {
  const x = rbGet().data.extras;
  return (
    "<h2>🌟 Extras</h2><p class='sub'>Certifications, languages, tools — the tiebreakers that win gigs.</p>" +
    '<label class="f-label">Certifications (one per line)</label><textarea id="rb_certs" rows="2" placeholder="Pet First Aid & CPR\nFood Handler Certificate">' +
    esc(x.certs) +
    "</textarea>" +
    '<label class="f-label">Languages</label><input id="rb_langs" value="' + esc(x.langs) + '" placeholder="English, Spanish" />' +
    '<label class="f-label">Tools / equipment you own</label><input id="rb_tools" value="' + esc(x.tools) + '" placeholder="Insulated delivery bags, full toolset" />'
  );
}
function rbResumeHTML() {
  const d = rbGet().data,
    c = d.contact,
    h = d.headline;
  let html = '<div class="resume-doc">';
  html += "<h1>" + esc(c.name || "Your Name") + "</h1>";
  const line = [c.city, c.phone, c.email, c.link].filter(Boolean).join(" · ");
  if (line) html += '<p class="rs-line">' + esc(line) + "</p>";
  const head = [h.role, h.years ? h.years + " years experience" : "", h.proof].filter(Boolean).join(" — ");
  if (head) html += '<p class="rs-head">' + esc(head) + "</p>";
  if (d.skills.length) html += "<h2>Skills</h2><p>" + d.skills.map(esc).join(" · ") + "</p>";
  if (d.exp.length) {
    html += "<h2>Experience</h2>";
    d.exp.forEach((e) => {
      html +=
        '<div class="rs-exp"><b>' +
        esc(e.title) +
        "</b> — " +
        esc(e.company) +
        (e.dates ? ' <span class="rs-dates">' + esc(e.dates) + "</span>" : "") +
        (e.bullets
          ? "<ul>" +
            e.bullets.split("\n").map((b) => b.trim()).filter(Boolean).map((b) => "<li>" + esc(b) + "</li>").join("") +
            "</ul>"
          : "") +
        "</div>";
    });
  }
  const extras = [];
  if (d.extras.certs.trim()) extras.push("<b>Certifications:</b> " + esc(d.extras.certs.trim()).replace(/\n/g, ", "));
  if (d.extras.langs.trim()) extras.push("<b>Languages:</b> " + esc(d.extras.langs));
  if (d.extras.tools.trim()) extras.push("<b>Tools:</b> " + esc(d.extras.tools));
  if (extras.length) html += "<h2>Additional</h2><p>" + extras.join("<br/>") + "</p>";
  return html + "</div>";
}
function rbResumeText() {
  const d = rbGet().data,
    c = d.contact,
    h = d.headline,
    L = [];
  L.push((c.name || "Your Name").toUpperCase());
  const line = [c.city, c.phone, c.email, c.link].filter(Boolean).join(" | ");
  if (line) L.push(line);
  L.push("");
  const head = [h.role, h.years ? h.years + " years experience" : "", h.proof].filter(Boolean).join(" — ");
  if (head) {
    L.push(head.toUpperCase());
    L.push("");
  }
  if (d.skills.length) {
    L.push("SKILLS");
    L.push(d.skills.join(" | "));
    L.push("");
  }
  if (d.exp.length) {
    L.push("EXPERIENCE");
    d.exp.forEach((e) => {
      L.push(e.title + (e.company ? " — " + e.company : "") + (e.dates ? " | " + e.dates : ""));
      e.bullets.split("\n").map((b) => b.trim()).filter(Boolean).forEach((b) => L.push("• " + b));
      L.push("");
    });
  }
  const ex = [];
  if (d.extras.certs.trim()) ex.push("Certifications: " + d.extras.certs.trim().replace(/\n/g, ", "));
  if (d.extras.langs.trim()) ex.push("Languages: " + d.extras.langs.trim());
  if (d.extras.tools.trim()) ex.push("Tools: " + d.extras.tools.trim());
  if (ex.length) {
    L.push("ADDITIONAL");
    ex.forEach((x) => L.push(x));
  }
  return L.join("\n");
}
function rbStepPreview() {
  return (
    "<h2>✨ Your resume</h2><p class='sub'>Here's what your answers built. Copy it, download it, or go back and tweak.</p>" +
    rbResumeHTML() +
    '<div class="row no-print" style="margin-top:16px"><button class="btn btn-primary" id="rbCopy" type="button">📋 Copy text</button><button class="btn btn-ghost" id="rbDl" type="button">⬇️ Download</button></div>' +
    '<div class="row no-print" style="margin-top:10px"><button class="btn btn-ghost" id="rbPrint" type="button">🖨️ Print</button><button class="btn btn-ghost" id="rbEdit" type="button">← Edit answers</button></div>' +
    '<button class="btn btn-ghost btn-block no-print" id="rbReset" type="button" style="margin-top:10px">Start over</button>'
  );
}
function rbCollect(i) {
  const d = rbGet().data;
  if (i === 0) {
    ["name", "city", "phone", "email", "link"].forEach((k) => (d.contact[k] = document.getElementById("rb_" + k).value.trim()));
    if (!d.contact.name) {
      toast("Add your name 🙂");
      return false;
    }
  } else if (i === 1) {
    d.headline.role = document.getElementById("rb_role").value.trim();
    d.headline.years = document.getElementById("rb_years").value;
    d.headline.proof = document.getElementById("rb_proof").value.trim();
  } else if (i === 4) {
    d.extras.certs = document.getElementById("rb_certs").value;
    d.extras.langs = document.getElementById("rb_langs").value.trim();
    d.extras.tools = document.getElementById("rb_tools").value.trim();
  }
  rbSave();
  return true;
}
function bindRbStep(i) {
  const back = document.getElementById("rbBack");
  if (back)
    back.onclick = () => {
      rbGet().step--;
      rbSave();
      renderRbStep();
    };
  const next = document.getElementById("rbNext");
  if (next)
    next.onclick = () => {
      if (!rbCollect(i)) return;
      rbGet().step++;
      rbSave();
      renderRbStep();
    };
  if (i === 2) {
    document.querySelectorAll("#rbSkillChips .chip").forEach((ch) => {
      ch.onclick = () => {
        const s = ch.dataset.skill;
        const cur = rbGet().data.skills;
        rbGet().data.skills = cur.includes(s) ? cur.filter((x) => x !== s) : cur.concat([s]);
        ch.classList.toggle("selected");
        rbSave();
      };
    });
    const add = document.getElementById("rbAddSkill");
    if (add)
      add.onclick = () => {
        const inp = document.getElementById("rbCustomSkill");
        const v = inp.value.trim();
        if (v && !rbGet().data.skills.includes(v)) {
          rbGet().data.skills.push(v);
          rbSave();
        }
        renderRbStep();
      };
  }
  if (i === 3) {
    document.querySelectorAll("[data-expdel]").forEach((b) => {
      b.onclick = () => {
        rbGet().data.exp.splice(+b.dataset.expdel, 1);
        rbSave();
        renderRbStep();
      };
    });
    const add = document.getElementById("rbAddExp");
    if (add)
      add.onclick = () => {
        const t = document.getElementById("rbE_title").value.trim();
        const co = document.getElementById("rbE_company").value.trim();
        if (!t) {
          toast("Give the entry a job title 🙂");
          return;
        }
        rbGet().data.exp.push({
          title: t,
          company: co,
          dates: document.getElementById("rbE_dates").value.trim(),
          bullets: document.getElementById("rbE_bullets").value.trim(),
        });
        rbSave();
        renderRbStep();
        toast("Entry added ✓");
      };
  }
  if (i === 5) {
    document.getElementById("rbCopy").onclick = async () => {
      try {
        await navigator.clipboard.writeText(rbResumeText());
        toast("Resume copied 📋");
      } catch (e) {
        toast("Copy blocked — use Download instead");
      }
    };
    document.getElementById("rbDl").onclick = () => {
      const blob = new Blob([rbResumeText()], { type: "text/plain" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "my-resume.txt";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast("Downloaded ⬇️");
    };
    document.getElementById("rbPrint").onclick = () => window.print();
    document.getElementById("rbEdit").onclick = () => {
      rbGet().step = 0;
      rbSave();
      renderRbStep();
    };
    document.getElementById("rbReset").onclick = () => {
      rbState = null;
      store.set("resumeDoc", null);
      rbGet();
      renderRbStep();
    };
  }
}

/* ---------------- application templates ---------------- */
const TEMPLATES = [
  {
    id: "tpl-rover",
    emoji: "🐾",
    title: "Rover pet sitter bio",
    for: "Rover, Wag, pet-sitting profiles",
    body: "Hi, I'm [Your Name]! I'm a lifelong animal lover with [X] years of experience caring for dogs and cats of all sizes. I offer boarding, daycare, and drop-in visits, and I send photo updates so you always know your pet is happy. Your pet gets my full attention — no crowded kennels, just a cozy home and lots of playtime. Let's set up a meet & greet!",
  },
  {
    id: "tpl-taskrabbit",
    emoji: "🔧",
    title: "TaskRabbit tasker pitch",
    for: "TaskRabbit, handyman & home-service profiles",
    body: "Hi, I'm [Your Name] — I help with [furniture assembly / mounting / repairs]. I bring my own professional tools, I show up on time, and I don't leave until the job is done right. With [X] years of hands-on experience and a [X]-star average rating, you can book with confidence. Message me with details and I'll give you a fair, upfront quote.",
  },
  {
    id: "tpl-upwork",
    emoji: "💻",
    title: "Upwork proposal opener",
    for: "Upwork, Fiverr, freelance proposals",
    body: "Hi [Client Name], I read your posting carefully and I can help. I'm [Your Name], a [your specialty] with [X] years of experience and [proof: e.g. 50+ five-star reviews]. For your project specifically, I'd [one concrete idea or approach]. I can start [when] and deliver [what] by [date]. Happy to jump on a quick call — what's the best time for you?",
  },
  {
    id: "tpl-restaurant",
    emoji: "🍽️",
    title: "Restaurant job application",
    for: "Server, cook, barista & bartender applications",
    body: "Hi, I'm [Your Name] and I'd love to join your team as a [position]. I bring [X] years of [serving / cooking / barista] experience, I'm comfortable in high-volume rushes, and I genuinely enjoy making guests happy. I'm available [your availability] and can start [when]. My resume is attached — would love to come in for a trial shift!",
  },
  {
    id: "tpl-generic",
    emoji: "✉️",
    title: "General gig application",
    for: "Any gig, gig-board or direct message",
    body: "Hi, I'm [Your Name]. I'm interested in the [gig name] opportunity — I have [X] years of relevant experience and I'm available [your schedule]. A couple of quick highlights: [proof #1, e.g. 4.9 rating] and [proof #2, e.g. 200+ completed jobs]. I'm reliable, responsive, and ready to start [when]. Can we talk next steps?",
  },
  {
    id: "tpl-followup",
    emoji: "👋",
    title: "Follow-up nudge",
    for: "When a client goes quiet",
    body: "Hi [Client Name], just floating this back to the top of your inbox! I'm still very interested in [the project / the role] and I'm available to start [when]. If the scope or timing has changed, no worries — just let me know. Either way, hope you're having a great week. — [Your Name]",
  },
  {
    id: "tpl-rate",
    emoji: "💰",
    title: "Rate negotiation reply",
    for: "When the pay offered is too low",
    body: "Thanks for getting back to me! Based on the scope — [briefly restate the work] — my rate for this would be [your rate]. That reflects [your proof: ratings, experience, demand]. I'm confident I'll deliver great value, and I'm flexible on [timeline / scope] if budget is tight. Does that work for you?",
  },
];

function vTemplates() {
  let html = '<div class="section" id="rs-templates"><h3>✉️ Application templates</h3>';
  html += '<p class="sub">Copy, paste, tweak the brackets — then send. Personalize with your name from your profile.</p>';
  TEMPLATES.forEach((t) => {
    html +=
      '<div class="card tpl-card"><div class="tpl-head"><h3>' + t.emoji + " " + t.title + '</h3><button class="btn btn-ghost" data-tplcopy="' + t.id + '">📋 Copy</button></div>' +
      '<p class="sub" style="margin:0 0 8px">For: ' + t.for + '</p>' +
      '<textarea id="ta-' + t.id + '">' + esc(t.body) + "</textarea></div>";
  });
  return html + "</div>";
}

function bindTemplates() {
  const prof = Auth.current();
  const nm = prof ? prof.name : "";
  document.querySelectorAll("[data-tplcopy]").forEach((b) => {
    b.onclick = async () => {
      const ta = document.getElementById("ta-" + b.dataset.tplcopy);
      let txt = ta.value;
      if (nm) txt = txt.split("[Your Name]").join(nm);
      try {
        await navigator.clipboard.writeText(txt);
        toast("Template copied 📋");
      } catch (e) {
        ta.select();
        toast("Copy manually (Ctrl+C) 🙂");
      }
    };
  });
}

/* ---------------- auth ----------------
   Local profiles today; designed so a Firebase/Google provider
   can plug in later without changing the app's views. */
const Auth = {
  current() {
    return store.get("profile", null);
  },
  signIn(name, email) {
    const p = {
      id: "u" + Date.now().toString(36),
      name: String(name).trim(),
      email: String(email).trim(),
      createdAt: new Date().toISOString(),
      provider: "local",
    };
    store.set("profile", p);
    return p;
  },
  signOut() {
    store.set("profile", null);
  },
};

function vLogin() {
  if (Auth.current()) {
    setTimeout(() => (location.hash = "#/profile"), 50);
    return '<p class="center">Already signed in…</p>';
  }
  return (
    '<div class="quiz-wrap"><div class="card">' +
    "<h2>👋 Welcome to HustleMatch</h2>" +
    '<p class="sub">Create your profile to personalize your hustle. Your profile and data stay on this device.</p>' +
    '<form id="loginForm">' +
    '<label class="f-label">Your name</label><input id="liName" required maxlength="40" placeholder="Alex" autocomplete="name" />' +
    '<label class="f-label">Email</label><input id="liEmail" type="email" required placeholder="you@email.com" autocomplete="email" />' +
    '<div style="margin-top:16px"><button class="btn btn-primary btn-block" type="submit">Create my profile ⚡</button></div>' +
    "</form>" +
    '<p style="font-size:13px;color:var(--muted);margin-top:14px">🔜 <b>Sign in with Google</b> unlocks when HustleMatch hits the Play Store — your profile carries over.</p>' +
    "</div></div>"
  );
}

function vProfile() {
  const p = Auth.current();
  if (!p) {
    setTimeout(() => (location.hash = "#/login"), 50);
    return '<p class="center">Redirecting to sign in…</p>';
  }
  const shifts = store.get("shifts", []);
  const total = shifts.reduce((t, s) => t + s.earnings, 0);
  const initial = (p.name.trim().charAt(0) || "?").toUpperCase();
  return (
    '<div class="quiz-wrap"><div class="card center">' +
    '<div style="width:72px;height:72px;border-radius:50%;background:var(--red);display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:800;margin:0 auto 12px">' +
    esc(initial) +
    "</div>" +
    '<h2 style="margin:0">' + esc(p.name) + "</h2>" +
    '<p class="sub">' + esc(p.email) + "</p>" +
    '<div class="detail-stats">' +
    '<div class="dstat"><b>' + store.get("saved", []).length + "</b><span>saved gigs</span></div>" +
    '<div class="dstat"><b>' + shifts.length + "</b><span>shifts logged</span></div>" +
    '<div class="dstat"><b>' + money(total) + "</b><span>tracked earnings</span></div>" +
    "</div>" +
    '<button class="btn btn-ghost btn-block" id="signOutBtn">Sign out</button>' +
    '<p style="font-size:12px;color:var(--muted)">Profile and data live on this device. Google sign-in with cloud sync arrives with the Play Store release.</p>' +
    "</div></div>"
  );
}

function bindLogin() {
  const f = document.getElementById("loginForm");
  if (!f) return;
  f.onsubmit = (e) => {
    e.preventDefault();
    const n = document.getElementById("liName").value.trim();
    const m = document.getElementById("liEmail").value.trim();
    if (!n || !m) {
      toast("Name and email, please 🙂");
      return;
    }
    Auth.signIn(n, m);
    toast("Welcome, " + n.split(" ")[0] + "! ⚡");
    location.hash = "#/";
  };
}
function bindProfile() {
  const b = document.getElementById("signOutBtn");
  if (!b) return;
  b.onclick = () => {
    Auth.signOut();
    toast("Signed out. See you soon 👋");
    location.hash = "#/";
  };
}

/* ---------------- employer job board ---------------- */
function getJobs() {
  return store.get("jobs", []);
}
function saveJobs(j) {
  store.set("jobs", j);
}
function jobToGig(job, mine) {
  const apply = [];
  if (job.url) apply.push({ label: "Apply online →", url: job.url });
  if (job.contact && job.contact.indexOf("@") >= 0) apply.push({ label: "Email employer", url: "mailto:" + job.contact });
  let desc = job.description;
  if (job.requirements && job.requirements.length) desc += "\n\nRequirements: " + job.requirements.join("; ");
  return {
    id: job.id,
    name: job.title,
    platforms: job.company + " · " + job.city,
    category: job.category,
    icon: "💼",
    tagline: job.description.slice(0, 90) + (job.description.length > 90 ? "…" : ""),
    basePay: job.pay,
    demand: 3,
    startupCost: 0,
    vehicle: "none",
    vehicleLabel: "No vehicle needed",
    skills: job.skills || [],
    styles: [job.style || "social"],
    schedule: [job.schedule || "any"],
    description: desc,
    pros: ["Posted directly by the employer", "Local opportunity — apply in one tap"],
    cons: ["Employer postings aren't verified by HustleMatch — use your judgment"],
    apply: apply.length ? apply : [{ label: job.company, url: "#/post-job" }],
    community: true,
    mine: mine !== false,
    contact: job.contact,
    postedAt: job.postedAt || "",
  };
}
function deleteJob(id) {
  saveJobs(getJobs().filter((j) => j.id !== id));
  const i = GIGS.findIndex((g) => g.id === id);
  if (i >= 0) GIGS.splice(i, 1);
  if (window.HMFirebase) HMFirebase.deleteRemoteJob(id);
}

function vPostJob() {
  const jobs = getJobs();
  const cats = CATEGORIES.filter((c) => c !== "All");
  let html =
    "<h2>💼 Post a job</h2>" +
    '<p class="sub">Hiring? List your opening for free. It shows up in search, matching and gig pages across the app. <b>Note:</b> in this preview version, postings live on your device — the Play Store release will share them with every HustleMatch user.</p>' +
    '<div class="card"><h3>➕ New job posting</h3><form id="jobForm">' +
    '<label class="f-label">Job title *</label><input id="jbTitle" required placeholder="Line cook — weekends" />' +
    '<div class="row"><div><label class="f-label">Company *</label><input id="jbCompany" required placeholder="Joe\'s Diner" /></div>' +
    '<div><label class="f-label">City *</label><input id="jbCity" required placeholder="Toronto" /></div></div>' +
    '<div class="row"><div><label class="f-label">Category *</label><select id="jbCat">' +
    cats.map((c) => "<option>" + esc(c) + "</option>").join("") +
    '</select></div>' +
    '<div><label class="f-label">Hourly pay equivalent ($) *</label><input id="jbPay" type="number" min="1" step="1" required placeholder="20" /></div></div>' +
    '<p class="sub" style="margin:0 0 10px">Paid per shift or per week? Divide by hours to get the hourly equivalent.</p>' +
    '<div class="row"><div><label class="f-label">Work style</label><select id="jbStyle"><option value="road">🛣️ On the road</option><option value="home">🏠 From home</option><option value="active">⚡ Out and about</option><option value="social" selected>😄 With people</option></select></div>' +
    '<div><label class="f-label">Schedule</label><select id="jbSched"><option value="any" selected>🔥 Anytime</option><option value="weekdays">☀️ Weekdays</option><option value="evenings">🌙 Evenings & weekends</option></select></div></div>' +
    '<label class="f-label">Description *</label><textarea id="jbDesc" rows="3" required placeholder="What\'s the job? Hours? What makes it good?"></textarea>' +
    '<label class="f-label">Requirements (one per line)</label><textarea id="jbReq" rows="2" placeholder="Smart Serve certified&#10;Available weekends"></textarea>' +
    '<label class="f-label">Skills wanted (optional)</label><div class="chips" id="jbSkills">' +
    SKILLS.map((s) => '<button type="button" class="chip" data-skill="' + esc(s) + '">' + esc(s) + "</button>").join("") +
    "</div>" +
    '<div class="row"><div><label class="f-label">Contact (email or phone) *</label><input id="jbContact" required placeholder="hiring@joesdiner.ca" /></div>' +
    '<div><label class="f-label">Apply link (optional)</label><input id="jbUrl" type="url" placeholder="https://…" /></div></div>' +
    '<div style="margin-top:14px"><button class="btn btn-primary btn-block" type="submit">Post this job 💼</button></div></form></div>';

  html += '<div class="section"><h3>Your postings (' + jobs.length + ")</h3>";
  html += jobs.length
    ? '<div class="shift-list">' +
      jobs
        .map(
          (j) =>
            '<div class="shift"><span>💼 <b>' + esc(j.title) + "</b> · " + esc(j.company) + " · " + money(j.pay) + '/hr</span><span><a class="btn btn-ghost" href="#/gig/' + j.id + '">View</a> <button class="del" data-jobdel="' + j.id + '" aria-label="Delete">×</button></span></div>'
        )
        .join("") +
      "</div>"
    : "<p>No postings yet. Your jobs will appear here and across the app.</p>";
  return html + "</div>";
}

function bindPostJob() {
  const picked = [];
  document.querySelectorAll("#jbSkills .chip").forEach((ch) => {
    ch.onclick = () => {
      const s = ch.dataset.skill;
      const i = picked.indexOf(s);
      if (i >= 0) picked.splice(i, 1);
      else picked.push(s);
      ch.classList.toggle("selected");
    };
  });
  document.querySelectorAll("[data-jobdel]").forEach((b) => {
    b.onclick = () => {
      deleteJob(b.dataset.jobdel);
      toast("Posting deleted");
      route();
    };
  });
  const form = document.getElementById("jobForm");
  if (form)
    form.onsubmit = (e) => {
      e.preventDefault();
      const val = (id) => document.getElementById(id).value.trim();
      const job = {
        id: "job-" + uid(),
        title: val("jbTitle"),
        company: val("jbCompany"),
        city: val("jbCity"),
        category: val("jbCat"),
        pay: +val("jbPay"),
        style: val("jbStyle"),
        schedule: val("jbSched"),
        description: val("jbDesc"),
        requirements: val("jbReq").split("\n").map((s) => s.trim()).filter(Boolean),
        skills: picked.slice(),
        contact: val("jbContact"),
        url: val("jbUrl"),
        postedAt: new Date().toISOString().slice(0, 10),
      };
      if (!job.title || !job.company || !job.city || !job.pay || !job.description || !job.contact) {
        toast("Fill in the required fields 🙂");
        return;
      }
      const jobs = getJobs();
      jobs.push(job);
      saveJobs(jobs);
      GIGS.push(jobToGig(job));
      if (window.HMFirebase) HMFirebase.pushJob(job);
      toast("Job posted! 💼");
      location.hash = "#/gig/" + job.id;
    };
}

function bindGigDelete(id) {
  const b = document.getElementById("delJobBtn");
  if (b)
    b.onclick = () => {
      deleteJob(id);
      toast("Posting deleted");
      location.hash = "#/post-job";
    };
}

/* ---------------- boot ---------------- */
document.getElementById("navToggle").onclick = () => {
  document.getElementById("mainNav").classList.toggle("open");
};
getJobs().forEach((j) => GIGS.push(jobToGig(j)));
if (window.HMFirebase) HMFirebase.init();
document.getElementById("appVer").textContent = "v6 · " + GIGS.length + " gigs";
window.addEventListener("hashchange", route);
route();
