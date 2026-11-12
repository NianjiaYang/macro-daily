// Macro Daily — interactive brief viewer
// Data: data/glossary.json, data/briefs/index.json, data/briefs/<date>.json, data/indicators.json,
//       data/quizzes/index.json, data/quizzes/<week-ending date>.json
// Optional, local only: me/profile.json, me/progress.json (written by the learner's AI tutor)
// Inline term markup in text: {{term-id|display text}}, **bold**, *italic*

const LEARNED_KEY = "mra.learned";
const WEEKLY_KEY = "mra.weekly";
const TIER_LABELS = ["Definition", "Why it matters", "Full reasoning"];

const state = {
  glossary: {},
  briefs: [],
  brief: null,
  learned: new Set(loadLearned()),
  tab: "brief",
  glFilter: "All",
  glQuery: "",
  pop: { id: null, tier: 0, anchor: null },
  quiz: {},
  indicators: null,
  weekly: { list: [], quiz: null, answers: {}, scores: loadWeeklyScores() },
  me: { profile: null, progress: null },
};

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

function loadLearned() {
  try { return JSON.parse(localStorage.getItem(LEARNED_KEY)) || []; } catch { return []; }
}
function saveLearned() {
  try { localStorage.setItem(LEARNED_KEY, JSON.stringify([...state.learned])); } catch {}
}

function loadWeeklyScores() {
  try { return JSON.parse(localStorage.getItem(WEEKLY_KEY)) || {}; } catch { return {}; }
}
function saveWeeklyScores() {
  try { localStorage.setItem(WEEKLY_KEY, JSON.stringify(state.weekly.scores)); } catch {}
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function rich(text) {
  return esc(text)
    .replace(/\{\{([a-z0-9-]+)\|([^}]+)\}\}/g, (_, id, label) => {
      if (!state.glossary[id]) return label;
      const cls = state.learned.has(id) ? "term learned" : "term";
      return `<button type="button" class="${cls}" data-term="${id}">${label}</button>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function termIdsIn(obj) {
  const ids = new Set();
  JSON.stringify(obj).replace(/\{\{([a-z0-9-]+)\|/g, (_, id) => ids.add(id));
  return [...ids].filter((id) => state.glossary[id]);
}

async function getJSON(path) {
  const r = await fetch(path, { cache: "no-store" });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

function fmtDate(iso, opts = { weekday: "long", month: "long", day: "numeric", year: "numeric" }) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", opts);
}

/* ---------- Brief ---------- */
function renderBrief() {
  const b = state.brief;
  const ids = termIdsIn(b);
  const learnedHere = ids.filter((id) => state.learned.has(id)).length;
  const pct = ids.length ? Math.round((learnedHere / ids.length) * 100) : 0;

  $("#tab-brief").innerHTML = `
    <div class="eyebrow">${esc(fmtDate(b.date))}</div>
    <h1 class="brief-title">${esc(b.title)}</h1>
    <p class="one-liner">${rich(b.oneLiner)}</p>
    ${(b.corrections || []).map((c) => `<p class="correction"><strong>Corrected ${esc(fmtDate(c.date, { month: "short", day: "numeric", year: "numeric" }))}:</strong> ${rich(c.text)}</p>`).join("")}
    <div class="progress">
      <div class="progress-bar"><span style="width:${pct}%"></span></div>
      <span>${learnedHere} of ${ids.length} key terms learned</span>
      <span class="hint">· click any <span style="color:var(--accent);border-bottom:1.5px dotted var(--accent)">underlined term</span></span>
    </div>

    <div class="scoreboard">
      ${b.scoreboard.map((t) => `
        <${t.term ? `button type="button" data-term="${t.term}"` : "div"} class="tile ${t.dir}${t.term ? " clickable" : ""}">
          <div class="tile-label"><span>${esc(t.label)}</span>${t.term ? '<span class="info">ⓘ</span>' : ""}</div>
          <div class="tile-value">${esc(t.value)}</div>
          <div class="tile-note">${esc(t.note || "")}</div>
        </${t.term ? "button" : "div"}>`).join("")}
    </div>

    ${b.sections.map((s) => `
      <article class="section">
        <div class="eyebrow">${esc(s.kicker)}</div>
        <h2>${esc(s.title)}</h2>
        ${s.paragraphs.map((p) => `<p>${rich(p)}</p>`).join("")}
      </article>`).join("")}

    ${b.connections ? `
    <article class="section">
      <div class="eyebrow">Cross-asset</div>
      <h2>How it all connects</h2>
      <p>${rich(b.connections.intro)}</p>
      <div class="conn-list">
        ${b.connections.items.map((c) => `
          <div class="conn${c.puzzle ? " puzzle" : ""}">
            <div class="conn-head">
              <span class="conn-flow"><span>${rich(c.driver)}</span><span class="arrow" aria-hidden="true">→</span><strong>${rich(c.asset)}</strong></span>
              <span class="conn-tag">${c.puzzle ? "Puzzle" : "As expected"}</span>
            </div>
            <dl>
              <div><dt>Textbook says</dt><dd>${rich(c.expected)}</dd></div>
              <div><dt>What happened</dt><dd>${rich(c.actual)}</dd></div>
              <div class="conn-why"><dt>Why</dt><dd>${rich(c.why)}</dd></div>
            </dl>
          </div>`).join("")}
      </div>
    </article>` : ""}

    <div class="watch">
      <div class="eyebrow">What to watch · ${esc(b.watch.when)}</div>
      <h2 class="section" style="margin:4px 0 8px;font-family:var(--serif);font-size:22px">${esc(b.watch.title)}</h2>
      <p style="margin:0">${rich(b.watch.text)}</p>
    </div>

    <article class="section">
      <div class="eyebrow">Also moving</div>
      <h2>Other headlines</h2>
      <ul class="headlines">${b.headlines.map((h) => `<li>${rich(h)}</li>`).join("")}</ul>
    </article>

    <div class="sources">
      <strong>Sources</strong>
      <ul>${b.sources.map((s) => `<li>${esc(s.name)}: <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></li>`).join("")}</ul>
    </div>`;
}

/* ---------- Dashboard ---------- */
function fmtVal(s, v) { return v.toFixed(s.decimals) + s.unit; }

function fmtChange(s) {
  if (s.change === null || s.change === undefined) return "";
  const c = s.changeUnit === "bp" ? Math.round(s.change * 100) : +s.change.toFixed(s.decimals);
  if (c === 0) return `unchanged over ${s.changeOver}`;
  const unit = s.changeUnit === "bp" ? " bp" : " pt";
  return `${c > 0 ? "+" : "−"}${Math.abs(c)}${unit} over ${s.changeOver}`;
}

function sparkline(s) {
  const h = s.history, W = 300, H = 72, pad = 6;
  const vals = h.map((p) => p[1]);
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const x = (i) => pad + (i / (h.length - 1)) * (W - 2 * pad);
  const y = (v) => H - pad - ((v - min) / span) * (H - 2 * pad);
  const pts = h.map((p, i) => `${x(i).toFixed(1)},${y(p[1]).toFixed(1)}`).join(" ");
  const label = `${s.label}, past year: low ${fmtVal(s, min)}, high ${fmtVal(s, max)}, latest ${fmtVal(s, s.value)}`;
  return `
    <svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(label)}">
      <polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    </svg>
    <div class="spark-range"><span>${esc(fmtDate(h[0][0], s.monthly ? { month: "short", year: "numeric" } : { month: "short", day: "numeric", year: "numeric" }))}</span>
      <span>1-yr range ${fmtVal(s, min)} – ${fmtVal(s, max)}</span></div>`;
}

function renderDashboard() {
  const d = state.indicators;
  if (!d) {
    $("#tab-dashboard").innerHTML = `<div class="empty">No indicator data yet. Run <code>python3 scripts/fetch_indicators.py</code>.</div>`;
    return;
  }
  $("#tab-dashboard").innerHTML = `
    <div class="eyebrow">Dashboard · official data</div>
    <h1 class="brief-title">Where the key rates stand</h1>
    <p class="one-liner">Latest official readings and the past year, pulled from the agencies that publish them. News figures in the brief can differ slightly because they are often quoted during the trading day.</p>
    <div class="dash-grid">
      ${d.series.map((s) => `
        <article class="dash-card">
          <div class="dash-head">
            <h3>${esc(s.label)}</h3>
            ${s.term && state.glossary[s.term] ? `<button type="button" class="term" data-term="${s.term}">What is this?</button>` : ""}
          </div>
          <div class="dash-value">${fmtVal(s, s.value)}</div>
          <div class="dash-meta">${esc(fmtChange(s))} · as of ${esc(fmtDate(s.asOf, s.monthly ? { month: "long", year: "numeric" } : { month: "short", day: "numeric", year: "numeric" }))}${s.stale ? ' · <span class="stale">not updated today</span>' : ""}</div>
          ${sparkline(s)}
          <p class="dash-about">${esc(s.about)}${s.note ? " " + esc(s.note) + "." : ""}</p>
          <div class="dash-src">Source: <a href="${esc(s.sourceUrl)}" target="_blank" rel="noopener">${esc(s.source)}</a></div>
        </article>`).join("")}
    </div>
    <div class="sources">Data last pulled ${esc(new Date(d.updated).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }))}.</div>`;
}

/* ---------- Glossary ---------- */
function renderGlossary() {
  const all = Object.entries(state.glossary);
  const cats = ["All", ...new Set(all.map(([, t]) => t.category))];
  const q = state.glQuery.toLowerCase();
  const list = all
    .filter(([, t]) => state.glFilter === "All" || t.category === state.glFilter)
    .filter(([, t]) => !q || (t.term + " " + t.definition).toLowerCase().includes(q))
    .sort((a, b) => a[1].term.localeCompare(b[1].term));
  const learned = all.filter(([id]) => state.learned.has(id)).length;

  $("#tab-glossary").innerHTML = `
    <div class="eyebrow">Your glossary</div>
    <h1 class="brief-title">${all.length} terms · ${learned} learned</h1>
    <div class="gl-tools">
      <input class="gl-search" type="search" placeholder="Search terms…" value="${esc(state.glQuery)}" aria-label="Search glossary">
    </div>
    <div class="filter-chips">
      ${cats.map((c) => `<button type="button" class="chip" data-cat="${esc(c)}" aria-pressed="${c === state.glFilter}">${esc(c)}</button>`).join("")}
    </div>
    <div class="gl-list">
      ${list.length ? list.map(([id, t]) => `
        <button type="button" class="gl-card${state.learned.has(id) ? " learned" : ""}" data-term="${id}">
          <div class="gl-card-head"><h3>${esc(t.term)}</h3><span class="meta">${esc(t.category)} · first seen ${esc(fmtDate(t.firstSeen, { month: "short", day: "numeric" }))}</span></div>
          <p>${esc(stripMarkup(t.definition))}</p>
        </button>`).join("") : `<div class="empty">No terms match.</div>`}
    </div>`;

  const input = $(".gl-search");
  input.addEventListener("input", (e) => {
    state.glQuery = e.target.value;
    const pos = e.target.selectionStart;
    renderGlossary();
    const again = $(".gl-search");
    again.focus();
    again.setSelectionRange(pos, pos);
  });
}

const stripMarkup = (s) => s.replace(/\{\{[a-z0-9-]+\|([^}]+)\}\}/g, "$1");

/* ---------- Quiz ---------- */
function renderQuiz() {
  const qs = state.brief.quiz || [];
  const answers = state.quiz;
  const done = Object.keys(answers).length;
  const correct = qs.filter((q, i) => answers[i] === q.answer).length;

  $("#tab-quiz").innerHTML = `
    <div class="eyebrow">Quick check · ${esc(fmtDate(state.brief.date, { month: "long", day: "numeric" }))}</div>
    <h1 class="brief-title">Did today's brief stick?</h1>
    <p class="one-liner">${qs.length} questions on today's market moves. Click the underlined terms in explanations to review.</p>
    ${qs.map((q, i) => {
      const a = answers[i];
      const answered = a !== undefined;
      return `
      <div class="quiz-q">
        <span class="num">Question ${i + 1} of ${qs.length}</span>
        <h3>${esc(q.q)}</h3>
        ${q.options.map((o, j) => {
          let cls = "opt";
          if (answered && j === q.answer) cls += " correct";
          else if (answered && j === a) cls += " wrong";
          return `<button type="button" class="${cls}" data-q="${i}" data-o="${j}" ${answered ? "disabled" : ""}>${esc(o)}</button>`;
        }).join("")}
        ${answered ? `<div class="explain">${a === q.answer ? "✓ Correct. " : "✗ Not quite. "}${rich(q.explain)}</div>` : ""}
      </div>`;
    }).join("")}
    ${done === qs.length && qs.length ? `
      <div class="score"><div><strong>${correct} / ${qs.length}</strong> correct</div>
      <button type="button" class="btn-ghost" id="quizReset">Try again</button></div>` : ""}`;
}

/* ---------- Weekly quiz ---------- */
const KIND_LABELS = { term: "Term", connect: "Connecting the week" };

async function loadWeekly(week) {
  state.weekly.quiz = await getJSON(`data/quizzes/${week}.json`);
  state.weekly.answers = {};
  renderWeekly();
}

function renderWeekly() {
  const w = state.weekly;
  const el = $("#tab-weekly");
  if (!w.list.length) {
    el.innerHTML = `
      <div class="eyebrow">Weekly quiz</div>
      <h1 class="brief-title">The first weekly quiz arrives Friday</h1>
      <p class="one-liner">Each Friday, 8 new questions cover the week: 4 on terms first seen that week and 4 that connect events across days.</p>`;
    return;
  }
  if (!w.quiz) { el.innerHTML = `<div class="empty">Loading…</div>`; return; }
  const qs = w.quiz.questions;
  const a = w.answers;
  const done = Object.keys(a).length;
  const correct = qs.filter((q, i) => a[i] === q.answer).length;
  if (done === qs.length && qs.length) {
    const prev = w.scores[w.quiz.week];
    w.scores[w.quiz.week] = { correct, total: qs.length, best: Math.max(correct, prev?.best ?? 0) };
    saveWeeklyScores();
  }
  const saved = w.scores[w.quiz.week];

  el.innerHTML = `
    <div class="eyebrow">Weekly quiz · ${esc(w.quiz.range)}</div>
    <h1 class="brief-title">${esc(w.quiz.title)}</h1>
    <p class="one-liner">${qs.length} questions on the week's terms and how its events connect.${saved ? ` Your best score: ${saved.best} of ${saved.total}.` : ""}</p>
    ${w.list.length > 1 ? `
    <div class="filter-chips">
      ${w.list.map((x) => {
        const sc = w.scores[x.week];
        return `<button type="button" class="chip" data-week="${esc(x.week)}" aria-pressed="${x.week === w.quiz.week}">Week ending ${esc(fmtDate(x.week, { month: "short", day: "numeric" }))}${sc ? ` · ${sc.best}/${sc.total}` : ""}</button>`;
      }).join("")}
    </div>` : ""}
    ${qs.map((q, i) => {
      const ans = a[i];
      const answered = ans !== undefined;
      return `
      <div class="quiz-q">
        <span class="num">Question ${i + 1} of ${qs.length} · ${esc(KIND_LABELS[q.kind] || "Question")}</span>
        <h3>${esc(q.q)}</h3>
        ${q.options.map((o, j) => {
          let cls = "opt";
          if (answered && j === q.answer) cls += " correct";
          else if (answered && j === ans) cls += " wrong";
          return `<button type="button" class="${cls}" data-wq="${i}" data-o="${j}" ${answered ? "disabled" : ""}>${esc(o)}</button>`;
        }).join("")}
        ${answered ? `<div class="explain">${ans === q.answer ? "✓ Correct. " : "✗ Not quite. "}${rich(q.explain)}${(q.days || []).length ? ` <span class="from-days">From ${q.days.map((d) => esc(fmtDate(d, { weekday: "short", month: "short", day: "numeric" }))).join(", ")}.</span>` : ""}</div>` : ""}
      </div>`;
    }).join("")}
    ${done === qs.length && qs.length ? `
      <div class="score"><div><strong>${correct} / ${qs.length}</strong> correct</div>
      <button type="button" class="btn-ghost" id="weeklyReset">Try again</button></div>` : ""}`;
}

/* ---------- My progress ---------- */
const STATUS = [
  { key: "mastered", label: "Mastered" },
  { key: "learned", label: "Learned" },
  { key: "review", label: "Needs review" },
  { key: "seen", label: "Seen" },
];
const AREA_LABELS = { equities: "Equities", rates: "Rates", credit: "Credit", macro: "Macro and the Fed", fx: "FX", commodities: "Commodities" };
const LEVEL_LABELS = { new: "New to markets", student: "Student", working: "Working in finance" };

function termStatus(id) {
  const p = state.me.progress;
  if (p) return p.terms?.[id]?.status || null;
  return state.learned.has(id) ? "learned" : null;
}

function renderProgress() {
  const p = state.me.progress, prof = state.me.profile;
  const personal = !!p;
  const all = Object.entries(state.glossary);
  const counts = { mastered: 0, learned: 0, review: 0, seen: 0 };
  const cats = {};
  all.forEach(([id, t]) => {
    const st = termStatus(id);
    const c = (cats[t.category] ||= { total: 0, mastered: 0, learned: 0, review: 0, seen: 0 });
    c.total++;
    if (st && st in counts) { counts[st]++; c[st]++; }
  });
  const known = counts.mastered + counts.learned;

  // Quiz results: from the tutor's file when present, otherwise this browser's weekly scores.
  const quizRows = [];
  if (personal) {
    Object.entries(p.briefs || {}).forEach(([d, b]) => { if (b.quickCheck) quizRows.push({ date: d, label: "Quick check", ...b.quickCheck }); });
    Object.entries(p.weekly || {}).forEach(([d, w]) => quizRows.push({ date: d, label: "Weekly quiz", correct: w.correct, total: w.total }));
  } else {
    Object.entries(state.weekly.scores).forEach(([d, w]) => quizRows.push({ date: d, label: "Weekly quiz", correct: w.best, total: w.total }));
  }
  quizRows.sort((a, b) => b.date.localeCompare(a.date));
  const qc = quizRows.reduce((n, r) => n + r.correct, 0), qt = quizRows.reduce((n, r) => n + r.total, 0);
  const briefsRead = personal ? Object.values(p.briefs || {}).filter((b) => b.read).length : null;
  const review = all.filter(([id]) => termStatus(id) === "review");
  const stat = (v, l) => `<div class="tile"><div class="tile-label"><span>${esc(l)}</span></div><div class="tile-value">${esc(v)}</div></div>`;

  $("#tab-progress").innerHTML = `
    <div class="eyebrow">My progress${personal ? "" : " · this browser"}</div>
    <h1 class="brief-title">${prof?.nickname ? esc(prof.nickname) + "’s progress" : "Your progress"}</h1>
    ${prof ? `
    <div class="prof">
      ${prof.level ? `<span class="chip static">${esc(LEVEL_LABELS[prof.level] || prof.level)}</span>` : ""}
      ${(prof.focusAreas || []).map((a) => `<span class="chip static${a === prof.primaryArea ? " primary" : ""}">${esc(AREA_LABELS[a] || a)}${a === prof.primaryArea ? " · main focus" : ""}</span>`).join("")}
      ${prof.goal ? `<p class="prof-goal">Goal: ${esc(prof.goal)}</p>` : ""}
    </div>` : ""}

    <div class="scoreboard">
      ${stat(`${known} of ${all.length}`, "Terms learned")}
      ${stat(qt ? Math.round((qc / qt) * 100) + "%" : "–", "Quiz accuracy")}
      ${briefsRead !== null ? stat(String(briefsRead), "Briefs read") : ""}
      ${stat(String(counts.review), "Needs review")}
    </div>

    <article class="section">
      <div class="eyebrow">Progress map</div>
      <h2>By topic</h2>
      <div class="legend">${STATUS.filter((s) => personal || s.key === "learned").map((s) => `<span><i class="sw ${s.key}"></i>${s.label}</span>`).join("")}<span><i class="sw none"></i>Not yet</span></div>
      <div class="map">
        ${Object.entries(cats).sort((a, b) => a[0].localeCompare(b[0])).map(([name, c]) => `
          <div class="map-row">
            <div class="map-name">${esc(name)}</div>
            <div class="map-bar" role="img" aria-label="${esc(name)}: ${c.mastered + c.learned} of ${c.total} learned${c.review ? ", " + c.review + " need review" : ""}">
              ${STATUS.map((s) => c[s.key] ? `<span class="seg ${s.key}" style="flex:${c[s.key]}"></span>` : "").join("")}
              ${c.total - c.mastered - c.learned - c.review - c.seen ? `<span class="seg none" style="flex:${c.total - c.mastered - c.learned - c.review - c.seen}"></span>` : ""}
            </div>
            <div class="map-num">${c.mastered + c.learned}/${c.total}</div>
          </div>`).join("")}
      </div>
    </article>

    ${review.length ? `
    <article class="section">
      <div class="eyebrow">Review next</div>
      <h2>Terms to revisit</h2>
      <div class="review-list">${review.map(([id, t]) => `<button type="button" class="chip" data-term="${id}">${esc(t.term)}</button>`).join("")}</div>
    </article>` : ""}

    ${quizRows.length ? `
    <article class="section">
      <div class="eyebrow">Quizzes</div>
      <h2>Results</h2>
      <div class="quiz-hist">${quizRows.map((r) => `<div class="qh-row"><span>${esc(fmtDate(r.date, { weekday: "short", month: "short", day: "numeric" }))}</span><span>${esc(r.label)}</span><strong>${r.correct} / ${r.total}</strong></div>`).join("")}</div>
    </article>` : ""}

    ${personal ? `<div class="sources">Recorded by your AI tutor in the <code>me/</code> folder on this computer. It is not uploaded anywhere.</div>` : `
    <div class="watch">
      <div class="eyebrow">Want a personal tutor?</div>
      <p style="margin:6px 0 0">This page shows what is saved in this browser: terms you ticked “I’ve got this” and your weekly quiz scores. To get onboarding, daily coaching and a full progress map, load the project into your own AI assistant. <a href="https://github.com/NianjiaYang/macro-daily#learn-with-your-own-ai-tutor" target="_blank" rel="noopener">See how</a>.</p>
    </div>`}`;
}

/* ---------- Popover ---------- */
function openTerm(id, anchor, tier = 0) {
  const t = state.glossary[id];
  if (!t) return;
  $$(".term.active").forEach((el) => el.classList.remove("active"));
  if (anchor && anchor.classList.contains("term")) anchor.classList.add("active");
  state.pop = { id, tier, anchor: anchor || state.pop.anchor };
  renderPop();
  $("#pop").hidden = false;
  positionPop();
  $("#popClose").focus({ preventScroll: true });
}

function renderPop() {
  const { id, tier } = state.pop;
  const t = state.glossary[id];
  $("#popCat").textContent = t.category;
  $("#popTitle").textContent = t.term;
  $$(".tier-tabs button").forEach((b) => b.setAttribute("aria-selected", String(+b.dataset.tier === tier)));
  const body =
    tier === 0 ? `<p>${rich(t.definition)}</p>` :
    tier === 1 ? `<p>${rich(t.why)}</p>` :
    `<ol class="chain">${t.chain.map((s) => `<li>${rich(s)}</li>`).join("")}</ol>`;
  $("#popBody").innerHTML = body;
  $("#popBody").scrollTop = 0;
  const rel = (t.related || []).filter((r) => state.glossary[r]);
  $("#popRelated").innerHTML = rel.length
    ? `<span class="label">Related:</span>` + rel.map((r) => `<button type="button" class="chip" data-related="${r}">${esc(state.glossary[r].term)}</button>`).join("")
    : "";
  $("#popLearned").checked = state.learned.has(id);
  const deeper = $("#popDeeper");
  deeper.disabled = tier >= 2;
  deeper.textContent = tier >= 2 ? "Deepest level" : `Go deeper: ${TIER_LABELS[tier + 1]} →`;
}

function positionPop() {
  const pop = $("#pop");
  const mobile = window.innerWidth <= 640;
  pop.classList.toggle("sheet", mobile);
  $("#scrim").hidden = !mobile;
  if (mobile) { pop.style.left = ""; pop.style.top = ""; return; }
  const a = state.pop.anchor;
  const r = a && document.body.contains(a) ? a.getBoundingClientRect() : { left: innerWidth / 2 - 210, bottom: 120, top: 120, width: 0 };
  const pw = pop.offsetWidth, ph = pop.offsetHeight, gap = 8, m = 16;
  let left = Math.min(Math.max(m, r.left + r.width / 2 - pw / 2), innerWidth - pw - m);
  let top = r.bottom + gap;
  if (top + ph > innerHeight - m) top = r.top - ph - gap >= m ? r.top - ph - gap : Math.max(m, innerHeight - ph - m);
  pop.style.left = left + "px";
  pop.style.top = top + "px";
}

function closePop() {
  $("#pop").hidden = true;
  $("#scrim").hidden = true;
  $$(".term.active").forEach((el) => el.classList.remove("active"));
  const a = state.pop.anchor;
  state.pop = { id: null, tier: 0, anchor: null };
  if (a && document.body.contains(a)) a.focus({ preventScroll: true });
}

function refreshLearnedViews() {
  $$("[data-term].term").forEach((el) => el.classList.toggle("learned", state.learned.has(el.dataset.term)));
  updateGlossaryCount();
  if (state.tab === "brief") {
    // re-render just the progress line
    const ids = termIdsIn(state.brief);
    const n = ids.filter((id) => state.learned.has(id)).length;
    const bar = $("#tab-brief .progress-bar > span");
    if (bar) {
      bar.style.width = (ids.length ? Math.round((n / ids.length) * 100) : 0) + "%";
      bar.parentElement.nextElementSibling.textContent = `${n} of ${ids.length} key terms learned`;
    }
  } else if (state.tab === "progress") {
    const anchorId = state.pop.anchor?.dataset?.term;
    renderProgress();
    if (anchorId) state.pop.anchor = $(`#tab-progress [data-term="${anchorId}"]`);
  } else if (state.tab === "glossary") {
    const anchorId = state.pop.anchor?.dataset?.term;
    renderGlossary();
    if (anchorId) state.pop.anchor = $(`.gl-card[data-term="${anchorId}"]`);
  }
}

function updateGlossaryCount() {
  $("#glossaryCount").textContent = Object.keys(state.glossary).length;
}

/* ---------- Tabs & events ---------- */
function setTab(tab) {
  state.tab = tab;
  closePop();
  $$(".tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
  $$(".tab-panel").forEach((p) => (p.hidden = p.id !== "tab-" + tab));
  if (tab === "brief") renderBrief();
  if (tab === "dashboard") renderDashboard();
  if (tab === "glossary") renderGlossary();
  if (tab === "quiz") renderQuiz();
  if (tab === "weekly") renderWeekly();
  if (tab === "progress") renderProgress();
  try { history.replaceState(null, "", `#${tab}`); } catch {}
  window.scrollTo(0, 0);
}

document.addEventListener("click", (e) => {
  const termEl = e.target.closest("[data-term]");
  const pop = $("#pop");

  if (e.target.closest("#popClose") || e.target.id === "scrim") return closePop();

  const tierBtn = e.target.closest(".tier-tabs button");
  if (tierBtn) { state.pop.tier = +tierBtn.dataset.tier; renderPop(); positionPop(); return; }

  if (e.target.closest("#popDeeper")) { state.pop.tier = Math.min(2, state.pop.tier + 1); renderPop(); positionPop(); return; }

  const rel = e.target.closest("[data-related]");
  if (rel) { openTerm(rel.dataset.related, state.pop.anchor, 0); return; }

  if (termEl) {
    // A term inside the popover swaps content, keeping the original anchor.
    if (pop.contains(termEl)) { openTerm(termEl.dataset.term, state.pop.anchor, 0); return; }
    if (state.pop.id === termEl.dataset.term && !pop.hidden && state.pop.anchor === termEl) return closePop();
    openTerm(termEl.dataset.term, termEl, 0);
    return;
  }

  const tab = e.target.closest(".tabs button");
  if (tab) return setTab(tab.dataset.tab);

  const cat = e.target.closest("[data-cat]");
  if (cat) { state.glFilter = cat.dataset.cat; renderGlossary(); return; }

  const wk = e.target.closest("[data-week]");
  if (wk) { loadWeekly(wk.dataset.week); return; }

  const wopt = e.target.closest(".opt[data-wq]");
  if (wopt) { state.weekly.answers[+wopt.dataset.wq] = +wopt.dataset.o; renderWeekly(); return; }

  if (e.target.closest("#weeklyReset")) { state.weekly.answers = {}; renderWeekly(); window.scrollTo(0, 0); return; }

  const opt = e.target.closest(".opt");
  if (opt) { state.quiz[+opt.dataset.q] = +opt.dataset.o; renderQuiz(); return; }

  if (e.target.closest("#quizReset")) { state.quiz = {}; renderQuiz(); window.scrollTo(0, 0); return; }

  if (!pop.hidden && !pop.contains(e.target)) closePop();
});

$("#popLearned").addEventListener("change", (e) => {
  const id = state.pop.id;
  if (!id) return;
  e.target.checked ? state.learned.add(id) : state.learned.delete(id);
  saveLearned();
  refreshLearnedViews();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("#pop").hidden) closePop();
  if (!$("#pop").hidden && (e.key === "ArrowRight" || e.key === "ArrowLeft") && !e.target.closest("input, select")) {
    state.pop.tier = Math.max(0, Math.min(2, state.pop.tier + (e.key === "ArrowRight" ? 1 : -1)));
    renderPop(); positionPop();
  }
});
window.addEventListener("resize", () => { if (!$("#pop").hidden) positionPop(); });
window.addEventListener("scroll", () => { if (!$("#pop").hidden && window.innerWidth > 640) positionPop(); }, { passive: true });

// A specific day can be linked as ?date=YYYY-MM-DD. Without it the newest brief opens.
function setDateInUrl(date) {
  try {
    const newest = state.briefs[0]?.date;
    const query = date && date !== newest ? `?date=${date}` : "";
    history.replaceState(null, "", `${location.pathname}${query}#${state.tab}`);
  } catch {}
}

$("#dateSelect").addEventListener("change", async (e) => { await loadBrief(e.target.value); setDateInUrl(e.target.value); });

async function loadBrief(date) {
  state.brief = await getJSON(`data/briefs/${date}.json`);
  state.quiz = {};
  setTab(state.tab);
}

async function init() {
  try {
    const [g, idx] = await Promise.all([getJSON("data/glossary.json"), getJSON("data/briefs/index.json")]);
    state.glossary = g.terms;
    state.briefs = idx.briefs.sort((a, b) => b.date.localeCompare(a.date));
    $("#dateSelect").innerHTML = state.briefs.map((b) => `<option value="${b.date}">${esc(fmtDate(b.date, { month: "short", day: "numeric", year: "numeric" }))}</option>`).join("");
    updateGlossaryCount();
    state.indicators = await getJSON("data/indicators.json").catch(() => null);
    [state.me.profile, state.me.progress] = await Promise.all([getJSON("me/profile.json").catch(() => null), getJSON("me/progress.json").catch(() => null)]);
    const wk = await getJSON("data/quizzes/index.json").catch(() => ({ quizzes: [] }));
    state.weekly.list = wk.quizzes.sort((a, b) => b.week.localeCompare(a.week));
    if (state.weekly.list.length) state.weekly.quiz = await getJSON(`data/quizzes/${state.weekly.list[0].week}.json`).catch(() => null);
    const hashTab = location.hash.slice(1);
    if (["brief", "dashboard", "glossary", "quiz", "weekly", "progress"].includes(hashTab)) state.tab = hashTab;
    let wanted = null;
    try { wanted = new URLSearchParams(location.search).get("date"); } catch {}
    const start = state.briefs.some((b) => b.date === wanted) ? wanted : state.briefs[0].date;
    $("#dateSelect").value = start;
    await loadBrief(start);
  } catch (err) {
    $("#tab-brief").innerHTML = `<div class="empty">Couldn't load data (${esc(err.message)}). Serve this folder over HTTP, e.g. <code>python3 -m http.server 8000 --directory web</code>.</div>`;
  }
}

init();
