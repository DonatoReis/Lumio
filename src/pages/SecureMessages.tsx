
import React from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const SecureMessagesPage: React.FC = () => {
  const { loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  // Redirect to the security page with the secure-messages tab
  return <Navigate to="/security?tab=secure-messages" />;
};

export default SecureMessagesPage;
