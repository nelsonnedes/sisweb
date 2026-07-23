// Simple Express static server for SisWeb workspace
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5500;

// Disable caching for easier dev
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

// Serve workspace root statically
app.use(express.static(path.join(__dirname), { extensions: ['html', 'htm'] }));

// Convenience route to folha
app.get(['/folha', '/folha_pagamento'], (req, res) => {
  res.redirect('/folha_pagamento/folha.html');
});

app.listen(PORT, () => {
  console.log(`SisWeb dev server running at http://localhost:${PORT}/`);
  console.log(`Open folha at http://localhost:${PORT}/folha_pagamento/folha.html`);
});