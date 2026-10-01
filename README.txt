PISTOL SKIN RPF TOOL – RAILWAY HOSTING

ORDNERSTRUKTUR
---------------
pistol-skin-hosting/
  index.html
  config.js
  package.json
  railway.json
  img/
    mk2_gold_chain.webp
    p50_galaxy.webp
    mk2_redchrome.webp
    p50_cyber.webp
    mk2_digital.webp
    editor.webp

1. BILDER EINFÜGEN
------------------
Lege diese 6 Dateien exakt in den Ordner img/:
- mk2_gold_chain.webp
- p50_galaxy.webp
- mk2_redchrome.webp
- p50_cyber.webp
- mk2_digital.webp
- editor.webp

Die Dateinamen müssen exakt stimmen, sonst werden sie auf der Website nicht angezeigt.

2. LINKS EINTRAGEN
------------------
Öffne config.js.

tebexUrl = Link zu deinem Tebex-Produkt / Shop.
appUrl   = Link zu deiner Web-App.

Wenn du noch keine Web-App hast, appUrl zunächst leer lassen.

3. GITHUB
---------
Erstelle ein neues GitHub-Repository und lade den kompletten INHALT dieses Ordners hoch.
Wichtig: index.html muss direkt im Hauptverzeichnis liegen, nicht in einem weiteren Unterordner.

4. RAILWAY
----------
- New Project
- Deploy from GitHub Repo
- Repository auswählen
- Deployment abwarten
- Settings / Networking
- Generate Domain

Railway startet die Website über "npm start".

5. WICHTIG
----------
Diese Dateien hosten die aktuell vorhandene Landingpage.
Der eigentliche Skin-Editor / RPF-Builder ist NICHT Bestandteil der hochgeladenen index.html.
Für eine echte /app-Seite braucht es den Quellcode der Web-App bzw. ein Backend für den RPF-Build.
