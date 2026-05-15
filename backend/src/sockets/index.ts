import { Server, Socket } from 'socket.io';
import prisma from '../config/db';
import { buttonQueue } from '../config/redis';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

export const setupSockets = (io: Server) => {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error'));
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      socket.data.user = decoded;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  const getWaitlistData = async (cycleId: string) => {
    const waitlist = await prisma.waitlist.findMany({
      where: { cycleId, status: 'WAITING' },
      orderBy: { joinedAt: 'asc' },
      include: { user: true }
    });
    return waitlist.map(w => w.user.username);
  };

  io.on('connection', async (socket: Socket) => {
    console.log(`User connected: ${socket.data.user.username}`);

    // Send initial state
    let cycle = await prisma.buttonCycle.findFirst({ where: { isActive: true }, include: { currentOwner: true, priorityUser: true } });
    if (!cycle) {
      cycle = await prisma.buttonCycle.create({ data: { status: 'GREEN', isActive: true, name: 'TTF S' }, include: { currentOwner: true, priorityUser: true } });
    }
    
    const waitlist = await getWaitlistData(cycle.id);

    socket.emit('initialState', {
      name: cycle.name,
      status: cycle.status,
      owner: cycle.currentOwner?.username,
      priorityUserId: cycle.priorityUserId,
      priorityUntil: cycle.priorityUntil,
      waitlist
    });

    socket.on('clickButton', async () => {
      const userId = socket.data.user.id;
      let currentCycle = await prisma.buttonCycle.findFirst({ where: { isActive: true } });
      if (!currentCycle) return;

      if (currentCycle.status === 'GRAY') return;

      if (currentCycle.status === 'RED') {
        if (currentCycle.currentOwnerId === userId) {
          // Owner clicked again -> returns to GREEN
          currentCycle = await prisma.buttonCycle.update({
            where: { id: currentCycle.id },
            data: { status: 'GREEN', currentOwnerId: null, redSince: null }
          });
          
          await prisma.clickHistory.create({ data: { userId, action: 'TURNED_GREEN' } });
          
          // Cancel 30 min job
          await buttonQueue.remove(`release_${currentCycle.id}`);

          // Process waitlist
          const nextUser = await prisma.waitlist.findFirst({
            where: { cycleId: currentCycle.id, status: 'WAITING' },
            orderBy: { joinedAt: 'asc' }
          });

          if (nextUser) {
            await prisma.waitlist.update({ where: { id: nextUser.id }, data: { status: 'NOTIFIED' } });
            const until = new Date(Date.now() + 60 * 1000);
            currentCycle = await prisma.buttonCycle.update({
              where: { id: currentCycle.id },
              data: { priorityUserId: nextUser.userId, priorityUntil: until }
            });
            await buttonQueue.add('expirePriority', { cycleId: currentCycle.id, userId: nextUser.userId }, { delay: 60 * 1000, jobId: `priority_${currentCycle.id}` });
            
            // Broadcast updated waitlist
            const newWaitlist = await getWaitlistData(currentCycle.id);
            io.emit('waitlistUpdated', newWaitlist);
          }
          
          io.emit('buttonStateChanged', {
            status: 'GREEN',
            priorityUserId: currentCycle.priorityUserId,
            priorityUntil: currentCycle.priorityUntil
          });
        }
        return;
      }

      if (currentCycle.status === 'GREEN') {
        // Priority check
        if (currentCycle.priorityUserId && currentCycle.priorityUserId !== userId) {
          if (new Date() < currentCycle.priorityUntil!) {
            socket.emit('errorMsg', 'Someone else has priority');
            return;
          }
        }

        // Add user to cycleUsers if not already
        const existingCycleUser = await prisma.cycleUser.findUnique({
          where: { cycleId_userId: { cycleId: currentCycle.id, userId } }
        });
        if (!existingCycleUser) {
          await prisma.cycleUser.create({ data: { cycleId: currentCycle.id, userId } });
        }

        const distinctUsersCount = await prisma.cycleUser.count({ where: { cycleId: currentCycle.id } });
        
        if (distinctUsersCount > 50) {
          // Limit reached!
          await prisma.buttonCycle.update({ where: { id: currentCycle.id }, data: { status: 'GRAY' } });
          io.emit('buttonStateChanged', { status: 'GRAY' });
          
          // Generate new cycle immediately
          await prisma.buttonCycle.update({ where: { id: currentCycle.id }, data: { isActive: false } });
          const newCycle = await prisma.buttonCycle.create({ data: { status: 'GREEN', isActive: true } });
          io.emit('buttonStateChanged', { status: 'GREEN', cycleId: newCycle.id });
          return;
        }

        // Proceed to turn red
        const updatedCycle = await prisma.buttonCycle.update({
          where: { id: currentCycle.id },
          data: {
            status: 'RED',
            currentOwnerId: userId,
            redSince: new Date(),
            priorityUserId: null,
            priorityUntil: null
          }
        });

        await prisma.clickHistory.create({ data: { userId, action: 'TURNED_RED' } });

        io.emit('buttonStateChanged', { status: 'RED', owner: socket.data.user.username });
        
        // Schedule 30 min timeout
        await buttonQueue.add('releaseButton', { cycleId: currentCycle.id }, { delay: 30 * 60 * 1000, jobId: `release_${currentCycle.id}` });
      }
    });

    socket.on('joinWaitlist', async () => {
      const userId = socket.data.user.id;
      const currentCycle = await prisma.buttonCycle.findFirst({ where: { isActive: true } });
      if (!currentCycle || currentCycle.status !== 'RED') return;

      const existing = await prisma.waitlist.findFirst({ where: { cycleId: currentCycle.id, userId, status: 'WAITING' } });
      if (existing) return;

      await prisma.waitlist.create({ data: { cycleId: currentCycle.id, userId } });
      const newWaitlist = await getWaitlistData(currentCycle.id);
      io.emit('waitlistUpdated', newWaitlist);
    });

    socket.on('changeButtonName', async (newName: string) => {
      if (socket.data.user.role !== 'ADMIN') return;
      const currentCycle = await prisma.buttonCycle.findFirst({ where: { isActive: true } });
      if (!currentCycle) return;

      await prisma.buttonCycle.update({
        where: { id: currentCycle.id },
        data: { name: newName }
      });

      io.emit('buttonNameChanged', newName);
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.data.user.username}`);
    });
  });
};
