# Zigarettenautomaten-Karte

Webapp zur Verwaltung von Zigarettenautomaten auf einer interaktiven Karte (OpenStreetMap/Leaflet) –
inklusive Standort, Status (OK / Defekt / Außer Betrieb), Befüllstand und Notizen.

## Features

- Karte mit farbcodierten Markern (grün/orange/rot nach Befüllstand, grau bei "Außer Betrieb", rot bei "Defekt")
- Seitenleiste mit Liste aller Automaten inkl. Filter nach Status
- Automat anlegen/bearbeiten/löschen über ein Formular (Klick auf die Karte übernimmt die Koordinaten)
- REST-API (`/api/machines`) mit SQLite-Persistenz

## Setup

```bash
npm install
npm start
```

Anschließend im Browser öffnen: http://localhost:3000

Beim ersten Start wird automatisch eine `data.db` (SQLite) mit ein paar Beispiel-Automaten angelegt.

## API

| Methode | Pfad                | Beschreibung                     |
|---------|---------------------|-----------------------------------|
| GET     | `/api/machines`     | Alle Automaten auflisten          |
| GET     | `/api/machines/:id` | Einzelnen Automaten abrufen       |
| POST    | `/api/machines`     | Neuen Automaten anlegen           |
| PUT     | `/api/machines/:id` | Automat aktualisieren (Teil-Update möglich) |
| DELETE  | `/api/machines/:id` | Automat löschen                   |

Felder: `name`, `address`, `lat`, `lng`, `status` (`ok` \| `defekt` \| `ausser_betrieb`), `fill_level` (0–100), `notes`.

## Hinweis zur Kartenbibliothek

Die Karte nutzt Leaflet + OpenStreetMap statt der Google Maps API, damit die App ohne API-Key
und Kosten läuft. Leaflet wird aus `node_modules` unter `/vendor/leaflet` ausgeliefert, es wird also
kein CDN benötigt. Der Kartenhintergrund (die Tiles) kommt von `tile.openstreetmap.org` – dafür
braucht der Browser Internetzugang.

Bei Bedarf lässt sich `public/index.html` + `public/app.js` auf die Google Maps JavaScript API
umstellen (dafür wird ein API-Key benötigt).

