/* PROJECT ELO 4000 - The pursuit of 4000. Read-only. Liest NUR die statischen Dateien data/*.json (der bereinigte Schnappschuss); es wird nichts gesendet. Jede Zahl stammt aus diesen Dateien; was dort fehlt, wird nicht gezeigt.
   Der Bauer (pawn-render.js) wird live als Obsidian-Skulptur gezeichnet. Motion (vendor/motion.js) animiert nur transform / opacity; bei reduzierter Bewegung ist alles statisch. Die Zahlen haengen nie von der Animation ab und werden nie hochgezaehlt. */

(function () {
  "use strict";
  const BASE = /\/static\/premium\//.test(location.pathname) ? "../../data/" : "../data/", REFRESH_MS = 60000, DELAY_S = 300, STALE_S = 900, PROJECT = { ref: "c0", base: 2000, goal: 4000, milestones: [2200, 2500, 3000, 3500, 4000] };
  const M = window.Motion, mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false }, motionOk = () => !!(M && M.animate) && !mq.matches, EASE = [0.22, 1, 0.36, 1];
  const $ = (s, e) => (e || document).querySelector(s), $$ = (s, e) => Array.from((e || document).querySelectorAll(s));
  const nf = new Intl.NumberFormat("de-DE"), n1 = (x, d) => Number(x).toLocaleString("de-DE", { minimumFractionDigits: d == null ? 1 : d, maximumFractionDigits: d == null ? 1 : d });
  const sg = (x, d) => (x > 0 ? "+" : x < 0 ? "−" : "±") + n1(Math.abs(x), d == null ? 1 : d);
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) { if (v === false || v == null) continue; if (k === "class") el.className = v; else if (k.startsWith("on")) el.addEventListener(k.slice(2), v); else el.setAttribute(k, v === true ? "" : v); }
    for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
    return el;
  }
  const NS = "http://www.w3.org/2000/svg";
  function sv(tag, attrs, ...kids) { const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v); kids.flat().forEach((c) => c != null && el.append(c.nodeType ? c : document.createTextNode(String(c)))); return el; }
  async function J(p) { const r = await fetch(BASE + p + (p.includes("?") ? "&" : "?") + "t=" + Date.now(), { cache: "no-store" }); if (!r.ok) throw new Error(p + " " + r.status); return r.json(); }
  const date = (t) => String(t || "").replace("T", " ").slice(0, 16), day = (t) => String(t || "").slice(0, 10).split("-").reverse().join("."), hhmm = (t) => String(t || "").slice(11, 16);
  const pe = (elo) => PROJECT.base + Math.round(elo);
  const resTxt = (r) => (r === "1-0" ? "1–0" : r === "0-1" ? "0–1" : r === "1/2-1/2" ? "½–½" : "–");
  const short = (s) => String(s || "?").replace(/ \(.*$/, "").replace(/^sf19-elo2400$/, "Stockfish 19 (2400)");
  const PIECE = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
  const de = (s) => String(s).replace(/(Freigabe beendet: )?the arena release expired at (\S+)/, (m, a, t) => "Freigabe abgelaufen am " + date(t));
  const outcomeCls = (g) => { const w = /^c1\b/.test(g.white), b = /^c1\b/.test(g.black); if (g.result === "1/2-1/2" || (!w && !b)) return ""; return (g.result === "1-0") === w ? "good" : "bad"; };
  const vw = () => Math.max(300, Math.min(window.innerWidth || 380, 1480));

  /* ---------- icons and the pawn ---------- */
  const ICON = { arrow: ["M5 12h14", "M13 6l6 6-6 6"], star: ["M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"], first: ["M6 5v14", "M18 6l-8 6 8 6z"], prev: ["M16 6l-8 6 8 6z"], next: ["M8 6l8 6-8 6z"], last: ["M18 5v14", "M6 6l8 6-8 6z"], play: ["M7 5l12 7-12 7z", "M7 5v14"], dl: ["M12 4v11", "M7 11l5 5 5-5", "M5 20h14"], close: ["M6 6l12 12", "M18 6L6 18"], crown: ["M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z", "M5 21h14"] };
  function icon(name) { const s = sv("svg", { class: "i", viewBox: "0 0 24 24", "aria-hidden": "true" }); (ICON[name] || []).forEach((d) => s.append(sv("path", { d }))); return s; }
  /* ---------- motion helpers ---------- */
  const seen = new Map();
  function count(el, to, fmt) {                                                                      // count-up; a changed value counts from the old one
    el.textContent = fmt(to);                                                                        // kein Hochzaehlen: jede Zahl zeigt von der ersten Sekunde an den gemessenen Endwert
  }
  function settle(root, ms) { setTimeout(() => { try { root.getAnimations({ subtree: true }).forEach((a) => { if (a.playState === "running" && (a.currentTime || 0) < 2500 && a.effect && a.effect.getTiming && a.effect.getTiming().iterations !== Infinity) a.finish(); }); } catch (e) { /* nothing */ } }, ms || 2600); }
  function reveal(root) {                                                                            // sections flow in once when they scroll into view; never hidden before that
    const kids = Array.from(root.children); if (!motionOk() || !M.inView) return;
    M.inView(root, () => { M.animate(kids, { opacity: [0, 1], transform: ["translateY(26px)", "translateY(0px)"] }, { duration: 0.6, ease: EASE, delay: M.stagger(0.09) }); $$(".bar b", root).forEach((b) => { b.style.transformOrigin = "left center"; M.animate(b, { transform: ["scaleX(0)", "scaleX(1)"] }, { duration: 0.9, ease: EASE, delay: 0.35 }); }); $$("svg.evo .fadein", root).forEach((g, i) => M.animate(g, { opacity: [0, 1] }, { duration: 0.6, delay: 0.3 + i * 0.12 })); settle(root, 2800); }, { amount: 0.15 });
  }
  function slide(el, dx, dy) { if (!motionOk() || !el) return; M.animate(el, { transform: [`translate(${dx}px, ${dy}px)`, "translate(0px, 0px)"] }, { duration: 0.32, ease: EASE }); setTimeout(() => { try { el.getAnimations().forEach((a) => a.finish()); } catch (e) { /* ignore */ } }, 700); }

  /* ---------- board ---------- */
  function board(fen, last) {
    const rows = String(fen).split(" ")[0].split("/"), el = h("div", { class: "board", role: "img", "aria-label": "Schachbrett" }), hl = new Set(last ? [last.from, last.to] : []);
    rows.forEach((row, r) => { let f = 0; for (const ch of row) { if (/\d/.test(ch)) { for (let k = 0; k < +ch; k++) { el.append(sq(r, f, null, hl)); f++; } } else { el.append(sq(r, f, ch, hl)); f++; } } });
    return el;
  }
  function sq(r, f, ch, hl) { const name = "abcdefgh"[f] + (8 - r); return h("i", { class: ((r + f) % 2 ? "d" : "l") + (hl.has(name) ? " hl" : "") }, ch ? (window.ChessPieces ? ChessPieces.el(ch) : h("span", { class: ch === ch.toUpperCase() ? "pw" : "pb" }, PIECE[ch.toLowerCase()])) : null); }
  const evWhite = (m) => (!m ? null : m.mate ? (String(m.mate).startsWith("-") ? -1 : 1) * (m.color === "b" ? -1 : 1) * 99 : m.eval == null ? null : m.eval * (m.color === "b" ? -1 : 1));
  const evPct = (v) => (v == null ? 50 : Math.abs(v) >= 99 ? (v > 0 ? 100 : 0) : 50 + 50 * Math.tanh(v / 3));
  const evTxt = (v) => (v == null ? "–" : Math.abs(v) >= 99 ? (v > 0 ? "Matt für Weiß" : "Matt für Schwarz") : sg(v, 2));
  const wdlBar = (w, d, l) => h("div", { class: "bar", role: "img", "aria-label": `${w} Siege, ${d} Remis, ${l} Niederlagen` }, h("b", { class: "w", style: `width:${w / ((w + d + l) || 1) * 100}%` }), h("b", { class: "d", style: `width:${d / ((w + d + l) || 1) * 100}%` }), h("b", { class: "l", style: `width:${l / ((w + d + l) || 1) * 100}%` }));

  /* ---------- facts from the files ---------- */
  function facts(D) {
    const ov = D.overview, ev = ov.strength && ov.strength.champion_evidence, st = D.arena.stats, ch = ov.champion || {};
    const w = st.series.reduce((a, x) => a + x.w, 0), d = st.series.reduce((a, x) => a + x.d, 0), l = st.series.reduce((a, x) => a + x.l, 0);
    const calc = ev && ev.calc && ev.calc.elo != null && ev.reference === PROJECT.ref ? ev.calc : null;
    return { ev, st, ch, w, d, l, n: w + d + l, calc, elo: calc ? pe(calc.elo) : null, eloOf: (name) => (/^c0\b/.test(name) ? PROJECT.base : /^c1\b/.test(name) && calc ? pe(calc.elo) : null) };
  }


  const head = (k, t, p) => h("div", { class: "sh2" }, h("h3", {}, t), p ? h("p", { class: "muted" }, p) : null);
  const statusOf = (D) => { const age = D.age, ar = D.arena; if (age > STALE_S) return { cls: "warn", txt: "Offline", sub: "Letzte Daten vom " + date(D.meta.time) }; if (age > DELAY_S) return { cls: "warn", txt: "Verzögert", sub: "Stand " + hhmm(D.meta.time) + " Uhr" }; if (ar.alive) return { cls: "live", txt: "Live", sub: "Arena läuft" }; if (D.meta && D.meta.arena_mode === "ARENA_OFFLINE") return { cls: "", txt: "Live nicht öffentlich", sub: "Arena läuft · Stand " + hhmm(D.meta.time) + " Uhr" }; return { cls: "", txt: "Arena pausiert", sub: "Stand " + hhmm(D.meta.time) + " Uhr" }; };

  /* ---------- Hero: der Bauer, das Licht folgt dem Zeiger ---------- */
  const pawnState = { L: 0, tgt: 0, raf: 0, built: false };
  function pawnDraw(q) {
    const cv = $("#pawn"), wrap = $("#pawnwrap"); if (!cv || !wrap || !window.PawnRender) return;
    const r = wrap.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2), H = Math.round(Math.min(r.height * dpr, 1200) * q), W = Math.round(H * (r.width / r.height));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    PawnRender.render(cv, { light: pawnState.L });
  }
  function pawnTick() { pawnState.raf = 0; const d = pawnState.tgt - pawnState.L; if (Math.abs(d) < 0.004) { pawnState.L = pawnState.tgt; pawnDraw(1); return; } pawnState.L += d * 0.2; pawnDraw(0.5); pawnState.raf = requestAnimationFrame(pawnTick); }
  function initPawn() {
    const wrap = $("#pawnwrap"), hero = $("#hero"); if (!wrap || pawnState.built) return; pawnState.built = true;
    pawnState.L = motionOk() ? -0.9 : 0; pawnState.tgt = 0; pawnDraw(1);
    if (motionOk()) { M.animate(wrap, { opacity: [0, 1], transform: ["translateY(28px)", "translateY(0px)"] }, { duration: 1.1, ease: EASE }); setTimeout(() => { try { wrap.getAnimations().forEach((a) => a.finish()); } catch (e) { /* nothing */ } }, 1800); pawnState.raf = requestAnimationFrame(pawnTick); }   // beim Laden gleitet das Studiolicht einmal ueber die Figur
    hero.addEventListener("pointermove", (e) => { if (e.pointerType === "touch" || !motionOk()) return; const r = hero.getBoundingClientRect(); pawnState.tgt = ((e.clientX - r.left) / r.width - 0.5) * 1.4; if (!pawnState.raf) pawnState.raf = requestAnimationFrame(pawnTick); });
    let rz2 = null; window.addEventListener("resize", () => { clearTimeout(rz2); rz2 = setTimeout(() => pawnDraw(1), 200); });
  }
  /* Gespielte Partien: bei jedem Abruf (alle 60 s) aktualisiert; waechst die Zahl, blinkt sie kurz gruen und nennt den Zuwachs */
  let lastGames = null;
  function updateGames(D) {
    const dd = $("#keyfacts .games dd"), sm = $("#keyfacts .games small"); if (!dd) return;
    const c = D.count, total = c ? c.total : null;                                    // nur beendete, gespeicherte Partien (data/gamecount.json)
    if (total == null) { dd.textContent = "–"; sm.textContent = "Zählung nicht verfügbar"; return; }
    dd.textContent = nf.format(total); sm.textContent = "";
    if (lastGames != null && total > lastGames) { sm.textContent = `+${nf.format(total - lastGames)} neu`; if (motionOk()) M.animate(dd, { color: ["#3EE6A0", "#ffffff"] }, { duration: 1.6 }); }
    lastGames = total;
  }
  function renderHero(D, F) {
    $("#elo").textContent = F.elo != null ? nf.format(F.elo) : "–";                                  // immer sofort der gemessene Endwert, nie hochgezaehlt
    $("#proof").replaceChildren(...(F.calc ? [h("span", { class: "chip good" }, `${sg(F.calc.elo, 0)} Elo gegen ${F.ev.reference}`), h("span", {}, `95-%-Konfidenz: ${sg(F.calc.lo, 0)} … ${sg(F.calc.hi, 0)}`), h("i", { class: "vbar", "aria-hidden": "true" }), h("span", {}, `${nf.format(F.ev.games)} Partien`)] : [h("span", {}, "Messung nicht verfügbar")]));
    const nodes = (D.lineage.chain && D.lineage.chain.nodes) || [], ref = nodes.find((n) => n.is_reference), cand = nodes.filter((n) => n.status === "EVALUATED").pop(), st = statusOf(D);
    const kf = (l, v, s, cls) => h("div", { class: "kf " + (cls || "") }, h("dt", {}, l), h("dd", {}, v), s ? h("small", {}, s) : null);
    $("#keyfacts").replaceChildren(
      kf("Gespielte Partien", "–", "wird geladen", "games"),
      ref ? kf("Referenz der Linie", ref.generation_id, ref.result && ref.result.n_pairs ? `${sg(ref.result.elo)} Elo gegen ${ref.result.reference}` : "akzeptiert") : null,
      kf("Aktive Engine", F.ch.current || "–", F.elo != null ? `Champion · ${nf.format(F.elo)} Elo` : "Champion"),
      kf("Status", st.txt, st.cls === "live" ? st.sub : (st.txt === "Arena pausiert" || st.txt === "Live nicht öffentlich") ? st.sub : st.sub.replace("Letzte Daten vom", "Letzte Daten:"), st.cls));
    updateGames(D);
    initPawn();
    if (!heroBuilt && motionOk()) { heroBuilt = true; M.animate([".hero-copy", "#keyfacts"].map((s) => $(s)), { opacity: [0, 1], transform: ["translateY(18px)", "translateY(0px)"] }, { duration: 0.7, ease: EASE, delay: M.stagger(0.12, { startDelay: 0.1 }) }); settle($("#hero"), 2600); }      /* nur zwei Bloecke bewegen sich (Regel: 1 bis 2 Schluesselelemente je Ansicht) */
  }
  let heroBuilt = false;

  /* ---------- Engine Evolution ---------- */
  function renderVersions(D) {
    const ch = D.lineage.chain, ph = ch.placeholders || [], body = $("#versBody"), champ = D.overview.champion || {};
    const tl = h("ol", { class: "tl" });
    ph.slice().reverse().forEach((p) => tl.append(h("li", { class: "tn plan" }, h("span", { class: "pt" }), h("div", {}, h("div", { class: "trow" }, h("b", { class: "tid" }, p), h("span", { class: "tel" }, "–"), h("span", { class: "chip" }, "Geplant"))))));
    ch.nodes.slice().reverse().forEach((n) => {
      const r = n.result, ref = n.is_reference, accepted = n.status === "ACCEPTED" || n.status === "BASELINE", bad = /REJECT|FAIL/.test(n.status), cand = n.status === "EVALUATED";
      tl.append(h("li", { class: "tn" + (ref ? " ref" : "") }, h("span", { class: "pt" }), h("div", {}, h("div", { class: "trow" }, h("b", { class: "tid" }, n.generation_id), h("span", { class: "tel" }, r && r.n_pairs ? sg(r.elo) + " Elo" : n.status === "BASELINE" ? "Ausgangsbasis" : "–"),
        h("span", { class: "chip " + (accepted ? "good" : bad ? "bad" : "warn") }, n.status === "BASELINE" ? "Trainiert" : cand ? "Kandidat · nicht akzeptiert" : n.label)),
        ref ? h("div", { class: "badge" }, icon("star"), "Referenz der Linie · beste akzeptierte Version") : null, h("div", { class: "muted small" }, r && r.n_pairs ? `gegen ${r.reference} · ${r.n_pairs * 2} Partien` : (n.claim && n.claim.text) || ""), r && r.n_pairs ? h("div", { class: "ci" }, `Konfidenzintervall ${n1(r.lo, 0)} … ${n1(r.hi, 0)}${r.final ? "" : " · Look " + (r.look || 1)}`) : null)));
    });
    const legend = h("div", { class: "legend" }, h("span", {}, h("i", { style: "background:#35D69A" }), "akzeptiert"), h("span", {}, h("i", { style: "background:#A7B9D5" }), "bewertet, Kandidat"), h("span", {}, h("i", { style: "background:#ff6b7a" }), "verworfen"), h("span", {}, h("i", { style: "background:#7589a8" }), "geplant"));
    body.replaceChildren(h("div", { class: "vers" },
      h("div", { class: "card flat" }, h("h3", { class: "ct" }, "Relative Verbesserung je Generation"), evoChart(ch.nodes, ph), legend),
      h("div", {}, h("div", { class: "who3" }, h("div", {}, h("span", { class: "k" }, "Aktiv"), h("b", {}, champ.current || "–")), h("div", {}, h("span", { class: "k" }, "Referenz der Linie"), h("b", {}, ch.reference || "–")), h("div", {}, h("span", { class: "k" }, "Kandidat"), h("b", {}, (ch.nodes.filter((n) => n.status === "EVALUATED").pop() || {}).generation_id || "–"))),
        h("p", { class: "muted small" }, `Aktiv ist die Engine ${champ.current || "–"}${champ.created ? " (Champion seit " + day(champ.created) + ")" : ""}. T1 bis T3 sind Generationen der Lernlinie: Sie wurden gemessen, laufen aber nicht als aktive Engine.`), tl,
        ch.next_step ? h("div", { class: "note" }, h("b", {}, "Nächster Schritt: "), ch.next_step.text) : null)));
    reveal(body);
  }

  /* ---------- Elo Performance: echte Messreihe, interaktiv ---------- */
  function renderPerf(D, S) {
    const body = $("#perfBody"), recs = S && S.groups ? S.groups.flatMap((g) => g.records || []).filter((r) => r.reliable && r.calc && r.calc.n).sort((a, b) => String(a.time).localeCompare(String(b.time))) : [];
    if (!recs.length) { body.replaceChildren(h("p", { class: "muted" }, "Keine vergleichbare Messreihe vorhanden.")); return; }
    const bw = body.clientWidth || vw() - 40, W = Math.max(300, Math.round(bw >= 980 ? (bw - 36) * 0.636 - 56 : bw - 40)), Ht = W < 520 ? 360 : 460, P = { l: 52, r: 14, t: 14, b: 40 };
    const vals = recs.flatMap((r) => [r.calc.lo, r.calc.hi, 0]), mn = Math.floor((Math.min(...vals) - 8) / 100) * 100, mx = Math.ceil((Math.max(...vals) + 8) / 100) * 100, n = recs.length;
    const X = (i) => P.l + (n === 1 ? 0.5 : i / (n - 1)) * (W - P.l - P.r), Y = (v) => P.t + (mx - v) / (mx - mn) * (Ht - P.t - P.b);
    const col = (r) => (/besser/.test(r.verdict) ? "#35D69A" : /schlecht|schwäch|verlor/.test(r.verdict || "") ? "#ff6b7a" : "#C9CFD8");
    const svg = sv("svg", { class: "perf", viewBox: `0 0 ${W} ${Ht}`, role: "group", "aria-label": "Gemessene relative Elo je Test mit Konfidenzintervall, chronologisch" });
    const stepV = W < 480 ? 200 : mx - mn > 400 ? 100 : 50; for (let v = Math.ceil(mn / stepV) * stepV; v <= mx; v += stepV) svg.append(sv("line", { x1: P.l, x2: W - P.r, y1: Y(v), y2: Y(v), stroke: v === 0 ? "rgba(201,207,216,.55)" : "rgba(255,255,255,.07)", "stroke-dasharray": v === 0 ? "4 5" : "0" }), sv("text", { x: P.l - 10, y: Y(v) + 4, "text-anchor": "end", "font-size": 13, fill: "#8EA0BF" }, (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v)));
    const ticks = Math.min(W < 480 ? 3 : 5, n); for (let k = 0; k < ticks; k++) { const i = Math.round(k * (n - 1) / Math.max(1, ticks - 1)); svg.append(sv("text", { x: X(i), y: Ht - 12, "text-anchor": k === 0 ? "start" : k === ticks - 1 ? "end" : "middle", "font-size": 13, fill: "#8EA0BF" }, day(recs[i].time).slice(0, 5))); }
    const detail = h("div", { class: "pdet", "aria-live": "polite" }); let active = -1;
    const subj = (t) => { t = String(t || "").replace(/ \(.*$/, ""); return t.length > 46 ? t.slice(0, 44) + "…" : t; }, isChamp = (r) => /^c1( |$)/.test(r.subject) && /^c0( |$)/.test(r.reference) && !/\+|Param/.test(String(r.subject));
    const show = (i) => {
      const r = recs[i], c = r.calc, champ = isChamp(r); active = i; $$(".pt", svg).forEach((g, k) => g.classList.toggle("on", k === i));
      detail.replaceChildren(h("div", { class: "pk" }, `Messung ${i + 1} von ${n} · ${day(r.time)}`), h("div", { class: "pv" }, `${sg(c.elo)} Elo`), h("div", { class: "pc" }, `95-%-Konfidenz ${n1(c.lo, 0)} … ${n1(c.hi, 0)}`),
        h("div", { class: "pr" }, h("b", { title: r.subject }, subj(r.subject)), " gegen ", h("b", {}, short(r.reference)), r.uncalibrated_reference ? h("span", { class: "muted" }, " (nicht kalibrierter Gegner)") : null), h("div", { class: "muted small" }, champ ? "Champion-Messung: c1 gegen den Vorgänger c0" : r.source === "lab" && /\+|Param/.test(String(r.subject)) ? "Labor-Experiment: Parameter-Variante, keine neue Engine-Version" : "Messung " + (r.source || "")), wdlBar(r.w, r.d, r.l), h("div", { class: "muted small" }, `${r.w} Siege · ${r.d} Remis · ${r.l} Niederlagen · ${nf.format(r.games)} Partien`),
        h("div", { class: "muted small" }, `Ergebnis: ${r.verdict}${r.experiment ? " · " + r.experiment : ""}`), h("div", { class: "dim small" }, r.condition));
    };
    recs.forEach((r, i) => { const c = r.calc, R = Math.max(4, Math.min(8, 3 + r.games / 250)), g = sv("g", { class: "pt", tabindex: 0, role: "img", "aria-label": `${short(r.subject)} gegen ${short(r.reference)}: ${sg(c.elo)} Elo, ${nf.format(r.games)} Partien, ${r.verdict}` });
      g.append(sv("rect", { class: "band", x: X(i) - 7, y: Y(c.hi), width: 14, height: Math.max(2, Y(c.lo) - Y(c.hi)), rx: 7, fill: col(r), "fill-opacity": 0.16 }), sv("line", { x1: X(i), x2: X(i), y1: Y(c.lo), y2: Y(c.hi), stroke: col(r), "stroke-width": 2, "stroke-opacity": 0.7, "stroke-linecap": "round" }), sv("circle", { cx: X(i), cy: Y(c.elo), r: R + 9, fill: "transparent" }), sv("circle", { class: "dot", cx: X(i), cy: Y(c.elo), r: R, fill: "#070D1B", stroke: col(r), "stroke-width": isChamp(r) ? 4 : 2.6 }));
      g.addEventListener("pointerenter", () => show(i)); g.addEventListener("focus", () => show(i)); g.addEventListener("click", () => show(i));
      g.addEventListener("keydown", (e) => { const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : e.key === "Home" ? -n : e.key === "End" ? n : 0; if (!d) return; e.preventDefault(); const pts = $$(".pt", svg), nx = Math.max(0, Math.min(n - 1, e.key === "Home" ? 0 : e.key === "End" ? n - 1 : i + d)); if (pts[nx]) pts[nx].focus(); });      // Pfeiltasten wandern von Messpunkt zu Messpunkt
      svg.append(g); });
    const legend = h("div", { class: "legend" }, h("span", {}, h("i", { style: "background:#35D69A" }), "besser (Konfidenz über 0)"), h("span", {}, h("i", { style: "background:#C9CFD8" }), "unentschieden"), h("span", {}, h("i", { style: "background:#ff6b7a" }), "schlechter"), h("span", { class: "legband" }, h("i", { class: "bandkey" }), "Band = 95-%-Konfidenzbereich der Messung"));
    body.replaceChildren(h("div", { class: "perfgrid" }, h("div", { class: "card flat" }, svg, legend), h("div", { class: "card flat" }, detail)), h("p", { class: "muted small foot3" }, `${S.totals.reliable} von ${S.totals.records} Messungen sind verlässlich (mindestens ${S.min_games_reliable} Partien). Insgesamt ${nf.format(S.totals.games)} Testpartien. Werte verschiedener Gegner und Bedingungen sind nicht auf einer gemeinsamen Skala vergleichbar. ${S.absolute_scale && S.absolute_scale.reason ? S.absolute_scale.reason : ""}`));
    const tbl = h("details", { class: "tbl" }, h("summary", {}, `Alle ${n} Messungen als Tabelle`), h("div", { class: "tbl-s" }, h("table", {}, h("thead", {}, h("tr", {}, ["Datum", "Test", "Elo", "95-%-Konfidenz", "Partien", "Ergebnis"].map((t) => h("th", { scope: "col" }, t)))),
      h("tbody", {}, recs.slice().reverse().map((r) => h("tr", {}, h("td", {}, day(r.time)), h("td", { title: r.subject }, `${subj(r.subject)} gegen ${short(r.reference)}`), h("td", {}, sg(r.calc.elo)), h("td", {}, `${n1(r.calc.lo, 0)} … ${n1(r.calc.hi, 0)}`), h("td", {}, nf.format(r.games)), h("td", {}, r.verdict)))))));
    body.append(tbl);                                                                                 // Tabelle als Alternative zum Diagramm (Tastatur, Screenreader, Farbe nicht noetig)
    const ci = recs.findIndex((r) => isChamp(r) && r.time === (S.champion_evidence || {}).time); show(ci >= 0 ? ci : n - 1); reveal(body);
  }

  /* ---------- Road to 4000: Gemessenes links, Vision rechts ---------- */
  function renderRoad(D, F) {
    const e = F.elo, span = PROJECT.goal - PROJECT.base, p = e == null ? 0 : Math.max(0, Math.min(1, (e - PROJECT.base) / span)), body = $("#wegBody"), left = e == null ? 0 : e;
    const marks = [[2000, "Start", "c0"], [2200, "2.200", ""], [2500, "2.500", ""], [3000, "3.000", ""], [3500, "3.500", ""], [4000, "4.000", "Ziel"]];
    const road = h("div", { class: "road", role: "img", "aria-label": `Gemessen ${e == null ? "unbekannt" : nf.format(e)} Elo, Ziel ${PROJECT.goal}. ${n1(p * 100)} Prozent des Weges.` },
      h("div", { class: "rd-now", style: `left:${p * 100}%` }, h("b", {}, e != null ? nf.format(e) : "–"), h("small", {}, "gemessen")),
      h("div", { class: "rd-line" }, h("i", { class: "rd-done", style: `width:${p * 100}%` }), h("i", { class: "rd-vision", style: `left:${p * 100}%` })),
      marks.map(([m, t, s]) => h("div", { class: "rd-tick" + (m === PROJECT.goal ? " goal" : m === 2000 ? " first" : "") + (m === 2200 || m === 3500 ? " minor" : ""), style: `left:${(m - PROJECT.base) / span * 100}%` }, h("i"), h("b", {}, m === 2000 ? "2.000" : t), s ? h("small", {}, s) : null)),
      h("div", { class: "rd-cap" }, "Vision · noch nicht erreicht"));
    const num = (l, v, s) => h("div", { class: "rn" }, h("div", { class: "l" }, l), h("div", { class: "v" }, v), h("div", { class: "s" }, s));
    const nf_ = D.lineage.planning && D.lineage.planning.no_forecast;
    body.replaceChildren(road, h("div", { class: "rnums" }, num("Gemessen", e != null ? nf.format(e) : "–", "Elo, Projekt-Skala"), num("Anteil des Weges", n1(p * 100) + " %", "von 2.000 bis 4.000"), num("Bis zur Vision", e != null ? nf.format(PROJECT.goal - left) : "–", "Elo Abstand zu 4.000")),
      h("p", { class: "muted road-note" }, "4.000 ist ein Ziel, kein Ergebnis. Es gibt keine Prognose, wann oder ob es erreicht wird. " + (nf_ || "")));
    reveal(body);
  }

  /* ---------- Mission ---------- */
  function renderMission(D, S) {
    const body = $("#missionBody"), tot = S && S.totals, champ = D.overview.champion || {};
    const col = (t, p) => h("div", { class: "mcol" }, h("h3", {}, t), h("p", {}, p));
    const st = (v, l) => h("div", { class: "mst" }, h("b", {}, v), h("span", {}, l));
    body.replaceChildren(h("p", { class: "mbig" }, "Eine Schachengine soll lernen, sich selbst zu verbessern. Jede Behauptung muss gemessen werden."),
      h("div", { class: "mcols" }, col("Selbstspiel statt Vorgaben", "Die Engine spielt gegen sich selbst. Aus diesen Partien entstehen die Trainingsdaten für das Bewertungsnetz."), col("Messen vor Behaupten", "Jede neue Generation tritt nach einem festen Plan gegen ihre Referenz an. Sie zählt erst, wenn das Konfidenzintervall sie trägt."), col("Ehrliche Zahlen", "Alle Werte sind relative Elo auf der Projekt-Skala. Es gibt keine kalibrierte absolute Skala und keine Prognose.")),
      h("div", { class: "mstats" }, st(D.count ? nf.format(D.count.total) : "–", "Beendete Partien"), tot ? st(nf.format(tot.games), "Testpartien in Messungen") : null, tot ? st(`${tot.reliable} von ${tot.records}`, "Messungen verlässlich") : null, champ.created ? st(day(champ.created), `Champion ${champ.current || ""}`) : null),
      h("p", { class: "mend" }, "PROJECT ELO 4000 — The pursuit of 4000."));
    reveal(body);
  }

  /* ---------- Game Explorer ---------- */
  let shown = 9, gq = "", gf = "all";
  function renderGames(D, F) {
    const gs = D.games.games, body = $("#gamesBody"), grid = h("div", { class: "gg" }), more = h("div", { class: "moreRow" }), cnt = h("span", { class: "muted" });
    const pass = (g) => gf === "all" || (gf === "win" && outcomeCls(g) === "good") || (gf === "draw" && g.result === "1/2-1/2") || (gf === "loss" && outcomeCls(g) === "bad");
    const paint = () => {
      const q = gq.trim().toLowerCase(), list = gs.filter((g) => pass(g) && (!q || `${short(g.white)} ${short(g.black)} ${g.date || ""} ${g.termination || ""}`.toLowerCase().includes(q)));
      grid.replaceChildren(...list.slice(0, shown).map((g) => h("button", { class: "gc", onclick: () => openGame(g.id, F) }, h("span", { class: "who" }, `${short(g.white)} – ${short(g.black)}`), h("span", { class: "chip " + outcomeCls(g) }, resTxt(g.result)), h("span", { class: "meta" }, `${String(g.date || "").split(".").reverse().join(".")} · ${g.tc || ""} · ${g.termination || ""}`))));
      cnt.textContent = `${list.length} von ${gs.length} Partien`; more.replaceChildren(shown < list.length ? h("button", { class: "btn", onclick: () => { shown += 12; paint(); } }, `Mehr anzeigen (${list.length - shown})`) : "");
      if (!list.length) grid.append(h("p", { class: "muted" }, "Keine Partie passt zu Filter und Suche."));
    };
    const seg = (k, t) => h("button", { class: "segb" + (gf === k ? " on" : ""), "aria-pressed": String(gf === k), onclick: (e) => { gf = k; shown = 9; $$(".segb", body).forEach((b) => { const on = b === e.currentTarget; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); }); paint(); } }, t);
    const search = h("input", { type: "search", class: "search", placeholder: "Suche nach Gegner, Datum, Ausgang", "aria-label": "Partien durchsuchen", value: gq, oninput: (e) => { gq = e.target.value; shown = 9; paint(); } });
    body.replaceChildren(h("div", { class: "gtools" }, search, h("div", { class: "seg", role: "group", "aria-label": "Ergebnis filtern" }, seg("all", "Alle"), seg("win", "Siege"), seg("draw", "Remis"), seg("loss", "Niederlagen")), cnt), grid, more);
    paint(); reveal(body);
  }

  /* ---------- one game ---------- */
  /* ---------- Zugqualitaet (aus den eigenen Suchbewertungen der beiden Engines in der Partie; keine unabhaengige Analyse) ---------- */
  const CATS = [["best", "★", "Beste Züge", "#2fd07a"], ["excellent", "!", "Hervorragend", "#7ed957"], ["good", "✓", "Gute Züge", "#a8bf4a"], ["inacc", "?!", "Ungenauigkeiten", "#f2c744"], ["mistake", "?", "Fehler", "#f28b3c"], ["blunder", "??", "Patzer", "#f0605d"]];
  const winPct = (cp) => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
  function analyse(g) {
    const cp = g.moves.map((m) => m.mate ? (String(m.mate).startsWith("-") ? -1 : 1) * 1000 : m.eval != null ? Math.max(-1000, Math.min(1000, Math.round(m.eval * 100))) : null);
    const per = [], side = { w: { acc: [], cat: {} }, b: { acc: [], cat: {} } };
    CATS.forEach(([k]) => { side.w.cat[k] = 0; side.b.cat[k] = 0; });
    for (let i = 0; i < g.moves.length; i++) {
      const own = cp[i], nxt = cp[i + 1]; if (own == null || nxt == null) { per.push(null); continue; }
      const loss = Math.max(0, winPct(own) - winPct(-nxt)), acc = Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * loss) - 3.1669));
      const cat = loss <= 1 ? "best" : loss <= 3 ? "excellent" : loss <= 7 ? "good" : loss <= 12 ? "inacc" : loss <= 20 ? "mistake" : "blunder", c = g.moves[i].color;
      side[c].acc.push(acc); side[c].cat[cat]++; per.push({ cat, loss });
    }
    const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
    return { per, w: { acc: mean(side.w.acc), cat: side.w.cat, n: side.w.acc.length }, b: { acc: mean(side.b.acc), cat: side.b.cat, n: side.b.acc.length }, n: side.w.acc.length + side.b.acc.length };
  }
  function qualityCard(g, a, W, B) {
    if (!a || a.n < 4) return h("div", { class: "qual" }, h("h3", {}, "Zugqualität"), h("p", { class: "muted small" }, "Für diese Partie liegen zu wenige Bewertungen vor."));
    const pc = (x) => (x == null ? "–" : x.toFixed(1).replace(".", ",") + " %"), row = (nm, side) => h("div", { class: "qacc" }, h("div", { class: "qh" }, h("span", {}, nm), h("b", {}, pc(side.acc))), h("div", { class: "qt" }, h("i", { style: `width:${side.acc || 0}%` })));
    return h("div", { class: "qual" }, h("div", { class: "qtop" }, h("h3", {}, "Zugqualität"), h("span", { class: "muted small" }, `${a.n} Züge bewertet`)),
      h("div", { class: "qpair" }, row("Weiß · " + W, a.w), row("Schwarz · " + B, a.b)),      // links Weiß, rechts Schwarz: je ein Feld mit der Prozentzahl
      h("table", { class: "qcats" }, h("thead", {}, h("tr", {}, h("th", {}, ""), h("th", {}, "Weiß"), h("th", {}, "Schwarz"))),
        h("tbody", {}, CATS.map(([k, sym, name, col]) => h("tr", {}, h("td", {}, h("span", { class: "qi", style: `background:${col}` }, sym), name), h("td", {}, String(a.w.cat[k])), h("td", {}, String(a.b.cat[k])))))),
      h("p", { class: "muted small qnote" }, "Einstufung nach Verlust an Gewinnchance je Zug, aus den eigenen Suchbewertungen der beiden Engines. Keine unabhängige Analyse. Der letzte Zug wird nicht bewertet."));
  }
  /* Zugbewertung als Zeichen: Kreis mit dunklem Rand, ragt aus der oberen rechten Ecke des Zielfelds (Vorlage); als SVG, damit es mit der Feldgroesse mitwaechst */
  function badge(qc) {
    const sym = qc[1], star = sym === "★", pts = Array.from({ length: 10 }, (_, i) => { const r = i % 2 ? 11 : 27, a = -Math.PI / 2 + i * Math.PI / 5; return (50 + r * Math.cos(a)).toFixed(1) + "," + (53 + r * Math.sin(a)).toFixed(1); }).join(" ");
    const size = sym.length > 1 ? 40 : sym === "✓" ? 46 : 60;
    const svg = sv("svg", { viewBox: "0 0 100 100", "aria-hidden": "true" }, sv("circle", { cx: 50, cy: 50, r: 43, fill: qc[3], stroke: "#0F1A2E", "stroke-width": 9 }),
      star ? sv("polygon", { points: pts, fill: "#0a0f18" }) : sv("text", { x: 50, y: 52, "text-anchor": "middle", "dominant-baseline": "central", "font-size": size, "font-weight": 800, fill: "#0a0f18", "font-family": "Inter, 'Segoe UI Symbol', sans-serif" }, sym));
    return h("span", { class: "qbadge", title: qc[2], role: "img", "aria-label": qc[2] }, svg);
  }
  function gameView(g, F, opt) {
    opt = opt || {}; const hd = g.headers || {}, W = short(hd.White), B = short(hd.Black), n = g.fens.length - 1;
    let ply = opt.startAtEnd ? n : 0, prevPly = null, timer = null;
    const player = (name, color) => h("div", { class: "player" }, h("span", { class: "dot " + color }), h("div", { class: "grow" }, h("b", {}, name), h("div", { class: "muted" }, color === "w" ? "Weiß" : "Schwarz")), F.eloOf(name) != null ? h("span", { class: "pelo" }, nf.format(F.eloOf(name))) : null);
    const host = h("div", {}), ebar = h("div", { class: "ebar", title: "Bewertung aus Sicht von Weiß" }, h("i", {})), evl = h("span", {}), plyl = h("span", {}), mv = h("div", { class: "moves" });
    const tcTxt = (opt.info && opt.info.tc) || hd.TimeControl || "", term = (opt.info && opt.info.termination) || hd.Termination || "";
    const status = h("div", { class: "gstatus" }, opt.noChip ? null : h("span", { class: "chip big " + (opt.cls || "") }, resTxt(g.result)), h("span", { class: "muted" }, [opt.stateTxt, tcTxt ? "Rapid " + tcTxt : "", term].filter(Boolean).join(" · ")));
    const idx = (s) => (8 - parseInt(s[1], 10)) * 8 + "abcdefgh".indexOf(s[0]);
    const draw = () => {
      const m = ply ? g.moves[ply - 1] : null, v = evWhite(m); host.replaceChildren(board(g.fens[ply], m)); ebar.firstChild.style.height = evPct(v) + "%"; evl.textContent = ply ? "Bewertung " + evTxt(v) : "Startstellung";
      const qm = m && qa.per[ply - 1], qc = qm && CATS.find((c) => c[0] === qm.cat);      // Zugbewertung als Zeichen auf dem Zielfeld der bewegten Figur
      if (qc && m.to) { const bd = host.firstChild, cell = bd && bd.children[idx(m.to)]; if (cell) cell.append(badge(qc)); }
      plyl.textContent = `Zug ${ply} / ${n}` + (m ? " · " + m.san : "") + (qc ? " · " + qc[2] : "");
      if (prevPly != null && Math.abs(ply - prevPly) === 1) { const mm = g.moves[Math.max(ply, prevPly) - 1], fwd = ply > prevPly, from = fwd ? mm.from : mm.to, to = fwd ? mm.to : mm.from, bd = host.firstChild, cell = bd && bd.children[idx(to)], piece = cell && cell.firstChild;
        if (piece && from && to) { const w = bd.clientWidth / 8; slide(piece, ("abcdefgh".indexOf(from[0]) - "abcdefgh".indexOf(to[0])) * w, (parseInt(to[1], 10) - parseInt(from[1], 10)) * w); } }       // the moved piece glides over
      prevPly = ply; mv.querySelectorAll("button").forEach((b) => b.classList.toggle("cur", +b.dataset.p === ply)); const cur = mv.querySelector("button.cur"); if (cur) { mv.scrollTop = Math.max(0, cur.offsetTop - mv.offsetTop - mv.clientHeight / 2); if (mv.scrollWidth > mv.clientWidth + 2) mv.scrollLeft = Math.max(0, cur.offsetLeft - mv.offsetLeft - mv.clientWidth / 2 + cur.offsetWidth / 2); }      // Handy: die Zugliste ist ein waagerechter Streifen, der aktuelle Zug bleibt in der Mitte
    };
    const go = (k) => { ply = Math.max(0, Math.min(k, n)); draw(); }, stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    const startPlay = () => { if (timer) return; timer = setInterval(() => { if (ply >= n) { stop(); if (root.__onend) root.__onend(); } else go(ply + 1); }, 1000); };      // 1 s pro Zug; am Ende meldet die Partie sich zurueck (Wiedergabeliste)
    const qa = analyse(g); g.moves.forEach((x, qi) => { if (x.color === "w") mv.append(h("span", {}, Math.ceil(x.ply / 2) + ".")); mv.append(h("button", { "data-p": x.ply, "data-q": qa.per[qi] ? qa.per[qi].cat : null, onclick: () => { stop(); go(x.ply); } }, x.san)); });
    const cb = (ic, label, fn, cls) => h("button", { class: cls || "", onclick: fn, "aria-label": label, title: label }, icon(ic));
    const ctrl = h("div", { class: "ctrl" }, cb("first", "Anfang", () => { stop(); go(0); }), cb("prev", "Zurück", () => { stop(); go(ply - 1); }), cb("play", "Abspielen", () => { if (timer) stop(); else { if (ply >= n) go(0); startPlay(); } }, "play"), cb("next", "Weiter", () => { stop(); go(ply + 1); }), cb("last", "Ende", () => { stop(); go(n); }));
    const bw = h("div", { class: "bwrap" }, ebar, host); let x0 = null;
    bw.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    bw.addEventListener("touchend", (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 40) { stop(); go(ply + (dx < 0 ? 1 : -1)); } }, { passive: true });
    const root = h("div", { class: "gv" }, h("div", {}, status, player(B, "b"), bw, player(W, "w"), h("div", { class: "foot-line" }, evl, plyl), ctrl), h("div", { class: "gv-side" }, qualityCard(g, qa, W, B), h("h3", {}, "Zugliste"), mv, h("button", { class: "btn", onclick: () => downloadPgn(g, opt.id || "partie") }, icon("dl"), "PGN herunterladen")));
    root.__stop = stop; root.__start = () => { stop(); go(0); startPlay(); }; root.__playing = () => !!timer; setTimeout(draw, 0); return root;
  }

  /* ---------- Match ---------- */
  const AUTO = { on: true };
  function renderMatch(D, F) {
    const body = $("#matchBody"), lv = D.live, g = lv && lv.game; if (!g || !g.fens || !g.fens.length) { body.replaceChildren(head("Live-Match", "Keine Partie vorhanden")); return; }
    if (AUTO.on && body.__gv && body.__gv.isConnected) { body.querySelectorAll("[data-key]").forEach((e) => { if (F[e.dataset.key] != null) e.textContent = F[e.dataset.key]; }); if (AUTO.sync) AUTO.sync(D, F); return; }      // die Wiedergabe laeuft: ein Datenstand-Wechsel setzt sie nicht zurueck, nur die Zaehler werden aktualisiert
    const alive = D.arena.alive && D.fresh, info = lv.info || {}, hd = g.headers || {}, l = (g.moves || []).filter((m) => m.eval != null || m.mate).pop();
    const gv = gameView(g, F, { startAtEnd: true, info, cls: outcomeCls({ white: hd.White, black: hd.Black, result: g.result }), stateTxt: alive ? "läuft" : "beendet", id: "arena-letzte", noChip: true });
    const vs = h("div", { class: "vsbar" }, h("div", {}, h("div", { class: "nm" }, short(hd.White)), h("div", { class: "muted" }, F.eloOf(short(hd.White)) != null ? nf.format(F.eloOf(short(hd.White))) + " Elo" : "Weiß")), h("div", { class: "sc" }, resTxt(g.result)), h("div", { class: "r" }, h("div", { class: "nm" }, short(hd.Black)), h("div", { class: "muted" }, F.eloOf(short(hd.Black)) != null ? nf.format(F.eloOf(short(hd.Black))) + " Elo" : "Schwarz")));
    const left = h("div", { class: "card" }, vs, gv);
    const right = h("div", {}, h("div", { class: "wdl" }, h("div", { class: "w" }, h("b", { "data-key": "w" }, F.w), h("span", {}, "Siege")), h("div", {}, h("b", { "data-key": "d" }, F.d), h("span", {}, "Remis")), h("div", { class: "l" }, h("b", { "data-key": "l" }, F.l), h("span", {}, "Niederlagen"))), h("div", { class: "card" }, h("h3", { style: "margin:0 0 12px;font-size:12.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim)" }, `Arena · ${nf.format(F.st.totals.scored)} Partien`), wdlBar(F.w, F.d, F.l),
      F.st.series.map((x) => h("div", { class: "kv", style: "margin-top:14px" }, h("span", {}, `gegen ${short(x.opponent_name)}`), h("span", {}, `${x.w} · ${x.d} · ${x.l}`))), F.st.series.some((x) => x.uncalibrated) ? h("p", { class: "muted", style: "font-size:12.5px;margin:12px 0 0" }, "Stockfish im Schwächemodus (UCI_Elo): nicht kalibriert, nur ein relatives Ergebnis.") : null,
      h("div", { class: "kv" }, h("span", {}, "Engine-Bewertung (Weiß)"), h("span", {}, evTxt(evWhite(l))), h("span", {}, "Suchtiefe letzter Zug"), h("span", {}, l && l.depth != null ? String(l.depth) : "–"), h("span", {}, "Hauptvariante · Nodes/s"), h("span", {}, "nicht erfasst"))),
      null);
    body.replaceChildren(h("div", { class: "mt" }, left, right));
    right.remove();      // die Karte "Arena · 314 Partien" (Reihen je Gegner, Engine-Bewertung, Suchtiefe) ist entfernt; die Siege/Remis/Niederlagen-Kacheln stehen bereits oberhalb des Bretts
    if (body.__stop) body.__stop(); body.__stop = gv.__stop; body.__gv = gv; reveal(body);
    /* Wiedergabeliste: die laufende bzw. letzte Partie und die juengsten Arena-Partien nacheinander, 1 s pro Zug (nur Wiedergabe gespeicherter Zuege, keine eigene Rechnung) */
    const mkQueue = (gm, DD) => [gm.id || "arena-letzte"].concat(((DD.games && DD.games.games) || []).filter((x) => x.kind === "arena" && x.id !== gm.id).slice(0, 8).map((x) => x.id));
    let queue = mkQueue(g, D), curId = queue[0], jump = false;
    const lbl = h("span", { class: "muted" }), tog = h("button", { class: "btn", type: "button" }), pv = h("button", { class: "btn", type: "button", "aria-label": "Vorige Partie" }, "‹"), nx = h("button", { class: "btn", type: "button", "aria-label": "Nächste Partie" }, "›");
    const bar = h("div", { class: "autobar" }, tog, pv, nx, lbl); left.insertBefore(bar, left.children[1]);
    let cur = gv, qi = 0, tok = 0, gLive = g;
    const upd = () => { tog.textContent = AUTO.on ? "Pause" : "Automatisch abspielen"; lbl.textContent = `Partie ${qi + 1} / ${queue.length} · 1 s pro Zug`; };
    async function show(i, tries) {
      const my = ++tok; qi = ((i % queue.length) + queue.length) % queue.length; curId = queue[qi]; let gg = qi === 0 ? gLive : null;
      if (!gg) { try { gg = await J("game/" + encodeURIComponent(queue[qi]) + ".json"); } catch (e) { gg = null; } if (my !== tok) return; if (!gg || !gg.ok) { if ((tries || 0) < queue.length) return show(qi + 1, (tries || 0) + 1); return; } }
      const hd2 = gg.headers || {}, nv = gameView(gg, F, { id: queue[qi], cls: outcomeCls({ white: hd2.White, black: hd2.Black, result: gg.result }), stateTxt: qi === 0 ? (alive ? "läuft" : "letzte Partie") : String(hd2.Date || "").split(".").reverse().join("."), info: qi === 0 ? info : null, noChip: qi === 0 });
      nv.__onend = () => { if (AUTO.on && my === tok) setTimeout(() => { if (AUTO.on && my === tok) { const j = jump; jump = false; show(j ? 0 : qi + 1); } }, 3500); };
      if (cur.__stop) cur.__stop(); vs.style.display = qi === 0 ? "" : "none"; cur.replaceWith(nv); cur = nv; body.__stop = nv.__stop; body.__gv = nv; if (AUTO.on) nv.__start(); upd();
    }
    tog.onclick = () => { AUTO.on = !AUTO.on; if (AUTO.on) show(qi); else { tok++; if (cur.__stop) cur.__stop(); upd(); } };
    pv.onclick = () => show(qi - 1); nx.onclick = () => show(qi + 1);
    upd(); if (AUTO.on) show(0);
    AUTO.sync = (DD) => {      // eine Partie wurde beendet / ein neuer Datenstand kam: Liste neu aufbauen, die neueste Partie kommt nach der laufenden dran
      const lg = DD.live && DD.live.game; if (!lg || !lg.fens || !lg.fens.length) return; const nq = mkQueue(lg, DD), fresh = nq[0] !== queue[0];
      gLive = lg; queue = nq; const k = queue.indexOf(curId); qi = k >= 0 ? k : qi; if (fresh) { jump = true; if (qi === 0) qi = 1; }
      if (fresh && !cur.__playing()) { jump = false; show(0); } upd();
    };
  }

  function evoChart(nodes, placeholders) {
    const rows = placeholders.slice().reverse().map((p) => ({ id: p, plan: true })).concat(nodes.slice().reverse().map((n) => ({ id: n.generation_id, n, r: n.result && n.result.n_pairs ? n.result : null })));
    const all = rows.filter((x) => x.r).flatMap((x) => [x.r.lo, x.r.hi, x.r.elo, 0]), mn = Math.floor((Math.min(...all) - 10) / 50) * 50, mx = Math.ceil((Math.max(...all) + 10) / 50) * 50;
    const W = Math.min(560, vw() - 70), RH = 48, T = 6, LB = 54, RB = 80, H = T + rows.length * RH + 26, X = (v) => LB + (v - mn) / (mx - mn) * (W - LB - RB);
    const svg = sv("svg", { class: "evo", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Relative Elo-Verbesserung je Version mit Konfidenzintervall" });
    const stepE = W < 480 ? 100 : 50; for (let v = Math.ceil(mn / stepE) * stepE; v <= mx; v += stepE) svg.append(sv("line", { x1: X(v), x2: X(v), y1: T, y2: H - 22, stroke: v === 0 ? "rgba(167,185,213,.5)" : "rgba(255,255,255,.06)", "stroke-dasharray": v === 0 ? "3 4" : "0" }), sv("text", { x: X(v), y: H - 6, "text-anchor": "middle", "font-size": 11, fill: "#7589a8" }, (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v)));
    rows.forEach((x, i) => {
      const y = T + i * RH + RH / 2, acc = x.n && (x.n.status === "ACCEPTED" || x.n.status === "BASELINE"), bad = x.n && /REJECT|FAIL/.test(x.n.status), col = acc ? "#35D69A" : bad ? "#ff6b7a" : "#A7B9D5";
      svg.append(sv("text", { x: 0, y: y + 5, "font-size": 16, "font-weight": 700, fill: x.plan ? "#7589a8" : "#F4F7FF" }, x.id + (x.n && x.n.is_reference ? " ★" : "")));
      if (x.plan) { svg.append(sv("text", { x: LB, y: y + 4, "font-size": 12.5, fill: "#7589a8" }, "geplant")); return; }
      if (!x.r) { svg.append(sv("text", { x: LB, y: y + 4, "font-size": 12.5, fill: "#7589a8" }, "Ausgangsbasis")); return; }
      const r = x.r, g = sv("g", { class: "fadein" });
      g.append(sv("line", { x1: X(r.lo), x2: X(r.hi), y1: y, y2: y, stroke: col, "stroke-opacity": ".55", "stroke-width": 4, "stroke-linecap": "round" }), sv("circle", { cx: X(r.elo), cy: y, r: 7, fill: "#070D1B", stroke: col, "stroke-width": 3.5 }), sv("text", { x: W, y: y + 5, "text-anchor": "end", "font-size": 14, "font-weight": 700, fill: "#F4F7FF" }, sg(r.elo) + " Elo"));
      svg.append(g);
    });
    return svg;
  }


  async function openGame(id, F) {
    const m = $("#modal"); m.hidden = false; m.replaceChildren(h("div", { class: "sheet" }, h("p", { class: "muted" }, "Lade Partie…")));
    let g; try { g = await J("game/" + encodeURIComponent(id) + ".json"); } catch (e) { g = { ok: false }; }
    const close = () => { if (m.__gv) m.__gv.__stop(); m.hidden = true; m.replaceChildren(); };
    if (!g.ok) { m.replaceChildren(h("div", { class: "sheet" }, h("div", { class: "top" }, h("h3", {}, "Partie"), h("button", { class: "btn", onclick: close }, icon("close"), "Schließen")), h("p", { class: "muted" }, "Diese Partie ist in der gehosteten Kopie nicht enthalten."))); return; }
    const hd = g.headers || {}, gv = gameView(g, F, { id, cls: outcomeCls({ white: hd.White, black: hd.Black, result: g.result }), stateTxt: String(hd.Date || "").split(".").reverse().join(".") }); m.__gv = gv;
    m.replaceChildren(h("div", { class: "sheet" }, h("div", { class: "top" }, h("h3", {}, `${short(hd.White)} – ${short(hd.Black)}`), h("button", { class: "btn", onclick: close }, icon("close"), "Schließen")), gv));
    m.onclick = (e) => { if (e.target === m) close(); };
  }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#modal").hidden) { const b = $("#modal .btn"); if (b) b.click(); } const k = e.key === "ArrowRight" ? "Weiter" : e.key === "ArrowLeft" ? "Zurück" : null; if (k) { const b = document.querySelector(`.ctrl button[aria-label=${k}]`); if (b) b.click(); } });


  /* ---------- PGN ---------- */
  function pgnOf(g) {
    const hd = g.headers || {}, tags = ["Event", "Date", "White", "Black", "Result", "TimeControl", "Termination"].filter((k) => hd[k]).map((k) => `[${k} "${String(hd[k]).replace(/"/g, "'")}"]`), std = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    if (g.start_fen && g.start_fen !== std) tags.push(`[SetUp "1"]`, `[FEN "${g.start_fen}"]`);
    const sb = (g.start_fen || "").split(" ")[1] === "b", body = g.moves.map((m, i) => (m.color === "w" ? `${Math.floor((m.ply + (sb ? 1 : 0)) / 2 + (sb ? 0 : 0.5))}. ` : (i === 0 ? `${Math.ceil(m.ply / 2)}... ` : "")) + m.san).join(" ");
    return tags.join("\n") + "\n\n" + body + " " + (g.result || "*") + "\n";
  }
  function downloadPgn(g, id) { const a = h("a", { href: URL.createObjectURL(new Blob([pgnOf(g)], { type: "application/x-chess-pgn" })), download: id + ".pgn" }); document.body.append(a); a.click(); a.remove(); }

  /* ---------- status, load ---------- */
  function header(D) {
    const st = $("#state"), up = $("#updated"), age = D.age, ar = D.arena; let cls, txt;
    if (age > STALE_S) { cls = "warn"; txt = "Offline"; } else if (age > DELAY_S) { cls = "warn"; txt = "Verzögert"; } else if (ar.alive) { cls = "live"; txt = "Live"; } else { cls = ""; txt = (D.meta && D.meta.arena_mode === "ARENA_OFFLINE") ? "Live nicht öffentlich" : "Arena pausiert"; }
    const prev = st.dataset.s; st.className = "pill " + cls; st.textContent = txt; st.dataset.s = txt; if (prev && prev !== txt && motionOk()) M.animate(st, { transform: ["scale(.92)", "scale(1)"], opacity: [0.4, 1] }, { duration: 0.3, ease: EASE });
    up.textContent = (age > DELAY_S ? "Stand " : "aktualisiert ") + hhmm(D.meta.time) + " Uhr";
    const b = $("#banner"); if (b) b.hidden = true;      // der Hinweis zu alten Daten ist entfernt; der Status oben und in der Kennzahlenleiste nennt den Stand
  }



  /* ---------- 48-h-Laeufe: je Charta nur Partienzahl, Siege / Remis / Niederlagen und laeuft / angehalten (data/runresults.json); fehlt die Datei, erscheint nichts ---------- */
  function renderRuns(rr) {
    const body = $("#matchBody"); if (!body) return; let box = $("#runsBody");
    if (!rr || !rr.runs || !rr.runs.length) { if (box) box.remove(); return; }
    if (!box) { box = h("div", { id: "runsBody", style: "margin-bottom:28px" }); body.parentNode.insertBefore(box, body); }
    box.replaceChildren(...rr.runs.map((r) => {
      const n = r.w + r.d + r.l, played = r.played == null ? n : r.played;
      return h("div", { class: "card", style: "margin-bottom:14px", "data-run": r.charter_id }, h("h3", { style: "margin:0 0 6px" }, `${r.charter_id} · ${r.running ? "läuft" : "angehalten"}`),
        h("p", { class: "muted", style: "margin:0 0 12px" }, `${nf.format(played)} Partien gespielt` + (played !== n ? ` · Tabelle: ${nf.format(n)} aus abgeschlossenen Matches` : "")),
        h("div", { class: "wdl" }, [["w", "Siege"], ["d", "Remis"], ["l", "Niederlagen"]].map(([k, t]) => h("div", { class: k }, h("b", {}, nf.format(r[k])), h("span", {}, t)))));
    }));
  }

  /* ---------- Laden ---------- */
  let DATA = null;
  function renderAll(D) { const F = facts(D), S = D.strength; renderHero(D, F); renderVersions(D); renderPerf(D, S); renderMatch(D, F); renderGames(D, F); renderRoad(D, F); renderMission(D, S); if (window.PremiumMobile) PremiumMobile.enhance(); }
  async function load(first) {
    try {
      const [meta, arena, live, overview, lineage, games] = await Promise.all(["meta", "arena", "live", "overview", "lineage", "games"].map((n) => J(n + ".json")));
      let strength = null; try { strength = await J("strength.json"); } catch (e) { strength = null; }
      const age = Date.now() / 1000 - meta.epoch, sig = (gm, lv) => ((gm.games || [])[0] || {}).id + "|" + (gm.games || []).length + "|" + ((lv.game || {}).id) + "|" + (((lv.game || {}).moves || []).length), changed = !DATA || DATA.meta.epoch !== meta.epoch || sig(DATA.games, DATA.live) !== sig(games, live);
      let count = null; try { count = await J("gamecount.json"); } catch (e) { count = null; }
      DATA = { meta, arena, live, overview, lineage, games, strength, count, age, fresh: age <= STALE_S }; header(DATA);
      if (first || changed) renderAll(DATA); else updateGames(DATA);
      let runs = null; try { runs = await J("runresults.json"); } catch (e) { runs = null; }
      try { renderRuns(runs); } catch (e) { /* der Lauf-Block darf die Seite nie stoeren */ }
    } catch (e) { const b = $("#banner"); b.hidden = false; b.textContent = "Daten nicht erreichbar (" + e.message + "). Es wird erneut versucht."; }
  }
  const nav = $("#nav"); const onScroll = () => nav.classList.toggle("solid", window.scrollY > 40); window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
  let rz = null, lastW = vw(); window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { if (Math.abs(vw() - lastW) > 40 && DATA) { lastW = vw(); renderAll(DATA); } }, 250); });
  { const btn = $("#menubtn"), sheet = $("#mnav");                                                    // Handy-Menue: Knopf oeffnet eine Liste aller Bereiche
    const setMenu = (open) => { if (!btn || !sheet) return; sheet.hidden = !open; btn.setAttribute("aria-expanded", String(open)); btn.setAttribute("aria-label", open ? "Menü schließen" : "Menü öffnen"); document.body.classList.toggle("menu-open", open); };
    if (btn && sheet) { btn.addEventListener("click", () => setMenu(sheet.hidden)); sheet.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); }); document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !sheet.hidden) { setMenu(false); btn.focus(); } }); window.addEventListener("resize", () => { if (window.innerWidth >= 860) setMenu(false); }); } }
  load(true); setInterval(() => load(false), REFRESH_MS);
})();
