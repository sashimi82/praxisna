// praxisNA Live – gemeinsame Hilfsfunktionen, Vorlagen und Resultat-Darstellungen
(function () {
  const PNA = (window.PNA = window.PNA || {});

  // ---------- DOM-Helfer ----------
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === null || v === undefined || v === false) continue;
        if (k === "class") el.className = v;
        else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
        else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
        else if (k === "value") el.value = v;
        else if (k === "checked") el.checked = !!v;
        else if (k === "html") el.innerHTML = v;
        else el.setAttribute(k, v === true ? "" : v);
      }
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid === null || kid === undefined || kid === false) continue;
      el.appendChild(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }
  PNA.h = h;
  PNA.leeren = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

  let toastTimer;
  PNA.toast = function (msg, fehler) {
    let t = document.querySelector(".toast");
    if (!t) { t = h("div", { class: "toast" }); document.body.appendChild(t); }
    t.textContent = msg; t.classList.toggle("fehler", !!fehler); t.classList.add("zeigen");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("zeigen"), fehler ? 4500 : 2200);
  };

  PNA.bogen = () => {
    const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 120 14"); s.setAttribute("class", "bogen");
    s.innerHTML = '<circle cx="5" cy="4" r="3.2" fill="#4a0a2a"/><path d="M10 6 Q60 18 112 4" stroke="#4a0a2a" stroke-width="1.4" fill="none"/>';
    return s;
  };

  PNA.datumText = (d) => { if (!d) return ""; const [y, m, t] = String(d).slice(0, 10).split("-"); return `${t}.${m}.${y}`; };
  PNA.kurzId = () => Math.random().toString(36).slice(2, 9);
  PNA.neuerCode = () => { const a = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; let c = ""; for (let i = 0; i < 5; i++) c += a[Math.floor(Math.random() * a.length)]; return c; };
  PNA.teilnahmeUrl = (code) => new URL("./", location.href).href + "?c=" + encodeURIComponent(code);
  PNA.teilnahmeUrlKurz = (code) => PNA.teilnahmeUrl(code).replace(/^https?:\/\//, "");

  PNA.FARBEN = ["#162c4a", "#4a0a2a", "#2f5d93", "#c4650f", "#1e9c45", "#2a8aa6", "#8e2b2f", "#6b7f35"];
  PNA.EBENEN_FARBEN = ["#2f5d93", "#8e2b2f", "#c4650f", "#1e9c45", "#2a8aa6", "#6b7f35", "#4a0a2a", "#162c4a"];
  PNA.SYMBOLE = ["🐟", "🐸", "🦒", "🐈", "🐄", "🦀", "🌳", "🐕", "🦆", "🐘", "🦋", "🐢", "🦉", "🐝", "🦔", "🐞", "🐌", "🦊", "🐻", "🐧", "🌻", "🍀", "⭐", "🌙", "☀️", "🍎", "🎈", "🔑", "⚓", "❤️"];

  // ---------- Bausteintypen ----------
  PNA.TYPEN = {
    saetze: { name: "Alte → neue Autorität", kurz: "Sätze", zeichen: "A" },
    praesenz: { name: "Präsenz-Ebenen", kurz: "Präsenz", zeichen: "P" },
    werte: { name: "Werte-Wolke", kurz: "Werte", zeichen: "W" },
    auswertung: { name: "Auswertung", kurz: "Auswertung", zeichen: "✓" },
  };
  PNA.TYP_REIHENFOLGE = ["saetze", "praesenz", "werte", "auswertung"];
  PNA.hex = (typ) => h("div", { class: "hex typ-" + typ, title: PNA.TYPEN[typ].name }, PNA.TYPEN[typ].zeichen);

  PNA.FRAGE_TYPEN = {
    text: "Offene Antwort",
    skala: "Skala",
    daumen: "Daumen hoch / runter",
    auswahl: "Auswahl (eine Option)",
    wolke: "Wortwolke (Stichworte)",
  };

  PNA.leereConfig = function (typ) {
    if (typ === "saetze") return { anleitung: "Formuliert jeden Satz so, wie er in der Haltung der Neuen Autorität klingen könnte. Mit «OK» wird der Satz gespeichert.", items: [{ id: PNA.kurzId(), text: "", symbol: "🐟" }] };
    if (typ === "praesenz") return { anleitung: "Schätze dich pro Ebene auf der Skala von 1 bis 10 ein.", ebenen: [{ id: PNA.kurzId(), name: "", untertitel: "", fragen: [] }] };
    if (typ === "werte") return { frage: "Welches sind deine drei wichtigsten Werte?", anzahl: 3 };
    return { anleitung: "Vielen Dank für deine Rückmeldung!", fragen: [{ id: PNA.kurzId(), typ: "skala", text: "", max: 10, links: "gar nicht", rechts: "sehr" }] };
  };

  // Startvorlagen (aus euren Unterlagen)
  PNA.startVorlagen = function () {
    const S = [
      ["Ich muss stark auftreten, sonst verliere ich die Kontrolle.", "🐟"],
      ["Ich bestimme hier, nicht du!", "🐸"],
      ["Solange du in meiner Klasse/in meiner Gruppe bist, machst du, was ich sage.", "🦒"],
      ["Ich erwarte, dass du auf mich hörst, weil ich deine Lehrperson/Betreuungsperson bin.", "🐈"],
      ["Wenn du dich so aufführst, brauchst du dich über Konsequenzen nicht zu wundern.", "🐄"],
      ["Strafen müssen sein, sonst lernen sie es nie.", "🦀"],
      ["Wer nicht hören will, muss fühlen.", "🌳"],
      ["Du musst dich anpassen, sonst hast du hier keinen Platz.", "🐕"],
      ["Wenn du Respekt willst, musst du dich erst benehmen.", "🦆"],
      ["Wenn du so weitermachst, rufe ich deine Eltern an.", "🐘"],
    ];
    const E = [
      ["Physische Präsenz", "körperlich-geistig", ["War ich körperlich und geistig anwesend, achtsam und wachsam?", "War ich in meiner Energie?", "War ich mir meiner Körpersprache bewusst?"]],
      ["Emotional-moralische Präsenz", "Überzeugung, Authentizität", ["War mein Handeln kongruent mit meiner Aufgabe?", "War ich bereit, mich auseinanderzusetzen?", "Wurden meine Überzeugungen durch mein Handeln sichtbar?"]],
      ["Pragmatische Präsenz", "Handlungsfähigkeit", ["Habe ich mich selbstwirksam erlebt?", "Hatte ich alternative Handlungsoptionen?", "War ich in der Lage, meine Reaktion aufzuschieben?"]],
      ["Systemische Präsenz", "Unterstützung, Netzwerk", ["Wusste ich, bei wem ich Unterstützung holen kann?", "Hatte ich das Gefühl, dass ich mich auf meine Kolleg*innen / meine Gruppe / mein Umfeld verlassen kann?", "Erlebte ich mich dem Team / der Gruppe / der Familie zugehörig?"]],
      ["Internale Präsenz", "Selbstführung", ["Entsprach mein Handeln meinen Erwartungen an mich?", "Konnte ich Ruhe bewahren?", "Habe ich auf einen emotionalen Knopf bei mir reagiert?"]],
      ["Intentionale Präsenz", "Absicht", ["War mein Handeln auf die Situation ausgerichtet?", "Was wollte ich erreichen?", "Hat mein Gegenüber gespürt, dass ich an ihr/ihm interessiert bin?"]],
    ];
    return [
      { typ: "saetze", titel: "Haltungs-Memory: alte → neue Autorität", config: { anleitung: "Formuliert jeden Satz so, wie er in der Haltung der Neuen Autorität klingen könnte. Mit «OK» wird der Satz gespeichert – ihr könnt ihn später noch ändern.", items: S.map(([text, symbol]) => ({ id: PNA.kurzId(), text, symbol })) } },
      { typ: "praesenz", titel: "Die sechs Präsenzebenen", config: { anleitung: "Denke an eine konkrete Situation und schätze dich pro Ebene auf der Skala von 1 bis 10 ein. Die Fragen helfen dir dabei. Deine Einschätzung bleibt anonym.", ebenen: E.map(([name, untertitel, fragen]) => ({ id: PNA.kurzId(), name, untertitel, fragen })) } },
      { typ: "werte", titel: "Meine drei wichtigsten Werte", config: { frage: "Welches sind deine drei wichtigsten Werte in deiner Arbeit?", anzahl: 3 } },
      { typ: "auswertung", titel: "Auswertung Weiterbildung", config: { anleitung: "Danke für deine Rückmeldung! Du kannst alle Fragen in deinem Tempo beantworten.", fragen: [
        { id: PNA.kurzId(), typ: "skala", text: "Wie zufrieden bist du insgesamt mit der Weiterbildung?", max: 10, links: "gar nicht", rechts: "sehr" },
        { id: PNA.kurzId(), typ: "daumen", text: "Kann ich das Gelernte in meinem Alltag umsetzen?" },
        { id: PNA.kurzId(), typ: "auswahl", text: "Was war für dich am wertvollsten?", optionen: ["Inputs", "Gruppenarbeiten", "Austausch im Plenum", "Fallbeispiele"] },
        { id: PNA.kurzId(), typ: "text", text: "Was nimmst du mit?" },
        { id: PNA.kurzId(), typ: "text", text: "Was dürfen wir verbessern?" },
      ] } },
    ];
  };

  // ---------- QR-Code ----------
  PNA.qrCanvas = function (text, px) {
    const { QRCode, Level } = window.QRCodeLib;
    const q = new QRCode(-1, Level.M); q.addData(text); q.make();
    const n = q.getModuleCount(), rand = 2, scale = Math.max(2, Math.floor(px / (n + rand * 2)));
    const size = (n + rand * 2) * scale;
    const c = h("canvas", { class: "qr", width: size, height: size });
    c.style.width = c.style.height = px + "px";
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, size, size); ctx.fillStyle = "#162c4a";
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) ctx.fillRect((k + rand) * scale, (r + rand) * scale, scale, scale);
    return c;
  };

  // ---------- Wortwolke ----------
  PNA.zaehleWoerter = function (liste) {
    const m = new Map();
    for (const raw of liste) {
      const w = String(raw || "").trim().replace(/\s+/g, " ").replace(/^[«»"'.,;:!?-]+|[«»"'.,;:!?-]+$/g, "");
      if (!w) continue;
      const key = w.toLocaleLowerCase("de-CH");
      if (!m.has(key)) m.set(key, { text: w.charAt(0).toLocaleUpperCase("de-CH") + w.slice(1), n: 0 });
      m.get(key).n++;
    }
    return [...m.values()].sort((a, b) => b.n - a.n || a.text.localeCompare(b.text));
  };

  PNA.zeichneWolke = function (canvas, woerter, breite, maxHoehe) {
    const W = Math.max(320, Math.round(breite));
    const H = Math.max(240, Math.round(Math.min(W * 0.52, maxHoehe || Infinity)));
    const dpr = 2;
    canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.height = H + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = "middle"; ctx.textAlign = "center";
    const font = getComputedStyle(document.body).fontFamily;
    if (!woerter.length) {
      ctx.fillStyle = "#9aa3b0"; ctx.font = `600 ${Math.max(14, Math.round(W / 45))}px ${font}`;
      ctx.fillText("Noch keine Antworten – die Wolke wächst, sobald Antworten eintreffen.", W / 2, H / 2);
      return;
    }
    const liste = woerter.slice(0, 150);
    const max = liste[0].n, min = liste[liste.length - 1].n;
    const gross0 = Math.min(W / 7.5, H / 3.2), klein0 = Math.max(13, gross0 / 5.5);
    const basis = (w) => max === min ? (liste.length <= 6 ? gross0 * 0.7 : liste.length <= 20 ? gross0 * 0.45 : klein0 * 1.4) : klein0 + (gross0 - klein0) * Math.sqrt((w.n - min) / (max - min));
    const rand = 3, luft = 0.12;
    const versuche = (skala) => {
      const plaziert = [];
      const ueberlappt = (r) => { for (const p of plaziert) if (r.x < p.x + p.w && r.x + r.w > p.x && r.y < p.y + p.h && r.y + r.h > p.y) return true; return false; };
      let fehlt = 0;
      for (const w of liste) {
        let size = Math.max(11, basis(w) * skala), ok = null;
        for (let v = 0; v < 3 && !ok; v++, size = Math.max(10, size * 0.85)) {
          ctx.font = `800 ${size}px ${font}`;
          const tw = ctx.measureText(w.text).width + size * luft * 2, th = size * 1.08;
          if (tw > W - 2 * rand) continue;
          for (let t = 0; t < 9000; t++) {
            const a = t * 0.045, rad = 0.55 * a;
            const cx = W / 2 + rad * Math.cos(a) * (W / H), cy = H / 2 + rad * Math.sin(a);
            if (rad * Math.min(1, W / H) > Math.max(W, H)) break;
            const r = { x: cx - tw / 2, y: cy - th / 2, w: tw, h: th };
            if (r.x < rand || r.y < rand || r.x + r.w > W - rand || r.y + r.h > H - rand) continue;
            if (!ueberlappt(r)) { ok = { ...r, cx, cy, size, text: w.text }; break; }
          }
        }
        if (ok) plaziert.push(ok); else fehlt++;
      }
      return { plaziert, fehlt };
    };
    let best = null;
    for (let skala = 1, i = 0; i < 9; i++, skala *= 0.9) {
      const r = versuche(skala);
      if (!best || r.fehlt < best.fehlt) best = r;
      if (!r.fehlt) break;
    }
    best.plaziert.forEach((p, i) => {
      ctx.font = `800 ${p.size}px ${font}`;
      ctx.fillStyle = PNA.FARBEN[i % PNA.FARBEN.length];
      ctx.fillText(p.text, p.cx, p.cy + p.size * 0.04);
    });
  };

  // ---------- Resultat-Darstellungen (Live-Ansicht) ----------
  const anzahlText = (n, ein, mehr) => `${n} ${n === 1 ? ein : mehr}`;

  PNA.resultate = {
    // Alte → neue Autorität
    saetze(ziel, block, antworten, zustand, aktionen) {
      const items = block.config.items || [];
      const gruppen = antworten.map((a, i) => ({ a, name: a.gruppe || "Gruppe " + (i + 1), ans: (a.daten && a.daten.answers) || {} }));
      const total = items.length;
      ziel.appendChild(h("div", { class: "gruppen-stand" },
        gruppen.length ? gruppen.map((g) => {
          const n = items.filter((it) => (g.ans[it.id] || "").trim()).length;
          return h("span", { class: "chip" + (n === total ? " ok" : "") }, g.name, " · ", `${n}/${total}`);
        }) : h("span", { class: "muted" }, "Noch keine Gruppe angemeldet.")));

      const karte = (it, g) => h("div", { class: "neu-karte" },
        h("div", { class: "txt" }, g.ans[it.id]),
        h("div", { class: "wer" }, g.name),
        aktionen && aktionen.entfernen ? h("button", { class: "icon-btn weg no-print", title: "Antwort ausblenden (löschen)", onclick: () => aktionen.entfernen(g.a, it.id) }, "✕") : null);

      const satzBlock = (it, gross) => {
        const neue = gruppen.filter((g) => (g.ans[it.id] || "").trim());
        return h("div", { class: gross ? "" : "satz-block" },
          h("div", { class: "alt-gross" }, it.symbol ? h("div", { class: "sym" }, it.symbol) : null,
            h("div", null, h("div", { class: "label-klein" }, "Alte Autorität"), h("div", { class: "txt" }, it.text))),
          h("div", { class: "label-klein", style: { margin: "0 0 8px 4px" } }, "Neue Autorität"),
          neue.length ? h("div", { class: "neu-grid" }, neue.map((g) => karte(it, g))) : h("div", { class: "noch-leer" }, "Noch keine Formulierung."));
      };

      if (zustand.modus === "alle" || !total) {
        items.forEach((it) => ziel.appendChild(satzBlock(it, false)));
      } else {
        const i = Math.min(zustand.idx || 0, total - 1);
        ziel.appendChild(satzBlock(items[i], true));
      }
    },

    // Präsenz-Ebenen: Ansicht «punkte» (Vorschlag B) oder «raster» (Vorschlag C)
    praesenz(ziel, block, antworten, zustand) {
      zustand = zustand || {};
      const mitSchnitt = zustand.schnitt === true;
      const ansicht = zustand.ansicht === "raster" ? "raster" : "punkte";
      const ebenen = block.config.ebenen || [];
      const fmt = (x) => x.toFixed(1).replace(".", ",");
      const daten = ebenen.map((e, ei) => {
        const werte = antworten.map((a) => a.daten && a.daten.ratings && a.daten.ratings[e.id]).filter((v) => typeof v === "number" && v >= 1 && v <= 10);
        const zaehl = Array(10).fill(0); werte.forEach((v) => zaehl[v - 1]++);
        return { e, zaehl, n: werte.length, schnitt: werte.length ? werte.reduce((s, v) => s + v, 0) / werte.length : null, farbe: PNA.EBENEN_FARBEN[ei % PNA.EBENEN_FARBEN.length] };
      });
      ziel.appendChild(h("p", { class: "muted" }, anzahlText(antworten.length, "Einschätzung", "Einschätzungen"), " · anonym", ansicht === "raster" ? " · Kreisgrösse = Anzahl Personen" : ""));
      const name = (d) => h("div", { class: "pe-name" }, d.e.name, d.e.untertitel ? h("small", null, d.e.untertitel) : null);

      if (ansicht === "punkte") {
        const wrap = h("div", { class: "pe-punkte" });
        daten.forEach((d) => {
          const skala = h("div", { class: "pe-skala" },
            h("div", { class: "pe-spalten" }, d.zaehl.map((n) => h("div", { class: "pe-spalte" }, Array.from({ length: n }, () => h("span", { class: "pe-dot", style: { background: d.farbe } }))))),
            h("div", { class: "pe-achse" }, d.zaehl.map((_, i) => h("div", null, i + 1))));
          if (mitSchnitt && d.schnitt !== null) {
            skala.appendChild(h("div", { class: "pe-linie", style: { left: ((d.schnitt - 0.5) / 10) * 100 + "%", borderColor: d.farbe } },
              h("span", { style: { color: d.farbe } }, "Ø " + fmt(d.schnitt))));
          }
          wrap.appendChild(h("div", { class: "pe-zeile" }, name(d), skala));
        });
        ziel.appendChild(wrap);
      } else {
        const maxN = Math.max(1, ...daten.flatMap((d) => d.zaehl));
        const grid = h("div", { class: "pe-raster", style: { gridTemplateColumns: `minmax(180px,260px) repeat(10,1fr)${mitSchnitt ? " 90px" : ""}` } },
          h("div"), Array.from({ length: 10 }, (_, i) => h("div", { class: "pe-kopf" }, i + 1)), mitSchnitt ? h("div", { class: "pe-kopf" }, "Ø") : null);
        daten.forEach((d) => {
          grid.appendChild(h("div", { class: "pe-zelle pe-links" }, name(d)));
          d.zaehl.forEach((n) => {
            const g = 20 + (n / maxN) * 40;
            grid.appendChild(h("div", { class: "pe-zelle" }, n ? h("div", { class: "pe-kreis", style: { background: d.farbe, width: g + "px", height: g + "px", opacity: 0.55 + 0.45 * (n / maxN) } }, n) : null));
          });
          if (mitSchnitt) grid.appendChild(h("div", { class: "pe-zelle pe-wert" }, d.schnitt === null ? "–" : fmt(d.schnitt)));
        });
        ziel.appendChild(grid);
      }
    },

    // Werte-Wolke
    werte(ziel, block, antworten, zustand) {
      const alle = []; antworten.forEach((a) => ((a.daten && a.daten.werte) || []).forEach((w) => alle.push(w)));
      const woerter = PNA.zaehleWoerter(alle);
      ziel.appendChild(h("p", { class: "muted" }, anzahlText(antworten.length, "Person hat", "Personen haben"), " geantwortet · ", anzahlText(woerter.length, "verschiedener Wert", "verschiedene Werte")));
      const c = h("canvas", { class: "wolke" });
      const wrap = h("div", { class: "wolke-wrap" }, c);
      ziel.appendChild(wrap);
      requestAnimationFrame(() => {
        const top = wrap.getBoundingClientRect().top + window.scrollY;
        const main = wrap.closest(".live-main");
        const unten = main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 70;
        const verfuegbar = window.innerHeight - top - unten - 26;
        PNA.zeichneWolke(c, woerter, wrap.clientWidth - 20, Math.max(320, verfuegbar));
      });
      zustand.canvas = c;
      if (woerter.length) {
        ziel.appendChild(h("details", { class: "no-print", style: { marginTop: "14px" } }, h("summary", { class: "muted" }, "Alle Werte als Liste"),
          h("p", null, woerter.map((w) => `${w.text} (${w.n})`).join(" · "))));
      }
    },

    // Auswertung
    auswertung(ziel, block, antworten, zustand) {
      const fragen = block.config.fragen || [];
      ziel.appendChild(h("p", { class: "muted" }, anzahlText(antworten.length, "Rückmeldung", "Rückmeldungen")));
      fragen.forEach((f, fi) => {
        const werte = antworten.map((a) => a.daten && a.daten.antworten && a.daten.antworten[f.id]).filter((v) => v !== undefined && v !== null && v !== "");
        const k = h("div", { class: "frage-karte" }, h("h3", null, `${fi + 1}. ${f.text}`));
        const farbe = PNA.EBENEN_FARBEN[fi % PNA.EBENEN_FARBEN.length];
        if (f.typ === "skala") {
          const max = f.max || 10, z = Array(max).fill(0);
          werte.forEach((v) => { if (v >= 1 && v <= max) z[v - 1]++; });
          const m = Math.max(1, ...z), schnitt = werte.length ? werte.reduce((s, v) => s + v, 0) / werte.length : null;
          k.appendChild(h("div", { class: "zeile spread", style: { alignItems: "flex-end" } },
            h("div", { style: { flex: 1 } },
              h("div", { class: "histo", style: { gridTemplateColumns: `repeat(${max},1fr)` } }, z.map((n) => h("div", { class: "s" }, h("div", { class: "n" }, n || ""), h("div", { class: "bar", style: { height: (n / m) * 88 + "%", background: n ? farbe : "#e6eaf0" } })))),
              h("div", { class: "histo-achse", style: { gridTemplateColumns: `repeat(${max},1fr)` } }, z.map((_, i) => h("div", null, i + 1))),
              h("div", { class: "skala-enden" }, h("span", null, f.links || ""), h("span", null, f.rechts || ""))),
            !(zustand && zustand.schnitt === true) ? null : h("div", { class: "schnitt", style: { minWidth: "120px" } }, h("div", { class: "wert" }, schnitt === null ? "–" : schnitt.toFixed(1).replace(".", ",")), h("div", { class: "lbl" }, `Durchschnitt (n = ${werte.length})`))));
        } else if (f.typ === "daumen") {
          const hoch = werte.filter((v) => v === "hoch").length, runter = werte.filter((v) => v === "runter").length, t = Math.max(1, hoch + runter);
          k.appendChild(h("div", { class: "daumen-ergebnis" },
            h("div", { class: "zeile" }, h("span", { class: "d" }, "👍"), h("span", { class: "z" }, hoch), h("span", { class: "muted" }, `(${Math.round((hoch / t) * 100)} %)`)),
            h("div", { class: "zeile" }, h("span", { class: "d" }, "👎"), h("span", { class: "z" }, runter), h("span", { class: "muted" }, `(${Math.round((runter / t) * 100)} %)`)),
            h("div", { class: "balken", style: { flex: 1, minWidth: "200px", height: "30px", display: "flex" } },
              h("div", { style: { width: (hoch / t) * 100 + "%", background: "#1e9c45", borderRadius: "8px 0 0 8px" } }),
              h("div", { style: { width: (runter / t) * 100 + "%", background: "#c0392b", borderRadius: "0 8px 8px 0" } }))));
        } else if (f.typ === "auswahl") {
          const opts = f.optionen || [], t = Math.max(1, werte.length);
          opts.forEach((o, oi) => {
            const n = werte.filter((v) => v === o).length;
            k.appendChild(h("div", { class: "balken-zeile" }, h("div", { style: { fontWeight: 650 } }, o),
              h("div", { class: "balken" }, h("div", { style: { width: (n / t) * 100 + "%", background: PNA.EBENEN_FARBEN[oi % 8] } })),
              h("div", { style: { fontWeight: 750, color: "#162c4a" } }, `${n} (${Math.round((n / t) * 100)} %)`)));
          });
        } else if (f.typ === "wolke") {
          const woerter = PNA.zaehleWoerter(werte.flat());
          const c = h("canvas", { class: "wolke" });
          k.appendChild(h("p", { class: "small muted", style: { marginTop: "-6px" } }, `${werte.length} Personen · ${woerter.length} verschiedene Begriffe`));
          k.appendChild(c);
          requestAnimationFrame(() => PNA.zeichneWolke(c, woerter, k.clientWidth - 44, 360));
        } else {
          k.appendChild(werte.length ? h("div", { class: "text-antworten" }, werte.map((v) => h("div", { class: "ta" }, v))) : h("div", { class: "noch-leer" }, "Noch keine Antworten."));
        }
        ziel.appendChild(k);
      });
    },
  };

  // CSV-Export (für Excel)
  PNA.csv = function (kurs, block, antworten) {
    const zeilen = [];
    const c = block.config;
    if (block.typ === "saetze") {
      zeilen.push(["Symbol", "Alter Satz", "Gruppe", "Neuer Satz"]);
      (c.items || []).forEach((it) => antworten.forEach((a, i) => { const t = a.daten && a.daten.answers && a.daten.answers[it.id]; if (t) zeilen.push([it.symbol || "", it.text, a.gruppe || "Gruppe " + (i + 1), t]); }));
    } else if (block.typ === "praesenz") {
      zeilen.push(["Person", ...(c.ebenen || []).map((e) => e.name)]);
      antworten.forEach((a, i) => zeilen.push(["#" + (i + 1), ...(c.ebenen || []).map((e) => (a.daten.ratings || {})[e.id] ?? "")]));
    } else if (block.typ === "werte") {
      zeilen.push(["Person", "Wert"]);
      antworten.forEach((a, i) => (a.daten.werte || []).forEach((w) => zeilen.push(["#" + (i + 1), w])));
    } else {
      zeilen.push(["Person", ...(c.fragen || []).map((f) => f.text)]);
      antworten.forEach((a, i) => zeilen.push(["#" + (i + 1), ...(c.fragen || []).map((f) => { const v = (a.daten.antworten || {})[f.id]; return Array.isArray(v) ? v.join(", ") : v ?? ""; })]));
    }
    const txt = "﻿" + zeilen.map((z) => z.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const a = h("a", { href: URL.createObjectURL(new Blob([txt], { type: "text/csv;charset=utf-8" })), download: `${kurs.titel} - ${block.titel}.csv` });
    document.body.appendChild(a); a.click(); a.remove();
  };
})();
