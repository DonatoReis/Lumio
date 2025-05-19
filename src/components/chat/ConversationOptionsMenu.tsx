
import React from 'react';
import {
  MoreVertical,
  UserPlus,
  LogOut,
  Trash2,
  MessageSquarePlus,
  Bell,
  BellOff,
  Users,
  Lock,
  Settings,
  Smartphone,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ConversationOptionsMenuProps {
  onCreateGroup?: () => void;
  onDevices?: () => void;
  onDeleteConversation?: () => void;
  onLeaveConversation?: () => void;
  onMuteConversation?: () => void;
  onBlockUser?: () => void;
  onManagePrivacy?: () => void;
  onSettings?: () => void;
  isMuted?: boolean;
}

const ConversationOptionsMenu: React.FC<ConversationOptionsMenuProps> = ({
  onCreateGroup,
  onDevices,
  onDeleteConversation,
  onLeaveConversation,
  onMuteConversation,
  onBlockUser,
  onManagePrivacy,
  onSettings,
  isMuted = false
}) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="p-2 rounded-full hover:bg-app-black/30 transition">
          <MoreVertical size={20} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-app-black border-sidebar-border">
        <DropdownMenuItem onClick={onCreateGroup} className="flex items-center gap-2 cursor-pointer">
          <MessageSquarePlus size={16} />
          <span>Novo grupo</span>
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={onDevices} className="flex items-center gap-2 cursor-pointer">
          <Smartphone size={16} />
          <span>Dispositivos conectados</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={onMuteConversation} className="flex items-center gap-2 cursor-pointer">
          {isMuted ? <Bell size={16} /> : <BellOff size={16} />}
          <span>{isMuted ? 'Reativar notificações' : 'Silenciar notificações'}</span>
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={onBlockUser} className="flex items-center gap-2 cursor-pointer">
          <Lock size={16} />
          <span>Bloquear usuário</span>
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={onManagePrivacy} className="flex items-center gap-2 cursor-pointer">
          <Users size={16} />
          <span>Gerenciar privacidade</span>
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={onSettings} className="flex items-center gap-2 cursor-pointer">
          <Settings size={16} />
          <span>Configurações</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={onLeaveConversation} className="flex items-center gap-2 cursor-pointer text-amber-500">
          <LogOut size={16} />
          <span>Sair da conversa</span>
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={onDeleteConversation} className="flex items-center gap-2 cursor-pointer text-red-500">
          <Trash2 size={16} />
          <span>Excluir conversa</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ConversationOptionsMenu;
