import { Worker, Job } from 'bullmq';
import { redisClient } from '../config/redis';
import prisma from '../config/db';

export const setupBullMQWorker = (io: any) => {
  const worker = new Worker('button-queue', async (job: Job) => {
    if (job.name === 'releaseButton') {
      const { cycleId } = job.data;
      const cycle = await prisma.buttonCycle.findUnique({ where: { id: cycleId } });
      if (!cycle || cycle.status !== 'RED') return;

      // Make it green
      await prisma.buttonCycle.update({
        where: { id: cycleId },
        data: {
          status: 'GREEN',
          currentOwnerId: null,
          redSince: null,
        }
      });
      console.log(`Cycle ${cycleId} returned to GREEN due to 30 min timeout`);
      
      // Notify next user in waitlist
      const nextUser = await prisma.waitlist.findFirst({
        where: { cycleId, status: 'WAITING' },
        orderBy: { joinedAt: 'asc' }
      });

      if (nextUser) {
        await prisma.waitlist.update({
          where: { id: nextUser.id },
          data: { status: 'NOTIFIED' }
        });
        const now = new Date();
        const until = new Date(now.getTime() + 60 * 1000); // 1 minute
        await prisma.buttonCycle.update({
          where: { id: cycleId },
          data: {
            priorityUserId: nextUser.userId,
            priorityUntil: until
          }
        });
        
        // Broadcast priority
        io.emit('buttonStateChanged', { status: 'GREEN', priorityUserId: nextUser.userId, priorityUntil: until });
        
        // Add job to expire priority
        const { buttonQueue } = require('../config/redis');
        await buttonQueue.add('expirePriority', { cycleId, userId: nextUser.userId }, { delay: 60 * 1000, jobId: `priority_${cycleId}` });
      } else {
        io.emit('buttonStateChanged', { status: 'GREEN' });
      }

    } else if (job.name === 'expirePriority') {
      const { cycleId, userId } = job.data;
      const cycle = await prisma.buttonCycle.findUnique({ where: { id: cycleId } });
      if (!cycle || cycle.priorityUserId !== userId) return;

      // Remove priority
      await prisma.buttonCycle.update({
        where: { id: cycleId },
        data: {
          priorityUserId: null,
          priorityUntil: null
        }
      });
      io.emit('buttonStateChanged', { status: cycle.status });
    }
  }, { connection: redisClient });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed with ${err.message}`);
  });
};
