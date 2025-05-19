
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface NotificationEvent {
  id: string;
  type: 'message' | 'security' | 'system';
  title: string;
  description: string;
  source_id?: string;
  created_at: string;
  read: boolean;
  data?: any;
}

interface UseNotificationsResult {
  notifications: NotificationEvent[];
  unreadCount: number;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearAll: () => Promise<void>;
}

export const useNotifications = (): UseNotificationsResult => {
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useAuth();
  const channelRef = useRef<any>(null);

  // Buscar notificações iniciais
  const fetchNotifications = async () => {
    if (!user) return;

    try {
      // Simulando a busca de notificações, você deve substituir isso
      // por uma chamada real ao seu banco de dados quando implementar
      // a tabela de notificações
      
      // Exemplo de implementação quando tiver uma tabela de notificações:
      // const { data, error } = await supabase
      //   .from('notifications')
      //   .select('*')
      //   .eq('user_id', user.id)
      //   .order('created_at', { ascending: false });
      
      // if (error) throw error;
      // setNotifications(data || []);
      // setUnreadCount(data?.filter(n => !n.read).length || 0);
      
      // Por enquanto, apenas inicializamos com um array vazio
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Erro ao buscar notificações:', error);
    }
  };

  // Configurar assinaturas em tempo real
  useEffect(() => {
    if (!user) return;

    fetchNotifications();

    // Assinar mensagens novas
    const setupMessageSubscription = () => {
      // Quando a tabela de mensagens recebe uma nova entrada
      return supabase
        .channel('new_message_notification')
        .on('postgres_changes', 
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages'
          },
          async (payload) => {
            const newMessage = payload.new as any;
            
            // Se a mensagem não é para o usuário atual, ignore
            if (!newMessage || newMessage.sender_id === user.id) return;
            
            try {
              // Buscar informações da conversa para verificar se o usuário é participante
              const { data: conversation, error: convError } = await supabase
                .from('conversation_participants')
                .select('conversation_id')
                .eq('user_id', user.id)
                .eq('conversation_id', newMessage.conversation_id)
                .single();
                
              if (convError || !conversation) return;
              
              // Buscar informações do remetente
              const { data: sender, error: senderError } = await supabase
                .from('profiles')
                .select('first_name, last_name, email')
                .eq('id', newMessage.sender_id)
                .single();
                
              if (senderError) throw senderError;
              
              // Verificar se o usuário já está na página de mensagens
              const isInMessagesPage = window.location.pathname.includes('/messages');
              const isInSameConversation = window.location.pathname.includes(newMessage.conversation_id);
              
              if (!isInMessagesPage || !isInSameConversation) {
                // Exibir notificação
                const senderName = sender.first_name 
                  ? `${sender.first_name} ${sender.last_name || ''}`
                  : sender.email;
                  
                const newNotification: NotificationEvent = {
                  id: newMessage.id,
                  type: 'message',
                  title: `Nova mensagem de ${senderName.trim()}`,
                  description: newMessage.content.length > 50 
                    ? newMessage.content.substring(0, 47) + '...'
                    : newMessage.content,
                  source_id: newMessage.conversation_id,
                  created_at: newMessage.created_at,
                  read: false,
                  data: { 
                    conversationId: newMessage.conversation_id,
                    senderId: newMessage.sender_id 
                  }
                };
                
                // Adicionar à lista e atualizar contador
                setNotifications(prev => [newNotification, ...prev]);
                setUnreadCount(prev => prev + 1);
                
                // Exibir toast usando Sonner
                toast(newNotification.title, {
                  description: newNotification.description,
                  action: {
                    label: "Ver mensagem",
                    onClick: () => {
                      window.location.href = `/messages?conversation=${newMessage.conversation_id}`;
                    }
                  },
                  duration: 8000
                });
              }
            } catch (error) {
              console.error('Erro ao processar notificação de mensagem:', error);
            }
          }
        )
        .subscribe();
    };

    // Configurar assinaturas
    channelRef.current = setupMessageSubscription();

    return () => {
      // Limpar assinaturas ao desmontar
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [user]);

  // Marcar uma notificação como lida
  const markAsRead = async (notificationId: string) => {
    try {
      // Atualizar localmente
      setNotifications(prev => prev.map(notification => 
        notification.id === notificationId 
          ? { ...notification, read: true } 
          : notification
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));

      // Quando tiver a tabela de notificações implementada:
      // await supabase
      //   .from('notifications')
      //   .update({ read: true })
      //   .eq('id', notificationId);
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
    }
  };

  // Marcar todas as notificações como lidas
  const markAllAsRead = async () => {
    try {
      // Atualizar localmente
      setNotifications(prev => prev.map(notification => ({ ...notification, read: true })));
      setUnreadCount(0);

      // Quando tiver a tabela de notificações implementada:
      // await supabase
      //   .from('notifications')
      //   .update({ read: true })
      //   .eq('user_id', user?.id);
    } catch (error) {
      console.error('Erro ao marcar todas notificações como lidas:', error);
    }
  };

  // Limpar todas as notificações
  const clearAll = async () => {
    try {
      setNotifications([]);
      setUnreadCount(0);

      // Quando tiver a tabela de notificações implementada:
      // await supabase
      //   .from('notifications')
      //   .delete()
      //   .eq('user_id', user?.id);
    } catch (error) {
      console.error('Erro ao limpar notificações:', error);
    }
  };

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll
  };
};
