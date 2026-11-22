// SchuBe Studis – Moderation & Live-Ansicht (Beamer)
(function () {
  const { h, leeren, toast, api, BLOECKE, REIHENFOLGE, SAMMLUNGEN, POSTIT_FARBEN } = SB;
  const app = document.getElementById("app");
  SB.demoBand();
  const q = new URLSearchParams(location.search);
  const tid = q.get("t"), live = q.get("live") === "1";
  let timer = null;

  const hexRgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  const kreideRahmen = (farbe) => `repeating-linear-gradient(-35deg, ${hexRgba(farbe, .85)} 0 3px, ${hexRgba(farbe, .32)} 3px 6px) 16`;
  const geh = (params) => { location.search = params ? "?" + new URLSearchParams(params).toString() : ""; };

  function schalter(text, an, onchange) {
    const inp = h("input", { type: "checkbox", checked: an, onchange: (e) => onchange(e.target.checked, e.target) });
    return h("label", { class: "switch" }, inp, h("span", { class: "bahn" }), text ? h("span", null, text) : null);
  }
  function topbar() {
    return h("div", { class: "topbar" }, h("div", { class: "topbar-in" }, SB.logo(), h("div", { class: "appname" }, "Studierenden-Treffen · Moderation"),
      h("div", { class: "wer" }, api.email(), api.demo ? null : h("button", { class: "btn klein", onclick: () => { api.abmelden(); location.reload(); } }, "Abmelden"))));
  }

  // ---------------- Anmeldung ----------------
  function login(fehler) {
    leeren(app);
    const e = h("input", { type: "email", autocomplete: "username" }), p = h("input", { type: "password", autocomplete: "current-password" });
    const los = async () => {
      try { await api.anmelden(e.value, p.value); if (!(await api.istModeration())) { api.abmelden(); throw new Error("Diese E-Mail ist nicht für die Moderation freigeschaltet."); } start(); }
      catch (err) { login(err.message); }
    };
    p.addEventListener("keydown", (ev) => { if (ev.key === "Enter") los(); });
    app.append(h("main", { style: { maxWidth: "420px" } }, h("div", { style: { margin: "30px 0 16px" } }, SB.logo()), h("h1", null, "Moderation"),
      h("div", { class: "karte" }, h("label", { class: "feld" }, h("span", null, "E-Mail"), e), h("label", { class: "feld" }, h("span", null, "Passwort"), p),
        h("button", { class: "btn primaer gross", onclick: los }, "Anmelden"),
        fehler ? h("p", { class: "small", style: { color: "#a3202a", marginBottom: 0 } }, fehler) : null)));
  }

  // ---------------- Übersicht ----------------
  async function uebersicht() {
    leeren(app);
    const main = h("main");
    app.append(topbar(), main);
    const titel = h("input", { type: "text", value: "Treffen Studierende Sozialpädagogik" });
    const datum = h("input", { type: "date", value: new Date().toISOString().slice(0, 10) });
    const anlegen = async () => {
      if (!titel.value.trim()) return toast("Bitte einen Titel eingeben.", true);
      for (let i = 0; i < 5; i++) {
        try { const t = await api.treffenAnlegen({ code: SB.neuerCode(), titel: titel.value.trim(), datum: datum.value || null, zustand: SB.STANDARD_ZUSTAND() }); return geh({ t: t.id }); }
        catch (e) { if (e.status !== 409 && !/duplicate/i.test(e.message)) return toast(e.message, true); }
      }
    };
    main.append(h("h1", null, "Treffen"),
      h("div", { class: "karte" }, h("h3", null, "Neues Treffen"),
        h("div", { class: "zeile", style: { alignItems: "flex-end" } },
          h("label", { class: "feld", style: { flex: "2 1 260px", margin: 0 } }, h("span", null, "Titel"), titel),
          h("label", { class: "feld", style: { flex: "1 1 150px", margin: 0 } }, h("span", null, "Datum"), datum),
          h("button", { class: "btn primaer", onclick: anlegen }, "Anlegen"))));
    const liste = h("div", { class: "karte" }, h("div", { class: "leer" }, "Lade …"));
    main.append(liste);
    try {
      const alle = await api.treffenListe();
      leeren(liste);
      if (!alle.length) liste.append(h("div", { class: "leer" }, "Noch kein Treffen angelegt."));
      alle.forEach((t) => liste.append(h("div", { class: "liste-item" },
        h("div", { class: "grow" }, h("div", { style: { fontWeight: 750 } }, t.titel), h("div", { class: "small muted" }, [SB.datumText(t.datum), "Code " + t.code].filter(Boolean).join(" · "))),
        h("button", { class: "btn", onclick: () => geh({ t: t.id }) }, "Öffnen"))));
    } catch (e) { leeren(liste).append(h("div", { class: "leer" }, "Fehler: " + e.message)); }
  }

  // ---------------- Steuerung eines Treffens ----------------
  async function steuerung() {
    let t = await api.treffen(tid);
    if (!t) return uebersicht();
    leeren(app);
    const main = h("main");
    app.append(topbar(), main);
    const url = SB.teilnahmeUrl(t.code);
    main.append(
      h("button", { class: "btn klein", onclick: () => geh(null), style: { marginBottom: "12px" } }, "‹ Alle Treffen"),
      h("h1", null, t.titel), h("p", { class: "muted", style: { marginTop: 0 } }, SB.datumText(t.datum)),
      h("div", { class: "beitritt" }, SB.qrCanvas(url, 120),
        h("div", { style: { flex: 1, minWidth: "200px" } }, h("div", { class: "small muted" }, "Teilnehmen unter " + SB.teilnahmeUrlKurz("").replace(/\?c=$/, "") + " mit Code"), h("div", { class: "code-gross" }, t.code)),
        h("div", { class: "zeile" },
          h("button", { class: "btn", onclick: () => qrGross(t) }, "QR gross zeigen"),
          h("a", { class: "btn primaer", href: "?t=" + t.id + "&live=1", target: "_blank" }, "Live-Ansicht öffnen"))));

    const bloecke = h("div", { class: "karte" });
    const einstellungen = h("div", { class: "karte" });
    const export_ = h("div", { class: "karte" });
    main.append(h("h2", null, "Bausteine"), bloecke, einstellungen, export_);

    async function zustandSetzen(fn) {
      const z = JSON.parse(JSON.stringify(t.zustand || SB.STANDARD_ZUSTAND())); fn(z);
      try { t = await api.treffenAendern(t.id, { zustand: z }); } catch (e) { toast(e.message, true); }
      zeichnen();
    }
    let postits = [], geloest = [];
    function zeichnen() {
      const z = t.zustand;
      leeren(bloecke);
      REIHENFOLGE.forEach((b) => {
        const B = BLOECKE[b];
        let info, knoepfe = [];
        if (b === "einstieg") {
          const n = (a) => geloest.filter((g) => g.aufgabe === a).length;
          info = "Neun Punkte: " + n("punkte") + " gelöst · Zehn Münzen: " + n("muenzen") + " gelöst";
          knoepfe.push(h("button", { class: "btn klein", onclick: async () => { if (confirm("Zähler der gelösten Denkaufgaben zurücksetzen?")) { await api.geloestLeeren(t.id); laden(); } } }, "Zähler zurücksetzen"));
        } else {
          const n = postits.filter((p) => p.block === b).length;
          info = n + (n === 1 ? " Post-it" : " Post-its");
          knoepfe.push(h("button", { class: "btn klein gefahr", disabled: !n, onclick: async () => { if (confirm("Alle Post-its in «" + B.titel + "» löschen?")) { await api.postitsLeeren(t.id, b); laden(); } } }, "Leeren"));
        }
        bloecke.append(h("div", { class: "mod-zeile" }, h("img", { src: B.bild, alt: "" }),
          h("div", { class: "grow" }, h("div", { class: "t" }, B.titel), h("div", { class: "s" }, info)),
          knoepfe, schalter(z.offen[b] ? "offen" : "zu", !!z.offen[b], (an) => zustandSetzen((zz) => (zz.offen[b] = an)))));
      });
      leeren(einstellungen).append(h("h3", null, "Einstellungen"),
        schalter("Post-its der anderen auch auf den Handys zeigen", !!z.wand_handy, (an) => zustandSetzen((zz) => (zz.wand_handy = an))),
        h("p", { class: "small muted", style: { margin: "8px 0 0" } }, "Aus: Die Studierenden sehen nur ihre eigenen Post-its, alle anderen erscheinen nur auf dem Beamer."));
      leeren(export_).append(h("h3", null, "Export & Aufräumen"), h("div", { class: "zeile" },
        h("button", { class: "btn", onclick: () => SB.csv(t, postits) }, "Post-its als CSV (Excel)"),
        h("a", { class: "btn", href: "?t=" + t.id + "&live=1&druck=1", target: "_blank" }, "Alle Sammlungen drucken / PDF"),
        h("button", { class: "btn gefahr", onclick: async () => { if (confirm("Treffen mit allen Post-its endgültig löschen?")) { await api.treffenLoeschen(t.id); geh(null); } } }, "Treffen löschen")));
    }
    async function laden() {
      try { [postits, geloest] = await Promise.all([api.postits(t.id), api.geloest(t.id)]); const neu = await api.treffen(t.id); if (neu) t = neu; zeichnen(); }
      catch (e) { if (e.status === 401) login("Bitte neu anmelden."); }
    }
    zeichnen(); laden();
    clearInterval(timer); timer = setInterval(laden, 4000);
  }

  function qrGross(t) {
    const url = SB.teilnahmeUrl(t.code);
    const o = h("div", { class: "overlay" },
      h("button", { class: "btn zu", onclick: () => o.remove() }, "Schliessen"),
      SB.logo(), SB.qrCanvas(url, Math.min(innerWidth, innerHeight) * 0.55),
      h("div", { class: "url" }, SB.teilnahmeUrlKurz(t.code)), h("div", { class: "code-gross" }, t.code));
    document.body.appendChild(o);
  }

  // ---------------- Live-Ansicht ----------------
  async function liveAnsicht() {
    document.body.classList.add("live");
    let t = await api.treffen(tid);
    if (!t) return uebersicht();
    const druck = q.get("druck") === "1";
    let tab = SB.ls.get("sb-live-tab-" + t.id, "einstieg"), postits = [], geloest = [], ordnen = false, signatur = "", gesehen = null, menue = null;
    const tabs = h("div", { class: "tabs" });
    const flaeche = h("div");
    leeren(app).append(
      h("div", { class: "live-kopf" }, SB.logo(), tabs,
        h("div", { class: "beitritt-klein" }, SB.qrCanvas(SB.teilnahmeUrl(t.code), 64), t.code),
        h("a", { class: "btn klein", href: "?t=" + t.id }, "Steuerung")),
      flaeche);

    async function zustandSetzen(fn) {
      const z = JSON.parse(JSON.stringify(t.zustand)); fn(z);
      try { t = await api.treffenAendern(t.id, { zustand: z }); } catch (e) { toast(e.message, true); }
      zeichnen(true);
    }
    function tabsZeichnen() {
      leeren(tabs);
      REIHENFOLGE.forEach((b) => tabs.append(h("button", { class: tab === b ? "an" : "", onclick: () => { tab = b; SB.ls.set("sb-live-tab-" + t.id, b); gesehen = null; zeichnen(true); } }, BLOECKE[b].titel)));
    }
    function menueZu() { if (menue) { menue.remove(); menue = null; } }
    document.addEventListener("click", (e) => { if (menue && !menue.contains(e.target) && !e.target.closest(".wand .postit")) menueZu(); });

    function flip(b, ...inhalt) {
      const B = BLOECKE[b];
      return h("div", { class: "flip", style: { borderImage: kreideRahmen(B.farbe) } }, inhalt);
    }
    function einstieg() {
      const z = t.zustand, n = (a) => geloest.filter((g) => g.aufgabe === a).length;
      const karte = (a) => h("div", { class: "denk-karte" },
        h("h2", null, SB.AUFGABEN[a].titel), h("p", { html: SB.AUFGABEN[a].auftrag }),
        SB.raetselGrafik(a, !!z.loesung[a]),
        h("div", { class: "denk-fuss" },
          h("div", { class: "gezaehlt" }, h("b", null, n(a)), " gelöst"),
          h("button", { class: "btn" + (z.loesung[a] ? " an" : ""), onclick: () => zustandSetzen((zz) => (zz.loesung[a] = !zz.loesung[a])) }, z.loesung[a] ? "Lösung verbergen" : "Lösung zeigen")));
      return flip("einstieg",
        h("div", { class: "flip-kopf" }, h("img", { src: BLOECKE.einstieg.bild, alt: "Denkaufgabe" }),
          h("div", null, schalter(z.offen.einstieg ? "auf den Handys offen" : "auf den Handys zu", !!z.offen.einstieg, (an) => zustandSetzen((zz) => (zz.offen.einstieg = an))))),
        h("div", { class: "denk-grid" }, karte("punkte"), karte("muenzen")));
    }
    function sammlung(b) {
      const z = t.zustand, B = BLOECKE[b];
      let liste = postits.filter((p) => p.block === b);
      if (ordnen) { const ord = Object.keys(POSTIT_FARBEN); liste = liste.slice().sort((x, y) => ord.indexOf(x.farbe) - ord.indexOf(y.farbe)); }
      const neueIds = gesehen ? liste.filter((p) => !gesehen.has(p.id)).map((p) => p.id) : [];
      gesehen = new Set(liste.map((p) => p.id));
      const wand = h("div", { class: "wand" }, liste.length ? liste.map((p) => {
        const el = h("div", { class: "postit" + (neueIds.includes(p.id) ? " neu-rein" : ""), style: { background: POSTIT_FARBEN[p.farbe] || POSTIT_FARBEN.gelb } }, p.text);
        el.addEventListener("click", (e) => { e.stopPropagation(); postitMenue(p, el); });
        return el;
      }) : h("div", { class: "leer", style: { width: "100%" } }, z.offen[b] ? "Noch keine Post-its – die Wand füllt sich live." : "Diese Sammlung ist noch zu. Öffne sie mit dem Schalter oben rechts."));
      return flip(b,
        h("div", { class: "flip-kopf" }, h("img", { src: B.bild, alt: B.titel }),
          h("div", null, h("div", { class: "zahl" }, h("b", null, liste.length), liste.length === 1 ? "Post-it" : "Post-its"),
            h("div", { class: "flip-werkzeug" },
              h("button", { class: "btn klein", onclick: () => neuesPostit(b) }, "+ Post-it"),
              h("button", { class: "btn klein" + (ordnen ? " an" : ""), onclick: () => { ordnen = !ordnen; zeichnen(true); } }, "Nach Farbe ordnen"),
              schalter(z.offen[b] ? "offen" : "zu", !!z.offen[b], (an) => zustandSetzen((zz) => (zz.offen[b] = an)))))),
        h("p", { class: "muted", style: { fontSize: "1.1rem", margin: "0 0 14px" } }, B.frage),
        wand);
    }
    function postitMenue(p, el) {
      menueZu();
      const r = el.getBoundingClientRect();
      menue = h("div", { class: "postit-menue", style: { left: r.left + scrollX + "px", top: r.bottom + scrollY + 6 + "px" } },
        Object.entries(POSTIT_FARBEN).map(([name, f]) => h("button", { class: "farbe", title: name, style: { background: f }, onclick: async () => { menueZu(); await api.postitAendern(p.id, { farbe: name }); laden(true); } })),
        h("button", { class: "btn klein gefahr", onclick: async () => { menueZu(); await api.postitWeg(p.id); laden(true); } }, "Löschen"));
      document.body.appendChild(menue);
    }
    function neuesPostit(b) {
      const ta = h("textarea", { maxlength: "300", style: { fontFamily: "var(--hand)", fontSize: "1.1rem", background: "#fbf3b0", minHeight: "110px" } });
      let farbe = "gelb";
      const farben = h("div", { class: "zeile" }, Object.entries(POSTIT_FARBEN).map(([n, f]) => h("button", { class: "farbe", style: { width: "30px", height: "30px", borderRadius: "50%", border: "2px solid #fff", boxShadow: "0 0 0 1px #cfd5df", background: f, cursor: "pointer" },
        onclick: () => { farbe = n; ta.style.background = f; } })));
      const o = h("div", { class: "overlay", style: { background: "rgba(255,255,255,.96)" } },
        h("div", { class: "karte", style: { width: "min(520px,92vw)", textAlign: "left" } }, h("h3", null, "Post-it für «" + BLOECKE[b].titel + "»"), ta,
          h("div", { class: "zeile spread", style: { marginTop: "10px" } }, farben,
            h("div", { class: "zeile" }, h("button", { class: "btn", onclick: () => o.remove() }, "Abbrechen"),
              h("button", { class: "btn primaer", onclick: async () => { const tx = ta.value.trim(); if (!tx) return; await api.postitNeu(t.id, b, tx, farbe); o.remove(); laden(true); } }, "Aufkleben")))));
      document.body.appendChild(o); setTimeout(() => ta.focus(), 30);
    }
    function druckAnsicht() {
      leeren(flaeche);
      SAMMLUNGEN.forEach((b) => { tab = b; gesehen = null; flaeche.append(sammlung(b)); });
      setTimeout(() => window.print(), 600);
    }
    function zeichnen(erzwingen) {
      const sig = JSON.stringify([tab, t.zustand, ordnen, postits.map((p) => [p.id, p.text, p.farbe]), geloest.length]);
      if (!erzwingen && sig === signatur) return;
      if (menue && !erzwingen) return; // nicht unter dem offenen Menü neu zeichnen
      signatur = sig; menueZu(); tabsZeichnen();
      leeren(flaeche).append(tab === "einstieg" ? einstieg() : sammlung(tab));
    }
    async function laden(erzwingen) {
      try {
        const [p, g, neu] = await Promise.all([api.postits(t.id), api.geloest(t.id), api.treffen(t.id)]);
        postits = p; geloest = g; if (neu) t = neu;
        if (druck) return druckAnsicht();
        zeichnen(erzwingen);
      } catch (e) { if (e.status === 401) login("Bitte neu anmelden."); }
    }
    await laden(true);
    if (!druck) { clearInterval(timer); timer = setInterval(() => laden(false), 3000); }
  }

  // ---------------- Start ----------------
  async function start() {
    if (!api.istAngemeldet()) return login();
    try { if (!(await api.istModeration())) { api.abmelden(); return login("Diese E-Mail ist nicht für die Moderation freigeschaltet."); } }
    catch (e) { return login(e.status === 401 ? "Bitte neu anmelden." : "Keine Verbindung: " + e.message); }
    if (tid && live) return liveAnsicht();
    if (tid) return steuerung();
    uebersicht();
  }
  start();
})();
