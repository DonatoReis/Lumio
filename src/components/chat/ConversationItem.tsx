
import React, { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSwipe } from '@/hooks/useSwipe';
import { ConversationWithParticipants } from '@/types/supabase';
import { Check, Star, StarOff, Trash2 } from 'lucide-react';

interface ConversationItemProps {
  conversation: ConversationWithParticipants;
  isActive: boolean;
  onClick: () => void;
  onDelete?: (id: string) => void;
  onToggleFavorite?: (id: string, isFavorite: boolean) => void;
  onMarkAsRead?: (id: string) => void;
}

const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isActive,
  onClick,
  onDelete,
  onToggleFavorite,
  onMarkAsRead
}) => {
  const itemRef = useRef<HTMLDivElement>(null);
  const [showActions, setShowActions] = React.useState(false);
  
  // Usar o hook de swipe melhorado
  const { bindSwipeEvents } = useSwipe({
    onSwipeLeft: () => setShowActions(true),
    onSwipeRight: () => setShowActions(false),
    minSwipeDistance: 30
  });
  
  // Adicionar eventos de swipe quando o componente montar
  useEffect(() => {
    const cleanup = bindSwipeEvents(itemRef.current);
    return () => cleanup && cleanup();
  }, [bindSwipeEvents]);
  
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) onDelete(conversation.id);
    setShowActions(false);
  };
  
  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleFavorite) {
      onToggleFavorite(conversation.id, !(conversation.is_favorite || false));
    }
    setShowActions(false);
  };
  
  const handleMarkAsRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onMarkAsRead) onMarkAsRead(conversation.id);
    setShowActions(false);
  };
  
  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    return format(new Date(dateString), 'HH:mm', { locale: ptBR });
  };

  const lastParticipant = conversation.participants?.[0];
  const displayName = lastParticipant?.first_name || lastParticipant?.username || 'Usuário';
  const hasUnread = (conversation.unread_count || 0) > 0;
  
  return (
    <div 
      ref={itemRef}
      className="relative overflow-hidden"
      onClick={onClick}
    >
      <div
        className={cn(
          "flex p-3 cursor-pointer transition-all duration-300 ease-in-out",
          isActive ? "bg-app-purple/10" : "hover:bg-app-background/50",
          { "translate-x-[-80px]": showActions }
        )}
      >
        <div className="w-10 h-10 rounded-full bg-app-purple/20 flex items-center justify-center shrink-0">
          <span className="text-app-purple font-medium">{displayName.charAt(0).toUpperCase()}</span>
        </div>
        <div className="ml-3 flex-1 min-w-0">
          <div className="flex justify-between items-start">
            <h3 className={cn("font-medium truncate", hasUnread && "font-semibold")}>
              {conversation.name || displayName}
            </h3>
            <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
              {formatTime(conversation.last_message_time)}
            </span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <p className={cn(
              "text-sm truncate text-muted-foreground max-w-[180px]", 
              hasUnread && "font-medium text-app-white"
            )}>
              {conversation.last_message || "Nenhuma mensagem"}
            </p>
            {hasUnread && (
              <span className="ml-2 bg-app-purple text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {conversation.unread_count}
              </span>
            )}
            {conversation.is_favorite && (
              <Star size={14} className="text-yellow-400 ml-1" />
            )}
          </div>
        </div>
      </div>
      
      {/* Ações de swipe */}
      <div className="absolute right-0 top-0 h-full flex items-center">
        <button 
          onClick={handleMarkAsRead} 
          className="h-full w-10 bg-blue-500 flex items-center justify-center text-white"
          aria-label="Marcar como lido"
        >
          <Check size={16} />
        </button>
        <button 
          onClick={handleToggleFavorite} 
          className="h-full w-10 bg-yellow-500 flex items-center justify-center text-white"
          aria-label={conversation.is_favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        >
          {conversation.is_favorite ? <StarOff size={16} /> : <Star size={16} />}
        </button>
        <button 
          onClick={handleDelete} 
          className="h-full w-10 bg-red-500 flex items-center justify-center text-white"
          aria-label="Excluir conversa"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};

export default ConversationItem;
