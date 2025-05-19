
import React, { ReactNode } from 'react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { useAuth } from '@/contexts/AuthContext';

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen h-screen flex flex-col bg-background overflow-hidden">
      <Navbar />
      <div className="flex flex-1 h-full overflow-hidden">
        <div 
          className="h-full shrink-0 w-52"
        >
          <Sidebar />
        </div>
        <main className="flex-1 overflow-auto h-full pt-16 w-full">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
