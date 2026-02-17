import http from 'node:http';
import dotenv from 'dotenv';

dotenv.config({ path: new URL('./.env', import.meta.url) });

const { default: app } = await import('./src/app.js');

const port = Number(process.env.PORT || 5000);

const server = http.createServer(app);
server.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error('Server failed to start:', err);

  if (err?.code === 'EADDRINUSE') {
    // eslint-disable-next-line no-console
    console.error(`Port ${port} is already in use.`);
  }

  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  // eslint-disable-next-line no-console
  console.error('Unhandled rejection:', err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  // eslint-disable-next-line no-console
  console.error('Uncaught exception:', err);
  process.exit(1);
});

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`PropertyPulse API listening on http://localhost:${port}`);
});
