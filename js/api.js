// praxisNA Live – Datenzugriff (Supabase REST oder Demo im Browser)
(function () {
  const PNA = (window.PNA = window.PNA || {});
  const cfg = window.PNA_CONFIG || {};

  PNA.uuid = function () {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    const b = new Uint8Array(16);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(b) : b.forEach((_, i) => (b[i] = Math.random() * 256));
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  };

  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
  PNA.ls = ls;

  // ------------------------------------------------------------------
  // Supabase (PostgREST + Auth) über fetch – ohne zusätzliche Bibliothek
  // ------------------------------------------------------------------
  class SupaApi {
    constructor(url, key) {
      this.url = url.replace(/\/+$/, "");
      this.key = key.trim();
      this.session = ls.get("pna-auth", null);
      this.demo = false;
    }
    baseHeaders(withUser) {
      const h = { apikey: this.key, "Content-Type": "application/json" };
      if (withUser && this.session) h.Authorization = "Bearer " + this.session.access_token;
      else if (this.key.startsWith("eyJ")) h.Authorization = "Bearer " + this.key;
      return h;
    }
    async req(path, opt = {}) {
      const withUser = opt.auth !== false;
      if (withUser && this.session) await this.frisch();
      const go = async () => {
        const h = this.baseHeaders(withUser);
        if (opt.prefer) h.Prefer = opt.prefer;
        return fetch(this.url + path, {
          method: opt.method || "GET",
          headers: h,
          body: opt.body !== undefined ? JSON.stringify(opt.body) : undefined,
        });
      };
      let r = await go();
      if (r.status === 401 && withUser && this.session) {
        await this.erneuern();
        r = await go();
      }
      const txt = await r.text();
      let data = null;
      try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
      if (!r.ok) {
        const m = (data && (data.message || data.error_description || data.msg || data.error)) || "Fehler " + r.status;
        const err = new Error(m); err.status = r.status; throw err;
      }
      return data;
    }
    // --- Anmeldung
    istAngemeldet() { return !!this.session; }
    email() { return this.session ? this.session.email : ""; }
    speichereSession(d) {
      this.session = {
        access_token: d.access_token,
        refresh_token: d.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + (d.expires_in || 3600),
        email: (d.user && d.user.email) || (this.session && this.session.email) || "",
      };
      ls.set("pna-auth", this.session);
    }
    async anmelden(email, passwort) {
      const r = await fetch(this.url + "/auth/v1/token?grant_type=password", {
        method: "POST",
        headers: { apikey: this.key, "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password: passwort }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error_description || d.msg || d.message || "Anmeldung fehlgeschlagen");
      this.speichereSession(d);
    }
    async frisch() {
      if (this.session && this.session.expires_at - Date.now() / 1000 < 90) await this.erneuern();
    }
    async erneuern() {
      if (!this.session) return;
      const r = await fetch(this.url + "/auth/v1/token?grant_type=refresh_token", {
        method: "POST",
        headers: { apikey: this.key, "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: this.session.refresh_token }),
      });
      if (!r.ok) { this.abmelden(true); throw new Error("Sitzung abgelaufen – bitte neu anmelden."); }
      this.speichereSession(await r.json());
    }
    abmelden(lokal) {
      if (!lokal && this.session) {
        fetch(this.url + "/auth/v1/logout", { method: "POST", headers: this.baseHeaders(true) }).catch(() => {});
      }
      this.session = null; ls.del("pna-auth");
    }
    async istModeration() { return !!(await this.req("/rest/v1/rpc/ist_moderation", { method: "POST", body: {} })); }

    // --- Bausteine
    bausteine() { return this.req("/rest/v1/bausteine?select=*&order=typ.asc,titel.asc"); }
    async bausteinSpeichern(b) {
      const body = { typ: b.typ, titel: b.titel, config: b.config, updated_at: new Date().toISOString() };
      if (b.id) {
        const r = await this.req("/rest/v1/bausteine?id=eq." + encodeURIComponent(b.id), { method: "PATCH", body, prefer: "return=representation" });
        return r[0];
      }
      const r = await this.req("/rest/v1/bausteine", { method: "POST", body, prefer: "return=representation" });
      return r[0];
    }
    bausteinLoeschen(id) { return this.req("/rest/v1/bausteine?id=eq." + encodeURIComponent(id), { method: "DELETE" }); }

    // --- Kurse
    kurse() { return this.req("/rest/v1/kurse?select=*&order=created_at.desc"); }
    async kurs(id) { const r = await this.req("/rest/v1/kurse?select=*&id=eq." + encodeURIComponent(id)); return r[0] || null; }
    async kursAnlegen(k) { const r = await this.req("/rest/v1/kurse", { method: "POST", body: k, prefer: "return=representation" }); return r[0]; }
    async kursAendern(id, patch) {
      const r = await this.req("/rest/v1/kurse?id=eq." + encodeURIComponent(id), { method: "PATCH", body: patch, prefer: "return=representation" });
      return r[0];
    }
    kursLoeschen(id) { return this.req("/rest/v1/kurse?id=eq." + encodeURIComponent(id), { method: "DELETE" }); }

    // --- Antworten (Moderation)
    antworten(kursId) { return this.req("/rest/v1/antworten?select=*&order=created_at.asc&kurs_id=eq." + encodeURIComponent(kursId)); }
    antwortenLoeschen(kursId, blockKey) {
      return this.req("/rest/v1/antworten?kurs_id=eq." + encodeURIComponent(kursId) + "&block_key=eq." + encodeURIComponent(blockKey), { method: "DELETE" });
    }
    antwortAendern(id, daten) {
      return this.req("/rest/v1/antworten?id=eq." + encodeURIComponent(id), { method: "PATCH", body: { daten, updated_at: new Date().toISOString() } });
    }

    // --- Teilnehmende (ohne Login)
    kursLaden(code) { return this.req("/rest/v1/rpc/kurs_laden", { method: "POST", body: { p_code: code }, auth: false }); }
    antwortSpeichern(code, block, token, gruppe, daten) {
      return this.req("/rest/v1/rpc/antwort_speichern", {
        method: "POST", auth: false,
        body: { p_code: code, p_block: block, p_token: token, p_gruppe: gruppe || null, p_daten: daten },
      });
    }
  }

  // ------------------------------------------------------------------
  // Demo: alles im localStorage dieses Browsers (zum Ausprobieren)
  // ------------------------------------------------------------------
  class DemoApi {
    constructor() { this.demo = true; }
    db() { return ls.get("pna-demo-db", { bausteine: [], kurse: [], antworten: [] }); }
    save(d) { ls.set("pna-demo-db", d); }
    async pause() { return new Promise((r) => setTimeout(r, 60)); }
    istAngemeldet() { return true; }
    email() { return "Demo"; }
    async anmelden() {}
    abmelden() {}
    async istModeration() { return true; }

    async bausteine() { await this.pause(); return this.db().bausteine.slice().sort((a, b) => (a.typ + a.titel).localeCompare(b.typ + b.titel)); }
    async bausteinSpeichern(b) {
      const d = this.db(); const now = new Date().toISOString();
      if (b.id) { const i = d.bausteine.findIndex((x) => x.id === b.id); d.bausteine[i] = { ...d.bausteine[i], ...b, updated_at: now }; this.save(d); return d.bausteine[i]; }
      const n = { ...b, id: PNA.uuid(), created_at: now, updated_at: now }; d.bausteine.push(n); this.save(d); return n;
    }
    async bausteinLoeschen(id) { const d = this.db(); d.bausteine = d.bausteine.filter((x) => x.id !== id); this.save(d); }

    async kurse() { await this.pause(); return this.db().kurse.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)); }
    async kurs(id) { return this.db().kurse.find((k) => k.id === id) || null; }
    async kursAnlegen(k) {
      const d = this.db();
      if (d.kurse.some((x) => x.code.toUpperCase() === k.code.toUpperCase())) { const e = new Error("duplicate key"); e.status = 409; throw e; }
      const n = { ...k, id: PNA.uuid(), created_at: new Date().toISOString() }; d.kurse.push(n); this.save(d); return n;
    }
    async kursAendern(id, patch) { const d = this.db(); const k = d.kurse.find((x) => x.id === id); Object.assign(k, patch); this.save(d); return k; }
    async kursLoeschen(id) { const d = this.db(); d.kurse = d.kurse.filter((x) => x.id !== id); d.antworten = d.antworten.filter((a) => a.kurs_id !== id); this.save(d); }

    async antworten(kursId) { return this.db().antworten.filter((a) => a.kurs_id === kursId); }
    async antwortenLoeschen(kursId, key) { const d = this.db(); d.antworten = d.antworten.filter((a) => !(a.kurs_id === kursId && a.block_key === key)); this.save(d); }
    async antwortAendern(id, daten) { const d = this.db(); const a = d.antworten.find((x) => x.id === id); if (a) a.daten = daten; this.save(d); }

    async kursLaden(code) {
      await this.pause();
      const k = this.db().kurse.find((x) => x.code.toUpperCase() === String(code).trim().toUpperCase());
      if (!k) return null;
      return { id: k.id, titel: k.titel, bloecke: k.bloecke.filter((b) => b.offen).map(({ key, typ, titel, config }) => ({ key, typ, titel, config })) };
    }
    async antwortSpeichern(code, block, token, gruppe, daten) {
      await this.pause();
      const d = this.db();
      const k = d.kurse.find((x) => x.code.toUpperCase() === String(code).trim().toUpperCase());
      if (!k || !k.bloecke.some((b) => b.key === block && b.offen)) return false;
      const now = new Date().toISOString();
      const a = d.antworten.find((x) => x.kurs_id === k.id && x.block_key === block && x.token === token);
      if (a) { a.daten = daten; a.gruppe = gruppe || null; a.updated_at = now; }
      else d.antworten.push({ id: PNA.uuid(), kurs_id: k.id, block_key: block, token, gruppe: gruppe || null, daten, created_at: now, updated_at: now });
      this.save(d);
      return true;
    }
  }

  PNA.api = cfg.SUPABASE_URL && cfg.SUPABASE_KEY ? new SupaApi(cfg.SUPABASE_URL, cfg.SUPABASE_KEY) : new DemoApi();
})();
