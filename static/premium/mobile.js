/* PROJECT ELO 4000 - Handyansicht, Verhalten (nur unter 860 px). Motion (vendor/motion.js, Framer Motion ohne React) fuer: Tab-Anzeige per Feder, Blatt "Mehr", Fortschrittslinie,
   Hero-Parallaxe, Einblenden (einmal, 14 px), Druck-Rueckmeldung. Ohne Motion oder bei reduzierter Bewegung ist alles sofort sichtbar und bedienbar. Die Zahlen haengen nie von der Bewegung ab. */
(function () {
  "use strict";
  const mqM = window.matchMedia ? window.matchMedia("(max-width: 859px)") : { matches: false }, mqR = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  const M = window.Motion, motionOk = () => !!(M && M.animate) && !mqR.matches, EASE = [0.22, 1, 0.36, 1];
  const $ = (s, e) => (e || document).querySelector(s), $$ = (s, e) => Array.from((e || document).querySelectorAll(s));
  const ICON = {
    start: '<path d="M3.5 11 12 3.5 20.5 11"/><path d="M5.5 9.5V20h4.5v-5.5h4V20h4.5V9.5"/>',
    arena: '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M12 4v16M4 12h16"/>',
    evo: '<path d="M5 20v-8M12 20V4M19 20v-5"/>',
    perf: '<path d="M3 17l5-5 4 4 8-9"/><path d="M15 7h5v5"/>',
    more: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>'
  };
  const TABS = [
    { id: "top", key: "start", label: "Start", sections: ["hero"] }, { id: "arena", key: "arena", label: "Arena", sections: ["arena"] },
    { id: "evolution", key: "evo", label: "Evolution", sections: ["evolution"] }, { id: "performance", key: "perf", label: "Daten", sections: ["performance"] },
    { id: "more", key: "more", label: "Mehr", sections: ["partien", "road", "mission"] }
  ];
  let built = false, tabbar, ind, sheet, shade, current = "top", sheetOpen = false;
  const els = {};

  function place(instant) {
    const t = els[current]; if (!t || !ind) return; const w = Math.max(40, t.offsetWidth - 6), x = t.offsetLeft + 3;
    if (instant || !motionOk()) { ind.style.width = w + "px"; ind.style.transform = `translateX(${x}px)`; return; }
    M.animate(ind, { transform: `translateX(${x}px)`, width: w + "px" }, { type: "spring", stiffness: 420, damping: 36 });
  }
  function setActive(id) {
    if (id === current && ind && ind.style.width) return; current = id;
    TABS.forEach((t) => { const el = els[t.id]; if (!el) return; if (t.id === id) el.setAttribute("aria-current", "true"); else el.removeAttribute("aria-current"); });
    place(false);
  }
  function scrollToId(id) {
    const behavior = mqR.matches ? "auto" : "smooth";
    if (id === "top") { window.scrollTo({ top: 0, behavior }); return; }
    const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior, block: "start" });
  }
  function openSheet() {
    if (sheetOpen) return; sheetOpen = true; shade.hidden = false; sheet.hidden = false; document.body.style.overflow = "hidden"; $("#mnavMoreBtn") && $("#mnavMoreBtn").setAttribute("aria-expanded", "true");
    if (motionOk()) { M.animate(shade, { opacity: [0, 1] }, { duration: 0.2 }); M.animate(sheet, { transform: ["translateY(100%)", "translateY(0%)"] }, { type: "spring", stiffness: 380, damping: 40 }); }
    const a = $("a", sheet); if (a) a.focus({ preventScroll: true });
  }
  function closeSheet(after) {
    if (!sheetOpen) return; sheetOpen = false; document.body.style.overflow = ""; $("#mnavMoreBtn") && $("#mnavMoreBtn").setAttribute("aria-expanded", "false");
    const done = () => { shade.hidden = true; sheet.hidden = true; sheet.style.transform = ""; if (after) after(); };
    if (motionOk()) { M.animate(shade, { opacity: [1, 0] }, { duration: 0.18 }); const a = M.animate(sheet, { transform: ["translateY(0%)", "translateY(100%)"] }, { duration: 0.22, ease: EASE }); if (a && a.then) a.then(done); else setTimeout(done, 240); setTimeout(() => { if (!sheet.hidden) done(); }, 600); }
    else done();
  }
  function linkProgress(bar) {
    try { if (motionOk() && M.scroll) { M.scroll(M.animate(bar, { transform: ["scaleX(0)", "scaleX(1)"] }, { ease: "linear" })); return; } } catch (e) { /* Rueckfall unten */ }
    const f = () => { const h = document.documentElement.scrollHeight - innerHeight; bar.style.transform = `scaleX(${h > 0 ? Math.min(1, scrollY / h) : 0})`; };
    window.addEventListener("scroll", f, { passive: true }); f();
  }
  function parallax() {
    const hero = $("#hero"), img = $(".hero-pawn img"); if (!hero || !img || !motionOk() || !M.scroll || parallax.on) return; parallax.on = true;
    try { M.scroll((p) => { img.style.transform = `translate3d(0,${(p * 44).toFixed(1)}px,0) scale(${(1 + p * 0.05).toFixed(3)})`; }, { target: hero, offset: ["start start", "end start"] }); } catch (e) { /* ohne Parallaxe */ }
  }
  function build() {
    if (built) return; built = true;
    tabbar = document.createElement("nav"); tabbar.className = "tabbar"; tabbar.setAttribute("aria-label", "Hauptnavigation");
    ind = document.createElement("i"); ind.className = "tabind"; ind.setAttribute("aria-hidden", "true"); tabbar.append(ind);
    TABS.forEach((t) => {
      const el = document.createElement(t.id === "more" ? "button" : "a"); el.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICON[t.key] + "</svg><span>" + t.label + "</span>";
      if (t.id === "more") { el.type = "button"; el.id = "mnavMoreBtn"; el.setAttribute("aria-haspopup", "dialog"); el.setAttribute("aria-expanded", "false"); el.addEventListener("click", () => (sheetOpen ? closeSheet() : openSheet())); }
      else { el.href = "#" + (t.id === "top" ? "top" : t.id); el.addEventListener("click", (e) => { e.preventDefault(); if (sheetOpen) closeSheet(); scrollToId(t.id); setActive(t.id); }); }
      els[t.id] = el; tabbar.append(el);
    });
    shade = document.createElement("div"); shade.className = "mshade"; shade.hidden = true; shade.addEventListener("click", () => closeSheet());
    sheet = document.createElement("div"); sheet.className = "msheet"; sheet.hidden = true; sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-modal", "true"); sheet.setAttribute("aria-label", "Weitere Bereiche");
    sheet.innerHTML = '<div class="grab"></div><h2>Weitere Bereiche</h2><a href="#partien"><i>04</i>Game Explorer</a><a href="#road"><i>05</i>Road to 4000</a><a href="#mission"><i>06</i>The Mission</a>';
    sheet.addEventListener("click", (e) => { const a = e.target.closest("a"); if (!a) return; e.preventDefault(); const id = a.getAttribute("href").slice(1); closeSheet(() => { scrollToId(id); setActive("more"); }); });
    let y0 = null; sheet.addEventListener("pointerdown", (e) => { y0 = e.clientY; }); sheet.addEventListener("pointerup", (e) => { if (y0 != null && e.clientY - y0 > 70) closeSheet(); y0 = null; });       // nach unten wischen schliesst
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && sheetOpen) { closeSheet(); const b = $("#mnavMoreBtn"); if (b) b.focus(); } });
    document.body.append(tabbar, shade, sheet);
    const nav = $("#nav"); if (nav) { const bar = document.createElement("i"); bar.className = "topprog"; bar.setAttribute("aria-hidden", "true"); nav.append(bar); linkProgress(bar); }
    if (window.IntersectionObserver) {                                                                      // der aktive Tab folgt dem Scrollen
      const map = new Map(); TABS.forEach((t) => t.sections.forEach((s) => map.set(s, t.id)));
      const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting && !sheetOpen) { const id = map.get(e.target.id); if (id) setActive(id); } }), { rootMargin: "-42% 0px -52% 0px" });
      $$("#hero, main > section.sec").forEach((s) => io.observe(s));
    }
    setActive("top"); place(true); window.addEventListener("resize", () => place(true)); window.addEventListener("orientationchange", () => setTimeout(() => place(true), 250));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => place(true));
    parallax();
  }
  function dots() {
    const kf = $("#keyfacts"); if (!kf || !kf.children.length) return; const n = kf.children.length; let d = $(".kfdots");
    if (!d || d.children.length !== n) { if (d) d.remove(); d = document.createElement("div"); d.className = "kfdots"; d.setAttribute("aria-hidden", "true"); for (let i = 0; i < n; i++) d.append(document.createElement("i")); kf.after(d); }
    kf.__upd = () => { const w = kf.firstElementChild.getBoundingClientRect().width + 10, i = Math.min(n - 1, Math.round(kf.scrollLeft / (w || 1))); Array.from(d.children).forEach((x, k) => x.classList.toggle("on", k === i)); };
    if (!kf.__dots) { kf.__dots = true; kf.addEventListener("scroll", () => { cancelAnimationFrame(kf.__r); kf.__r = requestAnimationFrame(() => kf.__upd && kf.__upd()); }, { passive: true }); }
    kf.__upd();
  }
  function details() {                                                                                      // die Tabelle der Zugkategorien klappt ein: auf dem Handy zaehlt zuerst die Genauigkeit
    $$(".qcats").forEach((t) => {
      if (t.closest(".mdet")) return; const note = t.nextElementSibling && t.nextElementSibling.classList.contains("qnote") ? t.nextElementSibling : null;
      const d = document.createElement("details"), s = document.createElement("summary"); d.className = "mdet"; s.textContent = "Zugkategorien im Detail"; t.before(d); d.append(s, t); if (note) d.append(note);
    });
  }
  function reveal() {
    if (!motionOk() || !M.inView) return;
    const list = $$(".sh, .vers > *, .perfgrid > *, .qual, .gc, .rn, .mcol, .mst").filter((e) => !e.dataset.rv); if (!list.length) return; list.forEach((e) => { e.dataset.rv = "1"; });
    M.inView(list, (el) => { M.animate(el, { opacity: [0, 1], transform: ["translateY(14px)", "translateY(0px)"] }, { duration: 0.45, ease: EASE }); }, { amount: 0.15 });
    setTimeout(() => { try { document.getAnimations().forEach((a) => { if (a.playState === "running" && typeof a.currentTime === "number" && a.currentTime < 2500 && a.effect && a.effect.getTiming && a.effect.getTiming().iterations !== Infinity) a.finish(); }); } catch (e) { /* nichts */ } }, 3000);
  }
  function press() {
    if (!motionOk() || !M.press) return; const list = $$(".btn, .tabbar a, .tabbar button, .gc, .segb, .ctrl button").filter((e) => !e.__p); if (!list.length) return; list.forEach((e) => { e.__p = 1; });
    M.press(list, (el) => { M.animate(el, { scale: 0.96 }, { duration: 0.12 }); return () => M.animate(el, { scale: 1 }, { duration: 0.22 }); });
  }
  function enhance() { if (!mqM.matches) return; build(); dots(); details(); reveal(); press(); }
  window.PremiumMobile = { enhance };
  if (mqM.addEventListener) mqM.addEventListener("change", () => { if (mqM.matches) enhance(); else if (sheetOpen) closeSheet(); });
  enhance();
})();
