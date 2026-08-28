# Zigarettenautomaten-Verwaltung

Webapp zur Verwaltung von Zigarettenautomaten und ihren Werbeflächen – mit Dashboard
und interaktiver Karte (OpenStreetMap/Leaflet).

## Features

### Dashboard
- Kennzahlen: Anzahl Automaten, Ø Befüllstand, Belegungsquote der Werbeflächen, Werbeumsatz pro Monat
- Anteilsbalken für Automatenstatus und Belegung der Werbeflächen
- Befüllstand je Automat, aufsteigend sortiert – oben steht, was zuerst nachgefüllt werden muss
- Arbeitslisten: „Nachfüllen nötig" und „Auslaufende Werbeverträge" (nächste 60 Tage)
- Tabelle aller Werbeflächen mit Partner, Kampagne, Laufzeit und Monatspreis

### Karte
- Farbcodierte Marker mit Symbol: `✓` betriebsbereit, `↓` nachfüllen, `!` kritisch/defekt, `×` außer Betrieb
- Seitenleiste mit Automatenliste, Statusfilter und Sprung zum jeweiligen Marker
- Popup je Automat mit Status, Befüllstand, Werbeflächen-Auslastung und Zeitstempel
- Anlegen/Bearbeiten/Löschen per Formular; ein Klick auf die Karte übernimmt die Koordinaten

### Werbeflächen
Jeder Automat hat beliebig viele Werbeflächen (Position, Maße, Monatspreis). Eine Fläche ist
`frei`, `reserviert` oder `belegt`; bei belegten Flächen kommen Werbepartner, Kampagne und
Laufzeit dazu. Setzt man eine Fläche zurück auf `frei`, werden Partner und Laufzeit geleert.

## Setup

```bash
npm install
npm start
```

Anschließend im Browser öffnen: http://localhost:3000

Beim ersten Start wird automatisch eine `data.db` (SQLite) mit Beispieldaten angelegt.
Zum Zurücksetzen einfach `data.db*` löschen und neu starten.

## API

| Methode | Pfad                        | Beschreibung                          |
|---------|-----------------------------|----------------------------------------|
| GET     | `/api/stats`                | Aggregierte Kennzahlen fürs Dashboard  |
| GET     | `/api/machines`             | Automaten inkl. Werbeflächen-Zähler    |
| GET     | `/api/machines/:id`         | Einzelnen Automaten abrufen            |
| GET     | `/api/machines/:id/ad-slots`| Werbeflächen eines Automaten           |
| POST    | `/api/machines`             | Automat anlegen                        |
| PUT     | `/api/machines/:id`         | Automat aktualisieren (Teil-Update)    |
| DELETE  | `/api/machines/:id`         | Automat löschen (samt Werbeflächen)    |
| GET     | `/api/ad-slots`             | Werbeflächen, optional `?status=`/`?machine_id=` |
| POST    | `/api/ad-slots`             | Werbefläche anlegen                    |
| PUT     | `/api/ad-slots/:id`         | Werbefläche aktualisieren              |
| DELETE  | `/api/ad-slots/:id`         | Werbefläche löschen                    |

**Automat:** `name`, `address`, `lat`, `lng`, `status` (`ok` \| `defekt` \| `ausser_betrieb`),
`fill_level` (0–100), `notes`

**Werbefläche:** `machine_id`, `position` (`vorne` \| `links` \| `rechts` \| `oben`),
`width_cm`, `height_cm`, `status` (`frei` \| `belegt` \| `reserviert`), `advertiser`,
`campaign`, `price_per_month`, `start_date`, `end_date` (jeweils `JJJJ-MM-TT`), `notes`

Fehlerhafte Eingaben liefern `400` mit allen Feldfehlern auf einmal:
`{ "errors": ["Breitengrad muss zwischen -90 und 90 liegen", ...] }`

## Aufbau

```
server.js            Express-Wiring
db.js                SQLite-Schema und Beispieldaten
validation.js        Feldvalidierung für beide Entitäten
routes/              machines.js · adSlots.js · stats.js
public/              index.html · style.css
                     common.js (Helfer) · dashboard.js · map.js · app.js (Formulare)
```

## Schwellenwerte

Unter **50 %** gilt ein Automat als nachfüllbedürftig, unter **20 %** als kritisch.
Außer Betrieb genommene Automaten zählen weder beim Ø Befüllstand noch in der Nachfüllliste mit.
Verträge, die in den nächsten **60 Tagen** enden, erscheinen unter „Auslaufende Werbeverträge".
Die Werte stehen oben in `routes/stats.js`.

## Gestaltungsentscheidungen

**Karte statt Google Maps.** Leaflet + OpenStreetMap braucht keinen API-Key und kostet nichts.
Leaflet wird lokal aus `node_modules` unter `/vendor/leaflet` ausgeliefert, ein CDN ist nicht
nötig. Nur die Kartenkacheln kommen von `tile.openstreetmap.org` – dafür braucht der Browser
Internetzugang. Auf die Google Maps JavaScript API umstellen lässt sich das in
`public/index.html` und `public/map.js` (dann wird ein API-Key benötigt).

**Status nie allein über Farbe.** Rot und Grün liegen unter Rotgrünblindheit bei einem
Farbabstand von ΔE 4.1 und sind damit praktisch ununterscheidbar. Deshalb tragen Marker,
Chips und Tabellen immer zusätzlich ein Symbol und einen Text. Im Befüllstand-Diagramm
trägt die Balkenlänge die Menge und der Chip daneben den Zustand, statt beides in die
Farbe zu packen.

**Dunkelmodus** folgt `prefers-color-scheme` und ist mit eigenen Farbwerten hinterlegt,
nicht durch Umkehren der hellen Palette.
