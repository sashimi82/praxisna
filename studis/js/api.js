// SchuBe Studis – Datenzugriff (Supabase REST oder Demo im Browser)
(function () {
  const SB = (window.SB = window.SB || {});
  const cfg = window.SB_CONFIG || {};

  SB.uuid = function () {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    const b = new Uint8Array(16);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(b); else for (let i = 0; i < 16; i++) b[i] = Math.random() * 256;
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    const x = [...b].map((v) => v.toString(16).padStart(2, "0")).join("");
    return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
  };
  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
  SB.ls = ls;
  SB.STANDARD_ZUSTAND = () => ({ offen: { einstieg: true, ideen: false, best: false, heraus: false }, wand_handy: false, loesung: { punkte: false, muenzen: false } });

  // ------------------------------------------------------------------
  class SupaApi {
    constructor(url, key) {
      this.url = url.replace(/\/+$/, ""); this.key = key.trim();
      this.session = ls.get("sb-auth", null); this.demo = false;
    }
    headers(withUser) {
      const h = { apikey: this.key, "Content-Type": "application/json" };
      if (withUser && this.session) h.Authorization = "Bearer " + this.session.access_token;
      else if (this.key.startsWith("eyJ")) h.Authorization = "Bearer " + this.key;
      return h;
    }
    async req(path, opt = {}) {
      const withUser = opt.auth !== false;
      if (withUser && this.session) await this.frisch();
      const go = () => {
        const h = this.headers(withUser);
        if (opt.prefer) h.Prefer = opt.prefer;
        return fetch(this.url + path, { method: opt.method || "GET", headers: h, body: opt.body !== undefined ? JSON.stringify(opt.body) : undefined });
      };
      let r = await go();
      if (r.status === 401 && withUser && this.session) { await this.erneuern(); r = await go(); }
      const txt = await r.text();
      let data = null; try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
      if (!r.ok) { const e = new Error((data && (data.message || data.error_description || data.msg || data.error)) || "Fehler " + r.status); e.status = r.status; throw e; }
      return data;
    }
    istAngemeldet() { return !!this.session; }
    email() { return this.session ? this.session.email : ""; }
    speichere(d) {
      this.session = { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Math.floor(Date.now() / 1000) + (d.expires_in || 3600),
        email: (d.user && d.user.email) || (this.session && this.session.email) || "" };
      ls.set("sb-auth", this.session);
    }
    async anmelden(email, pw) {
      const r = await fetch(this.url + "/auth/v1/token?grant_type=password", { method: "POST", headers: { apikey: this.key, "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), password: pw }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error_description || d.msg || d.message || "Anmeldung fehlgeschlagen");
      this.speichere(d);
    }
    async frisch() { if (this.session && this.session.expires_at - Date.now() / 1000 < 90) await this.erneuern(); }
    async erneuern() {
      if (!this.session) return;
      const r = await fetch(this.url + "/auth/v1/token?grant_type=refresh_token", { method: "POST", headers: { apikey: this.key, "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: this.session.refresh_token }) });
      if (!r.ok) { this.abmelden(true); throw new Error("Sitzung abgelaufen – bitte neu anmelden."); }
      this.speichere(await r.json());
    }
    abmelden(lokal) {
      if (!lokal && this.session) fetch(this.url + "/auth/v1/logout", { method: "POST", headers: this.headers(true) }).catch(() => {});
      this.session = null; ls.del("sb-auth");
    }
    async istModeration() { return !!(await this.req("/rest/v1/rpc/ist_moderation", { method: "POST", body: {} })); }

    // Moderation
    treffenListe() { return this.req("/rest/v1/sb_treffen?select=*&order=created_at.desc"); }
    async treffen(id) { const r = await this.req("/rest/v1/sb_treffen?select=*&id=eq." + encodeURIComponent(id)); return r[0] || null; }
    async treffenAnlegen(t) { return (await this.req("/rest/v1/sb_treffen", { method: "POST", body: t, prefer: "return=representation" }))[0]; }
    async treffenAendern(id, patch) { return (await this.req("/rest/v1/sb_treffen?id=eq." + encodeURIComponent(id), { method: "PATCH", body: patch, prefer: "return=representation" }))[0]; }
    treffenLoeschen(id) { return this.req("/rest/v1/sb_treffen?id=eq." + encodeURIComponent(id), { method: "DELETE" }); }
    postits(tid) { return this.req("/rest/v1/sb_postits?select=*&order=created_at.asc&treffen_id=eq." + encodeURIComponent(tid)); }
    async postitNeu(tid, block, text, farbe) { return (await this.req("/rest/v1/sb_postits", { method: "POST", body: { treffen_id: tid, block, text, farbe: farbe || "gelb" }, prefer: "return=representation" }))[0]; }
    postitAendern(id, patch) { return this.req("/rest/v1/sb_postits?id=eq." + encodeURIComponent(id), { method: "PATCH", body: Object.assign({ updated_at: new Date().toISOString() }, patch) }); }
    postitWeg(id) { return this.req("/rest/v1/sb_postits?id=eq." + encodeURIComponent(id), { method: "DELETE" }); }
    postitsLeeren(tid, block) { return this.req("/rest/v1/sb_postits?treffen_id=eq." + encodeURIComponent(tid) + "&block=eq." + encodeURIComponent(block), { method: "DELETE" }); }
    geloest(tid) { return this.req("/rest/v1/sb_geloest?select=aufgabe,token&treffen_id=eq." + encodeURIComponent(tid)); }
    geloestLeeren(tid) { return this.req("/rest/v1/sb_geloest?treffen_id=eq." + encodeURIComponent(tid), { method: "DELETE" }); }

    // Teilnehmende
    status(code, token) { return this.req("/rest/v1/rpc/sb_status", { method: "POST", auth: false, body: { p_code: code, p_token: token } }); }
    postitSpeichern(code, token, block, id, text) { return this.req("/rest/v1/rpc/sb_postit_speichern", { method: "POST", auth: false, body: { p_code: code, p_token: token, p_block: block, p_id: id || null, p_text: text } }); }
    postitLoeschen(code, token, id) { return this.req("/rest/v1/rpc/sb_postit_loeschen", { method: "POST", auth: false, body: { p_code: code, p_token: token, p_id: id } }); }
    geloestMelden(code, token, aufgabe) { return this.req("/rest/v1/rpc/sb_geloest_melden", { method: "POST", auth: false, body: { p_code: code, p_token: token, p_aufgabe: aufgabe } }); }
  }

  // ------------------------------------------------------------------
  // Demo: alles im localStorage dieses Browsers
  class DemoApi {
    constructor() { this.demo = true; }
    db() { return ls.get("sb-demo-db", { treffen: [], postits: [], geloest: [] }); }
    save(d) { ls.set("sb-demo-db", d); }
    pause() { return new Promise((r) => setTimeout(r, 40)); }
    istAngemeldet() { return true; } email() { return "Demo"; } async anmelden() {} abmelden() {} async istModeration() { return true; }
    find(d, code) { return d.treffen.find((t) => t.code.toUpperCase() === String(code || "").trim().toUpperCase()); }

    async treffenListe() { await this.pause(); return this.db().treffen.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)); }
    async treffen(id) { return this.db().treffen.find((t) => t.id === id) || null; }
    async treffenAnlegen(t) {
      const d = this.db();
      if (d.treffen.some((x) => x.code.toUpperCase() === t.code.toUpperCase())) { const e = new Error("duplicate key"); e.status = 409; throw e; }
      const n = Object.assign({ zustand: SB.STANDARD_ZUSTAND() }, t, { id: SB.uuid(), created_at: new Date().toISOString() });
      d.treffen.push(n); this.save(d); return n;
    }
    async treffenAendern(id, patch) { const d = this.db(); const t = d.treffen.find((x) => x.id === id); Object.assign(t, patch); this.save(d); return t; }
    async treffenLoeschen(id) { const d = this.db(); d.treffen = d.treffen.filter((t) => t.id !== id); d.postits = d.postits.filter((p) => p.treffen_id !== id); d.geloest = d.geloest.filter((g) => g.treffen_id !== id); this.save(d); }
    async postits(tid) { return this.db().postits.filter((p) => p.treffen_id === tid); }
    async postitNeu(tid, block, text, farbe) { const d = this.db(); const now = new Date().toISOString(); const p = { id: SB.uuid(), treffen_id: tid, block, token: null, text, farbe: farbe || "gelb", created_at: now, updated_at: now }; d.postits.push(p); this.save(d); return p; }
    async postitAendern(id, patch) { const d = this.db(); const p = d.postits.find((x) => x.id === id); if (p) Object.assign(p, patch); this.save(d); }
    async postitWeg(id) { const d = this.db(); d.postits = d.postits.filter((p) => p.id !== id); this.save(d); }
    async postitsLeeren(tid, block) { const d = this.db(); d.postits = d.postits.filter((p) => !(p.treffen_id === tid && p.block === block)); this.save(d); }
    async geloest(tid) { return this.db().geloest.filter((g) => g.treffen_id === tid); }
    async geloestLeeren(tid) { const d = this.db(); d.geloest = d.geloest.filter((g) => g.treffen_id !== tid); this.save(d); }

    async status(code, token) {
      await this.pause();
      const d = this.db(), t = this.find(d, code); if (!t) return null;
      const z = t.zustand;
      return {
        titel: t.titel, offen: z.offen, wand_handy: !!z.wand_handy,
        meine: d.postits.filter((p) => p.treffen_id === t.id && p.token === token).map((p) => ({ id: p.id, block: p.block, text: p.text })),
        alle: z.wand_handy ? d.postits.filter((p) => p.treffen_id === t.id && z.offen[p.block]).map((p) => ({ block: p.block, text: p.text, farbe: p.farbe })) : [],
        geloest: d.geloest.filter((g) => g.treffen_id === t.id && g.token === token).map((g) => g.aufgabe),
      };
    }
    async postitSpeichern(code, token, block, id, text) {
      await this.pause();
      const d = this.db(), t = this.find(d, code); text = String(text || "").trim();
      if (!t || !t.zustand.offen[block] || !text || text.length > 300) return null;
      const now = new Date().toISOString();
      if (id) { const p = d.postits.find((x) => x.id === id && x.token === token && x.block === block); if (!p) return null; p.text = text; p.updated_at = now; this.save(d); return p.id; }
      const p = { id: SB.uuid(), treffen_id: t.id, block, token, text, farbe: "gelb", created_at: now, updated_at: now };
      d.postits.push(p); this.save(d); return p.id;
    }
    async postitLoeschen(code, token, id) {
      const d = this.db(), t = this.find(d, code); if (!t) return false;
      const p = d.postits.find((x) => x.id === id && x.token === token && x.treffen_id === t.id);
      if (!p || !t.zustand.offen[p.block]) return false;
      d.postits = d.postits.filter((x) => x !== p); this.save(d); return true;
    }
    async geloestMelden(code, token, aufgabe) {
      const d = this.db(), t = this.find(d, code); if (!t || !t.zustand.offen.einstieg) return false;
      if (!d.geloest.some((g) => g.treffen_id === t.id && g.aufgabe === aufgabe && g.token === token)) d.geloest.push({ treffen_id: t.id, aufgabe, token, created_at: new Date().toISOString() });
      this.save(d); return true;
    }
  }

  SB.api = cfg.SUPABASE_URL && cfg.SUPABASE_KEY ? new SupaApi(cfg.SUPABASE_URL, cfg.SUPABASE_KEY) : new DemoApi();
})();
