import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

import routes from './routes';
import { setupSockets } from './sockets';
import { setupBullMQWorker } from './jobs/bullmq';
import { setupCronJobs } from './jobs/cron';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', routes);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

setupSockets(io);
setupBullMQWorker(io);
setupCronJobs(io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
