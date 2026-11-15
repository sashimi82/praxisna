// praxisNA Live – Teilnehmenden-Ansicht (Handy)
(function () {
  const { h, api, ls, toast } = PNA;
  const app = document.getElementById("app");
  if (api.demo) document.getElementById("demo-band").classList.remove("hidden");

  const S = { code: "", kurs: null, token: "", ersterLoad: true, blockSignatur: "" };

  const kopf = () => h("div", { class: "tn-kopf" }, h("img", { class: "logo", src: "assets/logo.png", alt: "praxisNA" }),
    S.code ? h("span", { class: "chip" }, "Kurs ", S.code) : null);

  const speicherKey = (key) => `pna-${S.code}-${key}`;
  const lokal = (key) => ls.get(speicherKey(key), { gruppe: "", entwurf: {}, gesendet: null });
  const lokalSetzen = (key, v) => ls.set(speicherKey(key), v);

  // ---------- Start ----------
  function start() {
    const p = new URLSearchParams(location.search);
    S.code = (p.get("c") || p.get("code") || "").trim().toUpperCase();
    if (!S.code) return codeEingabe();
    laden(true);
    setInterval(() => laden(false), 6000);
    window.addEventListener("hashchange", zeigen);
  }

  function codeEingabe(fehler) {
    PNA.leeren(app);
    const inp = h("input", { type: "text", placeholder: "z. B. K7M2P", autocapitalize: "characters", autocomplete: "off", style: { fontSize: "1.6rem", textAlign: "center", letterSpacing: ".15em", textTransform: "uppercase" } });
    const los = () => { const c = inp.value.trim().toUpperCase(); if (c) location.href = "?c=" + encodeURIComponent(c); };
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") los(); });
    app.append(kopf(),
      h("div", { class: "karte", style: { marginTop: "30px", textAlign: "center" } },
        h("h1", null, "Mitmachen"), h("p", { class: "muted" }, "Gib den Kurscode ein, den du auf der Leinwand siehst."),
        fehler ? h("p", { style: { color: "#a3202a", fontWeight: 650 } }, fehler) : null,
        inp, h("div", { style: { height: "12px" } }), h("button", { class: "btn primaer gross", style: { width: "100%" }, onclick: los }, "Los geht's")));
    setTimeout(() => inp.focus(), 50);
  }

  async function laden(erstes) {
    try {
      const k = await api.kursLaden(S.code);
      if (!k) { if (erstes) codeEingabe(`Der Kurscode «${S.code}» wurde nicht gefunden.`); return; }
      S.token = ls.get("pna-token-" + S.code, null) || PNA.uuid();
      ls.set("pna-token-" + S.code, S.token);
      k.bloecke.forEach((b) => { if (b.offen === undefined) b.offen = true; });
      const sig = JSON.stringify(k.bloecke.map((b) => [b.key, b.titel, b.config, b.offen, b.memory]));
      const geaendert = sig !== S.blockSignatur;
      S.kurs = k; S.blockSignatur = sig;
      if (erstes) {
        if (!location.hash && k.bloecke.length === 1 && k.bloecke[0].offen && !k.bloecke[0].memory) { history.replaceState(null, "", "#" + k.bloecke[0].key); }
        zeigen();
      } else if (geaendert) {
        const [aktiv, teil] = location.hash.slice(1).split("/");
        const b = k.bloecke.find((x) => x.key === aktiv);
        if (!aktiv) zeigen();
        else if (!b || (teil === "memory" ? !b.memory : !b.offen)) { toast("Dieser Teil wurde von der Kursleitung geschlossen."); location.hash = ""; }
      }
    } catch (e) {
      if (erstes) {
        PNA.leeren(app).append(kopf(), h("div", { class: "karte" }, h("h2", null, "Keine Verbindung"), h("p", null, "Bitte prüfe deine Internetverbindung und lade die Seite neu."),
          h("button", { class: "btn primaer", onclick: () => location.reload() }, "Neu laden")));
      }
    }
  }

  function zeigen() {
    if (!S.kurs) return;
    const [key, teil] = location.hash.slice(1).split("/");
    const block = S.kurs.bloecke.find((b) => b.key === key);
    PNA.leeren(app);
    app.appendChild(kopf());
    window.scrollTo(0, 0);
    if (!block) return startseite();
    const zurueck = () => h("button", { class: "zurueck", onclick: () => (location.hash = "") }, "← Zur Übersicht");
    app.appendChild(zurueck());
    if (teil === "memory" || !block.offen) {
      if (!block.memory) { location.hash = ""; return; }
      memory(block);
    } else {
      ({ saetze, praesenz, werte, auswertung }[block.typ])(block);
    }
    app.appendChild(h("div", { style: { textAlign: "center", marginTop: "18px" } },
      h("button", { class: "btn", onclick: () => (location.hash = "") }, "← Zurück zur Übersicht")));
  }

  function startseite() {
    app.append(h("h1", null, S.kurs.titel));
    if (!S.kurs.bloecke.length) {
      app.appendChild(h("div", { class: "karte leer" }, h("p", null, h("span", { class: "puls" }), "Gleich geht's los."), h("p", { class: "small" }, "Sobald die Kursleitung eine Übung öffnet, erscheint sie hier automatisch.")));
      return;
    }
    app.appendChild(h("p", { class: "muted" }, "Wähle aus:"));
    S.kurs.bloecke.forEach((b) => {
      const l = lokal(b.key);
      if (b.offen) app.appendChild(h("button", { class: "block-knopf", onclick: () => (location.hash = b.key) }, PNA.hex(b.typ),
        h("div", { class: "grow" }, h("div", { class: "titel" }, b.titel), h("div", { class: "small muted" }, PNA.TYPEN[b.typ].name)),
        l.gesendet ? h("span", { class: "chip ok" }, "✓") : h("span", { style: { fontSize: "1.3rem", color: "#9aa3b0" } }, "›")));
      if (b.memory) app.appendChild(h("button", { class: "block-knopf memory-knopf", onclick: () => (location.hash = b.key + "/memory") },
        h("div", { class: "hex", style: { background: "var(--bordeaux)" } }, "M"),
        h("div", { class: "grow" }, h("div", { class: "titel" }, "Memory spielen"), h("div", { class: "small muted" }, "mit den Sätzen der anderen Gruppen")),
        h("span", { style: { fontSize: "1.3rem", color: "#9aa3b0" } }, "›")));
    });
  }

  // ---------- Memory ----------
  async function memory(block) {
    app.append(h("h1", null, "Memory"));
    const bereich = h("div", null, h("p", { class: "muted" }, "Karten werden gemischt …"));
    app.appendChild(bereich);
    let daten;
    try { daten = await api.memoryLaden(S.code, block.key, S.token); }
    catch (e) { PNA.leeren(bereich).appendChild(h("div", { class: "karte" }, "Die Karten konnten nicht geladen werden. Bitte versuche es nochmals.")); return; }
    const items = block.config.items || [];
    const pool = items.map((it) => ({ it, antworten: daten.filter((d) => d.item === it.id) })).filter((x) => x.antworten.length);
    if (pool.length < 2) {
      PNA.leeren(bereich).appendChild(h("div", { class: "karte leer" }, h("p", null, "Es gibt noch zu wenige Sätze der anderen Gruppen."),
        h("button", { class: "btn primaer", onclick: zeigen }, "Nochmals versuchen")));
      return;
    }
    const mischen = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    let mitSymbolen = PNA.ls.get("pna-memory-symbole", true);
    const auswahl = () => {
      PNA.leeren(bereich);
      const n = pool.length;
      const optionen = [...new Set([Math.min(4, n), Math.min(6, n), Math.min(8, n), n])].filter((x) => x >= 2);
      const stufe = h("div", { class: "zeile" });
      const zeichneStufe = () => {
        PNA.leeren(stufe).append(
          h("button", { class: "btn " + (mitSymbolen ? "primaer" : ""), onclick: () => { mitSymbolen = true; PNA.ls.set("pna-memory-symbole", true); zeichneStufe(); } }, "Leichter – mit Symbolen"),
          h("button", { class: "btn " + (!mitSymbolen ? "primaer" : ""), onclick: () => { mitSymbolen = false; PNA.ls.set("pna-memory-symbole", false); zeichneStufe(); } }, "Schwerer – ohne Symbole"));
      };
      zeichneStufe();
      bereich.append(h("p", null, "Findet die Paare: Zu jedem Satz der ", h("b", { style: { color: "var(--bordeaux)" } }, "alten Autorität"), " gehört eine Formulierung der ",
        h("b", { style: { color: "#17673a" } }, "neuen Autorität"), " – geschrieben von einer anderen Gruppe."),
        h("p", { class: "muted small", style: { marginBottom: "6px" } }, "1. Schwierigkeit wählen"), stufe,
        h("p", { class: "muted small", style: { margin: "16px 0 6px" } }, "2. Wie viele Paare möchtet ihr spielen?"),
        h("div", { class: "zeile" }, optionen.map((k) => h("button", { class: "btn akzent", onclick: () => spiel(k) }, k === n ? `Alle (${k})` : `${k} Paare`))));
    };
    const spiel = (k) => {
      const paare = mischen(pool.slice()).slice(0, k).map((p, i) => ({ i, it: p.it, neu: p.antworten[Math.floor(Math.random() * p.antworten.length)] }));
      const karten = mischen(paare.flatMap((p) => [{ paar: p.i, art: "alt", text: p.it.text, symbol: p.it.symbol }, { paar: p.i, art: "neu", text: p.neu.text, symbol: p.it.symbol }]));
      let offen = [], gefunden = 0, zuege = 0;
      const stand = h("div", { class: "zeile spread small muted", style: { marginBottom: "10px" } });
      const standText = () => { stand.textContent = `Gefunden: ${gefunden} / ${paare.length}  ·  Züge: ${zuege}`; };
      const grid = h("div", { class: "memory-grid" });
      const els = karten.map((kt) => {
        const el = h("button", { class: "mkarte", "aria-label": "Karte" },
          h("div", { class: "rueck" }, h("span", null, "praxis"), h("b", null, "NA")),
          h("div", { class: "vorne " + kt.art }, h("div", { class: "mkopf" }, h("span", null, kt.art === "alt" ? "alt" : "neu"), h("span", null, mitSymbolen ? kt.symbol || "" : "")), h("div", { class: "mtext" }, kt.text)));
        el.addEventListener("click", () => tippen(kt, el));
        return el;
      });
      const tippen = (kt, el) => {
        if (el.classList.contains("paar")) return;
        if (offen.length === 2) { offen.forEach((o) => o.el.classList.remove("auf")); offen = []; }
        if (el.classList.contains("auf")) return;
        el.classList.add("auf"); offen.push({ kt, el });
        if (offen.length === 2) {
          zuege++;
          const [a, b] = offen;
          if (a.kt.paar === b.kt.paar) {
            gefunden++; a.el.classList.add("paar"); b.el.classList.add("paar"); offen = [];
            if (gefunden === paare.length) setTimeout(fertig, 700);
          }
          standText();
        }
      };
      const fertig = () => {
        PNA.leeren(bereich);
        bereich.append(h("div", { class: "karte", style: { textAlign: "center" } }, h("div", { style: { fontSize: "2.4rem" } }, "🎉"),
          h("h2", null, "Geschafft!"), h("p", { class: "muted" }, `Alle ${paare.length} Paare in ${zuege} Zügen gefunden.`),
          h("div", { class: "zeile", style: { justifyContent: "center" } }, h("button", { class: "btn primaer", onclick: auswahl }, "Nochmals spielen"))),
          h("h3", { style: { marginTop: "18px" } }, "Alle Paare zum Nachlesen"),
          ...paare.map((p) => h("div", { class: "satz-karte" },
            h("div", { class: "satz-alt" }, p.it.symbol ? h("div", { class: "sym" }, p.it.symbol) : null, h("div", null, h("div", { class: "label-klein" }, "Alte Autorität"), h("div", { class: "txt" }, p.it.text))),
            h("div", { class: "label-klein" }, "Neue Autorität"), h("div", { style: { color: "var(--navy)", fontWeight: 600 } }, p.neu.text),
            p.neu.gruppe ? h("div", { class: "small muted", style: { marginTop: "4px" } }, p.neu.gruppe) : null)));
        window.scrollTo(0, 0);
      };
      PNA.leeren(bereich);
      standText();
      bereich.append(stand, h("p", { class: "small muted", style: { marginTop: 0 } }, "Tippe zwei Karten an. Passen sie nicht, tippe einfach weiter."), grid);
      els.forEach((e) => grid.appendChild(e));
    };
    auswahl();
  }

  async function senden(block, gruppe, daten) {
    try {
      const ok = await api.antwortSpeichern(S.code, block.key, S.token, gruppe, daten);
      if (ok === false) { toast("Dieser Teil ist im Moment geschlossen.", true); return false; }
      return true;
    } catch (e) {
      toast("Nicht gespeichert – bitte nochmals versuchen.", true); return false;
    }
  }

  // ---------- Alte → neue Autorität ----------
  function saetze(block) {
    const st = lokal(block.key);
    const items = block.config.items || [];
    if (!st.gruppe) {
      const inp = h("input", { type: "text", placeholder: "z. B. Gruppe 3 oder eure Vornamen", maxlength: 60 });
      const weiter = () => { const g = inp.value.trim(); if (!g) return inp.focus(); st.gruppe = g; lokalSetzen(block.key, st); zeigen(); };
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter") weiter(); });
      app.append(h("h1", null, block.titel),
        h("div", { class: "karte" }, h("h2", null, "Wie heisst eure Gruppe?"), h("p", { class: "muted small" }, "Der Name erscheint auf der Leinwand bei euren Sätzen. Pro Gruppe genügt ein Handy."),
          inp, h("div", { style: { height: "12px" } }), h("button", { class: "btn primaer gross", style: { width: "100%" }, onclick: weiter }, "Weiter")));
      setTimeout(() => inp.focus(), 50);
      return;
    }
    const gesendet = (st.gesendet && st.gesendet.answers) || {};
    const balken = h("div");
    const stand = h("div", { class: "small muted" });
    const fortschritt = () => {
      const n = items.filter((it) => (gesendet[it.id] || "").trim()).length;
      stand.textContent = `${n} von ${items.length} Sätzen gespeichert`;
      balken.style.width = (items.length ? (n / items.length) * 100 : 0) + "%";
    };
    app.append(h("h1", null, block.titel),
      h("div", { class: "zeile spread" }, h("div", null, "Gruppe: ", h("b", null, st.gruppe)),
        h("button", { class: "btn klein", onclick: () => { const g = prompt("Gruppenname ändern:", st.gruppe); if (g && g.trim()) { st.gruppe = g.trim(); lokalSetzen(block.key, st); if (st.gesendet) senden(block, st.gruppe, st.gesendet); zeigen(); } } }, "ändern")),
      block.config.anleitung ? h("p", { class: "muted small" }, block.config.anleitung) : null,
      stand, h("div", { class: "fortschritt" }, balken));
    fortschritt();

    items.forEach((it) => {
      const ta = h("textarea", { rows: 3, placeholder: "So klingt der Satz in der Neuen Autorität …" });
      ta.value = st.entwurf[it.id] !== undefined ? st.entwurf[it.id] : gesendet[it.id] || "";
      const knopf = h("button", { class: "btn primaer" }, "OK");
      const status = h("span", { class: "gespeichert" });
      const karte = h("div", { class: "satz-karte" },
        h("div", { class: "satz-alt" }, it.symbol ? h("div", { class: "sym" }, it.symbol) : null, h("div", null, h("div", { class: "label-klein" }, "Alte Autorität"), h("div", { class: "txt" }, it.text))),
        h("div", { class: "label-klein" }, "Neue Autorität"), ta,
        h("div", { class: "zeile spread", style: { marginTop: "8px" } }, status, knopf));
      const aktual = () => {
        const v = ta.value.trim(), s = (gesendet[it.id] || "").trim();
        const fertig = !!s && v === s;
        karte.classList.toggle("fertig", fertig);
        status.textContent = fertig ? "✓ Gespeichert" : s ? "Geändert – noch nicht gespeichert" : "";
        status.style.color = fertig ? "" : "#a86a00";
        knopf.disabled = !v || fertig;
        knopf.textContent = s && !fertig ? "Änderung speichern" : "OK";
      };
      ta.addEventListener("input", () => { st.entwurf[it.id] = ta.value; lokalSetzen(block.key, st); aktual(); });
      knopf.addEventListener("click", async () => {
        const v = ta.value.trim(); if (!v) return;
        knopf.disabled = true; knopf.textContent = "…";
        const neu = { answers: { ...gesendet, [it.id]: v } };
        if (await senden(block, st.gruppe, neu)) {
          gesendet[it.id] = v; st.gesendet = neu; delete st.entwurf[it.id]; lokalSetzen(block.key, st);
          fortschritt(); toast("Gespeichert ✓");
        }
        aktual();
      });
      aktual();
      app.appendChild(karte);
    });
  }

  // ---------- Präsenz-Ebenen ----------
  function praesenz(block) {
    const st = lokal(block.key);
    const ebenen = block.config.ebenen || [];
    const wahl = { ...((st.gesendet && st.gesendet.ratings) || {}), ...(st.entwurf.ratings || {}) };
    app.append(h("h1", null, block.titel), block.config.anleitung ? h("p", { class: "muted" }, block.config.anleitung) : null);
    const knopf = h("button", { class: "btn primaer gross", style: { width: "100%" } });
    const info = h("div", { class: "small muted", style: { textAlign: "center", marginTop: "6px" } });
    const aktual = () => {
      const n = ebenen.filter((e) => wahl[e.id]).length;
      const gleich = st.gesendet && JSON.stringify(st.gesendet.ratings) === JSON.stringify(wahl);
      knopf.disabled = n < ebenen.length || gleich;
      knopf.textContent = gleich ? "✓ Gesendet" : st.gesendet ? "Änderungen senden" : "Absenden";
      info.textContent = n < ebenen.length ? `${n} von ${ebenen.length} Ebenen eingeschätzt` : gleich ? "Danke! Du kannst deine Einschätzung jederzeit anpassen." : "";
    };
    ebenen.forEach((e) => {
      const knoepfe = [];
      const reihe = h("div", { class: "skala-knoepfe" }, Array.from({ length: 10 }, (_, i) => {
        const b = h("button", { class: wahl[e.id] === i + 1 ? "an" : "", onclick: () => {
          wahl[e.id] = i + 1; st.entwurf.ratings = wahl; lokalSetzen(block.key, st);
          knoepfe.forEach((x, j) => x.classList.toggle("an", j === i)); aktual();
        } }, i + 1);
        knoepfe.push(b); return b;
      }));
      app.appendChild(h("div", { class: "satz-karte" },
        h("h3", { style: { marginBottom: "2px" } }, e.name), e.untertitel ? h("div", { class: "small muted" }, e.untertitel) : null,
        e.fragen && e.fragen.length ? h("ul", { class: "fragen-liste" }, e.fragen.map((f) => h("li", null, f))) : null,
        reihe, h("div", { class: "skala-enden" }, h("span", null, "1"), h("span", null, "10"))));
    });
    knopf.addEventListener("click", async () => {
      knopf.disabled = true;
      const daten = { ratings: { ...wahl } };
      if (await senden(block, null, daten)) { st.gesendet = daten; st.entwurf = {}; lokalSetzen(block.key, st); toast("Danke, gesendet ✓"); }
      aktual();
    });
    app.appendChild(h("div", { class: "sticky-unten" }, knopf, info));
    aktual();
  }

  // ---------- Werte ----------
  function werte(block) {
    const st = lokal(block.key);
    const n = Math.max(1, Math.min(8, block.config.anzahl || 3));
    const start = st.entwurf.werte || (st.gesendet && st.gesendet.werte) || [];
    app.append(h("h1", null, block.titel), h("p", { style: { fontWeight: 650, color: "#162c4a", fontSize: "1.1rem" } }, block.config.frage || ""),
      h("p", { class: "small muted" }, "Pro Feld ein Wert – am besten ein einzelnes Wort."));
    const felder = Array.from({ length: n }, (_, i) => {
      const f = h("input", { type: "text", maxlength: 40, placeholder: `Wert ${i + 1}`, value: start[i] || "" });
      f.addEventListener("input", () => { st.entwurf.werte = felder.map((x) => x.value); lokalSetzen(block.key, st); aktual(); });
      return f;
    });
    const knopf = h("button", { class: "btn primaer gross", style: { width: "100%" } });
    const werteJetzt = () => felder.map((f) => f.value.trim()).filter(Boolean);
    const aktual = () => {
      const gleich = st.gesendet && JSON.stringify(st.gesendet.werte) === JSON.stringify(werteJetzt());
      knopf.disabled = !werteJetzt().length || gleich;
      knopf.textContent = gleich ? "✓ Gesendet – danke!" : st.gesendet ? "Änderungen senden" : "Absenden";
    };
    knopf.addEventListener("click", async () => {
      knopf.disabled = true;
      const daten = { werte: werteJetzt() };
      if (await senden(block, null, daten)) { st.gesendet = daten; st.entwurf = {}; lokalSetzen(block.key, st); toast("Danke, gesendet ✓"); }
      aktual();
    });
    app.appendChild(h("div", { class: "karte" }, felder.map((f) => h("div", { style: { marginBottom: "10px" } }, f)), knopf));
    aktual();
  }

  // ---------- Auswertung ----------
  function auswertung(block) {
    const st = lokal(block.key);
    const fragen = block.config.fragen || [];
    const ant = { ...((st.gesendet && st.gesendet.antworten) || {}), ...(st.entwurf.antworten || {}) };
    const merken = () => { st.entwurf.antworten = ant; lokalSetzen(block.key, st); aktual(); };
    app.append(h("h1", null, block.titel), block.config.anleitung ? h("p", { class: "muted" }, block.config.anleitung) : null);

    fragen.forEach((f, fi) => {
      const k = h("div", { class: "satz-karte" }, h("h3", null, `${fi + 1}. ${f.text}`));
      if (f.typ === "text") {
        const ta = h("textarea", { rows: 3, placeholder: "Deine Antwort …", maxlength: 1500 });
        ta.value = ant[f.id] || "";
        ta.addEventListener("input", () => { if (ta.value.trim()) ant[f.id] = ta.value; else delete ant[f.id]; merken(); });
        k.appendChild(ta);
      } else if (f.typ === "skala") {
        const max = f.max || 10, kn = [];
        k.append(h("div", { class: "skala-knoepfe", style: { gridTemplateColumns: `repeat(${max},1fr)` } }, Array.from({ length: max }, (_, i) => {
          const b = h("button", { class: ant[f.id] === i + 1 ? "an" : "", onclick: () => { ant[f.id] = i + 1; kn.forEach((x, j) => x.classList.toggle("an", j === i)); merken(); } }, i + 1);
          kn.push(b); return b;
        })), h("div", { class: "skala-enden" }, h("span", null, f.links || ""), h("span", null, f.rechts || "")));
      } else if (f.typ === "daumen") {
        const hoch = h("button", { "aria-label": "Daumen hoch" }, "👍"), runter = h("button", { class: "runter", "aria-label": "Daumen runter" }, "👎");
        const setz = () => { hoch.classList.toggle("an", ant[f.id] === "hoch"); runter.classList.toggle("an", ant[f.id] === "runter"); };
        hoch.onclick = () => { ant[f.id] = "hoch"; setz(); merken(); };
        runter.onclick = () => { ant[f.id] = "runter"; setz(); merken(); };
        setz(); k.appendChild(h("div", { class: "daumen" }, hoch, runter));
      } else if (f.typ === "wolke") {
        const n = Math.max(1, Math.min(5, f.anzahl || 3));
        const start = Array.isArray(ant[f.id]) ? ant[f.id] : [];
        const felder = Array.from({ length: n }, (_, i) => h("input", { type: "text", maxlength: 40, placeholder: n > 1 ? `Stichwort ${i + 1}` : "Stichwort", value: start[i] || "" }));
        felder.forEach((x) => x.addEventListener("input", () => { const w = felder.map((y) => y.value); if (w.some((v) => v.trim())) ant[f.id] = w; else delete ant[f.id]; merken(); }));
        k.append(h("div", { class: "small muted", style: { marginBottom: "6px" } }, n > 1 ? "Pro Feld ein Wort." : "Ein Wort oder ein kurzer Begriff."), ...felder.map((x) => h("div", { style: { marginBottom: "8px" } }, x)));
      } else if (f.typ === "auswahl") {
        const kn = (f.optionen || []).map((o) => h("button", { class: ant[f.id] === o ? "an" : "", onclick: () => { ant[f.id] = o; kn.forEach((x) => x.classList.toggle("an", x.textContent === o)); merken(); } }, o));
        k.appendChild(h("div", { class: "optionen" }, kn));
      }
      app.appendChild(k);
    });

    const knopf = h("button", { class: "btn primaer gross", style: { width: "100%" } });
    const info = h("div", { class: "small muted", style: { textAlign: "center", marginTop: "6px" } });
    const aktual = () => {
      const n = Object.keys(sauber()).length;
      const gleich = st.gesendet && JSON.stringify(st.gesendet.antworten) === JSON.stringify(sauber());
      knopf.disabled = !n || gleich;
      knopf.textContent = gleich ? "✓ Gesendet – herzlichen Dank!" : st.gesendet ? "Änderungen senden" : "Absenden";
      info.textContent = `${n} von ${fragen.length} Fragen beantwortet`;
    };
    const sauber = () => {
      const o = {};
      fragen.forEach((f) => {
        let v = ant[f.id];
        if (Array.isArray(v)) v = v.map((x) => String(x).trim()).filter(Boolean);
        else if (typeof v === "string") v = v.trim();
        if (v === undefined || v === "" || (Array.isArray(v) && !v.length)) return;
        o[f.id] = v;
      });
      return o;
    };
    knopf.addEventListener("click", async () => {
      knopf.disabled = true;
      const daten = { antworten: sauber() };
      if (await senden(block, null, daten)) { st.gesendet = daten; st.entwurf = {}; lokalSetzen(block.key, st); toast("Herzlichen Dank ✓"); }
      aktual();
    });
    app.appendChild(h("div", { class: "sticky-unten" }, knopf, info));
    aktual();
  }

  start();
})();
