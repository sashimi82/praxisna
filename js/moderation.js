// praxisNA Live – Moderation: Kurse, Bausteine, Live-Ansicht
(function () {
  const { h, api, toast } = PNA;
  const app = document.getElementById("app");
  if (api.demo) document.getElementById("demo-band").classList.remove("hidden");

  let timer = null, aufraeumen = [];
  const stoppen = () => { clearInterval(timer); timer = null; aufraeumen.forEach((f) => f()); aufraeumen = []; document.body.classList.remove("live"); };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const gehe = (hash) => { location.hash = hash; };
  const fehler = (e) => { console.error(e); toast(e.message || "Es ist ein Fehler aufgetreten.", true); };

  // ---------- Rahmen ----------
  function rahmen(aktiv) {
    PNA.leeren(app);
    const nav = h("nav", null,
      h("a", { href: "#/", class: aktiv === "kurse" ? "aktiv" : "" }, "Kurse"),
      h("a", { href: "#/bausteine", class: aktiv === "bausteine" ? "aktiv" : "" }, "Bausteine"));
    const wer = h("div", { class: "wer" }, api.demo ? "Demo" : api.email(),
      api.demo ? null : h("button", { class: "btn klein", onclick: () => { api.abmelden(); route(); } }, "Abmelden"));
    app.appendChild(h("div", { class: "topbar" }, h("div", { class: "topbar-in" }, h("a", { href: "#/" }, h("img", { class: "logo", src: "assets/logo.png", alt: "praxisNA" })), nav, wer)));
    const main = h("main");
    app.appendChild(main);
    return main;
  }

  // ---------- Anmeldung ----------
  function anmeldung(meldung) {
    PNA.leeren(app);
    const email = h("input", { type: "email", autocomplete: "username", placeholder: "name@beispiel.ch" });
    const pw = h("input", { type: "password", autocomplete: "current-password" });
    const knopf = h("button", { class: "btn primaer gross", style: { width: "100%" }, type: "submit" }, "Anmelden");
    const form = h("form", { class: "karte", style: { maxWidth: "420px", margin: "60px auto" } },
      h("img", { src: "assets/logo.png", alt: "praxisNA", style: { height: "44px", marginBottom: "6px" } }),
      h("h1", null, "Moderation"),
      meldung ? h("p", { style: { color: "#a3202a", fontWeight: 650 } }, meldung) : null,
      h("label", { class: "feld" }, h("span", null, "E-Mail"), email),
      h("label", { class: "feld" }, h("span", null, "Passwort"), pw), knopf);
    form.addEventListener("submit", async (e) => {
      e.preventDefault(); knopf.disabled = true; knopf.textContent = "…";
      try { await api.anmelden(email.value, pw.value); route(); }
      catch (err) { knopf.disabled = false; knopf.textContent = "Anmelden"; toast(err.message === "Invalid login credentials" ? "E-Mail oder Passwort ist falsch." : err.message, true); }
    });
    app.appendChild(form);
    setTimeout(() => email.focus(), 50);
  }

  // ---------- Router ----------
  let moderationGeprueft = false;
  async function route() {
    stoppen();
    if (!api.istAngemeldet()) return anmeldung();
    if (!moderationGeprueft) {
      try {
        if (!(await api.istModeration())) { api.abmelden(); return anmeldung("Diese E-Mail-Adresse ist nicht als Moderation freigeschaltet (Tabelle «moderierende» in Supabase)."); }
        moderationGeprueft = true;
      } catch (e) { if (!api.istAngemeldet()) return anmeldung(e.message); return fehlerSeite(e); }
    }
    const teile = location.hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
    try {
      if (!teile[0]) await kurseSeite();
      else if (teile[0] === "kurs-neu") await kursNeu();
      else if (teile[0] === "kurs") await kursSeite(teile[1]);
      else if (teile[0] === "live") await liveSeite(teile[1], teile[2]);
      else if (teile[0] === "bausteine") await bausteineSeite();
      else if (teile[0] === "baustein") await bausteinEditor(teile[1], teile[2]);
      else gehe("#/");
    } catch (e) { fehlerSeite(e); }
  }
  function fehlerSeite(e) {
    console.error(e);
    const m = rahmen("");
    m.appendChild(h("div", { class: "karte" }, h("h2", null, "Das hat nicht geklappt"), h("p", null, e.message || String(e)),
      h("button", { class: "btn primaer", onclick: () => route() }, "Nochmals versuchen")));
  }
  window.addEventListener("hashchange", route);

  // ---------- Kurse ----------
  async function kurseSeite() {
    const m = rahmen("kurse");
    m.appendChild(h("p", { class: "muted" }, "Laden …"));
    const [kurse, bausteine] = await Promise.all([api.kurse(), api.bausteine()]);
    PNA.leeren(m);
    m.appendChild(h("div", { class: "zeile spread" }, h("div", null, h("h1", null, "Kurse")),
      h("button", { class: "btn primaer", onclick: () => gehe("#/kurs-neu"), disabled: !bausteine.length }, "+ Neuer Kurs")));

    if (!bausteine.length) {
      m.appendChild(h("div", { class: "karte" }, h("h2", null, "Willkommen bei praxisNA Live"),
        h("p", null, "Zuerst braucht es Bausteine (Übungen). Mit einem Klick werden Startvorlagen aus euren Unterlagen angelegt: das Haltungs-Memory mit den 10 Sätzen, die sechs Präsenzebenen, die Werte-Wolke und eine Beispiel-Auswertung. Alles lässt sich danach anpassen."),
        h("button", { class: "btn akzent", onclick: async (e) => {
          e.target.disabled = true;
          try { for (const b of PNA.startVorlagen()) await api.bausteinSpeichern(b); toast("Startvorlagen angelegt"); route(); } catch (err) { fehler(err); e.target.disabled = false; }
        } }, "Startvorlagen anlegen")));
      return;
    }
    if (!kurse.length) {
      m.appendChild(h("div", { class: "karte leer" }, h("p", null, "Noch keine Kurse."), h("button", { class: "btn primaer", onclick: () => gehe("#/kurs-neu") }, "Ersten Kurs anlegen")));
      return;
    }
    m.appendChild(h("div", { class: "grid2" }, kurse.map((k) => h("a", { class: "karte", href: "#/kurs/" + k.id, style: { textDecoration: "none", color: "inherit", display: "block" } },
      h("div", { class: "zeile spread" }, h("span", { class: "chip" }, "Code ", k.code), h("span", { class: "small muted" }, PNA.datumText(k.datum))),
      h("h2", { style: { margin: "10px 0 8px" } }, k.titel),
      h("div", { class: "zeile" }, (k.bloecke || []).map((b) => h("div", { class: "hex typ-" + b.typ, title: b.titel, style: { width: "24px", height: "27px", fontSize: ".7rem" } }, PNA.TYPEN[b.typ].zeichen)),
        (k.bloecke || []).some((b) => b.offen || b.memory) ? h("span", { class: "chip ok" }, "offen") : null)))));
  }

  function bausteinWahl(bausteine, gewaehlt) {
    return h("div", null, PNA.TYP_REIHENFOLGE.map((typ) => {
      const liste = bausteine.filter((b) => b.typ === typ);
      if (!liste.length) return null;
      return h("div", { style: { marginBottom: "10px" } }, h("div", { class: "zeile", style: { margin: "8px 0 4px" } }, PNA.hex(typ), h("b", null, PNA.TYPEN[typ].name)),
        liste.map((b) => h("label", { class: "zeile", style: { padding: "6px 0 6px 44px", cursor: "pointer" } },
          h("input", { type: "checkbox", onchange: (e) => (e.target.checked ? gewaehlt.add(b.id) : gewaehlt.delete(b.id)) }), b.titel)));
    }));
  }
  const blockAusVorlage = (b) => ({ key: PNA.kurzId(), vorlage_id: b.id, typ: b.typ, titel: b.titel, config: clone(b.config), offen: false });

  async function kursNeu() {
    const m = rahmen("kurse");
    const bausteine = await api.bausteine();
    const titel = h("input", { type: "text", placeholder: "z. B. Weiterbildung Neue Autorität – Pünt Uster" });
    const datum = h("input", { type: "date", value: new Date().toISOString().slice(0, 10) });
    const gewaehlt = new Set();
    const knopf = h("button", { class: "btn primaer gross" }, "Kurs anlegen");
    knopf.addEventListener("click", async () => {
      if (!titel.value.trim()) { titel.focus(); return toast("Bitte einen Titel eingeben.", true); }
      if (!gewaehlt.size) return toast("Bitte mindestens einen Baustein auswählen.", true);
      knopf.disabled = true;
      const bloecke = PNA.TYP_REIHENFOLGE.flatMap((t) => bausteine.filter((b) => b.typ === t && gewaehlt.has(b.id))).map(blockAusVorlage);
      for (let i = 0; i < 6; i++) {
        try {
          const k = await api.kursAnlegen({ code: PNA.neuerCode(), titel: titel.value.trim(), datum: datum.value || null, bloecke });
          return gehe("#/kurs/" + k.id);
        } catch (e) { if (e.status !== 409 && !/duplicate/i.test(e.message)) { knopf.disabled = false; return fehler(e); } }
      }
      knopf.disabled = false; toast("Code-Vergabe fehlgeschlagen – bitte nochmals.", true);
    });
    m.append(h("a", { href: "#/", class: "small" }, "← Kurse"), h("h1", null, "Neuer Kurs"),
      h("div", { class: "karte" }, h("label", { class: "feld" }, h("span", null, "Titel"), titel), h("label", { class: "feld", style: { maxWidth: "220px" } }, h("span", null, "Datum"), datum)),
      h("div", { class: "karte" }, h("h2", null, "Bausteine für diesen Kurs"), h("p", { class: "muted small" }, "Die Reihenfolge kannst du danach anpassen. Die Inhalte werden in den Kurs kopiert – spätere Änderungen an der Vorlage verändern diesen Kurs nicht (ausser du aktualisierst ihn bewusst)."),
        bausteinWahl(bausteine, gewaehlt)), knopf);
    setTimeout(() => titel.focus(), 50);
  }

  function qrOverlay(kurs) {
    const url = PNA.teilnahmeUrl(kurs.code);
    const gr = Math.min(window.innerWidth, window.innerHeight) * 0.55;
    const ov = h("div", { class: "overlay" },
      h("button", { class: "btn zu", onclick: () => ov.remove() }, "Schliessen ✕"),
      h("img", { src: "assets/logo.png", alt: "praxisNA", style: { height: "54px" } }),
      h("h1", { style: { fontSize: "2.2rem" } }, "Mitmachen mit dem Handy"),
      PNA.qrCanvas(url, gr),
      h("div", { class: "url" }, PNA.teilnahmeUrlKurz(kurs.code)),
      h("div", { class: "muted", style: { fontSize: "1.3rem" } }, "Kurscode ", h("b", { style: { color: "#162c4a", letterSpacing: ".12em" } }, kurs.code)));
    const esc = (e) => { if (e.key === "Escape") { ov.remove(); document.removeEventListener("keydown", esc); } };
    document.addEventListener("keydown", esc);
    document.body.appendChild(ov);
  }

  async function kursSeite(id) {
    const m = rahmen("kurse");
    let [kurs, bausteine, antworten] = await Promise.all([api.kurs(id), api.bausteine(), api.antworten(id)]);
    if (!kurs) { m.appendChild(h("div", { class: "karte" }, "Kurs nicht gefunden. ", h("a", { href: "#/" }, "Zur Übersicht"))); return; }
    const url = PNA.teilnahmeUrl(kurs.code);
    const zaehler = {};

    const speichern = async (bloecke, meldung) => {
      try { kurs = await api.kursAendern(kurs.id, { bloecke }); if (meldung) toast(meldung); zeichneAblauf(); } catch (e) { fehler(e); }
    };
    const ablauf = h("div");
    function zeichneAblauf() {
      PNA.leeren(ablauf);
      const bl = kurs.bloecke || [];
      if (!bl.length) ablauf.appendChild(h("p", { class: "muted" }, "Noch keine Bausteine in diesem Kurs."));
      bl.forEach((b, i) => {
        const n = antworten.filter((a) => a.block_key === b.key).length;
        zaehler[b.key] = h("span", { class: "chip" }, n, n === 1 ? " Antwort" : " Antworten");
        const vorlage = bausteine.find((v) => v.id === b.vorlage_id);
        ablauf.appendChild(h("div", { class: "liste-item" }, PNA.hex(b.typ),
          h("div", { class: "grow" }, h("div", { style: { fontWeight: 750, color: "#162c4a" } }, b.titel), h("div", { class: "zeile small muted", style: { marginTop: "4px" } }, PNA.TYPEN[b.typ].name, zaehler[b.key])),
          h("div", { style: { display: "flex", flexDirection: "column", gap: "6px" } },
            h("label", { class: "switch", title: "Für Teilnehmende sichtbar" }, h("input", { type: "checkbox", checked: b.offen, onchange: (e) => {
              const neu = clone(kurs.bloecke); neu[i].offen = e.target.checked; speichern(neu, e.target.checked ? "Für Teilnehmende geöffnet" : "Geschlossen");
            } }), h("span", { class: "bahn" }), h("span", { class: "txt" }, b.offen ? "offen" : "zu")),
            b.typ === "saetze" ? h("label", { class: "switch", title: "Memory mit den Sätzen der anderen Gruppen freigeben" }, h("input", { type: "checkbox", checked: !!b.memory, onchange: (e) => {
              const neu = clone(kurs.bloecke); neu[i].memory = e.target.checked; speichern(neu, e.target.checked ? "Memory freigegeben" : "Memory geschlossen");
            } }), h("span", { class: "bahn" }), h("span", { class: "txt" }, "Memory")) : null),
          h("a", { class: "btn primaer", href: `#/live/${kurs.id}/${b.key}` }, "Live-Ansicht"),
          h("div", { class: "zeile", style: { gap: "2px" } },
            h("button", { class: "icon-btn", title: "nach oben", disabled: i === 0, onclick: () => { const neu = clone(kurs.bloecke); [neu[i - 1], neu[i]] = [neu[i], neu[i - 1]]; speichern(neu); } }, "↑"),
            h("button", { class: "icon-btn", title: "nach unten", disabled: i === bl.length - 1, onclick: () => { const neu = clone(kurs.bloecke); [neu[i + 1], neu[i]] = [neu[i], neu[i + 1]]; speichern(neu); } }, "↓"),
            vorlage ? h("button", { class: "icon-btn", title: "Inhalt aus der Vorlage neu übernehmen", onclick: () => {
              if (!confirm(`Inhalt von «${b.titel}» aus der aktuellen Vorlage übernehmen?\n\nBereits erfasste Antworten bleiben erhalten; bei geänderten Sätzen/Fragen passen sie aber evtl. nicht mehr zusammen.`)) return;
              const neu = clone(kurs.bloecke); neu[i].config = clone(vorlage.config); neu[i].titel = vorlage.titel; speichern(neu, "Aus Vorlage aktualisiert");
            } }, "⟳") : null,
            h("button", { class: "icon-btn", title: "Antworten dieses Bausteins löschen", onclick: async () => {
              if (!confirm(`Alle ${n} Antworten von «${b.titel}» löschen? (z. B. nach einem Testlauf)`)) return;
              try { await api.antwortenLoeschen(kurs.id, b.key); antworten = antworten.filter((a) => a.block_key !== b.key); zeichneAblauf(); toast("Antworten gelöscht"); } catch (e) { fehler(e); }
            } }, "🧹"),
            h("button", { class: "icon-btn", title: "Baustein aus Kurs entfernen", onclick: () => {
              if (!confirm(`«${b.titel}» aus diesem Kurs entfernen?` + (n ? `\nDie ${n} Antworten werden dann nicht mehr angezeigt.` : ""))) return;
              const neu = clone(kurs.bloecke); neu.splice(i, 1); speichern(neu, "Entfernt");
            } }, "✕"))));
      });
      // hinzufügen
      const sel = h("select", { style: { maxWidth: "360px" } }, h("option", { value: "" }, "Baustein hinzufügen …"),
        PNA.TYP_REIHENFOLGE.map((t) => h("optgroup", { label: PNA.TYPEN[t].name }, bausteine.filter((b) => b.typ === t).map((b) => h("option", { value: b.id }, b.titel)))));
      sel.addEventListener("change", () => { const v = bausteine.find((b) => b.id === sel.value); if (v) speichern([...(kurs.bloecke || []), blockAusVorlage(v)], "Hinzugefügt"); });
      ablauf.appendChild(h("div", { class: "zeile", style: { marginTop: "14px" } }, sel,
        bl.some((b) => b.offen || b.memory) ? h("button", { class: "btn klein", onclick: () => speichern(kurs.bloecke.map((b) => ({ ...b, offen: false, memory: false })), "Alle geschlossen") }, "Alle schliessen") : null));
    }

    const titelEl = h("h1", null, kurs.titel);
    m.append(h("a", { href: "#/", class: "small" }, "← Kurse"),
      h("div", { class: "zeile spread" }, h("div", null, titelEl, h("div", { class: "muted" }, PNA.datumText(kurs.datum))),
        h("button", { class: "btn klein", onclick: async () => {
          const t = prompt("Titel des Kurses:", kurs.titel); if (!t || !t.trim()) return;
          try { kurs = await api.kursAendern(kurs.id, { titel: t.trim() }); titelEl.textContent = kurs.titel; } catch (e) { fehler(e); }
        } }, "Titel ändern")),
     
      h("div", { class: "karte" }, h("h2", null, "So machen die Teilnehmenden mit"),
        h("div", { class: "beitritt" }, PNA.qrCanvas(url, 170),
          h("div", null, h("div", { class: "small muted" }, "Kurscode"), h("div", { class: "code-gross" }, kurs.code),
            h("div", { class: "small", style: { wordBreak: "break-all", margin: "4px 0 12px" } }, url),
            h("div", { class: "zeile" },
              h("button", { class: "btn akzent", onclick: () => qrOverlay(kurs) }, "QR-Code auf Beamer zeigen"),
              h("button", { class: "btn", onclick: () => { navigator.clipboard.writeText(url).then(() => toast("Link kopiert"), () => prompt("Link kopieren:", url)); } }, "Link kopieren"),
              h("a", { class: "btn", href: url, target: "_blank" }, "Teilnahme-Seite öffnen"))))),
      h("div", { class: "karte" }, h("h2", null, "Ablauf"), h("p", { class: "small muted" }, "Mit dem Schalter öffnest du einen Baustein für die Teilnehmenden. Die Live-Ansicht zeigt die Resultate für den Beamer. Bei den Sätzen gibt der zweite Schalter das Memory frei: Jede Gruppe spielt mit den Formulierungen der anderen Gruppen."), ablauf),
      h("div", { style: { marginTop: "30px" } }, h("button", { class: "btn gefahr", onclick: async () => {
        if (!confirm(`Kurs «${kurs.titel}» mit allen Antworten endgültig löschen?`)) return;
        try { await api.kursLoeschen(kurs.id); toast("Kurs gelöscht"); gehe("#/"); } catch (e) { fehler(e); }
      } }, "Kurs löschen")));
    zeichneAblauf();

    timer = setInterval(async () => {
      try {
        antworten = await api.antworten(id);
        for (const [key, el] of Object.entries(zaehler)) { const n = antworten.filter((a) => a.block_key === key).length; el.textContent = n + (n === 1 ? " Antwort" : " Antworten"); }
      } catch (e) {}
    }, 5000);
  }

  // ---------- Live-Ansicht ----------
  async function liveSeite(id, key) {
    PNA.leeren(app);
    document.body.classList.add("live");
    let kurs = await api.kurs(id);
    if (!kurs) return gehe("#/");
    let block = kurs.bloecke.find((b) => b.key === key) || kurs.bloecke[0];
    if (!block) return gehe("#/kurs/" + id);
    const zustand = { modus: "einzeln", idx: 0, schnitt: PNA.ls.get("pna-schnitt-v2", false), ansicht: PNA.ls.get("pna-praesenz-ansicht", "punkte") };
    let antworten = [], signatur = "";

    const steuerung = h("div", { class: "zeile no-print" });
    const tabs = h("div", { class: "tabs" }, kurs.bloecke.map((b) => h("a", { href: `#/live/${id}/${b.key}`, class: b.key === block.key ? "aktiv" : "" }, b.titel)));
    app.appendChild(h("div", { class: "live-kopf" }, h("a", { href: "#/kurs/" + id, title: "Zurück zum Kurs" }, h("img", { class: "logo", src: "assets/logo.png", alt: "praxisNA" })), tabs, steuerung));

    const offenSchalter = h("label", { class: "switch no-print" }, h("input", { type: "checkbox", checked: block.offen, onchange: async (e) => {
      const neu = clone(kurs.bloecke); const i = neu.findIndex((b) => b.key === block.key); neu[i].offen = e.target.checked;
      try { kurs = await api.kursAendern(kurs.id, { bloecke: neu }); block = kurs.bloecke[i]; schalterText.textContent = block.offen ? "offen für Teilnehmende" : "geschlossen"; } catch (err) { fehler(err); }
    } }), h("span", { class: "bahn" }));
    const schalterText = h("span", { class: "txt" }, block.offen ? "offen für Teilnehmende" : "geschlossen");
    offenSchalter.appendChild(schalterText);

    const inhalt = h("div");
    const main = h("div", { class: "live-main" },
      h("div", { class: "print-kopf" }, h("img", { src: "assets/logo.png", alt: "praxisNA" }), h("div", { class: "muted" }, kurs.titel, kurs.datum ? " · " + PNA.datumText(kurs.datum) : "")),
      h("div", { class: "live-titel" }, h("div", null, h("h1", null, block.titel)), offenSchalter), inhalt);
    app.appendChild(main);
    app.appendChild(h("div", { class: "live-fuss" }, h("span", null, h("span", { class: "puls" }), "live"),
      h("span", null, "Mitmachen: ", h("b", { style: { letterSpacing: "0" } }, PNA.teilnahmeUrlKurz(kurs.code)), " · Code ", h("b", null, kurs.code))));

    const aktionen = block.typ === "saetze" ? {
      entfernen: async (a, itemId) => {
        if (!confirm("Diese Formulierung löschen?")) return;
        const d = clone(a.daten); delete d.answers[itemId];
        try { await api.antwortAendern(a.id, d); await holen(true); } catch (e) { fehler(e); }
      },
    } : null;

    function zeichnen() {
      PNA.leeren(inhalt);
      const eigene = antworten.filter((a) => a.block_key === block.key);
      PNA.resultate[block.typ](inhalt, block, eigene, zustand, aktionen);
      zeichneSteuerung();
    }
    function zeichneSteuerung() {
      PNA.leeren(steuerung);
      if (block.typ === "saetze") {
        const n = (block.config.items || []).length;
        if (zustand.modus === "einzeln" && n) {
          steuerung.append(h("div", { class: "satz-nav" },
            h("button", { class: "btn", disabled: zustand.idx <= 0, onclick: () => { zustand.idx--; zeichnen(); } }, "←"),
            h("span", { class: "stand" }, `Satz ${zustand.idx + 1} / ${n}`),
            h("button", { class: "btn", disabled: zustand.idx >= n - 1, onclick: () => { zustand.idx++; zeichnen(); } }, "→")));
        }
        steuerung.appendChild(h("button", { class: "btn", onclick: () => { zustand.modus = zustand.modus === "alle" ? "einzeln" : "alle"; zeichnen(); } }, zustand.modus === "alle" ? "Satz für Satz" : "Alle Sätze"));
      }
      if (block.typ === "werte") steuerung.appendChild(h("button", { class: "btn", onclick: wolkeBild }, "Bild (PNG)"));
      if (block.typ === "praesenz" || (block.typ === "auswertung" && (block.config.fragen || []).some((f) => f.typ === "skala"))) {
        if (block.typ === "praesenz") {
          steuerung.appendChild(h("div", { class: "segment" },
            [["punkte", "Punkte"], ["raster", "Raster"]].map(([k, t]) => h("button", { class: zustand.ansicht === k ? "an" : "", onclick: () => {
              zustand.ansicht = k; PNA.ls.set("pna-praesenz-ansicht", k); zeichnen();
            } }, t))));
        }
        steuerung.appendChild(h("button", { class: "btn", title: "Durchschnitt ein-/ausblenden", onclick: () => {
          zustand.schnitt = !zustand.schnitt; PNA.ls.set("pna-schnitt-v2", zustand.schnitt); zeichnen();
        } }, zustand.schnitt ? "Ø ausblenden" : "Ø einblenden"));
      }
      steuerung.append(
        h("button", { class: "btn", onclick: drucken, title: "Im Druckdialog «Als PDF speichern» wählen" }, "PDF"),
        h("button", { class: "btn", onclick: () => PNA.csv(kurs, block, antworten.filter((a) => a.block_key === block.key)), title: "Tabelle für Excel" }, "CSV"),
        h("button", { class: "btn", onclick: () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen && document.documentElement.requestFullscreen()) }, "⛶"));
    }
    function drucken() {
      const vorher = zustand.modus;
      if (block.typ === "saetze") { zustand.modus = "alle"; zeichnen(); }
      const nachher = () => { window.removeEventListener("afterprint", nachher); if (zustand.modus !== vorher) { zustand.modus = vorher; zeichnen(); } };
      window.addEventListener("afterprint", nachher);
      setTimeout(() => window.print(), 300);
    }
    function wolkeBild() {
      const quelle = zustand.canvas; if (!quelle) return;
      const pad = 40 * 2, kopfH = 120 * 2;
      const c = document.createElement("canvas"); c.width = quelle.width + pad * 2; c.height = quelle.height + kopfH + pad;
      const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
      const logo = new Image();
      logo.onload = () => {
        const lh = 60 * 2; ctx.drawImage(logo, pad, pad * 0.6, (logo.width / logo.height) * lh, lh);
        ctx.fillStyle = "#162c4a"; ctx.font = `800 ${32 * 2}px ${getComputedStyle(document.body).fontFamily}`; ctx.textAlign = "right"; ctx.textBaseline = "middle";
        ctx.fillText(block.titel, c.width - pad, pad * 0.6 + lh / 2);
        ctx.drawImage(quelle, pad, kopfH);
        const a = document.createElement("a"); a.href = c.toDataURL("image/png"); a.download = `${kurs.titel} - ${block.titel}.png`; document.body.appendChild(a); a.click(); a.remove();
      };
      logo.src = "assets/logo.png";
    }
    async function holen(erzwingen) {
      try {
        antworten = await api.antworten(id);
        const sig = JSON.stringify(antworten.filter((a) => a.block_key === block.key).map((a) => [a.id, a.gruppe, a.daten]));
        if (erzwingen || sig !== signatur) { signatur = sig; zeichnen(); }
      } catch (e) { console.warn(e); }
    }
    const tasten = (e) => {
      if (block.typ !== "saetze" || zustand.modus !== "einzeln" || /input|textarea/i.test(e.target.tagName)) return;
      const n = (block.config.items || []).length;
      if ((e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") && zustand.idx < n - 1) { e.preventDefault(); zustand.idx++; zeichnen(); }
      if ((e.key === "ArrowLeft" || e.key === "PageUp") && zustand.idx > 0) { e.preventDefault(); zustand.idx--; zeichnen(); }
    };
    document.addEventListener("keydown", tasten);
    let breite = window.innerWidth;
    const groesse = () => { if ((block.typ === "werte" || block.typ === "auswertung") && Math.abs(window.innerWidth - breite) > 30) { breite = window.innerWidth; zeichnen(); } };
    window.addEventListener("resize", groesse);
    aufraeumen.push(() => { document.removeEventListener("keydown", tasten); window.removeEventListener("resize", groesse); });

    zeichneSteuerung();
    await holen(true);
    timer = setInterval(() => holen(false), 3000);
  }

  // ---------- Bausteine ----------
  function zusammenfassung(b) {
    const c = b.config || {};
    if (b.typ === "saetze") return `${(c.items || []).length} Sätze`;
    if (b.typ === "praesenz") return `${(c.ebenen || []).length} Ebenen`;
    if (b.typ === "werte") return `${c.anzahl || 3} Werte pro Person`;
    return `${(c.fragen || []).length} Fragen`;
  }

  async function bausteineSeite() {
    const m = rahmen("bausteine");
    const bausteine = await api.bausteine();
    m.append(h("h1", null, "Bausteine"), h("p", { class: "muted" }, "Hier gestaltest du die Vorlagen. Beim Anlegen eines Kurses wählst du daraus aus."));
    if (!bausteine.length) m.appendChild(h("div", { class: "karte" }, h("p", null, "Noch keine Bausteine."),
      h("button", { class: "btn akzent", onclick: async (e) => { e.target.disabled = true; try { for (const b of PNA.startVorlagen()) await api.bausteinSpeichern(b); route(); } catch (err) { fehler(err); } } }, "Startvorlagen anlegen")));
    PNA.TYP_REIHENFOLGE.forEach((typ) => {
      const liste = bausteine.filter((b) => b.typ === typ);
      m.appendChild(h("div", { class: "karte" },
        h("div", { class: "zeile spread" }, h("div", { class: "zeile" }, PNA.hex(typ), h("h2", { style: { margin: 0 } }, PNA.TYPEN[typ].name)),
          h("a", { class: "btn klein", href: "#/baustein/neu/" + typ }, "+ Neu")),
        liste.length ? liste.map((b) => h("div", { class: "liste-item" },
          h("div", { class: "grow" }, h("a", { href: "#/baustein/" + b.id, style: { fontWeight: 700, textDecoration: "none" } }, b.titel), h("div", { class: "small muted" }, zusammenfassung(b))),
          h("a", { class: "btn klein", href: "#/baustein/" + b.id }, "Bearbeiten"),
          h("button", { class: "btn klein", onclick: async () => { try { await api.bausteinSpeichern({ typ: b.typ, titel: b.titel + " (Kopie)", config: clone(b.config) }); route(); } catch (e) { fehler(e); } } }, "Duplizieren"),
          h("button", { class: "btn klein gefahr", onclick: async () => { if (!confirm(`Vorlage «${b.titel}» löschen? Bestehende Kurse behalten ihre Kopie.`)) return; try { await api.bausteinLoeschen(b.id); route(); } catch (e) { fehler(e); } } }, "Löschen")))
          : h("p", { class: "muted small", style: { marginTop: "10px" } }, "Noch keine Vorlage.")));
    });
  }

  // Liste mit ↑ ↓ ✕
  function listenKnoepfe(arr, i, neuZeichnen) {
    return h("div", { class: "zeile", style: { gap: "2px", marginLeft: "auto" } },
      h("button", { class: "icon-btn", type: "button", title: "nach oben", disabled: i === 0, onclick: () => { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; neuZeichnen(); } }, "↑"),
      h("button", { class: "icon-btn", type: "button", title: "nach unten", disabled: i === arr.length - 1, onclick: () => { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; neuZeichnen(); } }, "↓"),
      h("button", { class: "icon-btn", type: "button", title: "entfernen", onclick: () => { arr.splice(i, 1); neuZeichnen(); } }, "✕"));
  }
  const textFeld = (obj, feld, attrs = {}) => { const el = h(attrs.mehrzeilig ? "textarea" : "input", { type: "text", rows: attrs.rows || 2, placeholder: attrs.placeholder || "" }); el.value = obj[feld] || ""; el.addEventListener("input", () => (obj[feld] = el.value)); return el; };

  async function bausteinEditor(idOderNeu, typNeu) {
    const m = rahmen("bausteine");
    let b;
    if (idOderNeu === "neu") b = { typ: typNeu, titel: "", config: PNA.leereConfig(typNeu) };
    else { b = (await api.bausteine()).find((x) => x.id === idOderNeu); if (!b) return gehe("#/bausteine"); b = clone(b); }
    const c = b.config;
    const titel = textFeld(b, "titel", { placeholder: "Titel, z. B. Haltungs-Memory Pünt Uster" });
    const bereich = h("div");

    const editoren = {
      saetze() {
        c.items = c.items || [];
        const liste = h("div");
        const zeichne = () => {
          PNA.leeren(liste);
          c.items.forEach((it, i) => {
            const palette = h("div", { class: "symbol-palette hidden" }, PNA.SYMBOLE.map((s) => h("button", { type: "button", onclick: () => { it.symbol = s; zeichne(); } }, s)),
              h("button", { type: "button", title: "kein Symbol", style: { fontSize: ".9rem" }, onclick: () => { it.symbol = ""; zeichne(); } }, "–"));
            liste.appendChild(h("div", { class: "editor-item" },
              h("div", { class: "kopf" }, h("span", { class: "nr" }, i + 1), h("button", { type: "button", class: "symbol-wahl", title: "Symbol wählen", onclick: () => palette.classList.toggle("hidden") }, it.symbol || "＋"),
                h("span", { class: "small muted" }, "Symbol (zur Zuordnung der Karten)"), listenKnoepfe(c.items, i, zeichne)),
              palette, textFeld(it, "text", { mehrzeilig: true, placeholder: "Satz in der alten Autorität …" })));
          });
        };
        zeichne();
        return [h("label", { class: "feld" }, h("span", null, "Anleitung für die Gruppen"), textFeld(c, "anleitung", { mehrzeilig: true })),
          h("h3", null, "Sätze"), liste,
          h("button", { class: "btn", type: "button", onclick: () => { const frei = PNA.SYMBOLE.find((s) => !c.items.some((x) => x.symbol === s)) || ""; c.items.push({ id: PNA.kurzId(), text: "", symbol: frei }); zeichne(); } }, "+ Satz hinzufügen")];
      },
      praesenz() {
        c.ebenen = c.ebenen || [];
        const liste = h("div");
        const zeichne = () => {
          PNA.leeren(liste);
          c.ebenen.forEach((e, i) => {
            const fragen = h("textarea", { rows: 3, placeholder: "Eine Hilfsfrage pro Zeile" }); fragen.value = (e.fragen || []).join("\n");
            fragen.addEventListener("input", () => (e.fragen = fragen.value.split("\n").map((s) => s.trim()).filter(Boolean)));
            liste.appendChild(h("div", { class: "editor-item" }, h("div", { class: "kopf" }, h("span", { class: "nr" }, i + 1), h("b", null, "Ebene"), listenKnoepfe(c.ebenen, i, zeichne)),
              h("div", { class: "grid2", style: { gap: "8px" } }, h("label", { class: "feld" }, h("span", null, "Name"), textFeld(e, "name", { placeholder: "z. B. Physische Präsenz" })),
                h("label", { class: "feld" }, h("span", null, "Untertitel"), textFeld(e, "untertitel", { placeholder: "z. B. körperlich-geistig" }))),
              h("label", { class: "feld" }, h("span", null, "Hilfsfragen (eine pro Zeile)"), fragen)));
          });
        };
        zeichne();
        return [h("label", { class: "feld" }, h("span", null, "Anleitung"), textFeld(c, "anleitung", { mehrzeilig: true })),
          h("p", { class: "small muted" }, "Die Teilnehmenden schätzen sich pro Ebene von 1 bis 10 ein. Die Auswertung ist anonym."), liste,
          h("button", { class: "btn", type: "button", onclick: () => { c.ebenen.push({ id: PNA.kurzId(), name: "", untertitel: "", fragen: [] }); zeichne(); } }, "+ Ebene hinzufügen")];
      },
      werte() {
        const anz = h("input", { type: "number", min: 1, max: 8, value: c.anzahl || 3, style: { maxWidth: "100px" } });
        anz.addEventListener("input", () => (c.anzahl = Math.max(1, Math.min(8, parseInt(anz.value) || 3))));
        return [h("label", { class: "feld" }, h("span", null, "Frage"), textFeld(c, "frage", { mehrzeilig: true })),
          h("label", { class: "feld" }, h("span", null, "Anzahl Werte pro Person"), anz)];
      },
      auswertung() {
        c.fragen = c.fragen || [];
        const liste = h("div");
        const zeichne = () => {
          PNA.leeren(liste);
          c.fragen.forEach((f, i) => {
            const typSel = h("select", { style: { maxWidth: "260px" } }, Object.entries(PNA.FRAGE_TYPEN).map(([k, v]) => h("option", { value: k }, v)));
            typSel.value = f.typ;
            typSel.addEventListener("change", () => {
              f.typ = typSel.value;
              if (f.typ === "skala") { f.max = f.max || 10; f.links = f.links ?? "gar nicht"; f.rechts = f.rechts ?? "sehr"; }
              if (f.typ === "auswahl" && !f.optionen) f.optionen = ["Option 1", "Option 2"];
              if (f.typ === "wolke" && !f.anzahl) f.anzahl = 3;
              zeichne();
            });
            const extra = [];
            if (f.typ === "skala") {
              const max = h("select", { style: { maxWidth: "120px" } }, [5, 6, 7, 10].map((n) => h("option", { value: n }, "1–" + n))); max.value = f.max || 10;
              max.addEventListener("change", () => (f.max = parseInt(max.value)));
              extra.push(h("div", { class: "zeile", style: { alignItems: "flex-end" } },
                h("label", { class: "feld" }, h("span", null, "Bereich"), max),
                h("label", { class: "feld", style: { flex: 1 } }, h("span", null, "Beschriftung links"), textFeld(f, "links")),
                h("label", { class: "feld", style: { flex: 1 } }, h("span", null, "Beschriftung rechts"), textFeld(f, "rechts"))));
            }
            if (f.typ === "wolke") {
              const anz = h("select", { style: { maxWidth: "160px" } }, [1, 2, 3, 4, 5].map((n) => h("option", { value: n }, n + (n === 1 ? " Stichwort" : " Stichworte")))); anz.value = f.anzahl || 3;
              anz.addEventListener("change", () => (f.anzahl = parseInt(anz.value)));
              extra.push(h("label", { class: "feld" }, h("span", null, "Stichworte pro Person"), anz));
            }
            if (f.typ === "auswahl") {
              const opt = h("textarea", { rows: 4 }); opt.value = (f.optionen || []).join("\n");
              opt.addEventListener("input", () => (f.optionen = opt.value.split("\n").map((s) => s.trim()).filter(Boolean)));
              extra.push(h("label", { class: "feld" }, h("span", null, "Optionen (eine pro Zeile)"), opt));
            }
            liste.appendChild(h("div", { class: "editor-item" }, h("div", { class: "kopf" }, h("span", { class: "nr" }, i + 1), typSel, listenKnoepfe(c.fragen, i, zeichne)),
              textFeld(f, "text", { mehrzeilig: true, placeholder: "Frage …" }), extra));
          });
        };
        zeichne();
        return [h("label", { class: "feld" }, h("span", null, "Einleitung für die Teilnehmenden"), textFeld(c, "anleitung", { mehrzeilig: true })),
          h("p", { class: "small muted" }, "Alle Fragen erscheinen gleichzeitig – jede Person antwortet in ihrem Tempo."), liste,
          h("button", { class: "btn", type: "button", onclick: () => { c.fragen.push({ id: PNA.kurzId(), typ: "text", text: "" }); zeichne(); } }, "+ Frage hinzufügen")];
      },
    };
    bereich.append(...editoren[b.typ]());

    const speichern = h("button", { class: "btn primaer gross" }, "Speichern");
    speichern.addEventListener("click", async () => {
      b.titel = (b.titel || "").trim();
      if (!b.titel) return toast("Bitte einen Titel eingeben.", true);
      if (b.typ === "saetze") { c.items = c.items.filter((x) => (x.text || "").trim()); if (!c.items.length) return toast("Bitte mindestens einen Satz erfassen.", true); }
      if (b.typ === "praesenz") { c.ebenen = c.ebenen.filter((x) => (x.name || "").trim()); if (!c.ebenen.length) return toast("Bitte mindestens eine Ebene erfassen.", true); }
      if (b.typ === "auswertung") {
        c.fragen = c.fragen.filter((x) => (x.text || "").trim());
        if (c.fragen.some((f) => f.typ === "auswahl" && (f.optionen || []).length < 2)) return toast("Auswahl-Fragen brauchen mindestens zwei Optionen.", true);
        if (!c.fragen.length) return toast("Bitte mindestens eine Frage erfassen.", true);
      }
      speichern.disabled = true;
      try { await api.bausteinSpeichern(b); toast("Gespeichert"); gehe("#/bausteine"); } catch (e) { speichern.disabled = false; fehler(e); }
    });

    m.append(h("a", { href: "#/bausteine", class: "small" }, "← Bausteine"),
      h("div", { class: "zeile" }, PNA.hex(b.typ), h("h1", { style: { margin: 0 } }, (idOderNeu === "neu" ? "Neu: " : "") + PNA.TYPEN[b.typ].name)),
      h("div", { class: "karte" }, h("label", { class: "feld" }, h("span", null, "Titel"), titel), bereich),
      h("div", { class: "zeile" }, speichern, h("a", { class: "btn", href: "#/bausteine" }, "Abbrechen")));
  }

  route();
})();
