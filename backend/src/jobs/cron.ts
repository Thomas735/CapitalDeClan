import cron from 'node-cron';
import prisma from '../config/db';

export const setupCronJobs = (io: any) => {
  // Thursday at 23:59
  cron.schedule('59 23 * * 4', async () => {
    console.log('Running weekly reset cron job');
    try {
      const activeCycle = await prisma.buttonCycle.findFirst({ where: { isActive: true } });
      if (activeCycle) {
        await prisma.buttonCycle.update({
          where: { id: activeCycle.id },
          data: { isActive: false }
        });
      }

      const newCycle = await prisma.buttonCycle.create({
        data: {
          status: 'GREEN',
          isActive: true
        }
      });

      // Clear waitlist implicitly since it's tied to cycleId
      
      io.emit('buttonStateChanged', { status: 'GREEN', cycleId: newCycle.id });
      console.log('Weekly reset completed');
    } catch (e) {
      console.error('Cron job error:', e);
    }
  });
};
