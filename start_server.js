const { createServer } = require('http');
const fs = require('fs');
const path = require('path');
const next = require('next');

// Parse .env natively at startup so updated secrets are always loaded
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

// Guard process against unhandled errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception caught:', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection caught:', reason);
});

const port = parseInt(process.env.PORT || '3000', 10);
const app = next({ dev: false, hostname: 'localhost', port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      await handle(req, res);
    } catch (err) {
      console.error('Request handling error:', err.message);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    }
  }).listen(port, () => {
    console.log(`> Social Engine ready on http://localhost:${port}`);
  });
}).catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
