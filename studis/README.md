# Studierenden-Treffen – Schulergänzende Betreuung

Interaktive Web-App für die Treffen mit den Sozialpädagogik-Studierenden: Einstieg mit zwei Denkaufgaben, drei Post-it-Sammlungen (Ideen & Wünsche, Best Practice, Herausforderungen). Die Studierenden machen mit dem Handy mit (QR-Code, kein Login, anonym), die Resultate erscheinen live auf dem Beamer.

**Seiten**
- `moderation.html` – Moderation: Treffen anlegen, Bausteine öffnen/schliessen, Live-Ansicht (Beamer), Lösungen zeigen, Export (CSV, Druck/PDF)
- `index.html?c=CODE` – Teilnehmende

**Technik**
- Läuft im Supabase-Projekt von praxisNA Live (Tabellen `sb_treffen`, `sb_postits`, `sb_geloest`), Login über dieselben Moderations-Konten (`moderierende`, `ist_moderation()`).
- Einrichtung der Datenbank: `supabase/setup.sql` (bereits ausgeführt; kann gefahrlos wiederholt werden).
- Ohne Eintrag in `config.js` läuft alles im Demo-Modus (Daten nur im eigenen Browser).

**Anpassen**
- Fragen und Titel der Sammlungen: `js/common.js` → `SB.BLOECKE`
- Logo: Datei `assets/logo.png` hinzufügen (sonst erscheint der Schriftzug «Stadt Winterthur»)
- Titelbilder: `assets/titel-*.png` (aus Canva exportiert)

**Datenschutz:** Keine Namen. Post-its sind anonym (zufällige Geräte-ID, damit man eigene Post-its ändern kann). Nach dem Treffen exportieren und das Treffen löschen.

**Vor dem Treffen:** Im Supabase-Dashboard prüfen, ob das Projekt pausiert ist (Gratis-Plan) und ggf. «Restore project» klicken.

QR-Code-Generator: © 2009 Kazuhiko Arase, MIT-Lizenz.
