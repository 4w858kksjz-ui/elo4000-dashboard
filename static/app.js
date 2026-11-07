"use strict";
/* PROJECT ELO 4000 - Live Control Center. Vanilla JS, no framework, read-only. Every text from the server is inserted with textContent (no HTML string insertion): PGN headers cannot inject markup. */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const view = $("#view");
  const GLYPH = { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟" };       // filled glyphs for both colours; fill colour distinguishes the sides
  const S = { lastOk: 0, ver: null, sse: null, timer: null, game: null, ply: 0, flip: false, auto: null, live: false, route: null, archive: { q: "", result: "", kind: "", tc: "", offset: 0, items: [], total: 0 } };

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === false || v == null) continue;
      if (k === "class") el.className = v; else if (k.startsWith("on")) el.addEventListener(k.slice(2), v); else el.setAttribute(k, v === true ? "" : v);
    }
    for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
    return el;
  }
  const svgNS = "http://www.w3.org/2000/svg";
  function sv(tag, attrs, ...kids) {
    const el = document.createElementNS(svgNS, tag);
    for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
    for (const c of kids.flat(Infinity)) if (c != null) el.append(c.nodeType ? c : document.createTextNode(String(c)));
    return el;
  }
  const pill = (txt, cls) => h("span", { class: "pill " + (cls || "") }, txt);
  const kindPill = (l) => !l ? null : l.kind === "live" ? pill("LIVE", "live") : l.kind === "historical" ? pill("Historisch", "hist") : pill("Nicht verfügbar", "na");
  const fmtTime = (iso) => iso ? String(iso).replace("T", " ").slice(0, 16) : "–";
  const pct = (x) => x == null ? "–" : (x * 100).toFixed(1) + " %";
  const PROJECT_ELO = { ref: "c0", base: 2000 };                                                      // the project's OWN scale: the user chose the starting value for c0; every number is relative to it, never an absolute Elo
  const projElo = (c, ref) => (c && c.elo != null && ref === PROJECT_ELO.ref ? PROJECT_ELO.base + Math.round(c.elo) : null);
  const eloInt = (c) => c && c.elo != null ? `${c.elo > 0 ? "+" : c.elo < 0 ? "−" : ""}${Math.abs(Math.round(c.elo))} Elo` : "nicht bestimmbar";          // whole number of the RELATIVE Elo
  const eloTxt = (c) => c && c.elo != null ? `${c.elo > 0 ? "+" : ""}${c.elo} Elo [${c.lo ?? "−∞"}; ${c.hi ?? "+∞"}]` : "nicht bestimmbar";

  async function api(path, ms) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms || 15000);
    try {
      const r = await fetch(path, { signal: ctl.signal, cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      S.lastOk = Date.now();
      banner(null);
      return j;
    } catch (e) {
      banner(navigator.onLine === false ? "Kein Netz: die Anzeige zeigt den letzten Stand." : "Server nicht erreichbar oder zu langsam (" + (e.message || e) + "). Anzeige kann veraltet sein.", true);
      throw e;
    } finally { clearTimeout(t); }
  }
  function banner(msg, err) { const b = $("#banner"); if (!msg) { b.hidden = true; return; } b.hidden = false; b.className = "banner" + (err ? " err" : ""); b.textContent = msg; }
  function tickFresh() {
    const d = $("#fdot"), t = $("#ftext");
    if (window.HOSTED_MODE) { const a = window.HOSTED_AGE_S(); if (a == null) { t.textContent = "lädt…"; d.className = "dot"; return; }
      t.textContent = (a < 900 ? "Kopie · " : "PC offline · ") + new Date(Date.now() - a * 1000).toLocaleTimeString("de-DE"); d.className = "dot " + (a < 900 ? "ok" : a < 3600 ? "stale" : "err"); return; }
    if (!S.lastOk) { t.textContent = "lädt…"; d.className = "dot"; return; }
    const age = (Date.now() - S.lastOk) / 1000;
    t.textContent = (age < 90 ? "aktuell · " : "VERALTET · ") + new Date(S.lastOk).toLocaleTimeString("de-DE");
    d.className = "dot " + (age < 90 ? "ok" : age < 600 ? "stale" : "err");
  }
  setInterval(tickFresh, 5000);
  (function () {                                                                                           // header: the source word as a pill (dot inside), the time next to it (works for the live and the hosted text alike)
    const t = $("#ftext"), d = $("#fdot"); if (!t || !window.MutationObserver) return; let busy = false;
    new MutationObserver(() => { if (busy || t.querySelector(".fpill")) return; const m = /^(.*?) · ([0-9]{2}:[0-9]{2}:[0-9]{2})$/.exec(t.textContent); if (!m) return; busy = true; t.replaceChildren(h("span", { class: "fpill " + (d.className.split(" ")[1] || "") }, m[1]), m[2]); busy = false; }).observe(t, { childList: true, characterData: true, subtree: true });
  })();

  /* ---------------- board ---------------- */
  function parseFen(fen) {
    const rows = fen.split(" ")[0].split("/"), out = [];
    for (const r of rows) { const row = []; for (const ch of r) { if (/\d/.test(ch)) for (let i = 0; i < +ch; i++) row.push(null); else row.push(ch); } out.push(row); }
    return out;
  }
  function drawBoard(fen, last, flip, badge) {
    const b = parseFen(fen), svg = sv("svg", { class: "board", viewBox: "0 0 80 80", role: "img", "aria-label": "Schachbrett" });
    const sq = (f, r) => (flip ? { x: 7 - f, y: r } : { x: f, y: 7 - r });                            // file 0..7, rank 0..7 -> screen cell
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const p = sq(f, r), light = (f + r) % 2 === 1, name = "abcdefgh"[f] + (r + 1), hit = last && (last.from === name || last.to === name);
      svg.append(sv("rect", { x: p.x * 10, y: p.y * 10, width: 10, height: 10, fill: hit ? "#b8cf72" : light ? "#dfe5ef" : "#5a7cae" }));       // last move: the two squares in solid green-yellow
    }
    for (let rank = 0; rank < 8; rank++) for (let f = 0; f < 8; f++) {
      const ch = b[7 - rank][f]; if (!ch) continue;
      const white = ch === ch.toUpperCase(), p = sq(f, rank);
      svg.append(sv("text", { x: p.x * 10 + 5, y: p.y * 10 + 8, "font-size": 9, "text-anchor": "middle", fill: white ? "#fdfdfd" : "#141b2b", stroke: white ? "#18223a" : "#eef2f8", "stroke-width": 0.35, "paint-order": "stroke",
        "font-family": "'Segoe UI Symbol','Noto Sans Symbols 2','Apple Symbols','DejaVu Sans',serif" }, GLYPH[ch.toUpperCase()] + "︎"));       // pieces exactly as before; U+FE0E: force text (not emoji) presentation on iOS
    }
    if (badge && last) {                                                      // quality badge of the last move on its target square (top right corner)
      const f = "abcdefgh".indexOf(last.to[0]), r = +last.to[1] - 1, p = sq(f, r), cx = p.x * 10 + 8.4, cy = p.y * 10 + 1.7;
      svg.append(sv("circle", { cx, cy, r: 2.7, fill: badge.color, stroke: "#0b1322", "stroke-width": 0.5 }), sv("text", { x: cx, y: cy + 1.1, "font-size": badge.sym.length > 1 ? 2.6 : 3.4, "text-anchor": "middle", "font-weight": 700, fill: "#06140d" }, badge.sym));
    }
    return svg;
  }

  /* ---------------- move quality (from the engines' own evaluations in the PGN; not an independent analysis) ---------------- */
  const CATS = [["best", "★", "Bester Zug", "#2fd07a"], ["excellent", "!", "Hervorragend", "#7ed957"], ["good", "✓", "Guter Zug", "#a8bf4a"], ["inacc", "?!", "Ungenauigkeit", "#f2c744"], ["mistake", "?", "Fehler", "#f28b3c"], ["blunder", "??", "Grober Fehler", "#f0605d"]];
  const winPct = (cp) => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
  function analyse(g) {
    const cp = g.moves.map((m) => m.mate ? (String(m.mate).startsWith("-") ? -1 : 1) * 1000 : m.eval != null ? Math.max(-1000, Math.min(1000, Math.round(m.eval * 100))) : null);       // each value: the mover's own score when choosing the move
    const per = [], side = { w: { acc: [], cat: {} }, b: { acc: [], cat: {} } };
    CATS.forEach(([k]) => { side.w.cat[k] = 0; side.b.cat[k] = 0; });
    for (let i = 0; i < g.moves.length; i++) {
      const own = cp[i], nxt = cp[i + 1];
      if (own == null || nxt == null) { per.push(null); continue; }
      const loss = Math.max(0, winPct(own) - winPct(-nxt)), acc = Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * loss) - 3.1669));
      const cat = loss <= 1 ? "best" : loss <= 3 ? "excellent" : loss <= 7 ? "good" : loss <= 12 ? "inacc" : loss <= 20 ? "mistake" : "blunder", c = g.moves[i].color;
      side[c].acc.push(acc); side[c].cat[cat]++; per.push({ cat, loss });
    }
    const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
    return { per, w: { acc: mean(side.w.acc), cat: side.w.cat, n: side.w.acc.length }, b: { acc: mean(side.b.acc), cat: side.b.cat, n: side.b.acc.length }, n: side.w.acc.length + side.b.acc.length };
  }
  function analysisCards(g, a) {
    if (!a || a.n < 4) return [];
    const pc = (x) => x == null ? "–" : x.toFixed(1).replace(".", ",") + " %";
    return [h("div", { class: "card" }, h("h2", {}, h("span", {}, "Genauigkeit des Spiels")),
      h("div", { class: "stat" }, h("div", { class: "lab" }, h("span", {}, "Weiß · " + (g.headers.White || "")), h("b", {}, pc(a.w.acc))), h("div", { class: "track" }, fillBar(a.w.acc || 0))),
      h("div", { class: "stat" }, h("div", { class: "lab" }, h("span", {}, "Schwarz · " + (g.headers.Black || "")), h("b", {}, pc(a.b.acc))), h("div", { class: "track alt" }, fillBar(a.b.acc || 0))),
      h("p", { class: "tiny muted" }, "Genauigkeit je Zug aus dem Verlust an Gewinnchance (Win-%-Modell). Grundlage sind die eigenen Suchbewertungen der beiden spielenden Engines in der Partie – keine unabhängige Analyse.")),
      h("div", { class: "card" }, h("h2", {}, h("span", {}, "Zuganalyse"), pill(a.n + " Züge bewertet", "hist")),
        h("table", { class: "cats" }, h("thead", {}, h("tr", {}, h("th", {}, "Kategorie"), h("th", {}, "Weiß"), h("th", {}, "Schwarz"))),
          h("tbody", {}, CATS.map(([k, sym, name]) => h("tr", {}, h("td", {}, h("span", { class: "ico c-" + k }, sym), name), h("td", {}, h("span", { class: "cnt c-" + k }, String(a.w.cat[k]))), h("td", {}, h("span", { class: "cnt c-" + k }, String(a.b.cat[k]))))))),
        h("p", { class: "tiny muted" }, "Einstufung nach Verlust an Gewinnchance je Zug: ≤ 1 Punkt bester, ≤ 3 hervorragend, ≤ 7 gut, ≤ 12 Ungenauigkeit, ≤ 20 Fehler, darüber grober Fehler. Der letzte Zug jeder Partie wird nicht bewertet."))];
  }
  function chips(g, ply) {
    const el = $("#chips"); if (!el) return;
    const lo = Math.max(1, Math.min(ply - 1, g.moves.length - 2)), items = [];
    for (let q = lo; q <= Math.min(g.moves.length, lo + 3); q++) { const m = g.moves[q - 1]; items.push(h("button", { class: "chip" + (q === ply ? " cur" : ""), onclick: () => { stopAuto(); go(q); } }, `${Math.ceil(q / 2)}${m.color === "w" ? "." : "..."} ${m.san}`)); }
    el.replaceChildren(...items);
  }

  /* ---------------- views ---------------- */
  function setTab(t) { document.querySelectorAll(".tabs a").forEach((a) => a.classList.toggle("on", a.dataset.t === t)); }
  function loading() { view.replaceChildren(h("p", { class: "muted pad" }, "Lade Daten…")); }
  function fail(e) { view.replaceChildren(h("div", { class: "card" }, h("h2", {}, "Daten nicht verfügbar"), h("p", { class: "muted" }, "Der Dashboard-Server antwortet nicht. " + (e && e.message ? e.message : "")), h("button", { class: "btn", onclick: () => route() }, "Erneut versuchen"))); }

  async function viewStart() {
    setTab("start");
    const o = await api("/api/overview");
    const c = o.champion, s = o.service, ms = o.milestones, ls = o.last_step, lg = o.last_game, ce = o.strength.champion_evidence, lr = ce || o.strength.latest_reliable;
    const done = ms.items.filter((m) => m.state === "done").length;
    const cards = [];
    cards.push(h("div", { class: "card" }, h("h2", {}, "Status", kindPill(s.label)),
      h("div", { class: "kv" }, h("div", {}, "Forschungsdienst"), h("div", {}, s.running ? "läuft (Heartbeat " + s.heartbeat_age_s + " s)" : "läuft nicht – " + (s.enable_flag_valid ? "Flag gültig bis " + fmtTime(s.enable_flag_until) : "kein gültiges Enable-Flag")),
        h("div", {}, "Freigabe (Grant)"), h("div", {}, s.grant_active ? "AKTIV" : "keine aktive Freigabe"), h("div", {}, "Warteschlange"), h("div", {}, `${s.queue.queued} offen · ${s.queue.running} läuft · ${s.queue.done} erledigt · ${s.queue.failed} fehlgeschlagen`)),
      h("p", { class: "tiny muted" }, s.label.note)));
    cards.push(h("div", { class: "card" }, h("h2", {}, "Champion", kindPill(c.label)),
      c.available ? [h("div", { class: "big" }, c.current), h("div", { class: "kv" }, h("div", {}, "Erstellt"), h("div", {}, c.created || "–"), h("div", {}, "SHA-256"), h("div", {}, c.sha256 + "…"), h("div", {}, "Hinweis"), h("div", {}, c.note || "–"))] : h("p", { class: "muted" }, "Keine Champion-Daten.")));
    cards.push(h("div", { class: "card" }, h("h2", {}, "Spielstärke", kindPill(o.strength.label)),
      lr ? [h("div", { class: "big" }, eloTxt(lr.calc)), h("p", { class: "small" }, `${lr.subject} gegen ${lr.reference}`), ce ? h("p", { class: "tiny muted" }, ce.note) : h("p", { class: "tiny muted" }, "Kein Vergleich Champion gegen Vorgänger gefunden; letzte belastbare Messung unter gleichen Bedingungen."), h("p", { class: "small muted" }, `${lr.games} Partien (${lr.w} S / ${lr.d} R / ${lr.l} N) · ${lr.condition} · ${fmtTime(lr.time)}`)] : h("p", { class: "muted" }, "Noch keine belastbare Messung."),
      h("div", { class: "note" }, o.strength.absolute.reason), h("a", { href: "#/strength" }, "Alle Messungen und Bedingungen →")));
    cards.push(h("div", { class: "card" }, h("h2", {}, "Letzte Verbesserung / Rückschritt", pill("Historisch", "hist")),
      ls ? [h("p", {}, pill(ls.verdict === "besser" ? "Verbesserung" : "Rückschritt", ls.verdict === "besser" ? "good" : "bad"), " ", ls.subject, " gegen ", ls.reference), h("p", { class: "small muted" }, `${eloTxt(ls.calc)} · ${ls.games} Partien · ${ls.condition} · ${fmtTime(ls.time)}`)] : h("p", { class: "muted" }, "Keine statistisch belegte Veränderung gefunden."),
      o.warning_signal ? h("div", { class: "note" }, h("b", {}, "Warnsignal: "), o.warning_signal.text, " (", fmtTime(o.warning_signal.time), ")") : null));
    cards.push(h("div", { class: "card" }, h("h2", {}, "Forschung", kindPill(o.research_now.label)),
      h("div", { class: "kv" }, h("div", {}, "Offene Ideen"), h("div", {}, String(o.research_now.open_ideas)), h("div", {}, "Letzter Zyklus"), h("div", {}, o.research_now.last_cycle ? fmtTime(o.research_now.last_cycle.time) : "–"),
        h("div", {}, "Audits / übersprungen"), h("div", {}, o.research_now.audit ? `${o.research_now.audit.audits ?? 0} / ${o.research_now.audit.skipped ?? 0}` : "–")), h("a", { href: "#/research" }, "Forschungsfortschritt →")));
    const ar = o.arena, refS = ar.series.find((x) => x.reference) || ar.series[0];
    cards.push(h("div", { class: "card" }, h("h2", {}, "Live-Arena", arenaPill(ar)),
      h("div", { class: "kv" }, h("div", {}, "Partien (gewertet)"), h("div", {}, String(ar.totals.scored)), h("div", {}, "Zustand"), h("div", {}, arenaStateText(ar) + (ar.reason ? " – " + ar.reason : "")),
        h("div", {}, refS ? "Elo gegen " + refS.opponent : "Elo"), h("div", {}, refS ? eloTxt(refS.calc) + (refS.reliable ? "" : " (unsicher, < 100 Partien)") : "noch keine gewerteten Partien")),
      h("p", { class: "tiny muted" }, "Arena-Partien sind keine offiziellen Spielstärketests."), h("a", { href: "#/arena" }, "Arena-Seite →")));
    cards.push(h("div", { class: "card" }, h("h2", {}, "Letzte Partie", pill("Historisch", "hist")),
      lg ? h("a", { class: "game", href: "#/board/" + lg.id }, h("div", { class: "t" }, h("span", {}, lg.white, " – ", lg.black), h("span", { class: "res" }, lg.result)), h("div", { class: "s" }, `${lg.date} · ${lg.tc || "?"} · ${lg.plies ?? "?"} Halbzüge · ${o.games_total} Partien im Archiv`)) : h("p", { class: "muted" }, "Keine Partien vorhanden."),
      h("p", { class: "small" }, "Live-Partie: ", pill(o.live_game.connected ? (o.live_game.state === "live" ? "LIVE" : "veraltet") : "nicht verbunden", o.live_game.connected ? "live" : "na"), " ", h("span", { class: "muted tiny" }, o.live_game.note || ""))));
    cards.push(h("div", { class: "card" }, h("h2", {}, `Meilensteine ${done}/5`, kindPill(ms.label)), h("div", { class: "bar" }, h("i", {})),
      h("div", { class: "ms", style: false }, ms.items.map((m) => h("div", { class: "m " + m.state }, h("div", { class: "n" }, m.n), h("div", {}, h("b", {}, m.name), h("div", { class: "tiny muted" }, m.status.slice(0, 120))), pill({ done: "fertig", deferred: "zurückgestellt", prepared: "vorbereitet", in_progress: "in Arbeit", not_started: "offen" }[m.state] || m.state, m.state === "done" ? "good" : m.state === "deferred" ? "warn" : "hist"))))));
    view.replaceChildren(...cards);
    $(".bar i", view).style.width = (done / 5 * 100) + "%";
  }

  /* board view */
  function evalChart(g) {
    const pts = g.moves.map((m) => m.mate ? ((String(m.mate).startsWith("-") ? -1 : 1) * (m.color === "b" ? -1 : 1) * 6) : m.eval != null ? Math.max(-6, Math.min(6, m.eval * (m.color === "b" ? -1 : 1))) : null);
    const ok = pts.filter((v) => v != null);
    if (ok.length < 2) return null;
    const W = 340, H = 110, X = (i) => 10 + i / Math.max(1, pts.length - 1) * (W - 20), Y = (v) => 8 + (1 - (v + 6) / 12) * (H - 20);
    const svg = sv("svg", { class: "ev", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Bewertungsverlauf aus Sicht von Weiß" });
    const defs = sv("defs", {}, sv("linearGradient", { id: "evg", x1: 0, x2: 0, y1: 0, y2: 1 }, sv("stop", { offset: "0", "stop-color": "#6db0ff", "stop-opacity": ".55" }), sv("stop", { offset: "1", "stop-color": "#6db0ff", "stop-opacity": ".05" })));
    const known = pts.map((v, i) => [i, v]).filter(([, v]) => v != null);
    svg.append(defs, sv("line", { x1: 10, x2: W - 10, y1: Y(0), y2: Y(0), stroke: "#3a4a6b", "stroke-dasharray": "3 3" }));
    svg.append(sv("polygon", { points: [`${X(known[0][0])},${H - 6}`, ...known.map(([i, v]) => X(i) + "," + Y(v)), `${X(known[known.length - 1][0])},${H - 6}`].join(" "), fill: "url(#evg)" }));
    svg.append(sv("polyline", { points: known.map(([i, v]) => X(i) + "," + Y(v)).join(" "), fill: "none", stroke: "#8cc2ff", "stroke-width": 2, "stroke-linejoin": "round" }));
    svg.append(sv("circle", { id: "evmark", r: 4, cx: -10, cy: -10, fill: "#fff", stroke: "#4a8fe7", "stroke-width": 2 }));
    S.evMap = { pts, X, Y };
    return svg;
  }
  function renderGame() {
    const g = S.game; if (!g) return;
    const ply = Math.max(0, Math.min(S.ply, g.fens.length - 1)), mv = ply > 0 ? g.moves[ply - 1] : null;
    $("#boardhost").replaceChildren(drawBoard(g.fens[ply], mv, S.flip, S.an && ply > 0 && S.an.per[ply - 1] ? { color: CATS.find((c) => c[0] === S.an.per[ply - 1].cat)[3], sym: CATS.find((c) => c[0] === S.an.per[ply - 1].cat)[1] } : null));
    let ev = mv && mv.eval != null ? mv.eval * (mv.color === "b" ? -1 : 1) : null;                         // engine annotation is from the mover's view
    const mate = mv && mv.mate ? (String(mv.mate).startsWith("-") ? -1 : 1) * (mv.color === "b" ? -1 : 1) : 0;
    const pos = mate ? (mate > 0 ? 100 : 0) : ev == null ? 50 : 50 + 50 * Math.tanh(ev / 3);
    const ef = $("#evalfill"); if (ef) ef.style.width = pos + "%";
    chips(g, ply);
    document.querySelectorAll("#movelist button").forEach((b) => b.classList.toggle("cur", +b.dataset.p === ply));
    const lst = $("#movelist"), cur = $("#movelist button.cur"); if (lst && cur) lst.scrollTop = Math.max(0, cur.offsetTop - lst.offsetTop - lst.clientHeight / 2);      // scroll only the move list, never the page
    const em = $("#evmark"); if (em && S.evMap) { const i = Math.max(0, ply - 1), v = S.evMap.pts[i]; if (ply > 0 && v != null) { em.setAttribute("cx", S.evMap.X(i)); em.setAttribute("cy", S.evMap.Y(v)); } else em.setAttribute("cx", -10); }
    const pn = $("#plynum"); if (pn) pn.textContent = `Zug ${ply} / ${g.fens.length - 1}`;
  }
  function go(n) { if (!S.game) return; S.ply = Math.max(0, Math.min(n, S.game.fens.length - 1)); renderGame(); }
  function stopAuto(sys) {
    if (S.auto) { clearInterval(S.auto); S.auto = null; } const b = $("#autobtn"); if (b) b.classList.remove("on");
    if (S.replayTimer) { clearTimeout(S.replayTimer); S.replayTimer = null; if (!sys) S.replayPaused = true; }          // a tap of the user pauses the automatic replay; a page refresh (sys) does not
  }
  function startReplay() {                                                    // automatic, slow replay of the last played game (not live): one move every S.replayDelay ms, then a pause and again from the start
    if (S.replayTimer) { clearTimeout(S.replayTimer); S.replayTimer = null; }
    S.replayPaused = false;
    const tick = () => {
      S.replayTimer = null;
      if (!S.game || S.route !== "board" || !S.replay) return;
      const last = S.game.fens.length - 1;
      if (S.ply >= last) { S.replayTimer = setTimeout(() => { S.ply = 0; renderGame(); S.replayTimer = setTimeout(tick, S.replayDelay); }, 5000); return; }
      go(S.ply + 1); S.replayTimer = setTimeout(tick, S.replayDelay);
    };
    S.replayTimer = setTimeout(tick, S.replayDelay);
  }
  function startAuto() { stopAuto(); const b = $("#autobtn"); if (b) b.classList.add("on"); S.auto = setInterval(() => { if (!S.game || S.ply >= S.game.fens.length - 1) return stopAuto(); go(S.ply + 1); }, 1000); }

  function liveDetails(li, g) {
    const i = li.info || {}, e = i.engines || {}, c = g.clock || {}, done = li.state === "finished", ab = li.state === "aborted";
    const nm = (x) => x ? x.name + (x.sha256 ? " · " + x.sha256.slice(0, 8) : "") : "?";
    const bits = [];
    if (done || ab) bits.push(h("div", { class: "note" }, h("b", {}, done ? "Ergebnis " + g.result + " · " : "Abgebrochen (nicht gewertet) · "), i.termination || "", i.reason ? " " + i.reason : ""));
    if (i.series && i.series.scored != null) bits.push(h("p", { class: "small" }, `Arena gesamt: ${i.series.scored} gewertet` + (i.series.series || []).map((x) => ` · gegen ${x.opponent}: ${x.w} S ${x.d} R ${x.l} N`).join("")));
    if (i.next) bits.push(h("p", { class: "small" }, h("b", {}, "Nächste Partie: "), `${i.next.game_id} gegen ${i.next.opponent}, Champion ${i.next.subject_white ? "mit Weiß" : "mit Schwarz"} – ${i.next.note}`));
    return h("div", {}, bits);
  }

  async function viewBoard(id) {
    setTab("board"); stopAuto(true); S.liveRoute = id === "live"; if (S.replayDelay == null) S.replayDelay = 2000;
    if (S.livePoll) { clearInterval(S.livePoll); S.livePoll = null; }
    if (id === "live") {                                                      // reliable live updates even if the event stream is buffered by a proxy: a tiny stat probe every 1.5 s, full reload only on change
      S.livePoll = setInterval(async () => {
        if (document.hidden || S.route !== "board" || !S.liveRoute) return;
        try { const r = await api("/api/livestate", 8000), sig = JSON.stringify(r); if (S.liveSig !== undefined && sig !== S.liveSig) { S.liveSig = sig; refreshQuiet(); } else S.liveSig = sig; } catch (e) { /* banner already set */ }
      }, 1500);
    }
    let live = id === "live", replay = false, g, liveInfo = null;
    if (live) {
      liveInfo = await api("/api/live");
      if (!liveInfo.connected) {                                                // no live file: replay the most recent archived game instead (labelled as a replay, never as live)
        const lastG = (await api("/api/games?limit=1")).games[0];
        if (!lastG) { view.replaceChildren(h("div", { class: "card" }, h("h2", {}, "Keine Partie vorhanden"), h("p", { class: "muted small" }, "Es gibt noch keine gespielte Partie. Sobald die Arena spielt, erscheint sie hier."), h("a", { class: "btn", href: "#/arena" }, "Zur Arena"))); S.game = null; return; }
        live = false; replay = true; g = await api("/api/game/" + encodeURIComponent(lastG.id)); if (!g.ok) throw new Error(g.error || "Partie nicht lesbar");
      } else { g = liveInfo.game; replay = liveInfo.state !== "live"; }              // finished/aborted/stale live file: replay it as well
    } else { g = await api("/api/game/" + encodeURIComponent(id)); if (!g.ok) throw new Error(g.error || "Partie nicht lesbar"); }
    g.key = live ? "live:" + ((liveInfo.info && liveInfo.info.game_id) || "") : g.id;
    const keep = S.game && S.game.key === g.key && S.live === live && S.replay === replay;
    S.game = g; S.live = live; S.replay = replay; if (!keep) { S.ply = replay ? 0 : live ? g.fens.length - 1 : 0; S.flip = false; S.replayPaused = false; } else if (live && !replay && S.followLive !== false) S.ply = g.fens.length - 1;
    const hd = g.headers, wn = (hd.White || "?") + (hd.EngineWhiteName && hd.EngineWhiteName !== hd.White ? " (" + hd.EngineWhiteName + ")" : ""), bn = (hd.Black || "?") + (hd.EngineBlackName && hd.EngineBlackName !== hd.Black ? " (" + hd.EngineBlackName + ")" : "");
    const tcTxt = (liveInfo && liveInfo.info && liveInfo.info.tc) || hd.TimeControl || "";
    S.an = analyse(g);
    const list = h("div", { class: "moves", id: "movelist" });
    g.moves.forEach((m, i) => { if (m.color === "w") list.append(h("span", { class: "no" }, Math.ceil(m.ply / 2) + ".")); list.append(h("button", { "data-p": m.ply, onclick: () => { stopAuto(); go(m.ply); } }, m.san)); });
    const pc = (x) => (x == null ? "" : x.toFixed(1).replace(".", ",") + " %"), who = (name, side, acc) => h("div", { class: "pl" }, h("span", { class: "dot " + side }), h("div", { class: "grow" }, h("b", {}, name), h("div", { class: "tiny muted" }, side === "w" ? "Weiß" : "Schwarz")), h("span", { class: "acc" }, pc(acc)));
    const top = S.flip ? who(wn, "w", S.an.w.acc) : who(bn, "b", S.an.b.acc), bottom = S.flip ? who(bn, "b", S.an.b.acc) : who(wn, "w", S.an.w.acc);
    const resTxt = g.result === "1-0" ? "Sieg Weiß" : g.result === "0-1" ? "Sieg Schwarz" : g.result === "1/2-1/2" ? "Remis" : "läuft";
    const card = h("div", { class: "card gcard" },
      h("div", { class: "hdr" }, h("div", { class: "avatar" }, "♛"), h("div", { class: "grow" }, h("b", { class: "gtitle" }, "ELO 4000"), h("div", { class: "muted" }, "Partieanalyse")),
        replay ? pill("Replay", "warn") : live ? pill({ live: "LIVE", finished: "beendet", aborted: "abgebrochen" }[liveInfo.state] || "veraltet (" + Math.round(liveInfo.age_s) + " s)", liveInfo.state === "live" ? "live" : liveInfo.state === "finished" ? "hist" : "warn") : pill("Archiv", "hist")),
      top, h("div", { class: "boardwrap", id: "bw" }, h("div", { id: "boardhost" })), bottom,
      h("div", { class: "evalbar", hidden: true }, h("i", { id: "evalfill" })),
      h("p", { class: "tiny muted gmeta" }, [(live ? "Live-Arena" : (g.meta && g.meta.experiment) || hd.Event || "Archiv"), tcTxt ? "Rapid " + tcTxt : "", hd.Termination || (liveInfo && liveInfo.info && liveInfo.info.termination) || "", resTxt].filter(Boolean).join(" · ")),
      live && liveInfo.info ? liveDetails(liveInfo, g) : null,
      g.parse_errors && g.parse_errors.length ? h("div", { class: "note" }, "Hinweis beim Lesen der Partie: ", g.parse_errors.join("; ")) : null, list, h("pre", { id: "pgnbox", hidden: true }));
    const ec = evalChart(g);
    view.replaceChildren(card, ...(ec ? [h("div", { class: "card" }, h("h2", {}, h("span", {}, "Verlauf der Partie"), pill("Weiß oben", "hist")), ec, h("p", { class: "tiny muted" }, "Engine-Bewertung je Zug aus Sicht von Weiß (nur wenn die Partie Bewertungen enthält).")) ] : []), ...analysisCards(g, S.an)); renderGame();
    if (replay && !S.replayPaused) startReplay();
    const bw = $("#bw"); let x0 = null;                                                                     // swipe left/right on the board
    bw.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    bw.addEventListener("touchend", (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 40) { stopAuto(); go(S.ply + (dx < 0 ? 1 : -1)); } }, { passive: true });
  }
  async function showPgn(id) {
    const box = $("#pgnbox"); if (!box.hidden) { box.hidden = true; return; }
    try { const r = await fetch("/api/pgn/" + encodeURIComponent(id)); box.textContent = await r.text(); box.hidden = false; } catch (e) { box.textContent = "PGN nicht ladbar"; box.hidden = false; }
  }

  async function loadArchive(reset) {
    const A = S.archive; if (reset) { A.offset = 0; A.items = []; }
    const p = new URLSearchParams({ q: A.q, result: A.result, kind: A.kind, tc: A.tc, offset: A.offset, limit: 30 });
    const r = await api("/api/games?" + p); A.total = r.total; A.items = A.items.concat(r.games); A.offset = A.items.length; A.facets = r.facets; A.labels = r.kind_labels; return r;
  }
  const ICONS = {                                                                                          // small stroke icons (24x24) for the games list
    search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.3-4.3", bars: "M5 20V10M12 20V4M19 20v-7", layers: "M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5", hour: "M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9",
    sort: "M8 4v16M4 16l4 4 4-4M16 20V4M12 8l4-4 4 4", cal: "M5 5h14v15H5zM5 10h14M9 3v4M15 3v4", clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2", user: "M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM5 21c0-4 3-6 7-6s7 2 7 6", monitor: "M3 4h18v12H3zM8 20h8M12 16v4",
    crown: "M3 8l4 4 5-7 5 7 4-4-2 11H5zM5 21h14", bolt: "M13 2L5 14h6l-1 8 8-12h-6z",
    trophy: "M8 4h8v6a4 4 0 0 1-8 0zM8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 14v4M8 20h8", hand: "M3 12l5-4 4 2 4-2 5 4-5 6-3-2-2 2-4-3zM8 8l4 2"
  };
  const icon = (n, size = 20) => sv("svg", { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", "stroke-width": 1.8, "stroke-linecap": "round", "stroke-linejoin": "round", class: "ic" }, sv("path", { d: ICONS[n] }));
  async function viewArchive() {
    setTab("archive"); const A = S.archive; await loadArchive(true);
    const draw = () => {
      const kls = (r) => (r === "1-0" ? "win" : r === "0-1" ? "loss" : r === "1/2-1/2" ? "draw" : "open"), rtxt = (r) => (r === "1/2-1/2" ? "½ – ½" : r === "1-0" ? "1 – 0" : r === "0-1" ? "0 – 1" : r || "–");
      const list = $("#glist"); list.replaceChildren(...(A.items.length ? A.items.map((g) => h("a", { class: "game " + kls(g.result), href: "#/board/" + g.id },
        h("span", { class: "gico" }, icon(g.result === "1/2-1/2" ? "hand" : "trophy", 26)),
        h("div", { class: "gbody" }, h("div", { class: "t" }, h("span", { class: "gname", title: g.white + " – " + g.black }, g.white, " – ", g.black), h("span", { class: "res" }, rtxt(g.result))),
          h("div", { class: "gmeta" }, h("span", {}, icon("cal", 17), (g.date || "ohne Datum").replace(/-/g, ".")), h("span", {}, icon("clock", 17), g.tc || "?"), h("span", {}, icon("user", 17), `Halbzüge: ${g.plies ?? "?"}`)),
          h("div", { class: "gtags" }, h("span", { class: "gtag" }, icon("monitor", 16), A.labels[g.kind] || g.kind), g.experiment ? h("span", { class: "gtag" }, g.experiment) : null)))) : [h("div", { class: "card muted" }, "Keine Partien gefunden. Es werden nur tatsächlich vorhandene PGN-Dateien gelesen.")]));
      $("#gcount").textContent = `${A.items.length} von ${A.total} Partien`; $("#more").hidden = A.items.length >= A.total;
    };
    let timer = null; const reload = async () => { await loadArchive(true); draw(); };
    const sel = (key, opts, ph, ic) => h("label", { class: "fsel" }, icon(ic, 20), h("select", { onchange: (e) => { A[key] = e.target.value; reload(); } }, h("option", { value: "" }, ph), opts.map(([v, t]) => h("option", { value: v, selected: A[key] === v }, t))));
    view.replaceChildren(h("label", { class: "fsearch" }, icon("search", 22), h("input", { type: "search", placeholder: "Suche: Engine, Experiment, Datum…", value: A.q, maxlength: 60, oninput: (e) => { A.q = e.target.value; clearTimeout(timer); timer = setTimeout(reload, 350); } })),
      h("div", { class: "frow" }, sel("result", [["1-0", "1 – 0"], ["0-1", "0 – 1"], ["1/2-1/2", "½ – ½"]], "Ergebnis", "bars"), sel("kind", A.facets.kinds.map((k) => [k, A.labels[k] || k]), "Quelle", "layers"), sel("tc", A.facets.tcs.map((t) => [t, t]), "Bedenkzeit", "hour")),
      h("div", { class: "gcountrow" }, h("span", { id: "gcount" }), h("span", { class: "sortlab" }, icon("sort", 20), "Neueste zuerst")), h("div", { id: "glist" }), h("button", { class: "btn", id: "more", style: false, onclick: async () => { await loadArchive(false); draw(); } }, "Mehr laden"));
    draw();
  }

  function forest(records) {
    const W = 360, rowH = 34, H = records.length * rowH + 34, lim = 150, xs = (v) => 20 + (Math.max(-lim, Math.min(lim, v)) + lim) / (2 * lim) * (W - 40);
    const svg = sv("svg", { class: "forest", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Elo-Differenz mit 95%-Konfidenzintervall je Messung" });
    [-100, -50, 0, 50, 100].forEach((t) => { svg.append(sv("line", { x1: xs(t), x2: xs(t), y1: 6, y2: H - 22, stroke: t === 0 ? "#8fa1b3" : "#263241", "stroke-width": t === 0 ? 1.4 : 1 })); svg.append(sv("text", { x: xs(t), y: H - 8, "font-size": 9, "text-anchor": "middle", fill: "#8fa1b3" }, (t > 0 ? "+" : "") + t)); });
    records.forEach((r, i) => {
      const y = 22 + i * rowH, c = r.calc, col = !r.reliable ? "#8fa1b3" : r.verdict === "besser" ? "#3ecf8e" : r.verdict === "schlechter" ? "#ff6b6b" : "#4cc2ff";
      if (c.elo == null) { svg.append(sv("text", { x: 20, y: y + 4, "font-size": 10, fill: "#f5b84b" }, "nicht bestimmbar (100 %/0 % Ergebnis)")); return; }
      const lo = c.lo == null ? -lim : c.lo, hi = c.hi == null ? lim : c.hi;
      svg.append(sv("line", { x1: xs(lo), x2: xs(hi), y1: y, y2: y, stroke: col, "stroke-width": 3, "stroke-linecap": "round", opacity: r.reliable ? 1 : 0.5 }));
      svg.append(sv("circle", { cx: xs(c.elo), cy: y, r: 4.5, fill: col, opacity: r.reliable ? 1 : 0.6 }));
      svg.append(sv("text", { x: 4, y: y - 9, "font-size": 7, fill: "#8fa1b3" }, (r.experiment + " · " + r.games).slice(0, 44)));
      if (c.elo > lim || c.elo < -lim || hi > lim || lo < -lim) svg.append(sv("text", { x: c.elo > 0 ? W - 8 : 8, y: y - 7, "font-size": 8, "text-anchor": c.elo > 0 ? "end" : "start", fill: "#f5b84b" }, "außerhalb des Bereichs"));
    });
    return svg;
  }
  async function viewStrength() {
    setTab("strength"); const d = await api("/api/strength");
    const cards = [h("div", { class: "card" }, h("h2", {}, "Spielstärke – wissenschaftlich korrekt", pill("Historisch", "hist")),
      h("div", { class: "note" }, h("b", {}, "Keine absolute Elo. "), d.absolute_scale.reason), h("p", { class: "small" }, `${d.totals.records} Messungen, davon ${d.totals.reliable} belastbar (≥ ${d.min_games_reliable} Partien, Intervall bestimmbar), ${d.totals.games} Partien insgesamt.`),
      d.empty_series_text ? h("div", { class: "note" }, d.empty_series_text) : null,
      h("p", { class: "tiny muted" }, "Alle Werte sind relative Elo-Differenzen A gegen B mit 95-%-Intervall, aus den gespeicherten Siegen/Remis/Niederlagen neu berechnet. Verschiedene Testbedingungen stehen in getrennten Blöcken und werden nie zu einer Kurve gemischt. Die combo3-Zugqualitätsmessung (QUALITY_LOSS) ist KEIN Elo-Ergebnis und steht auf der Forschungsseite."))];
    for (const g of d.groups) {
      const recs = g.records;
      cards.push(h("div", { class: "card" }, h("h2", {}, h("span", {}, g.condition)), h("div", { class: "tiny muted" }, g.note), recs.length ? h("div", { class: "scroll" }, forest(recs)) : null,
        recs.map((r) => h("div", { class: "issue" + (r.reliable ? "" : " muted") },
          h("div", { class: "row" }, h("b", { class: "grow" }, r.experiment), pill({ besser: "besser", schlechter: "schlechter", unentschieden: "unentschieden", nicht_bestimmbar: "n. bestimmbar" }[r.verdict], r.verdict === "besser" ? "good" : r.verdict === "schlechter" ? "bad" : ""), r.reliable ? null : pill("unsicher", "warn")),
          h("div", { class: "small" }, r.subject, " gegen ", r.reference, r.uncalibrated_reference ? [" ", pill("nicht kalibriert", "na")] : null),
          h("div", { class: "small" }, h("b", {}, eloTxt(r.calc)), ` · ${r.w} S / ${r.d} R / ${r.l} N · ${r.games} Partien`),
          h("div", { class: "tiny muted" }, fmtTime(r.time) + (r.chunks > 1 ? " · " + r.chunks + " Blöcke gepoolt" : "") + (r.flags.length ? " · " + r.flags.map((f) => f.replace(/_/g, " ")).join(", ") : "") + (r.note ? " · " + r.note : ""))))));
    }
    view.replaceChildren(...cards);
  }

  async function viewResearch() {
    setTab("research"); const d = await api("/api/research"), s = d.service, k = d.knowledge, a = d.audit, b = d.budget, ap = d.approval, host = s.host;
    const list = (title, items, f, empty) => h("div", { class: "card" }, h("h2", {}, title), items.length ? items.map(f) : h("p", { class: "muted small" }, empty));
    view.replaceChildren(
      h("div", { class: "card" }, h("h2", {}, "Forschungsdienst", pill(s.running ? "LÄUFT" : "aus", s.running ? "live" : "hist")),
        h("div", { class: "kv" }, h("div", {}, "Zustand"), h("div", {}, s.state + (s.reason ? " – " + s.reason : "")), h("div", {}, "Heartbeat"), h("div", {}, s.heartbeat_age_s == null ? "–" : s.heartbeat_age_s + " s alt"), h("div", {}, "Enable-Flag"), h("div", {}, s.enable_flag_valid ? "gültig bis " + fmtTime(s.enable_flag_until) : "kein gültiges Flag"),
          h("div", {}, "Freigabe (Grant)"), h("div", {}, s.grant_active ? "AKTIV" : "keine"), h("div", {}, "Queue"), h("div", {}, JSON.stringify(s.queue))),
        host ? h("p", { class: "tiny muted" }, `Host (letzte Probe des Dienstes): Netzteil ${host.ac_online}, Leerlauf ${host.idle_s} s, Takt ${host.clock_ratio}, freier RAM ${host.free_ram_mb} MB`) : h("p", { class: "tiny muted" }, "Keine Host-Messwerte des Dienstes verfügbar.")),
      h("div", { class: "card" }, h("h2", {}, "CPU-Budget", pill("Historisch", "hist")), b.available ? [h("div", { class: "kv" }, h("div", {}, "24 h"), h("div", {}, `${b.used_24h} von ${b.cap_24h} h (frei ${b.free_24h})`), h("div", {}, "7 Tage"), h("div", {}, `${b.used_7d} von ${b.cap_7d} h (frei ${b.free_7d})`))] : h("p", { class: "muted" }, "Budgetdaten nicht verfügbar.")),
      ap.available ? h("div", { class: "card" }, h("h2", {}, "Freigabe-Anfrage an Sie", pill("wartet", "warn")), h("p", {}, ap.headline), h("div", { class: "kv" }, h("div", {}, "Stufe"), h("div", {}, ap.stage + " (~" + ap.estimated_cost_h + " CPU-h)"), h("div", {}, "Befehl (nur Sie)"), h("div", {}, h("code", {}, ap.required_grant)), h("div", {}, "Bedingungen"), h("div", {}, ap.conditions)), h("div", { class: "note" }, ap.note)) : null,
      h("div", { class: "card" }, h("h2", {}, "Audit-Befunde", a.available ? pill(a.issues.length + " offen", a.issues.some((i) => i.severity === "high") ? "bad" : "hist") : pill("nicht verfügbar", "na")),
        a.available ? [a.stats ? h("p", { class: "tiny muted" }, `Audits: ${a.stats.audits ?? 0} · übersprungen (Eingaben unverändert): ${a.stats.skipped ?? 0} · Stand ${fmtTime(a.written)}`) : null, a.issues.map((i) => h("div", { class: "issue " + i.severity }, h("b", {}, i.severity.toUpperCase() + ": "), i.text, h("div", { class: "tiny muted" }, "Vorschlag: " + i.proposal)))] : h("p", { class: "muted small" }, "Noch kein Audit-Bericht.")),
      list("Letzte Controller-Zyklen", s.last_cycles.slice().reverse(), (c) => h("div", { class: "small" }, fmtTime(c.time), " · ", c.item, h("div", { class: "tiny muted" }, c.summary)), "Keine Zyklen aufgezeichnet."),
      list("Offene Ideen / Experimente", k.ideas.open, (i) => h("div", { class: "small" }, h("b", {}, i.id), " ", pill(i.candidate || "–"), h("div", { class: "tiny muted" }, `Stufen: ${i.tests.join(", ")} · ~${i.cost_h} h`)), "Keine offenen Ideen."),
      list("Abgeschlossene Experimente", k.ideas.done.slice(-12).reverse(), (i) => h("div", { class: "small" }, i.id, " ", pill(i.candidate || "–", "good")), "Keine."),
      list("Fehlgeschlagene / ungültige Stufen", k.failed, (f) => h("div", { class: "small" }, f.candidate, " · ", f.stage, " · ", pill(f.outcome, "bad"), " ", h("span", { class: "tiny muted" }, fmtTime(f.time))), "Keine fehlgeschlagenen Stufen aufgezeichnet."),
      list("Geschlossene Hypothesen", k.closed_leads, (l) => h("div", { class: "small" }, h("b", {}, l.key), h("div", { class: "tiny muted" }, l.reason)), "Keine."),
      list("Messaussagen (Claims) – Zugqualität/Knoten sind KEINE Elo", k.claims, (c) => h("div", { class: "small" }, c.claim, " ", pill(c.outcome, /LOSS|NOT|NO_/.test(c.outcome) ? "bad" : /REPRODUCED|GAIN/.test(c.outcome) ? "good" : "warn")), "Keine."),
      h("div", { class: "card" }, h("h2", {}, "Meilensteine", kindPill({ kind: "historical" })), d.milestones.items.map((m) => h("div", { class: "issue" }, h("b", {}, m.n + ". " + m.name), " ", pill(m.state, m.state === "done" ? "good" : "hist"), h("div", { class: "tiny muted" }, m.status), m.missing && m.missing !== "nichts" ? h("div", { class: "tiny" }, "Fehlt: " + m.missing) : null))));
  }

  const fillBar = (v) => { const i = document.createElement("i"); i.style.width = Math.max(0, Math.min(100, v)).toFixed(1) + "%"; return i; };          // CSSOM, not an inline style attribute (CSP)
  const arenaStateText = (a) => ({ running: "spielt", paused: "pausiert", stopped: "gestoppt", starting: "startet", never: "noch nie gestartet" }[a.state] || a.state);
  const arenaPill = (a) => pill(arenaStateText(a).toUpperCase(), a.state === "running" ? "live" : a.state === "paused" ? "warn" : "hist");
  const hms = (sec) => { if (sec == null) return "–"; const hh = Math.floor(sec / 3600), mm = Math.floor(sec % 3600 / 60); return hh + " h " + String(mm).padStart(2, "0") + " min"; };
  const clk = (ms) => { if (ms == null) return "–"; const t = Math.max(0, Math.round(ms / 1000)); return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0"); };

  function timeline(points) {
    const pts = points.filter((p) => p.elo != null);
    if (pts.length < 2) return null;
    const W = 360, H = 130, lim = 200, X = (i) => 28 + i / (pts.length - 1) * (W - 40), Y = (v) => 10 + (1 - (Math.max(-lim, Math.min(lim, v)) + lim) / (2 * lim)) * (H - 30);
    const svg = sv("svg", { class: "tl", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Verlauf der relativen Elo mit 95%-Intervall" });
    [-100, 0, 100].forEach((t) => { svg.append(sv("line", { x1: 28, x2: W - 12, y1: Y(t), y2: Y(t), stroke: t === 0 ? "#8fa1b3" : "#263241", "stroke-width": 1 })); svg.append(sv("text", { x: 2, y: Y(t) + 3, "font-size": 8, fill: "#8fa1b3" }, (t > 0 ? "+" : "") + t)); });
    const band = pts.map((p, i) => X(i) + "," + Y(p.hi == null ? lim : p.hi)).concat(pts.slice().reverse().map((p, k) => X(pts.length - 1 - k) + "," + Y(p.lo == null ? -lim : p.lo)));
    svg.append(sv("polygon", { points: band.join(" "), fill: "rgba(76,194,255,.18)" }));
    svg.append(sv("polyline", { points: pts.map((p, i) => X(i) + "," + Y(p.elo)).join(" "), fill: "none", stroke: "#4cc2ff", "stroke-width": 2 }));
    svg.append(sv("text", { x: 28, y: H - 4, "font-size": 8, fill: "#8fa1b3" }, "nach " + pts[0].n + " Partien"), sv("text", { x: W - 12, y: H - 4, "font-size": 8, "text-anchor": "end", fill: "#8fa1b3" }, "nach " + pts[pts.length - 1].n));
    return svg;
  }
  function lineageCard(d) {                                                                         // generations dashboard of the Arena page: current generation, training progress, five stages, overview table
    const cur = d.current, el = (x) => x.elo != null ? `${x.elo < 0 ? "−" : "+"}${Math.abs(x.elo).toFixed(1).replace(".", ",")} Elo gegen ${x.vs || "c1"}` : x.interval_only ? `Intervall ${x.lo} bis ${x.hi} Elo gegen ${x.vs}` : "–";
    const mark = { done: "✓", current: "●", planned: "○", failed: "✕" };
    const stat = (lab, big, sub) => h("div", { class: "lstat" }, h("div", { class: "lab" }, lab), h("div", { class: "lbig" }, big), h("div", { class: "lsub" }, sub));
    const parts = [h("h2", {}, h("span", {}, "PROJECT ELO 4000 – Live"), pill("Stand " + fmtTime(d.time), "hist"))];
    if (cur) {
      parts.push(h("div", { class: "lgrid" }, stat("Aktuelle Generation", cur.id, cur.headline), stat("Trainingsfortschritt", cur.steps_total ? `${cur.steps_done} / ${cur.steps_total}` : "–", "Schritte")));
      parts.push(h("div", { class: "lhead" }, h("b", {}, "Fortschritt der Generation"), h("span", { class: "muted" }, cur.stage_status)));
      parts.push(h("ol", { class: "stepper" }, cur.stages.map((s) => h("li", { class: s.state }, h("i", {}, mark[s.state] || "○"), h("span", {}, s.name)))));
    }
    parts.push(h("div", { class: "lhead" }, h("b", {}, "Generationenübersicht")));
    parts.push(h("table", { class: "ltable" }, h("tbody", {}, [...d.generations.map((g) => h("tr", {}, h("td", {}, g.id), h("td", {}, g.label), h("td", {}, el(g)))), h("tr", {}, h("td", {}, d.next.id), h("td", {}, d.next.label), h("td", {}, "–"))])));
    parts.push(h("p", { class: "tiny muted" }, d.note));
    return h("div", { class: "card lineage" }, parts);
  }
  function gateBlock(q) {                                                                            // gate history: every attempt, the original verdict, the audited correction (only when re-evaluated from the stored evidence)
    const rows = q.attempts.map((a) => h("p", { class: "tiny" }, h("b", {}, "Gate-Versuch " + a.attempt_no + ": "), a.outcome + (a.cpu_s != null ? ` (${a.cpu_s} s CPU, ${a.wall_s} s)` : "")));
    const lines = [];
    if (q.other_checks_passed) lines.push("Alle weiteren technischen Prüfungen bestanden (" + (q.checks - 1) + " von " + (q.checks - 1) + ").");
    if (q.original) lines.push("Ursprüngliche Gate-Entscheidung: nicht bestanden (" + (q.original.failed || []).join(", ") + ")" + (q.evaluation_error ? " – Bewertungsfehler der alten Ressourcenregel: der ergebnisliefernde Versuch hielt seine Grenzen ein." : "."));
    lines.push(q.corrected ? "Korrigierte Entscheidung: Gate bestanden (aus den vorhandenen Nachweisen neu bewertet, Protokoll " + String(q.corrected.record_sha256 || "").slice(0, 12) + ")." : q.pending_correction ? "Korrektur: belegt, noch nicht ausgeführt." : "");
    return h("div", { class: "note" }, h("b", {}, "Gate-Verlauf"), ...rows, ...lines.filter(Boolean).map((x) => h("p", { class: "tiny" }, x)), h("p", { class: "tiny muted" }, q.strength_note));
  }
  function eloCard(lr, series) {                                                                     // the estimated Elo number with the real course of the underlying measurement (running estimate by games played)
    const pe = lr ? projElo(lr.calc, lr.reference) : null, num = lr ? (pe != null ? `${pe} Elo` : eloInt(lr.calc)) : null, base = pe != null ? PROJECT_ELO.base : 0;
    const ser = lr && (series || []).find((x) => (x.timeline || []).filter((p) => p.elo != null).length >= 2 && String(x.subject).startsWith(String(lr.subject).split(" ")[0]) && String(x.opponent_name || x.opponent).startsWith(lr.reference));
    let chart = null;
    if (ser) {
      const pts = ser.timeline.filter((p) => p.elo != null).map((p) => base + p.elo), W = 200, H = 90, mn = Math.min(...pts), mx = Math.max(...pts), pad = Math.max(2, (mx - mn) * 0.15), X = (i) => 6 + i / (pts.length - 1) * (W - 16), Y = (v) => 8 + (1 - (v - (mn - pad)) / ((mx + pad) - (mn - pad))) * (H - 20);
      const line = pts.map((v, i) => X(i).toFixed(1) + "," + Y(v).toFixed(1)).join(" "), id = "eg" + Math.round(Math.random() * 1e6);
      chart = sv("svg", { class: "elochart", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Verlauf der laufenden Elo-Schätzung" },
        sv("defs", {}, sv("linearGradient", { id, x1: 0, y1: 0, x2: 0, y2: 1 }, sv("stop", { offset: "0", "stop-color": "#2fd07a", "stop-opacity": ".35" }), sv("stop", { offset: "1", "stop-color": "#2fd07a", "stop-opacity": "0" }))),
        sv("polygon", { points: `${X(0)},${H - 6} ${line} ${X(pts.length - 1)},${H - 6}`, fill: `url(#${id})` }), sv("polyline", { points: line, fill: "none", stroke: "#2fd07a", "stroke-width": 2.4, "stroke-linejoin": "round", "stroke-linecap": "round" }),
        sv("circle", { cx: X(pts.length - 1), cy: Y(pts[pts.length - 1]), r: 4, fill: "#4dffa0" }));
    }
    return h("div", { class: "card elocard" }, h("div", { class: "eleft" }, h("div", { class: "elab" }, "Aktuelles Elo der Engine"), num ? h("div", { class: "ebig" }, h("span", { class: "enum" }, num.replace(/ Elo$/, "")), h("span", { class: "eunit" }, " Elo")) : h("p", { class: "muted" }, "Noch keine belastbare Messung."),
      lr && lr.games ? h("div", { class: "ebadge" }, h("span", { class: "bpill" }, `${lr.games} Partien`), h("span", { class: "muted" }, `gegen ${lr.reference}`)) : null), chart);
  }
  function chainCard(ch) {                                                                           // generation chain T1 -> T2 -> ...: reference, current, chain, one column per generation with its stages and earlier measurements
    const MK = { done: "✓", release: "⏳", registration: "○", pending: "·", failed: "✕", blocked: "–" };
    const parts = [h("div", { class: "ghead" }, h("span", { class: "gtile" }, icon("layers", 26)), h("b", {}, "Generationen"), h("span", { class: "gdate" }, icon("cal", 18), "Stand: " + String(ch.time || "").replace("T", " ").slice(0, 16)))];
    parts.push(h("div", { class: "refcur" }, h("div", {}, h("div", { class: "lab" }, "Referenz (beste akzeptierte)"), h("div", { class: "lbig" }, ch.reference || "–")), h("div", {}, h("div", { class: "lab" }, "Aktuelle Generation"), h("div", { class: "lbig cur" }, ch.current || "–"))));
    parts.push(h("div", { class: "chainrow" }, ch.nodes.map((n, i) => [i ? h("span", { class: "arrow" }, "›") : null, h("span", { class: "chip " + (n.is_reference || n.status === "ACCEPTED" ? "ref " : "") + (n.generation_id === ch.current ? "cur" : "") }, (n.is_reference || n.status === "ACCEPTED" ? "✓ " : n.generation_id === ch.current ? "▶ " : "") + n.generation_id)]), ch.placeholders.map((p) => [h("span", { class: "arrow" }, "›"), h("span", { class: "chip ghost" }, p)])));
    const col = (n) => {
      const res = n.result, st = n.status === "ACCEPTED" ? "good" : (n.status === "REJECTED" || n.status === "GATE_FAILED" || n.status === "FAILED") ? "bad" : (n.status === "INCONCLUSIVE" || n.status === "INTERRUPTED" || n.status === "AWAITING_RELEASE") ? "warn" : n.status === "BASELINE" ? "good" : "hist";
      const sg = (x) => (x > 0 ? "+" : x < 0 ? "−" : "") + Math.abs(x).toFixed(1).replace(".", ","), stat = (lab, val, sub) => h("div", { class: "gstat" }, h("span", { class: "sl" }, lab), h("b", { class: "sv" }, val), sub ? h("span", { class: "ss" }, sub) : null);
      return h("div", { class: "gcol" + (n.generation_id === ch.current ? " now" : "") + (n.is_reference ? " isref" : "") },
        h("div", { class: "gtop" }, h("span", { class: "gtile " + (n.is_reference ? "ref" : "bolt") }, icon(n.is_reference ? "crown" : "bolt", 22)), h("b", { class: "gname" }, n.generation_id), n.is_reference ? h("span", { class: "gtag" }, "Referenz") : null, h("span", { class: "spill " + st }, n.status === "BASELINE" ? "Trainiert" : n.label)),
        n.claim ? h("p", { class: "gclaim" }, n.claim.code === "proven_stronger" ? h("b", {}, "Nachweislich stärker: ") : n.claim.code === "baseline" ? null : h("b", {}, "Kein Stärkenachweis. "), n.claim.text) : null,
        h("ol", { class: "stepper small" }, n.stages.map((x) => h("li", { class: x.state === "release" || x.state === "registration" ? "current" : x.state }, h("i", {}, MK[x.state] || "·"), h("span", {}, x.name)))),
        res && res.n_pairs ? h("div", { class: "gstats" }, stat("Partien", String(res.n_pairs * 2), `${res.n_pairs} Paare`), stat("Elo", sg(res.elo), `zu ${res.reference}`), res.lo != null ? stat("Intervall", `${sg(res.lo)}…${sg(res.hi)}`, "angepasst") : null) : null,
        res ? h("p", { class: "gverdict" }, h("span", { class: "spill " + st }, res.outcome + (res.final ? "" : ` · Look ${res.look || 1}`)), res.reason ? h("span", { class: "tiny muted" }, res.reason) : null) : null,
        n.deferral ? h("p", { class: "tiny" }, `${ch.reference} bleibt Referenz. ${n.next.text}.`) : null,
        (n.history_results || []).length ? h("div", { class: "ghist" }, h("span", { class: "hl" }, icon("bars", 16), "Früher gemessen"), ...(n.history_results || []).map((r) => h("div", { class: "hrow" }, h("span", {}, r.vs), h("b", {}, `${r.elo > 0 ? "+" : "−"}${Math.abs(r.elo).toFixed(1).replace(".", ",")} Elo`), h("span", { class: "muted" }, `${r.games} Partien`)))) : null);
    };
    parts.push(h("div", { class: "gcols" }, ch.nodes.map(col)));
    if ((ch.development || []).length) {
      const f = (x) => (x == null ? "–" : (x > 0 ? "+" : x < 0 ? "−" : "") + Math.abs(x).toFixed(1));
      const dstat = (lab, val) => h("div", { class: "gstat" }, h("span", { class: "sl" }, lab), h("b", { class: "sv" }, val));
      parts.push(h("div", { class: "lhead" }, h("b", {}, "Entwicklungshistorie (relativ)")), h("div", { class: "devlist" }, ch.development.map((d) => h("div", { class: "dev" },
        h("div", { class: "devtop" }, h("b", {}, `${d.generation_id} gegen ${d.reference}`), h("span", { class: "spill warn" }, d.outcome + (d.final ? "" : " · vorläufig"))),
        h("div", { class: "gstats two" }, dstat("Elo-Gewinn", f(d.elo_gain)), dstat("Paare", String(d.n_pairs ?? "–")), dstat("Angepasstes Intervall", `${f(d.adjusted_lo)} … ${f(d.adjusted_hi)}`), dstat("95 %-Intervall", d.plain_ci95 ? `${f(d.plain_ci95[0])} … ${f(d.plain_ci95[1])}` : "–"))))), h("p", { class: "tiny muted" }, ch.absolute_note));
    }
    if (ch.t2b) {
      const t = ch.t2b, MKS = { done: "✓", planned: "○", missing: "·" }, nf = (x) => (x == null ? "–" : Number(x).toLocaleString("de-DE"));
      parts.push(h("div", { class: "lhead" }, h("b", {}, "T2b · Datenpipeline (geplant)")), h("p", { class: "small" }, t.status_text),
        h("ol", { class: "vsteps" }, t.steps.map((x) => h("li", { class: x.state === "planned" ? "current" : x.state === "done" ? "done" : "pending" }, h("i", {}, MKS[x.state] || "·"), h("span", { class: "vtxt" }, h("b", {}, x.label), x.detail ? h("small", {}, x.detail) : null)))),
        h("table", { class: "ltable kv2" }, h("tbody", {}, [["Geplante neue Positionen", nf(t.numbers.planned)], ["Erzeugt (roh)", nf(t.numbers.generated_raw)], ["Beschriftet", nf(t.numbers.labeled)], ["Verworfen beim Beschriften", nf(t.numbers.dropped_by_labeling)], ["Altkorpus-Labels (Teacher-Nachweis)", t.old_corpus_labels + " · Stufe " + (t.old_corpus_level || "none")],
          ["Datenmanifest", t.manifest_ready ? "READY" : "nicht READY"], ["Training", t.training_blocked ? "gesperrt" : "möglich (eigene Freigabe)"]].map((r) => h("tr", {}, r.map((c) => h("td", {}, c)))))),
        t.provenance_note ? h("p", { class: "small" }, h("b", {}, "Herkunft der Altkorpus-Labels: "), t.provenance_note) : null,
        h("p", { class: "tiny muted" }, "Nötige Einzelfreigaben: " + t.needs_release.join(" · ") + ". Werte stammen aus den offiziellen Artefakten; ohne Lauf bleiben sie leer."));
    }
    if (ch.next_step) parts.push(h("div", { class: "note" }, h("b", {}, "Nächster möglicher Schritt: "), ch.next_step.text, h("p", { class: "tiny muted" }, "Keine absolute Elo-Prognose; das Ergebnis sagt nicht, dass die Generation endgültig schwächer ist.")));
    if (ch.problems.length) parts.push(h("div", { class: "note" }, h("b", {}, "Hinweis: "), ch.problems.join("; ")));
    return h("div", { class: "card lineage gens" }, parts);
  }
  function planningCard(pl) {                                                                       // T2 planning: recipe comparison, data quality, training metrics, candidates, missing releases (all recorded values, no forecast)
    const tbl = (rows, head) => h("table", { class: "ltable" }, head ? h("thead", {}, h("tr", {}, head.map((x) => h("th", {}, x)))) : null, h("tbody", {}, rows.map((r) => h("tr", {}, r.map((c) => h("td", {}, c))))));
    const dq = pl.data_quality, m = pl.metrics, parts = [h("h2", {}, h("span", {}, "T2-Planung"), pill("Entwurf", "na"))];
    parts.push(h("div", { class: "lhead" }, h("b", {}, "Vergleich der T2-Trainingsrezepte")), tbl(pl.recipes.rows, pl.recipes.columns), h("p", { class: "tiny muted" }, pl.recipes.difference));
    parts.push(h("div", { class: "lhead" }, h("b", {}, "Qualitätsbericht der Trainingsdaten")), tbl([["Positionen", dq.records.toLocaleString("de-DE")], ["Ungültige Datensätze", String(dq.invalid_records)], ["Exakte Dubletten", String(dq.exact_duplicates)],
      ["Gleiche Netz-Eingaben (Spiegel/Farbtausch)", `${dq.net_input_twins.toLocaleString("de-DE")} (${String(dq.twin_share_pct).replace(".", ",")} %)`], ["Weiß am Zug", String(dq.white_to_move_pct).replace(".", ",") + " %"],
      ["Positionen aus Partien über 100 Stellungen", String(dq.late_games_share_pct).replace(".", ",") + " %"], ["Bewertungen ab 1000 cp", String(dq.labels_abs_ge_1000_pct).replace(".", ",") + " %"], ["Abstand Training/DEV (Score, KS)", String(dq.train_vs_dev_score_ks).replace(".", ",")]]), h("p", { class: "tiny muted" }, dq.verdict));
    if (m) {
      const pts = m.series, mx = Math.max(...pts.map((p) => p[0])), my = Math.max(...pts.map((p) => p[1])), W = 300, H = 64;
      const line = pts.map((p) => `${(6 + p[0] / mx * (W - 12)).toFixed(1)},${(H - 6 - p[1] / my * (H - 12)).toFixed(1)}`).join(" ");
      parts.push(h("div", { class: "lhead" }, h("b", {}, "Trainingsverlauf (T1)"), h("span", { class: "muted" }, `${m.steps} Schritte`)), sv("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img", "aria-label": "Trainingsverlust" }, sv("polyline", { points: line, fill: "none", stroke: "#4cc2ff", "stroke-width": "2" })),
        h("p", { class: "small muted" }, `Trainingsverlust zuletzt ${m.final_train_loss != null ? m.final_train_loss.toFixed(5) : "–"} · Validierungsverlust ${m.val_loss != null ? m.val_loss.toFixed(5) : "–"}`), h("p", { class: "tiny muted" }, pl.metrics_note));
    }
    parts.push(h("div", { class: "lhead" }, h("b", {}, "Kandidaten und Auswahl")), tbl(pl.candidates.map((c) => [c.id, c.status, c.decision || "–"])));
    parts.push(h("div", { class: "lhead" }, h("b", {}, "Fehlende Freigaben")), h("ul", { class: "small" }, pl.releases_missing.map((x) => h("li", {}, x))));
    parts.push(h("p", { class: "tiny muted" }, `${pl.no_forecast} Auflösung: etwa ±${Math.round(pl.resolution_elo.one_look)} Elo (erste 100 Paare), ±${Math.round(pl.resolution_elo.after_extension)} Elo nach der Erweiterung.`));
    return h("div", { class: "card lineage" }, parts);
  }
  async function viewArena() {
    setTab("arena"); const d = await api("/api/arena"), st = d.stats, c = d.compute, gb = d.global_budget, host = d.host, cur = d.current;
    const cards = [];
    const ln = await api("/api/lineage").catch(() => null);
    const ov = await api("/api/overview").catch(() => null), lr = ov && (ov.strength.champion_evidence || ov.strength.latest_reliable);          // the current Elo of the engine: the newest reliable relative measurement of the champion
    cards.push(eloCard(lr, st.series));
    if (ln && ln.chain) cards.push(chainCard(ln.chain));                                                          // the Elo card is first, then the generation chain
    if (!st.series.length) cards.push(h("div", { class: "card muted" }, "Noch keine gewerteten Arena-Partien. Die Elo-Entwicklung erscheint, sobald die Arena gespielt hat."));
    for (const x of st.series) {
      const tl = timeline(x.timeline);
      cards.push(h("div", { class: "card" }, h("h2", {}, h("span", {}, x.subject + " gegen " + (x.opponent_name || x.opponent)), x.reference ? pill("Referenz", "good") : null, x.uncalibrated ? pill("nicht kalibriert", "na") : null),
        h("div", { class: "big" }, x.calc.elo != null ? eloTxt(x.calc) : "nicht bestimmbar"), h("p", { class: "small" }, `${x.n} Partien · ${x.w} S / ${x.d} R / ${x.l} N`, x.reliable ? null : [" ", pill("unsicher (< 100 Partien)", "warn")]),
        h("div", { class: "stat" }, h("div", { class: "lab" }, h("span", {}, x.subject + " (Punkte)"), h("b", {}, pct(x.calc.score))), h("div", { class: "track" }, fillBar((x.calc.score ?? 0) * 100))),
        h("div", { class: "stat" }, h("div", { class: "lab" }, h("span", {}, (x.opponent_name || x.opponent) + " (Punkte)"), h("b", {}, x.calc.score == null ? "–" : pct(1 - x.calc.score))), h("div", { class: "track alt" }, fillBar((1 - (x.calc.score ?? 1)) * 100))),
        h("table", { class: "cats" }, h("thead", {}, h("tr", {}, h("th", {}, "Ergebnis"), h("th", {}, "Weiß"), h("th", {}, "Schwarz"))), h("tbody", {}, [["w", "S", "Siege", 0], ["d", "R", "Remis", 1], ["l", "N", "Niederlagen", 2]].map(([k, ic, nm, i]) => h("tr", {}, h("td", {}, h("span", { class: "ico " + k }, ic), nm), h("td", {}, h("span", { class: "cnt " + k }, String(x.by_color.white[i]))), h("td", {}, h("span", { class: "cnt " + k }, String(x.by_color.black[i]))))))),
        h("p", { class: "tiny muted" }, x.condition + " · Version " + x.subject_sha.slice(0, 8) + " · " + fmtTime(x.first) + " bis " + fmtTime(x.last)), h("div", { class: "strip" }, x.recent.map((r) => h("b", { class: r }, r))), tl ? h("div", { class: "scroll" }, tl) : h("p", { class: "tiny muted" }, "Verlauf erscheint ab zwei Messpunkten."),
        x.faults.time_forfeit || x.faults.illegal_move || x.faults.adjudicated ? h("p", { class: "tiny muted" }, `Markiert: ${x.faults.time_forfeit} Zeitüberschreitung(en), ${x.faults.illegal_move} illegale(r) Zug/Züge, ${x.faults.adjudicated} per Zuglimit remis gewertet`) : null));
    }
    if (st.invalid_recent.length) cards.push(h("div", { class: "card" }, h("h2", {}, "Ungültige Partien (nicht gewertet)"), st.invalid_recent.map((g) => h("div", { class: "issue high" }, h("b", {}, g.game_id), " ", h("span", { class: "tiny muted" }, fmtTime(g.time)), h("div", { class: "small" }, g.reason || "Engine-Fehler")))));
    view.replaceChildren(...cards);
  }

  /* ---------------- router + live ---------------- */
  async function route() {
    stopAuto(true); const hash = location.hash || "#/board/live", parts = hash.slice(2).split("/"); if (["board", "archive", "arena"].indexOf(parts[0]) < 0) parts.splice(0, parts.length, "board", "live"); S.route = parts[0];          // Start, Forschung and Stärke are no longer in the navigation: their old links open the live board if (parts[0] !== "board" && S.livePoll) { clearInterval(S.livePoll); S.livePoll = null; }
    try {
      if (parts[0] === "board") await viewBoard(parts[1] || "live"); else if (parts[0] === "archive") await viewArchive(); else if (parts[0] === "strength") await viewStrength(); else if (parts[0] === "research") await viewResearch(); else if (parts[0] === "arena") await viewArena(); else await viewStart();
    } catch (e) { fail(e); }
    tickFresh();
  }
  async function refreshQuiet() { if (S.route === "archive" || document.hidden) return; try { const keepAuto = !!S.auto; await route(); if (keepAuto && S.game && !S.live) startAuto(); } catch (e) { /* banner already set */ } }
  function connectLive() {
    if (!window.EventSource) { S.timer = setInterval(refreshQuiet, 30000); return; }
    const es = new EventSource("/api/stream"); S.sse = es; let deb = null;
    es.addEventListener("version", (e) => {
      let v = null; try { v = JSON.parse(e.data).v; } catch (_) { /* ignore */ }
      const prev = S.vers; S.vers = v; S.lastOk = Date.now(); tickFresh();
      if (!prev || !v) return;
      const keys = Object.keys(v).filter((k) => JSON.stringify(v[k]) !== JSON.stringify(prev[k]));
      if (!keys.length) return;
      const liveBoard = S.route === "board" && S.live, onlyLive = keys.every((k) => k === "live_game");
      if (onlyLive && !liveBoard && S.route !== "start" && S.route !== "arena") return;          // a running game only matters on the live board, Start and Arena
      const wait = liveBoard && onlyLive ? 900 : onlyLive ? 20000 : 1500;                         // bounded refresh rate (phone data and battery)
      if (S.pending) return;
      S.pending = setTimeout(() => { S.pending = null; S.lastRefresh = Date.now(); refreshQuiet(); }, Math.max(100, (S.lastRefresh || 0) + wait - Date.now()));
    });
    es.onerror = () => { es.close(); S.sse = null; setTimeout(connectLive, 15000); };                         // reconnect with a pause; the server closes after 10 minutes anyway
    if (!S.timer) S.timer = setInterval(() => { if (!S.sse) refreshQuiet(); }, 45000);
  }
  document.addEventListener("keydown", (e) => { if (!S.game || S.route !== "board") return; if (e.key === "ArrowLeft") { stopAuto(); go(S.ply - 1); } else if (e.key === "ArrowRight") { stopAuto(); go(S.ply + 1); } else if (e.key === "Home") go(0); else if (e.key === "End") go(S.game.fens.length - 1); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshQuiet(); });
  window.addEventListener("hashchange", route);
  window.addEventListener("online", refreshQuiet);
  setInterval(() => { if (!document.hidden && (S.route === "arena" || S.route === "start")) refreshQuiet(); }, 15000);          // heartbeat-driven state (pause reason, time left)
  route(); connectLive();
})();
