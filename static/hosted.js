/* The hosted (GitHub Pages) copy of the Live Control Center: the same page, fed by static files instead of a server. Loaded BEFORE app.js.
   It maps the page's /api/... requests to data/*.json, replaces the live event stream by nothing, and says honestly how old the data are (stale after 15 minutes: the PC is off or offline).
   Read-only by construction: every request is a GET of a static file; nothing is ever sent anywhere. */
(function () {
  "use strict";
  const REFRESH_MS = 60000;
  window.HOSTED_MODE = true;
  window.HOSTED = null;
  const real = window.fetch.bind(window);
  let gamesCache = null, gamesFor = null;

  const j = (obj, status) => new Response(JSON.stringify(obj), { status: status || 200, headers: { "Content-Type": "application/json" } });
  const file = (rel) => real("data/" + rel + (rel.indexOf("?") < 0 ? "?t=" + (window.HOSTED ? window.HOSTED.epoch : 0) : ""), { cache: "no-store" });

  async function games(qs) {
    if (!gamesCache || gamesFor !== (window.HOSTED && window.HOSTED.epoch)) {
      const r = await file("games.json");
      if (!r.ok) return r;
      gamesCache = await r.json(); gamesFor = window.HOSTED && window.HOSTED.epoch;
    }
    const p = new URLSearchParams(qs || ""), q = (p.get("q") || "").toLowerCase().slice(0, 60), result = p.get("result") || "", kind = p.get("kind") || "", tc = p.get("tc") || "";
    let rows = gamesCache.games;
    if (q) rows = rows.filter((g) => (g.white + " " + g.black + " " + g.event + " " + g.experiment + " " + g.date).toLowerCase().indexOf(q) >= 0);
    if (result) rows = rows.filter((g) => g.result === result);
    if (kind) rows = rows.filter((g) => g.kind === kind);
    if (tc) rows = rows.filter((g) => g.tc === tc);
    const offset = Math.max(0, parseInt(p.get("offset") || "0", 10) || 0), limit = Math.max(1, Math.min(100, parseInt(p.get("limit") || "30", 10) || 30));
    return j({ total: rows.length, offset: offset, games: rows.slice(offset, offset + limit), facets: gamesCache.facets, kind_labels: gamesCache.kind_labels, sources: gamesCache.sources, hosted_note: gamesCache.note });
  }

  window.fetch = function (input, init) {
    const s = typeof input === "string" ? input : (input && input.url) || "";
    const m = /^\/api\/([a-z]+)(?:\/([^?]*))?(?:\?(.*))?$/.exec(s);
    if (!m) return real(input, init);
    const name = m[1], arg = m[2], qs = m[3];
    if (name === "games") return games(qs);
    if (name === "game" && arg && /^[A-Za-z0-9_.-]+$/.test(arg)) return file("game/" + arg + ".json").then((r) => r.ok ? r : j({ ok: false, error: "Diese Partie ist in der gehosteten Kopie nicht enthalten (nur die neuesten Partien und die Arena-Partien)." }));
    if (name === "pgn" && arg && /^[A-Za-z0-9_.-]+$/.test(arg)) return file("pgn/" + arg + ".txt");
    if (/^(overview|research|strength|arena|live|livestate|lineage|version|learn|experiments|match)$/.test(name) && !arg) return file(name + ".json");
    return Promise.resolve(j({ error: "in der gehosteten Kopie nicht vorhanden" }, 404));
  };
  window.EventSource = function () { return { addEventListener: function () {}, close: function () {}, onerror: null }; };    // no live stream: the page is refreshed from the files every minute

  window.HOSTED_AGE_S = function () { return window.HOSTED ? Date.now() / 1000 - window.HOSTED.epoch : null; };
  async function loadMeta(first) {
    try {
      const r = await real("data/meta.json?t=" + Date.now(), { cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const meta = await r.json(), changed = !window.HOSTED || window.HOSTED.epoch !== meta.epoch;
      window.HOSTED = meta;
      if (changed && !first) window.dispatchEvent(new Event("hashchange"));                      // new data: the page re-reads its files (same code path as navigating)
    } catch (e) { /* the header keeps its last state: it turns to PC offline when the data get old */ }
  }
  loadMeta(true);                                                                                  // this script sits at the end of <body>: the header exists already
  setInterval(() => loadMeta(false), REFRESH_MS);
})();
