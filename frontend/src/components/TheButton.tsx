import React, { useState } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';

export const TheButton: React.FC = () => {
  const { socket, buttonState } = useSocket();
  const { user } = useAuth();
  const [newName, setNewName] = useState('');

  const handleClick = () => {
    if (buttonState.status === 'GRAY') return;
    socket?.emit('clickButton');
  };

  const handleJoinWaitlist = () => {
    socket?.emit('joinWaitlist');
  };

  const handleChangeName = () => {
    if (newName.trim()) {
      socket?.emit('changeButtonName', newName.trim());
      setNewName('');
    }
  };

  const handleResetToGreen = () => {
    socket?.emit('resetToGreen');
  };

  const isOwner = buttonState.owner === user?.username;
  const inWaitlist = user ? buttonState.waitlist.includes(user.username) : false;
  const waitlistIndex = user ? buttonState.waitlist.indexOf(user.username) : -1;
  const ahead = waitlistIndex > 0 ? buttonState.waitlist.slice(0, waitlistIndex) : [];
  const behind = waitlistIndex >= 0 ? buttonState.waitlist.slice(waitlistIndex + 1) : [];

  return (
    <div className="the-button-container" style={{ flexDirection: 'column' }}>
      
      {user?.role === 'ADMIN' && (
        <div style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #334155', borderRadius: '8px', width: '100%', maxWidth: '400px' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>Espace Administrateur</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Nouveau nom du bouton" 
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <button className="btn-primary" onClick={handleChangeName} style={{ whiteSpace: 'nowrap' }}>
                Changer le nom
              </button>
            </div>
            {buttonState.status === 'RED' && (
              <button className="btn-secondary" onClick={handleResetToGreen} style={{ borderColor: '#ef4444', color: '#ef4444' }}>
                Forcer en Vert (Kick Owner)
              </button>
            )}
          </div>
        </div>
      )}

      <h2 style={{ letterSpacing: '0.2em', color: '#94a3b8', marginBottom: '0.5rem' }}>ÉTAT CAPITAL</h2>
      <h1 style={{ fontSize: '3rem', margin: '0 0 2rem 0', color: 'white' }}>{buttonState.name || 'TTF S'}</h1>

      <button 
        className={`the-button ${buttonState.status}`} 
        onClick={handleClick}
        disabled={buttonState.status === 'GRAY'}
      >
        {buttonState.status === 'GREEN' ? 'CLIQUEZ-MOI' : 
         buttonState.status === 'RED' ? 'OCCUPÉ' : 'DÉSACTIVÉ'}
      </button>

      <div className="status-text" style={{ marginTop: '2rem' }}>
        {buttonState.status === 'RED' && (
          <p>Actuellement possédé par : <strong style={{ color: '#ef4444' }}>{buttonState.owner}</strong></p>
        )}
        {buttonState.priorityUserId === user?.id && (
          <p style={{ color: '#4ade80', fontWeight: 'bold' }}>Vous avez la priorité pendant 1 minute !</p>
        )}
      </div>

      {buttonState.status === 'RED' && !isOwner && !inWaitlist && (
        <div className="waitlist-container" style={{ marginTop: '2rem' }}>
          <p style={{ marginBottom: '1rem' }}>Le bouton est actuellement occupé.</p>
          <button className="btn-secondary" onClick={handleJoinWaitlist}>
            Rejoindre la file d'attente
          </button>
        </div>
      )}
      
      {inWaitlist && buttonState.status === 'RED' && (
        <div className="waitlist-container" style={{ marginTop: '2rem', textAlign: 'left', width: '100%', maxWidth: '400px', padding: '1.5rem', backgroundColor: '#1e293b', borderRadius: '12px' }}>
          <h3 style={{ margin: '0 0 1rem 0', textAlign: 'center', color: '#38bdf8' }}>File d'attente</h3>
          <p style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '1rem' }}>Votre place : {waitlistIndex + 1}</p>
          
          <div style={{ marginBottom: '0.5rem' }}>
            <span style={{ color: '#94a3b8' }}>Devant vous ({ahead.length}) :</span>
            <div style={{ paddingLeft: '1rem', color: '#cbd5e1' }}>
              {ahead.length > 0 ? ahead.join(', ') : <em>Personne</em>}
            </div>
          </div>
          
          <div>
            <span style={{ color: '#94a3b8' }}>Derrière vous ({behind.length}) :</span>
            <div style={{ paddingLeft: '1rem', color: '#cbd5e1' }}>
              {behind.length > 0 ? behind.join(', ') : <em>Personne</em>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
