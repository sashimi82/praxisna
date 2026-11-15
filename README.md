# praxisNA Live

Interaktive Übungen für die Weiterbildungen von praxisNA: Die Teilnehmenden machen mit dem Handy mit (QR-Code, kein Login), die Resultate erscheinen live auf dem Beamer.

**Bausteine**
- **Alte → neue Autorität** (Haltungs-Memory): Gruppen formulieren Sätze neu, die Live-Ansicht zeigt pro Satz alle Formulierungen
- **Präsenz-Ebenen**: anonyme Selbsteinschätzung 1–10 pro Ebene mit Verteilung und Durchschnitt
- **Werte-Wolke**: jede Person nennt ihre wichtigsten Werte, die Wortwolke wächst live
- **Auswertung**: alle Fragen auf einer Seite (offene Antwort, Skala, Daumen hoch/runter, Auswahl)

**Seiten**
- `moderation.html` – Kursleitung: Bausteine gestalten, Kurse anlegen, Live-Ansicht, Export (PDF, CSV, PNG)
- `index.html?c=CODE` – Teilnehmende

Ohne Eintrag in `config.js` läuft alles im **Demo-Modus** (Daten nur im eigenen Browser) – praktisch zum Ausprobieren.

---

## Einrichtung (einmalig, ca. 15 Minuten)

### 1. Supabase-Projekt
1. Auf [supabase.com](https://supabase.com) anmelden → **New project** (Name z. B. `praxisna-live`, Region in Europa, Datenbank-Passwort notieren).
2. Warten, bis das Projekt bereit ist.

### 2. Datenbank einrichten
1. Datei `supabase/setup.sql` öffnen und bei `DEINE-EMAIL@beispiel.ch` die eigene E-Mail eintragen (für die Kollegin die nächste Zeile aktivieren).
2. In Supabase: **SQL Editor → New query** → Inhalt einfügen → **Run**. Es sollte «Success» erscheinen.

### 3. Zugang für die Moderation
In Supabase: **Authentication → Users → Add user → Create new user** – E-Mail und Passwort eingeben, **Auto Confirm User** anhaken. (Für die Kollegin ebenso, mit ihrer E-Mail aus Schritt 2.)

### 4. App mit Supabase verbinden
In Supabase unter **Project Settings → API Keys** (bzw. **Data API**) die **Project URL** und den **anon public** bzw. **publishable** Key kopieren und in `config.js` eintragen.
Der anon/publishable Key darf öffentlich sein – geschützt wird über die Regeln in `setup.sql`. Den **service_role / secret** Key niemals eintragen!

### 5. GitHub Pages
Im Repository: **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)` → Save**.
Nach 1–2 Minuten ist die App erreichbar unter `https://<benutzername>.github.io/praxisna-live/moderation.html`.

---

## Gut zu wissen
- **Kostenloser Supabase-Plan:** Projekte werden nach rund einer Woche ohne Nutzung pausiert. Vor einem Kurs kurz im Supabase-Dashboard prüfen und ggf. **Restore project** klicken (dauert ein paar Minuten, die Daten bleiben erhalten).
- **Datenschutz:** Es werden keine Namen von Teilnehmenden gespeichert – nur Gruppennamen (Sätze) bzw. anonyme Antworten. Nach dem Kurs können Antworten oder der ganze Kurs gelöscht werden.
- **Testlauf:** Nach einem Test die Antworten pro Baustein mit 🧹 löschen.
- **PDF:** In der Live-Ansicht «PDF» → im Druckdialog «Als PDF speichern» wählen.

QR-Code-Generator: © 2009 Kazuhiko Arase, MIT-Lizenz.
