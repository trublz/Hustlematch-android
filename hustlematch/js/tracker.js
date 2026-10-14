/* HustleMatch earnings tracker: shifts, goal, canvas charts, breakdown.
   Exposes vTracker() and HM_trackerInit(). Data persists in localStorage. */

"use strict";

function uid() {
  return "s" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}
function getShifts() {
  return store.get("shifts", []);
}
function saveShifts(s) {
  store.set("shifts", s);
}
function getGoal() {
  return store.get("goal", 2000);
}

/* ---------- expenses, tax, streaks ---------- */
function getExpenses() {
  return store.get("expenses", []);
}
function saveExpenses(e) {
  store.set("expenses", e);
}
function getTaxRate() {
  return store.get("taxrate", 25);
}
const EXP_CATS = ["Gas", "Vehicle maintenance", "Supplies & tools", "Food & drink", "Phone & data", "Platform fees", "Other"];

function calcStreak(shifts) {
  if (!shifts.length) return 0;
  const days = new Set(shifts.map((s) => s.date));
  const iso = (dt) => dt.toISOString().slice(0, 10);
  const d = new Date();
  if (!days.has(iso(d))) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (days.has(iso(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function milestoneDefs(shifts, total, monthTotal, goal) {
  const streak = calcStreak(shifts);
  return {
    streak: streak,
    defs: [
      ["🌱", "First shift logged", shifts.length >= 1],
      ["💵", "Earned $100 total", total >= 100],
      ["💰", "Earned $500 total", total >= 500],
      ["🤑", "Earned $1,000 total", total >= 1000],
      ["🏦", "Earned $2,500 total", total >= 2500],
      ["🔟", "10 shifts logged", shifts.length >= 10],
      ["📈", "25 shifts logged", shifts.length >= 25],
      ["💯", "50 shifts logged", shifts.length >= 50],
      ["🔥", "3-day streak", streak >= 3],
      ["⚡", "7-day streak", streak >= 7],
      ["🌪️", "14-day streak", streak >= 14],
      ["👑", "30-day streak", streak >= 30],
      ["🎯", "Halfway to monthly goal", goal > 0 && monthTotal >= goal / 2],
      ["🏆", "Monthly goal smashed", goal > 0 && monthTotal >= goal],
    ],
  };
}

/* seed 12 sample shifts on first run */
function seedSamples() {
  if (store.get("seeded", false)) return;
  const gigIds = ["food-delivery", "rideshare", "pet-sitting", "freelance-design", "handyman", "dog-walking"];
  const samples = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 4 - 1);
    const gig = gigIds[i % gigIds.length];
    const hours = 2 + ((i * 7) % 5);
    samples.push({
      id: uid() + i,
      gigId: gig,
      date: d.toISOString().slice(0, 10),
      hours: hours,
      earnings: Math.round(hours * (14 + ((i * 13) % 18))),
      sample: true,
    });
  }
  saveShifts(samples);
  store.set("seeded", true);
}

/* ---------- view ---------- */
function vTracker() {
  seedSamples();
  const goal = getGoal();
  const shifts = getShifts().sort((a, b) => (a.date < b.date ? 1 : -1));
  const total = shifts.reduce((t, s) => t + s.earnings, 0);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthTotal = shifts.filter((s) => s.date.slice(0, 7) === thisMonth).reduce((t, s) => t + s.earnings, 0);
  const pct = goal > 0 ? Math.min(100, Math.round((monthTotal / goal) * 100)) : 0;

  /* money dashboard: gross / expenses / net / tax */
  const expenses = getExpenses().sort((a, b) => (a.date < b.date ? 1 : -1));
  const expMonth = getExpenses()
    .filter((e) => e.date.slice(0, 7) === thisMonth)
    .reduce((t, e) => t + e.amount, 0);
  const net = monthTotal - expMonth;
  const rate = getTaxRate();
  const taxAside = Math.max(0, net) * (rate / 100);
  const ms = milestoneDefs(shifts, total, monthTotal, goal);

  const gigOpts = GIGS.map((g) => '<option value="' + g.id + '">' + esc(g.icon + " " + g.name) + "</option>").join("");
  const today = new Date().toISOString().slice(0, 10);

  const moneyCard = (emoji, label, val, sub) =>
    '<div class="money-card"><span class="mc-emoji">' + emoji + '</span><b>' + val + '</b><small>' + label + '</small><span class="mc-sub">' + sub + "</span></div>";

  let html =
    "<h2>💰 Earnings tracker</h2>" +
    '<div class="goal-card"><div><b>Monthly goal</b><br/><span style="color:var(--muted);font-size:13px">This month: <b style="color:var(--text)">' +
    money(monthTotal) +
    "</b> of " +
    money(goal) +
    " (" +
    pct +
    "%)</span></div>" +
    '<input type="number" id="goalInput" min="0" step="50" value="' + goal + '" />' +
    '<button class="btn btn-primary" id="goalSave">Set goal</button></div>' +

    '<div class="progress" style="margin-bottom:18px"><i style="width:' + pct + '%"></i></div>' +

    '<div class="money-grid">' +
    moneyCard("💵", "Gross earned", money(monthTotal), "this month") +
    moneyCard("💸", "Expenses", money(expMonth), "this month") +
    moneyCard("✨", "Net profit", money(net), "gross − expenses") +
    moneyCard("🧾", "Tax set-aside", money(taxAside), rate + "% of net") +
    "</div>" +

    '<div class="card" style="margin-bottom:18px"><div class="row"><div><label class="f-label">Tax set-aside %</label><input type="number" id="taxInput" min="0" max="60" value="' +
    rate +
    '" /></div>' +
    '<div style="display:flex;align-items:flex-end"><button class="btn btn-ghost" id="taxSave">Update</button></div></div>' +
    '<p class="sub" style="margin:8px 0 0">Gig income isn\'t taxed at payout — stash this aside per shift and tax season won\'t hurt.</p></div>' +

    '<div class="streak-card"><div class="streak-fire">🔥</div><div><b>' +
    ms.streak +
    '-day streak</b><br/><span style="color:var(--muted);font-size:13px">Log a shift every day to keep it burning.</span></div></div>' +

    '<div class="chart-card"><h3>🏆 Milestones</h3><div class="ms-grid">' +
    ms.defs
      .map((d) => '<div class="ms' + (d[2] ? " unlocked" : "") + '"><span>' + d[0] + "</span><small>" + d[1] + "</small></div>")
      .join("") +
    "</div></div>" +

    '<div class="chart-card"><h3>Last 8 weeks</h3><canvas class="chart" id="chWeeks"></canvas></div>' +
    '<div class="chart-card"><h3>Last 6 months</h3><canvas class="chart" id="chMonths"></canvas></div>' +

    '<div class="chart-card"><h3>Breakdown by gig</h3><div id="breakdown"></div></div>' +

    '<div class="card"><h3>➕ Log a shift</h3>' +
    '<form id="shiftForm"><label class="f-label">Gig</label><select id="sfGig">' + gigOpts + "</select>" +
    '<div class="row"><div><label class="f-label">Date</label><input type="date" id="sfDate" value="' + today + '" required /></div>' +
    '<div><label class="f-label">Hours</label><input type="number" id="sfHours" min="0.5" step="0.5" value="4" required /></div>' +
    '<div><label class="f-label">Earnings ($)</label><input type="number" id="sfEarn" min="0" step="1" value="80" required /></div></div>' +
    '<div style="margin-top:14px"><button class="btn btn-primary btn-block" type="submit">Add shift</button></div></form></div>' +

    '<div class="card"><h3>💸 Log an expense</h3>' +
    '<form id="expForm"><div class="row"><div><label class="f-label">Amount ($)</label><input type="number" id="exAmt" min="0.01" step="0.01" required /></div>' +
    '<div><label class="f-label">Category</label><select id="exCat">' +
    EXP_CATS.map((c) => "<option>" + c + "</option>").join("") +
    '</select></div>' +
    '<div><label class="f-label">Date</label><input type="date" id="exDate" value="' + today + '" required /></div></div>' +
    '<label class="f-label">Note (optional)</label><input id="exNote" placeholder="Gas fill-up, new spatulas…" />' +
    '<div style="margin-top:14px"><button class="btn btn-primary btn-block" type="submit">Add expense</button></div></form></div>' +

    '<div class="section"><h3>Expense history</h3><div class="shift-list">' +
    (expenses.length
      ? expenses
          .map(
            (e) =>
              '<div class="shift"><span>💸 ' + esc(e.cat) + (e.note ? " · " + esc(e.note) : "") + " · " + esc(e.date) + '</span><span><b style="color:var(--red)">' +
              money(e.amount) +
              '</b> <button class="del" data-expdel="' + e.id + '" aria-label="Delete">×</button></span></div>'
          )
          .join("")
      : "<p>No expenses yet. Log gas, supplies, whatever the hustle costs you.</p>") +
    "</div></div>" +

    '<div class="section"><h3>Shift history</h3><div class="shift-list">' +
    (shifts.length
      ? shifts
          .map((s) => {
            const g = GIGS.find((x) => x.id === s.gigId);
            return (
              '<div class="shift"><span>' + (g ? g.icon + " " + esc(g.name) : "?") + " · " + esc(s.date) + " · " + s.hours + "h" +
              (s.sample ? '<span class="sample-tag">sample</span>' : "") +
              '</span><span><b>' + money(s.earnings) + '</b> <button class="del" data-del="' + s.id + '" aria-label="Delete">×</button></span></div>'
            );
          })
          .join("")
      : "<p>No shifts yet. Log your first one above!</p>") +
    "</div></div>";

  return html;
}

function HM_trackerInit() {
  drawCharts();
  renderBreakdown();

  document.getElementById("goalSave").onclick = () => {
    const v = Math.max(0, +document.getElementById("goalInput").value || 0);
    store.set("goal", v);
    toast("Goal updated to " + money(v));
    route();
  };
  document.getElementById("shiftForm").onsubmit = (e) => {
    e.preventDefault();
    const shifts = getShifts();
    shifts.push({
      id: uid(),
      gigId: document.getElementById("sfGig").value,
      date: document.getElementById("sfDate").value,
      hours: +document.getElementById("sfHours").value,
      earnings: +document.getElementById("sfEarn").value,
    });
    saveShifts(shifts);
    toast("Shift logged 💪");
    route();
  };
  document.querySelectorAll("[data-del]").forEach((b) => {
    b.onclick = () => {
      saveShifts(getShifts().filter((s) => s.id !== b.dataset.del));
      toast("Shift deleted");
      route();
    };
  });
  document.getElementById("taxSave").onclick = () => {
    const v = Math.min(60, Math.max(0, +document.getElementById("taxInput").value || 0));
    store.set("taxrate", v);
    toast("Tax set-aside: " + v + "% 🧾");
    route();
  };
  document.getElementById("expForm").onsubmit = (e) => {
    e.preventDefault();
    const ex = getExpenses();
    ex.push({
      id: uid(),
      amount: +document.getElementById("exAmt").value,
      cat: document.getElementById("exCat").value,
      date: document.getElementById("exDate").value,
      note: document.getElementById("exNote").value.trim(),
    });
    saveExpenses(ex);
    toast("Expense logged 💸");
    route();
  };
  document.querySelectorAll("[data-expdel]").forEach((b) => {
    b.onclick = () => {
      saveExpenses(getExpenses().filter((e) => e.id !== b.dataset.expdel));
      toast("Expense deleted");
      route();
    };
  });
}
window.HM_trackerInit = HM_trackerInit;

/* ---------- breakdown ---------- */
function renderBreakdown() {
  const el = document.getElementById("breakdown");
  if (!el) return;
  const shifts = getShifts();
  const byGig = {};
  shifts.forEach((s) => {
    byGig[s.gigId] = byGig[s.gigId] || { earn: 0, hours: 0 };
    byGig[s.gigId].earn += s.earnings;
    byGig[s.gigId].hours += s.hours;
  });
  const rows = Object.keys(byGig)
    .map((id) => ({ gig: GIGS.find((g) => g.id === id), ...byGig[id] }))
    .filter((r) => r.gig)
    .sort((a, b) => b.earn - a.earn);
  const max = rows.length ? rows[0].earn : 1;
  el.innerHTML = rows.length
    ? rows
        .map(
          (r) =>
            '<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:4px"><span>' +
            r.gig.icon + " " + esc(r.gig.name) + ' <span style="color:var(--muted)">' + r.hours + 'h</span></span><b style="color:var(--green)">' +
            money(r.earn) +
            '</b></div><div class="progress"><i style="width:' + Math.round((r.earn / max) * 100) + '%;background:var(--green)"></i></div></div>'
        )
        .join("")
    : "<p>No data yet.</p>";
}

/* ---------- charts ---------- */
function mondayOf(d) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
function drawCharts() {
  const shifts = getShifts();
  const goal = getGoal();
  drawBar(
    document.getElementById("chWeeks"),
    weekBuckets(shifts),
    goal / 4.33,
    (b) => b.label
  );
  drawBar(
    document.getElementById("chMonths"),
    monthBuckets(shifts),
    goal,
    (b) => b.label
  );
}
function weekBuckets(shifts) {
  const out = [];
  const start = mondayOf(new Date());
  start.setDate(start.getDate() - 7 * 7);
  for (let i = 0; i < 8; i++) {
    const ws = new Date(start);
    ws.setDate(ws.getDate() + i * 7);
    const we = new Date(ws);
    we.setDate(we.getDate() + 7);
    const total = shifts
      .filter((s) => {
        const d = new Date(s.date + "T12:00:00");
        return d >= ws && d < we;
      })
      .reduce((t, s) => t + s.earnings, 0);
    out.push({ label: ws.getMonth() + 1 + "/" + ws.getDate(), value: total });
  }
  return out;
}
function monthBuckets(shifts) {
  const out = [];
  const now = new Date();
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toISOString().slice(0, 7);
    const total = shifts.filter((s) => s.date.slice(0, 7) === key).reduce((t, s) => t + s.earnings, 0);
    out.push({ label: names[d.getMonth()], value: total });
  }
  return out;
}
function drawBar(canvas, buckets, goalLine, labelFn) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 600;
  const H = 220;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const padL = 44, padB = 26, padT = 14;
  const cw = W - padL - 12, ch = H - padB - padT;
  const maxV = Math.max(goalLine * 1.15, ...buckets.map((b) => b.value), 10);
  const y = (v) => padT + ch - (v / maxV) * ch;
  const bw = cw / buckets.length;

  // gridlines
  ctx.strokeStyle = "#2a2a36";
  ctx.fillStyle = "#a7a3b5";
  ctx.font = "11px sans-serif";
  ctx.lineWidth = 1;
  for (let g = 0; g <= 4; g++) {
    const v = (maxV / 4) * g;
    ctx.beginPath();
    ctx.moveTo(padL, y(v));
    ctx.lineTo(W - 12, y(v));
    ctx.stroke();
    ctx.fillText("$" + Math.round(v), 4, y(v) + 4);
  }
  // bars
  buckets.forEach((b, i) => {
    const x = padL + i * bw + bw * 0.18;
    const w = bw * 0.64;
    const grad = ctx.createLinearGradient(0, y(b.value), 0, y(0));
    grad.addColorStop(0, "#e63946");
    grad.addColorStop(1, "#7a1620");
    ctx.fillStyle = grad;
    const hh = Math.max(2, y(0) - y(b.value));
    ctx.beginPath();
    ctx.roundRect(x, y(b.value), w, hh, 4);
    ctx.fill();
    ctx.fillStyle = "#a7a3b5";
    ctx.textAlign = "center";
    ctx.fillText(labelFn(b), x + w / 2, H - 8);
    ctx.textAlign = "left";
  });
  // goal line
  if (goalLine > 0) {
    ctx.strokeStyle = "#3ddc84";
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padL, y(goalLine));
    ctx.lineTo(W - 12, y(goalLine));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#3ddc84";
    ctx.fillText("goal $" + Math.round(goalLine), padL + 4, y(goalLine) - 6);
  }
}
