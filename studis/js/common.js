// SchuBe Studis – gemeinsame Hilfsfunktionen
(function () {
  const SB = (window.SB = window.SB || {});

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else if (k === "value") el.value = v;
      else if (k === "checked") el.checked = !!v;
      else if (k === "html") el.innerHTML = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid === null || kid === undefined || kid === false) continue;
      el.appendChild(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }
  SB.h = h;
  SB.leeren = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

  let toastTimer;
  SB.toast = function (msg, fehler) {
    let t = document.querySelector(".toast");
    if (!t) { t = h("div", { class: "toast" }); document.body.appendChild(t); }
    t.textContent = msg; t.classList.toggle("fehler", !!fehler); t.classList.add("zeigen");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("zeigen"), fehler ? 4500 : 2200);
  };

  // Die Bausteine des Treffens – Texte hier anpassen
  SB.BLOECKE = {
    einstieg: { titel: "Einstieg", sub: "Zwei Denkaufgaben", bild: "assets/titel-denkaufgabe.png", farbe: "#e04e1b" },
    ideen: { titel: "Ideen & Wünsche", sub: "Sammlung", bild: "assets/titel-ideen.png", farbe: "#2f6fc0",
      frage: "Was wünschst du dir für deine Ausbildung in der Schulergänzenden Betreuung? Welche Ideen hast du?" },
    best: { titel: "Best Practice", sub: "Sammlung", bild: "assets/titel-best-practice.png", farbe: "#4f9a3a",
      frage: "Was läuft in deiner Praxisausbildung richtig gut? Was könnten andere übernehmen?" },
    heraus: { titel: "Herausforderungen", sub: "Sammlung", bild: "assets/titel-herausforderungen.png", farbe: "#7a5bb5",
      frage: "Was ist in deiner Ausbildung gerade schwierig oder herausfordernd?" },
  };
  SB.REIHENFOLGE = ["einstieg", "ideen", "best", "heraus"];
  SB.SAMMLUNGEN = ["ideen", "best", "heraus"];
  SB.POSTIT_FARBEN = { gelb: "#fbf3b0", pink: "#ff9fcf", gruen: "#c9ebbd", blau: "#c5e0fa" };

  // Logo: assets/logo.png (Stadt Winterthur); fehlt die Datei, steht Text da
  SB.logo = function (cls) {
    const box = h("div", { class: "logo-box " + (cls || "") });
    const img = h("img", { class: "logo", src: "assets/logo.png", alt: "Stadt Winterthur" });
    img.onerror = () => { box.textContent = ""; box.appendChild(h("span", { class: "logo-text" }, "Stadt Winterthur")); };
    box.appendChild(img);
    return box;
  };

  SB.datumText = (d) => { if (!d) return ""; const [y, m, t] = String(d).slice(0, 10).split("-"); return `${t}.${m}.${y}`; };
  SB.neuerCode = () => { const a = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; let c = ""; for (let i = 0; i < 4; i++) c += a[Math.floor(Math.random() * a.length)]; return c; };
  SB.teilnahmeUrl = (code) => new URL("./", location.href).href + "?c=" + encodeURIComponent(code);
  SB.teilnahmeUrlKurz = (code) => SB.teilnahmeUrl(code).replace(/^https?:\/\//, "");

  SB.qrCanvas = function (text, px) {
    const { QRCode, Level } = window.QRCodeLib;
    const q = new QRCode(-1, Level.M); q.addData(text); q.make();
    const n = q.getModuleCount(), rand = 2, scale = Math.max(2, Math.floor((px * 2) / (n + rand * 2)));
    const size = (n + rand * 2) * scale;
    const c = h("canvas", { class: "qr", width: size, height: size });
    c.style.width = c.style.height = px + "px";
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, size, size); ctx.fillStyle = "#1b2433";
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) ctx.fillRect((k + rand) * scale, (r + rand) * scale, scale, scale);
    return c;
  };

  SB.csv = function (treffen, postits) {
    const z = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
    const zeilen = [["Sammlung", "Text", "Farbe", "Von", "Zeit"].map(z).join(";")];
    SB.SAMMLUNGEN.forEach((b) => postits.filter((p) => p.block === b).forEach((p) =>
      zeilen.push([SB.BLOECKE[b].titel, p.text, p.farbe, p.token ? "Teilnehmende" : "Moderation", new Date(p.created_at).toLocaleString("de-CH")].map(z).join(";"))));
    const blob = new Blob(["﻿" + zeilen.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = h("a", { href: URL.createObjectURL(blob), download: "postits-" + treffen.code + ".csv" });
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };

  SB.demoBand = function () { if (SB.api.demo) { const b = document.getElementById("demo-band"); if (b) b.classList.remove("hidden"); } };
})();
