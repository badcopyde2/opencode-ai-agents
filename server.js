const path = require('path');
const express = require('express');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
// Leaflet lokal ausliefern, damit die App ohne CDN/Internetzugang läuft.
app.use('/vendor/leaflet', express.static(path.join(__dirname, 'node_modules', 'leaflet', 'dist')));

app.use('/api/machines', require('./routes/machines'));
app.use('/api/ad-slots', require('./routes/adSlots'));
app.use('/api/stats', require('./routes/stats'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Zigarettenautomat-Map läuft auf http://localhost:${PORT}`);
});
