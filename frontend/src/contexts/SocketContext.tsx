import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: Socket | null;
  buttonState: {
    status: 'GREEN' | 'RED' | 'GRAY';
    owner?: string;
    priorityUserId?: string;
    priorityUntil?: Date;
  };
}

const SocketContext = createContext<SocketContextType>({} as SocketContextType);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [buttonState, setButtonState] = useState<SocketContextType['buttonState']>({ status: 'GREEN' });

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
        setButtonState(state);
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
