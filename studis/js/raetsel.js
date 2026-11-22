// SchuBe Studis – Denkaufgaben (Neun Punkte, Zehn Münzen)
// Interaktiv auf dem Handy + statische Grafiken (Aufgabe/Lösung) für die Live-Ansicht.
(function () {
  "use strict";
  const SB = (window.SB = window.SB || {});
  const NS = "http://www.w3.org/2000/svg";

  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function svgPunkt(svg, evt) {
    const p = svg.createSVGPoint(); p.x = evt.clientX; p.y = evt.clientY;
    const m = svg.getScreenCTM(); if (!m) return { x: 0, y: 0 };
    const q = p.matrixTransform(m.inverse());
    return { x: q.x, y: q.y };
  }
  function h(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }

  const AUFGABEN = {
    punkte: { titel: "Neun Punkte", auftrag: "Verbinde alle neun Punkte mit <b>vier geraden Linien</b>, ohne den Stift abzusetzen." },
    muenzen: { titel: "Zehn Münzen", auftrag: "Das Dreieck zeigt nach oben. Lass es nach <b>unten</b> zeigen – mit <b>höchstens drei Zügen</b>. Jedes Verschieben einer Münze ist ein Zug." },
  };
  SB.AUFGABEN = AUFGABEN;

  // ---------------- Geometrie Neun Punkte ----------------
  const P = { W: 340, H: 340, DOT_R: 15, HIT: 14, MIN_LEN: 14, KOLLINEAR_GRAD: 4, MAX: 4 };
  const DOTS = [];
  [100, 170, 240].forEach((y) => [100, 170, 240].forEach((x) => DOTS.push({ x, y })));
  const P_LOESUNG = [[30, 30], [240, 240], [30, 240], [240, 30], [240, 240]];

  function abstandSeg(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    let t = l2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(a.x + t * dx - p.x, a.y + t * dy - p.y);
  }

  // ---------------- Geometrie Zehn Münzen ----------------
  const M = { D: 52, R: 24, CX: 170, Y0: 36, W: 340, H: 300, ROW_MAX: 5, X2: 5, MAX: 3 };
  M.ZH = M.D * Math.sqrt(3) / 2;
  const START = [[1, 0], [2, -1], [2, 1], [3, -2], [3, 0], [3, 2], [4, -3], [4, -1], [4, 1], [4, 3]];
  const M_LOESUNG = [[2, -3], [2, -1], [2, 1], [2, 3], [3, -2], [3, 0], [3, 2], [4, -1], [4, 1], [5, 0]];
  const mPos = (r, x2) => ({ x: M.CX + x2 * M.D / 2, y: M.Y0 + r * M.ZH });
  const mGueltig = (r, x2) => r >= 0 && r <= M.ROW_MAX && x2 >= -M.X2 && x2 <= M.X2 && (((x2 + r) % 2) + 2) % 2 === 1;

  function istUmgekehrt(liste) { // liste: [{r,x2}]
    const reihen = {};
    liste.forEach((c) => (reihen[c.r] = reihen[c.r] || []).push(c.x2));
    const rs = Object.keys(reihen).map(Number).sort((a, b) => a - b);
    if (rs.length !== 4) return false;
    for (let i = 0; i < 4; i++) if (rs[i] !== rs[0] + i) return false;
    const b = Math.min.apply(null, reihen[rs[0]]);
    for (let k = 0; k < 4; k++) {
      const soll = []; for (let j = 0; j < 4 - k; j++) soll.push(b + k + 2 * j);
      const ist = reihen[rs[k]].slice().sort((a, c) => a - c);
      if (ist.length !== soll.length || ist.some((v, i) => v !== soll[i])) return false;
    }
    return true;
  }
  SB._istUmgekehrt = istUmgekehrt;

  function muenze(parent, x, y) {
    const g = el("g", { transform: `translate(${x},${y})` }, parent);
    el("circle", { cx: 0, cy: 0, r: M.R, fill: "#f2c94c", stroke: "#b8860b", "stroke-width": 2.5 }, g);
    el("circle", { cx: 0, cy: 0, r: M.R - 7, fill: "none", stroke: "#d9a92a", "stroke-width": 1.5 }, g);
    return g;
  }

  // ---------------- Statische Grafiken (Live-Ansicht) ----------------
  SB.raetselGrafik = function (art, mitLoesung) {
    if (art === "punkte") {
      const svg = el("svg", { viewBox: `0 0 ${P.W} ${P.H}`, class: "raetsel-grafik" });
      DOTS.forEach((d) => el("circle", { cx: d.x, cy: d.y, r: P.DOT_R, fill: "#b8bec7" }, svg));
      if (mitLoesung) el("polyline", { points: P_LOESUNG.map((p) => p.join(",")).join(" "), fill: "none", stroke: "#e04e1b", "stroke-width": 5, "stroke-linejoin": "round", "stroke-linecap": "round" }, svg);
      return svg;
    }
    const svg = el("svg", { viewBox: `0 0 ${M.W} ${M.H}`, class: "raetsel-grafik" });
    if (!mitLoesung) START.forEach(([r, x2]) => { const p = mPos(r, x2); muenze(svg, p.x, p.y); });
    else {
      const start = START.map((s) => s.join()), ziel = M_LOESUNG.map((s) => s.join());
      START.filter((s) => !ziel.includes(s.join())).forEach(([r, x2]) => { const p = mPos(r, x2); el("circle", { cx: p.x, cy: p.y, r: M.R, fill: "none", stroke: "#e04e1b", "stroke-width": 2, "stroke-dasharray": "5 5" }, svg); });
      M_LOESUNG.forEach(([r, x2]) => {
        const p = mPos(r, x2), g = muenze(svg, p.x, p.y);
        if (!start.includes([r, x2].join())) { g.firstChild.setAttribute("fill", "#e04e1b"); g.firstChild.setAttribute("stroke", "#a83a12"); g.lastChild.setAttribute("stroke", "#f08a63"); }
      });
    }
    return svg;
  };

  // ---------------- Interaktiv: Neun Punkte ----------------
  SB.spielPunkte = function (root, opt) {
    opt = opt || {};
    root.innerHTML = "";
    const auftrag = h("p", "auftrag"); auftrag.innerHTML = AUFGABEN.punkte.auftrag;
    const status = h("div", "r-status"); const sL = h("span"), sT = h("span"); status.append(sL, sT);
    const svg = el("svg", { viewBox: `0 0 ${P.W} ${P.H}`, class: "r-feld", "aria-label": "Spielfeld neun Punkte" });
    const knoepfe = h("div", "r-knoepfe"); const bUndo = h("button", "btn", "Letzte Linie weg"), bNeu = h("button", "btn", "Neu beginnen"); knoepfe.append(bUndo, bNeu);
    const msg = h("div", "r-meldung info");
    root.append(auftrag, status, svg, knoepfe, msg);

    const gLin = el("g", {}, svg), gDot = el("g", {}, svg), gTop = el("g", {}, svg);
    const dotEls = DOTS.map((d) => el("circle", { cx: d.x, cy: d.y, r: P.DOT_R, fill: "#b8bec7" }, gDot));
    const poly = el("polyline", { fill: "none", stroke: "#e04e1b", "stroke-width": 4, "stroke-linejoin": "round", "stroke-linecap": "round" }, gLin);
    const gummi = el("line", { stroke: "#e04e1b", "stroke-width": 4, "stroke-linecap": "round", "stroke-dasharray": "8 7", opacity: 0.75 }, gLin);
    const spitze = el("circle", { r: 7, fill: "#e04e1b", stroke: "#fff", "stroke-width": 2 }, gTop);

    let pts = [], akt = null, zieht = false, fertig = false, pid = null;
    const START_TEXT = "Setz den Finger aufs Feld und zieh die erste Linie. Jede weitere Linie beginnt dort, wo die letzte aufgehört hat.";
    function meldung(t, art) { msg.textContent = t; msg.className = "r-meldung " + art; }
    const klemmen = (p) => ({ x: Math.max(2, Math.min(P.W - 2, p.x)), y: Math.max(2, Math.min(P.H - 2, p.y)) });
    const segs = (l) => { const s = []; for (let i = 1; i < l.length; i++) s.push([l[i - 1], l[i]]); return s; };
    const treffer = (s) => DOTS.map((d) => s.some(([a, b]) => abstandSeg(d, a, b) <= P.HIT));
    const anz = (a) => a.filter(Boolean).length;

    function zeichnen() {
      poly.setAttribute("points", pts.map((p) => p.x + "," + p.y).join(" "));
      const sf = segs(pts), hf = treffer(sf);
      let hv = hf;
      if (zieht && pts.length && akt) {
        const a = pts[pts.length - 1];
        gummi.setAttribute("x1", a.x); gummi.setAttribute("y1", a.y); gummi.setAttribute("x2", akt.x); gummi.setAttribute("y2", akt.y);
        gummi.style.display = ""; hv = treffer(sf.concat([[a, akt]]));
      } else gummi.style.display = "none";
      dotEls.forEach((c, i) => c.setAttribute("fill", hf[i] ? "#e04e1b" : hv[i] ? "#f2a37f" : "#b8bec7"));
      const sp = zieht && akt ? akt : pts[pts.length - 1];
      if (sp && !fertig) { spitze.style.display = ""; spitze.setAttribute("cx", sp.x); spitze.setAttribute("cy", sp.y); } else spitze.style.display = "none";
      const lin = Math.max(0, pts.length - 1);
      sL.innerHTML = fertig ? "Linien: <b>" + lin + "</b>" : "Linie <b>" + Math.min(lin + 1, P.MAX) + "</b> von " + P.MAX;
      sT.innerHTML = "<b>" + anz(hf) + "</b> von 9 Punkten";
      bUndo.disabled = pts.length < 2;
    }
    function pruefen() {
      const n = anz(treffer(segs(pts))), lin = pts.length - 1;
      if (n === 9) {
        fertig = true;
        meldung("Geschafft! Alle neun Punkte mit " + lin + (lin === 1 ? " Linie" : " Linien") + " verbunden.", "ok");
        if (opt.onGeloest) opt.onGeloest();
      } else if (lin >= P.MAX) {
        fertig = true;
        meldung("Vier Linien sind gezogen, aber erst " + n + " von 9 Punkten verbunden. Versuch es nochmals.", "nein");
      } else meldung("Weiter: Die nächste Linie beginnt am roten Punkt.", "info");
    }
    function gleicheRichtung(a, b, c) {
      const v1x = b.x - a.x, v1y = b.y - a.y, v2x = c.x - b.x, v2y = c.y - b.y;
      const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
      if (!l1 || !l2) return false;
      return (v1x * v2x + v1y * v2y) / (l1 * l2) >= Math.cos(P.KOLLINEAR_GRAD * Math.PI / 180);
    }
    svg.addEventListener("pointerdown", (e) => {
      if (fertig || zieht) return;
      e.preventDefault(); zieht = true; pid = e.pointerId;
      try { svg.setPointerCapture(pid); } catch (_) {}
      const p = klemmen(svgPunkt(svg, e));
      if (!pts.length) pts = [p];
      akt = p; zeichnen();
    });
    svg.addEventListener("pointermove", (e) => {
      if (!zieht || e.pointerId !== pid) return;
      e.preventDefault(); akt = klemmen(svgPunkt(svg, e)); zeichnen();
    });
    function los(e) {
      if (!zieht || e.pointerId !== pid) return;
      zieht = false; pid = null;
      const a = pts[pts.length - 1], c = akt; akt = null;
      if (c && Math.hypot(c.x - a.x, c.y - a.y) >= P.MIN_LEN) {
        if (pts.length >= 2 && gleicheRichtung(pts[pts.length - 2], a, c)) pts[pts.length - 1] = c;
        else pts.push(c);
        pruefen();
      } else if (pts.length === 1) pts = [];
      zeichnen();
    }
    svg.addEventListener("pointerup", los);
    svg.addEventListener("pointercancel", los);
    bUndo.onclick = () => {
      if (pts.length <= 2) pts = []; else pts.pop();
      fertig = false;
      meldung(pts.length ? "Letzte Linie entfernt. Weiter am roten Punkt." : START_TEXT, "info");
      zeichnen();
    };
    bNeu.onclick = () => { pts = []; fertig = false; zieht = false; akt = null; meldung(START_TEXT, "info"); zeichnen(); };
    meldung(START_TEXT, "info");
    zeichnen();
  };

  // ---------------- Interaktiv: Zehn Münzen ----------------
  SB.spielMuenzen = function (root, opt) {
    opt = opt || {};
    root.innerHTML = "";
    const auftrag = h("p", "auftrag"); auftrag.innerHTML = AUFGABEN.muenzen.auftrag;
    const status = h("div", "r-status"); const sZ = h("span"); status.append(sZ, h("span"));
    const svg = el("svg", { viewBox: `0 0 ${M.W} ${M.H}`, class: "r-feld", "aria-label": "Spielfeld zehn Münzen" });
    const knoepfe = h("div", "r-knoepfe"); const bNeu = h("button", "btn", "Neu beginnen"); knoepfe.append(bNeu);
    const msg = h("div", "r-meldung info");
    root.append(auftrag, status, svg, knoepfe, msg);

    let coins = [], zuege = 0, fertig = false, drag = null;
    const START_TEXT = "Zieh eine Münze mit dem Finger an einen neuen Platz.";
    function meldung(t, art) { msg.textContent = t; msg.className = "r-meldung " + art; }
    function setzen(c, x, y, anim) {
      c.g.style.transition = anim ? "transform .18s ease-out" : "none";
      c.g.style.transform = `translate(${x}px,${y}px)`;
    }
    const besetzt = (r, x2, aus) => coins.some((c) => c !== aus && c.r === r && c.x2 === x2);
    function status_() { sZ.innerHTML = "Züge: <b>" + zuege + "</b> von " + M.MAX; }

    function aufbauen() {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      coins = []; zuege = 0; fertig = false; drag = null;
      START.forEach(([r, x2]) => {
        const g = el("g", { class: "coin" }, svg);
        el("circle", { cx: 0, cy: 0, r: M.R, fill: "#f2c94c", stroke: "#b8860b", "stroke-width": 2.5 }, g);
        el("circle", { cx: 0, cy: 0, r: M.R - 7, fill: "none", stroke: "#d9a92a", "stroke-width": 1.5 }, g);
        const c = { r, x2, g };
        const p = mPos(r, x2); setzen(c, p.x, p.y, false);
        g.addEventListener("pointerdown", (e) => start(e, c));
        coins.push(c);
      });
      status_(); meldung(START_TEXT, "info");
    }
    function start(e, c) {
      if (fertig || drag) return;
      e.preventDefault(); e.stopPropagation();
      if (zuege >= M.MAX) { meldung("Du hast alle drei Züge gemacht. Tippe auf «Neu beginnen» für einen neuen Versuch.", "nein"); return; }
      const p = svgPunkt(svg, e), mp = mPos(c.r, c.x2);
      drag = { c, dx: p.x - mp.x, dy: p.y - mp.y, pid: e.pointerId };
      try { svg.setPointerCapture(e.pointerId); } catch (_) {}
      svg.appendChild(c.g);
      c.g.classList.add("zieht"); c.g.firstChild.setAttribute("stroke-width", 3.5);
      setzen(c, mp.x, mp.y, false);
    }
    svg.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.pid) return;
      e.preventDefault();
      const p = svgPunkt(svg, e);
      drag.x = Math.max(M.R, Math.min(M.W - M.R, p.x - drag.dx));
      drag.y = Math.max(M.R, Math.min(M.H - M.R, p.y - drag.dy));
      setzen(drag.c, drag.x, drag.y, false);
    });
    function ende(e) {
      if (!drag || e.pointerId !== drag.pid) return;
      const c = drag.c, x = drag.x, y = drag.y; drag = null;
      c.g.classList.remove("zieht"); c.g.firstChild.setAttribute("stroke-width", 2.5);
      const zur = mPos(c.r, c.x2);
      if (x === undefined) { setzen(c, zur.x, zur.y, true); return; }
      let best = null, bestD = Infinity;
      const rm = Math.round((y - M.Y0) / M.ZH);
      for (let r = rm - 1; r <= rm + 1; r++) for (let x2 = -M.X2; x2 <= M.X2; x2++) {
        if (!mGueltig(r, x2) || besetzt(r, x2, c)) continue;
        const q = mPos(r, x2), d = Math.hypot(q.x - x, q.y - y);
        if (d < bestD) { bestD = d; best = { r, x2 }; }
      }
      if (!best || bestD > M.D * 0.75 || (best.r === c.r && best.x2 === c.x2)) { setzen(c, zur.x, zur.y, true); return; }
      c.r = best.r; c.x2 = best.x2; zuege++;
      const z = mPos(c.r, c.x2); setzen(c, z.x, z.y, true);
      status_();
      if (istUmgekehrt(coins)) {
        fertig = true;
        meldung("Geschafft! Das Dreieck zeigt nach unten – mit " + zuege + (zuege === 1 ? " Zug." : " Zügen."), "ok");
        if (opt.onGeloest) opt.onGeloest();
      } else if (zuege >= M.MAX) {
        meldung("Drei Züge gemacht, aber das Dreieck zeigt noch nicht nach unten. Tippe auf «Neu beginnen».", "nein");
      } else meldung("Noch " + (M.MAX - zuege) + (M.MAX - zuege === 1 ? " Zug." : " Züge."), "info");
    }
    svg.addEventListener("pointerup", ende);
    svg.addEventListener("pointercancel", ende);
    bNeu.onclick = aufbauen;
    aufbauen();
  };
})();
