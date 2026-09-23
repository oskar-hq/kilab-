# Ylva Labs

Landingpage für ein regionales KI-Innovation-Lab / Venture Builder in Schleswig-Holstein.
Rein statisches HTML/CSS/JS, kein Build-Schritt, direkt für GitHub Pages geeignet.

## Struktur

```
index.html          Startseite
impressum.html      Impressum (gelb markierte Platzhalter ausfüllen)
datenschutz.html    Datenschutzerklärung (gelb markierte Platzhalter ausfüllen)
404.html            Fehlerseite (GitHub Pages nutzt sie automatisch)
favicon.ico/.svg    Favicon (Bildmarke)
site.webmanifest    Icons für Homescreen / Android
assets/style.css    Design-Tokens & Layout (siehe DESIGN.md)
assets/main.js      Pixel-Szenen (Hero-Organismus, Flow, Modell-Band, Kartenbilder, Footer-Balken)
assets/icons/       Bildmarke (mark.svg), PNG-Icons, Open-Graph-Bild (og-image.png)
assets/fonts/       Inter Tight, selbst gehostet (SIL OFL 1.1) – keine Google-Fonts-Anfragen
.nojekyll           GitHub Pages liefert die Dateien unverändert aus
```

## Lokal ansehen

```
python3 -m http.server 8000   # dann http://localhost:8000
```

## Auf GitHub Pages veröffentlichen

1. Branch nach `main` mergen.
2. Im Repo: **Settings → Pages → Build and deployment → Source: „Deploy from a branch“**,
   Branch `main`, Ordner `/ (root)` wählen und speichern.
3. Nach ca. einer Minute ist die Seite unter `https://<user>.github.io/<repo>/` erreichbar.
   Eigene Domain: unter *Custom domain* eintragen (legt eine `CNAME`-Datei an).

Alle Pfade sind relativ, die Seite funktioniert also auch im Unterordner `/<repo>/`.

## Vor dem Livegang

- [x] Name: **Ylva Labs**
- [x] Schriften lokal gehostet (keine Verbindung zu Google Fonts)
- [ ] **Impressum & Datenschutz:** alle gelb markierten Platzhalter (`<mark class="todo">`) ersetzen: Name, Anschrift, Telefon, E-Mail, E-Mail-Anbieter. Nach Gründung der UG den auskommentierten Block im Impressum übernehmen.
- [ ] **E-Mail** `kontakt@example.de` auf der Startseite durch die echte Adresse ersetzen.
- [ ] In GitHub unter *Settings → Pages* **„Enforce HTTPS“** aktivieren (die Datenschutzerklärung sagt, dass nur HTTPS ausgeliefert wird).
- [ ] Sobald die Domain feststeht: `og:image` in `index.html` auf eine absolute URL setzen.
- [ ] Optional: Die Schrift „Sneak“ lizenzieren; sie steht bereits an erster Stelle im Font-Stack.
