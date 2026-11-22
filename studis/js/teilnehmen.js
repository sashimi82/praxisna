// SchuBe Studis – Ansicht für Teilnehmende (Handy)
(function () {
  const { h, leeren, toast, api, BLOECKE, REIHENFOLGE, POSTIT_FARBEN } = SB;
  const app = document.getElementById("app");
  SB.demoBand();

  let token = SB.ls.get("sb-token", null);
  if (!token) { token = SB.uuid(); SB.ls.set("sb-token", token); }
  const params = new URLSearchParams(location.search);
  let code = (params.get("c") || "").trim().toUpperCase();
  let status = null, ansicht = "start", tab = "punkte", bearbeite = null, timer = null;
  let teile = {}; // Elemente der aktuellen Ansicht, die beim Aktualisieren neu gefüllt werden

  const offen = (b) => !!(status && status.offen && status.offen[b]);
  const geloest = (a) => !!(status && status.geloest && status.geloest.includes(a));

  function kopf(mitZurueck) {
    return h("div", { class: "tn-kopf" },
      mitZurueck ? h("button", { class: "zurueck", onclick: () => zeige("start") }, "‹ Übersicht") : SB.logo(),
      h("div", { class: "code" }, "Code " + code));
  }

  // ---------------- Code eingeben ----------------
  function codeEingabe(fehler) {
    leeren(app);
    const inp = h("input", { type: "text", placeholder: "z. B. K7QM", autocapitalize: "characters", autocomplete: "off", style: { fontSize: "1.4rem", letterSpacing: ".12em", textAlign: "center" } });
    const los = async () => { code = inp.value.trim().toUpperCase(); if (code) await laden(true); };
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") los(); });
    app.append(
      h("div", { class: "tn-kopf" }, SB.logo()),
      h("h1", null, "Willkommen"),
      h("p", { class: "sub" }, "Gib den Code ein, der vorne angezeigt wird."),
      h("div", { class: "karte" }, inp, h("div", { style: { height: "10px" } }), h("button", { class: "btn primaer gross", onclick: los }, "Mitmachen"),
        fehler ? h("p", { class: "small", style: { color: "#a3202a", marginBottom: 0 } }, fehler) : null));
    setTimeout(() => inp.focus(), 50);
  }

  // ---------------- Laden & Aktualisieren ----------------
  async function laden(erstesMal) {
    try {
      const s = await api.status(code, token);
      if (!s) { clearInterval(timer); SB.ls.del("sb-code"); return codeEingabe(code ? "Zu diesem Code gibt es kein Treffen." : null); }
      status = s;
      if (erstesMal) {
        SB.ls.set("sb-code", code);
        if (params.get("c") !== code) history.replaceState(null, "", "?c=" + encodeURIComponent(code));
        zeige("start");
        clearInterval(timer); timer = setInterval(() => laden(false), 4000);
      } else aktualisieren();
    } catch (e) {
      if (erstesMal) codeEingabe("Keine Verbindung. Bitte nochmals versuchen.");
    }
  }

  function zeige(v) { ansicht = v; bearbeite = null; teile = {}; leeren(app); window.scrollTo(0, 0);
    if (v === "start") startAnsicht(); else if (v === "einstieg") einstiegAnsicht(); else sammlungAnsicht(v); }

  function aktualisieren() {
    if (ansicht === "start") { leeren(app); startAnsicht(); return; }
    if (ansicht === "einstieg") { einstiegStatus(); return; }
    sammlungStatus();
  }

  // ---------------- Übersicht ----------------
  function startAnsicht() {
    app.append(kopf(false), h("h1", null, status.titel), h("p", { class: "sub" }, "Tippe auf einen Baustein, sobald er offen ist."));
    REIHENFOLGE.forEach((b) => {
      const B = BLOECKE[b], o = offen(b);
      let chip = h("span", { class: "chip" + (o ? "" : " zu") }, o ? "offen" : "noch zu");
      if (b === "einstieg" && o && geloest("punkte") && geloest("muenzen")) chip = h("span", { class: "chip geloest" }, "beide gelöst");
      else if (SB.SAMMLUNGEN.includes(b)) { const n = status.meine.filter((p) => p.block === b).length; if (n && o) chip = h("span", { class: "chip" }, n + (n === 1 ? " Post-it" : " Post-its") + " von dir"); }
      app.append(h("button", { class: "block-knopf", disabled: !o, onclick: () => zeige(b) },
        h("img", { src: B.bild, alt: "" }),
        h("div", null, h("div", { class: "t" }, B.titel), h("div", { class: "s" }, B.sub), chip)));
    });
  }

  // ---------------- Einstieg: Denkaufgaben ----------------
  function einstiegAnsicht() {
    const B = BLOECKE.einstieg;
    const tabs = h("div", { class: "tabs-tn" });
    const felder = { punkte: h("div", { class: "raetsel" }), muenzen: h("div", { class: "raetsel" }) };
    const zu = h("div", { class: "r-meldung nein hidden" }, "Der Einstieg ist jetzt geschlossen.");
    app.append(kopf(true), h("img", { class: "titelbild", src: B.bild, alt: "Denkaufgabe" }), tabs, zu,
      h("div", { class: "karte" }, felder.punkte, felder.muenzen));
    ["punkte", "muenzen"].forEach((a) => {
      const fn = a === "punkte" ? SB.spielPunkte : SB.spielMuenzen;
      fn(felder[a], { onGeloest: () => melden(a) });
    });
    teile = { tabs, felder, zu };
    einstiegStatus();
  }
  function einstiegStatus() {
    const { tabs, felder, zu } = teile; if (!tabs) return;
    const sig = [tab, geloest("punkte"), geloest("muenzen"), offen("einstieg")].join();
    if (teile.sig === sig) return; teile.sig = sig;
    leeren(tabs);
    ["punkte", "muenzen"].forEach((a) => {
      tabs.append(h("button", { class: tab === a ? "an" : "", onclick: () => { tab = a; einstiegStatus(); } },
        SB.AUFGABEN[a].titel, geloest(a) ? h("span", { class: "haken", title: "gelöst" }) : null));
      felder[a].classList.toggle("hidden", tab !== a);
    });
    zu.classList.toggle("hidden", offen("einstieg"));
  }
  async function melden(a) {
    try { await api.geloestMelden(code, token, a); if (status && !status.geloest.includes(a)) status.geloest.push(a); einstiegStatus(); } catch (e) {}
  }

  // ---------------- Sammlung ----------------
  function sammlungAnsicht(b) {
    const B = BLOECKE[b];
    const ta = h("textarea", { class: "neu", maxlength: "300", placeholder: "Ein Gedanke pro Post-it …" });
    const zaehler = h("div", { class: "zaehler" }, "0 / 300");
    const knopf = h("button", { class: "btn blau gross", style: { marginTop: "10px" } }, "Post-it aufkleben");
    const abbrechen = h("button", { class: "btn gross hidden", style: { marginTop: "8px" }, onclick: () => { bearbeite = null; ta.value = ""; formular(); } }, "Abbrechen");
    const zu = h("div", { class: "r-meldung nein hidden" }, "Diese Sammlung ist jetzt geschlossen.");
    const meine = h("div"), alle = h("div");
    ta.addEventListener("input", () => (zaehler.textContent = ta.value.length + " / 300"));
    knopf.onclick = () => speichern(b);
    app.append(kopf(true), h("img", { class: "titelbild", src: B.bild, alt: B.titel }),
      h("p", { class: "sub", style: { color: "var(--ink)" } }, B.frage), zu, ta, zaehler, knopf, abbrechen, meine, alle);
    teile = { b, ta, zaehler, knopf, abbrechen, zu, meine, alle };
    sammlungStatus();
  }
  function formular() {
    const { ta, knopf, abbrechen, zaehler } = teile;
    knopf.textContent = bearbeite ? "Änderung speichern" : "Post-it aufkleben";
    abbrechen.classList.toggle("hidden", !bearbeite);
    zaehler.textContent = ta.value.length + " / 300";
  }
  function sammlungStatus() {
    const { b, ta, knopf, zu, meine, alle } = teile; if (!b) return;
    const o = offen(b);
    zu.classList.toggle("hidden", o); ta.disabled = !o; knopf.disabled = !o;
    leeren(meine);
    const mine = status.meine.filter((p) => p.block === b);
    if (mine.length) {
      meine.append(h("div", { class: "abschnitt" }, "Deine Post-its (anonym)"));
      meine.append(h("div", { class: "meine" }, mine.map((p) => h("div", { class: "postit" }, p.text,
        o ? h("div", { class: "aktion" },
          h("button", { onclick: () => { bearbeite = p.id; ta.value = p.text; formular(); ta.focus(); } }, "ändern"),
          h("button", { onclick: () => loeschen(p) }, "weg")) : null))));
    }
    leeren(alle);
    if (status.wand_handy) {
      const andere = status.alle.filter((p) => p.block === b);
      alle.append(h("div", { class: "abschnitt" }, "Alle Post-its (" + andere.length + ")"));
      alle.append(andere.length ? h("div", { class: "alle" }, andere.map((p) => h("div", { class: "postit", style: { background: POSTIT_FARBEN[p.farbe] || POSTIT_FARBEN.gelb } }, p.text)))
        : h("p", { class: "small muted" }, "Noch keine Post-its."));
    }
  }
  async function speichern(b) {
    const { ta, knopf } = teile;
    const text = ta.value.trim();
    if (!text) { toast("Schreib zuerst etwas aufs Post-it.", true); return; }
    knopf.disabled = true;
    try {
      const id = await api.postitSpeichern(code, token, b, bearbeite, text);
      if (!id) throw new Error("zu");
      toast(bearbeite ? "Geändert" : "Aufgeklebt");
      ta.value = ""; bearbeite = null; formular();
      const s = await api.status(code, token); if (s) status = s;
      sammlungStatus();
    } catch (e) {
      toast(e.message === "zu" ? "Speichern nicht möglich – ist die Sammlung noch offen?" : "Keine Verbindung – bitte nochmals versuchen.", true);
    } finally { knopf.disabled = !offen(b); }
  }
  async function loeschen(p) {
    try {
      const ok = await api.postitLoeschen(code, token, p.id);
      if (!ok) throw new Error();
      status.meine = status.meine.filter((x) => x.id !== p.id);
      if (bearbeite === p.id) { bearbeite = null; teile.ta.value = ""; formular(); }
      sammlungStatus(); toast("Entfernt");
    } catch (e) { toast("Entfernen nicht möglich.", true); }
  }

  // ---------------- Start ----------------
  if (!code) code = (SB.ls.get("sb-code", "") || "").toUpperCase();
  if (code) laden(true); else codeEingabe();
})();
