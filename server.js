const express = require('express');
const path = require('path');

const app = express();
const staticDir = path.join(__dirname, 'src');

app.use(express.static(staticDir));
app.get('/', (_req, res) => res.sendFile(path.join(staticDir, 'index.html')));
app.get('*', (_req, res) => res.sendFile(path.join(staticDir, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Client listening on ${PORT}`));
