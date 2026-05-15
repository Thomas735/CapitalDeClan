import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: Socket | null;
  buttonState: {
    name: string;
    status: 'GREEN' | 'RED' | 'GRAY';
    owner?: string;
    priorityUserId?: string;
    priorityUntil?: Date;
    waitlist: string[];
  };
}

const SocketContext = createContext<SocketContextType>({} as SocketContextType);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [buttonState, setButtonState] = useState<SocketContextType['buttonState']>({ name: 'TTF S', status: 'GREEN', waitlist: [] });

  useEffect(() => {
    if (token) {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const newSocket = io(apiUrl, {
        auth: { token }
      });

      newSocket.on('initialState', (state) => {
        setButtonState(state);
      });

      newSocket.on('buttonStateChanged', (state) => {
        setButtonState(prev => ({ ...prev, ...state }));
      });

      newSocket.on('waitlistUpdated', (newList) => {
        setButtonState(prev => ({ ...prev, waitlist: newList }));
      });

      newSocket.on('buttonNameChanged', (newName) => {
        setButtonState(prev => ({ ...prev, name: newName }));
      });

      newSocket.on('errorMsg', (msg) => {
        alert(msg);
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    }
  }, [token]);

  return (
    <SocketContext.Provider value={{ socket, buttonState }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
