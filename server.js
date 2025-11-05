const express = require('express');
const path = require('node:path');

const app = express();
const PORT = process.env.PORT || 3000;

// Servir estáticos desde /src
app.use(express.static(path.join(__dirname, 'src')));

// Ruta raíz
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'index.html'));
});

// Fallback (si navegas directo a otras rutas del front)
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'index.html'));
});

// Importante en Azure Linux: host 0.0.0.0
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Client server listening on port ${PORT}`);
});
