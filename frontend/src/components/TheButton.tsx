import React, { useEffect, useState } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';

export const TheButton: React.FC = () => {
  const { socket, buttonState } = useSocket();
  const { user } = useAuth();
  const [waitlistCount, setWaitlistCount] = useState(0);
  const [inWaitlist, setInWaitlist] = useState(false);

  useEffect(() => {
    if (socket) {
      socket.on('waitlistJoined', (data) => {
        setWaitlistCount(data.count);
        setInWaitlist(true);
      });
    }
    return () => {
      socket?.off('waitlistJoined');
    }
  }, [socket]);

  const handleClick = () => {
    if (buttonState.status === 'GRAY') return;
    socket?.emit('clickButton');
  };

  const handleJoinWaitlist = () => {
    socket?.emit('joinWaitlist');
  };

  const isOwner = buttonState.owner === user?.username;

  return (
    <div className="the-button-container" style={{ flexDirection: 'column' }}>
      <button 
        className={`the-button ${buttonState.status}`} 
        onClick={handleClick}
        disabled={buttonState.status === 'GRAY'}
      >
        {buttonState.status === 'GREEN' ? 'CLICK ME' : 
         buttonState.status === 'RED' ? 'OCCUPIED' : 'DISABLED'}
      </button>

      <div className="status-text" style={{ marginTop: '2rem' }}>
        {buttonState.status === 'RED' && (
          <p>Currently owned by: <strong>{buttonState.owner}</strong></p>
        )}
        {buttonState.priorityUserId === user?.id && (
          <p style={{ color: '#4ade80' }}>You have priority for 1 minute!</p>
        )}
      </div>

      {buttonState.status === 'RED' && !isOwner && !inWaitlist && (
        <div className="waitlist-container">
          <p>Button is currently occupied.</p>
          <button className="btn-secondary" onClick={handleJoinWaitlist}>
            Join Waitlist
          </button>
        </div>
      )}
      
      {inWaitlist && buttonState.status === 'RED' && (
        <div className="waitlist-container">
          <p>You are on the waitlist. ({waitlistCount} waiting)</p>
        </div>
      )}
    </div>
  );
};
