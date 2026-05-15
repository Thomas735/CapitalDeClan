import React from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { AuthForm } from './components/AuthForm';
import { TheButton } from './components/TheButton';

const MainContent: React.FC = () => {
  const { user, isLoading, logout } = useAuth();

  if (isLoading) return <div>Loading...</div>;

  if (!user) {
    return (
      <div className="app-container">
        <h1>THE BUTTON</h1>
        <AuthForm />
      </div>
    );
  }

  return (
    <SocketProvider>
      <div className="app-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>THE BUTTON</h1>
          <button className="btn-secondary" onClick={logout}>Logout</button>
        </div>
        <p style={{ textAlign: 'center', color: '#94a3b8' }}>Welcome, {user.username}</p>
        <TheButton />
      </div>
    </SocketProvider>
  );
};

function App() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}

export default App;
