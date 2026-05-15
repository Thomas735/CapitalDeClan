import Redis from 'ioredis';
import { Queue } from 'bullmq';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Singleton Redis instances for reuse
export const redisClient = new Redis(redisUrl, { maxRetriesPerRequest: null });
export const redisSubscriber = new Redis(redisUrl, { maxRetriesPerRequest: null });

// BullMQ Queues
export const buttonQueue = new Queue('button-queue', { connection: redisClient });

redisClient.on('error', (err) => console.error('Redis Client Error', err));
