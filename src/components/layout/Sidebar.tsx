import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import Logo from '@/components/ui/logo';
import { 
  Home, 
  MessageCircle, 
  Calendar, 
  ShoppingBag, 
  Users, 
  Settings, 
  Sparkles,
  VideoIcon,
  FolderArchive,
  Bell
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  to: string;
  isActive: boolean;
  notification?: number;
}

interface SidebarProps {
  expanded?: boolean;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ 
  icon, 
  label, 
  to, 
  isActive, 
  notification 
}) => {
  return (
    <Link 
      to={to} 
      className={cn(
        'sidebar-link relative mb-1 group flex items-center w-full',
        isActive && 'sidebar-link-active'
      )}
    >
      <div className="flex items-center w-full">
        <span className={cn(
          "w-10 h-10 flex items-center justify-center",
          isActive && 'text-app-purple'
        )}>
          {icon}
        </span>
        <span 
          className="whitespace-nowrap flex-1 opacity-100 visible"
        >
          {label}
        </span>
        
        {notification && notification > 0 && (
          <span className="rounded-full bg-app-purple text-white text-xs px-2 py-0.5 min-w-[20px] text-center mr-2">
            {notification}
          </span>
        )}
      </div>
    </Link>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ expanded = true }) => {
  const location = useLocation();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const { profile } = useAuth();

  const sidebarItems = [
    { icon: <Home size={20} />, label: 'Dashboard', to: '/', notification: 0 },
    { icon: <MessageCircle size={20} />, label: 'Mensagens', to: '/messages', notification: 0 },
    { icon: <ShoppingBag size={20} />, label: 'Marketplace', to: '/marketplace', notification: 0 },
    { icon: <Sparkles size={20} />, label: 'Match IA', to: '/ai-match', notification: 0 },
    { icon: <Calendar size={20} />, label: 'Calendário', to: '/calendar', notification: 0 },
    { icon: <Users size={20} />, label: 'Equipes', to: '/teams', notification: 0 },
    { icon: <FolderArchive size={20} />, label: 'Arquivos', to: '/files', notification: 0 },
  ];

  // Mantém apenas os itens com notificações reais (valor maior que 0)
  const sidebarItemsFiltered = sidebarItems.map(item => ({
    ...item,
    notification: item.notification > 0 ? item.notification : undefined
  }));

  return (
    <div
      ref={sidebarRef}
      className='h-full bg-sidebar flex flex-col border-r border-sidebar-border w-52 shadow-[0_4px_6px_rgba(0,0,0,0.4)]'
    >
      <div className="px-4 py-4 flex items-center border-b border-sidebar-border">
        <div className='overflow-hidden whitespace-nowrap w-auto'>
          <Logo size="md" variant="full" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-2">
        <nav className="space-y-1 flex flex-col">
          {sidebarItemsFiltered.map((item) => (
            <SidebarItem
              key={item.to}
              icon={item.icon}
              label={item.label}
              to={item.to}
              isActive={location.pathname === item.to}
              notification={item.notification}
            />
          ))}
        </nav>
      </div>

      <div className="p-4 border-t border-sidebar-border">
        <Link 
          to="/settings" 
          className="sidebar-link relative group flex items-center w-full"
        >
          <div className="flex items-center w-full">
            <span className="w-10 h-10 flex items-center justify-center">
              <Settings size={20} />
            </span>
            <span className="whitespace-nowrap flex-1 opacity-100 visible">
              Configurações
            </span>
          </div>
        </Link>
      </div>
    </div>
  );
};

export default Sidebar;
