# Ylva Labs

Landingpage für ein regionales KI-Innovation-Lab / Venture Builder in Schleswig-Holstein.
Rein statisches HTML/CSS/JS, kein Build-Schritt, direkt für GitHub Pages geeignet.

## Struktur

```
index.html        Startseite
impressum.html    Platzhalter – vor Livegang ausfüllen
datenschutz.html  Platzhalter – vor Livegang ausfüllen
404.html          Fehlerseite (GitHub Pages nutzt sie automatisch)
assets/style.css  Design-Tokens & Layout (siehe DESIGN.md)
assets/main.js    Pixel-Szenen (Hero-Band, Flow, Protokoll-Band, Kartenbilder, Footer-Balken)
.nojekyll         GitHub Pages liefert die Dateien unverändert aus
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
- [ ] **E-Mail** `kontakt@example.de` durch die echte Adresse ersetzen.
- [ ] **Impressum & Datenschutz** ausfüllen (in Deutschland Pflicht).
- [ ] Optional: Google Fonts lokal hosten (Datenschutz) – Schrift nach `assets/fonts/` legen und `@font-face` in `style.css` ergänzen.
- [ ] Optional: Die Schrift „Sneak“ aus der Designvorlage lizenzieren; sie steht bereits an erster Stelle im Font-Stack.
