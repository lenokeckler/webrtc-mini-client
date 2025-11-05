const express = require('express');
const path = require('path');

const app = express();

// === Rutas estáticas: ajusta "src" si tu index.html está en otra carpeta ===
const staticDir = path.join(__dirname, 'src');
app.use(express.static(staticDir));

// Raíz
app.get('/', (_req, res) => {
  res.sendFile(path.join(staticDir, 'index.html'));
});

// Fallback SPA (otras rutas del front)
app.get('*', (_req, res) => {
  res.sendFile(path.join(staticDir, 'index.html'));
});

// Azure asigna el puerto por env. IMPORTANTE: host 0.0.0.0 en Linux
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Client listening on http://0.0.0.0:${PORT}`);
});
