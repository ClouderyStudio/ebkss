import { createApp } from './app.js';
import { config } from './config.js';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`API server listening on http://localhost:${config.port}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `Port ${config.port} is already in use. Stop the existing API server or set PORT in server/.env.`
    );
    process.exit(1);
  }

  throw error;
});
