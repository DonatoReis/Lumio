/**
 * Hook para gerenciar chats seguros usando o Signal Protocol
 * Implementa E2EE com AES-256 e HMAC-SHA256
 */

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import signalProtocolUtils, { EncryptedMessage } from '@/utils/signalProtocol';
import { v4 as uuidv4 } from 'uuid';

interface Message {
  id: string;
  sender_id: string;
  content: string;
  encrypted_content?: string;
  is_encrypted: boolean;
  created_at: string;
  sender?: {
    email: string;
    first_name?: string;
    last_name?: string;
  };
}

interface ChatPartner {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  last_message?: string;
  last_message_time?: string;
  unread_count?: number;
}

export const useSecureChat = () => {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatPartners, setChatPartners] = useState<ChatPartner[]>([]);
  const [currentChatPartner, setCurrentChatPartner] = useState<ChatPartner | null>(null);
  const [publicKeyMap, setPublicKeyMap] = useState<Record<string, string>>({});
  const { user } = useAuth();
  const { toast } = useToast();

  // Inicialização - garantir que o par de chaves está configurado
  useEffect(() => {
    const initializeKeyPair = async () => {
      if (!user) return;
      
      try {
        // Verificar se já temos um par de chaves
        const keyId = await signalProtocolUtils.getSenderPublicKeyId().catch(() => null);
        
        if (!keyId) {
          // Gerar novo par de chaves
          const newKeyId = await signalProtocolUtils.generateAndStoreKeyPair();
          console.log('Novo par de chaves gerado:', newKeyId);
        }
        
        // Registrar a chave pública no servidor
        await registerPublicKey();
      } catch (error) {
        console.error('Erro ao inicializar par de chaves:', error);
        toast({
          title: 'Erro de criptografia',
          description: 'Não foi possível configurar a criptografia segura.',
          variant: 'destructive',
        });
      }
    };
    
    initializeKeyPair();
  }, [user]);

  /**
   * Registra a chave pública do usuário no servidor
   */
  const registerPublicKey = async () => {
    if (!user) return;
    
    try {
      const publicKey = await signalProtocolUtils.getCurrentPublicKey();
      const keyId = await signalProtocolUtils.getSenderPublicKeyId();
      
      await supabase.functions.invoke('key-exchange', {
        body: {
          action: 'registerPublicKey',
          publicKey,
          keyId,
        }
      });
      
      console.log('Chave pública registrada com sucesso');
    } catch (error) {
      console.error('Erro ao registrar chave pública:', error);
      throw error;
    }
  };

  /**
   * Obtém a chave pública de um usuário
   * @param userId ID do usuário
   * @returns Chave pública em formato string
   */
  const getPublicKey = async (userId: string): Promise<string> => {
    // Verificar se já temos a chave em cache
    if (publicKeyMap[userId]) {
      return publicKeyMap[userId];
    }
    
    try {
      const { data, error } = await supabase.functions.invoke('key-exchange', {
        body: {
          action: 'getPublicKey',
          userId,
        }
      });
      
      if (error || !data.success) {
        throw new Error(error?.message || data?.message || 'Falha ao buscar chave pública');
      }
      
      // Adicionar chave ao cache
      setPublicKeyMap(prev => ({
        ...prev,
        [userId]: data.publicKey,
      }));
      
      return data.publicKey;
    } catch (error) {
      console.error('Erro ao buscar chave pública:', error);
      throw error;
    }
  };

  /**
   * Carrega histórico de conversas do usuário
   */
  const loadChatPartners = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Consultar todas as conversas envolvendo o usuário atual
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id,
          last_message,
          last_message_time,
          conversation_participants!inner(
            user_id,
            user:profiles!inner(id, email, first_name, last_name)
          )
        `)
        .eq('conversation_participants.user_id', user.id);
      
      if (error) throw error;
      
      if (data) {
        // Mapear conversas para parceiros de chat (excluindo o usuário atual)
        const partners = data.flatMap(conversation => {
          const participants = conversation.conversation_participants
            .filter(p => p.user_id !== user.id)
            .map(p => p.user);
          
          return participants.map(partner => ({
            id: partner.id,
            email: partner.email,
            first_name: partner.first_name,
            last_name: partner.last_name,
            last_message: conversation.last_message,
            last_message_time: conversation.last_message_time,
          }));
        });
        
        setChatPartners(partners);
      }
    } catch (error) {
      console.error('Erro ao carregar conversas:', error);
      toast({
        title: 'Erro ao carregar conversas',
        description: 'Não foi possível carregar suas conversas.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  /**
   * Carrega mensagens de uma conversa específica
   * @param partnerId ID do parceiro de conversa
   */
  const loadMessages = useCallback(async (partnerId: string) => {
    if (!user || !partnerId) return;
    
    try {
      setLoading(true);
      
      // Encontrar o parceiro de chat
      const partner = chatPartners.find(p => p.id === partnerId);
      if (partner) {
        setCurrentChatPartner(partner);
      }
      
      // Encontrar ou criar a conversa entre os usuários
      const { data: conversationData, error: conversationError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);
      
      if (conversationError) throw conversationError;
      
      // Se não há conversa, não tem mensagens para carregar
      if (!conversationData || conversationData.length === 0) {
        setMessages([]);
        return;
      }
      
      const conversationIds = conversationData.map(c => c.conversation_id);
      
      // Encontrar conversas em comum com o parceiro
      const { data: partnerConversations, error: partnerError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', partnerId)
        .in('conversation_id', conversationIds);
      
      if (partnerError) throw partnerError;
      
      // Se não há conversa em comum, não tem mensagens para carregar
      if (!partnerConversations || partnerConversations.length === 0) {
        setMessages([]);
        return;
      }
      
      const commonConversationIds = partnerConversations.map(c => c.conversation_id);
      
      // Consultar todas as mensagens da conversa
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select(`
          id,
          sender_id,
          content,
          encrypted_content,
          is_encrypted,
          created_at,
          sender:profiles!sender_id(email, first_name, last_name)
        `)
        .in('conversation_id', commonConversationIds)
        .order('created_at');
      
      if (messagesError) throw messagesError;
      
      if (messagesData) {
        // Para mensagens criptografadas, tentar descriptografar
        const processedMessages = await Promise.all(messagesData.map(async (msg) => {
          if (msg.is_encrypted && msg.encrypted_content) {
            try {
              const encryptedMessage: EncryptedMessage = JSON.parse(msg.encrypted_content);
              const decryptedContent = await signalProtocolUtils.decryptMessage(encryptedMessage);
              return { ...msg, content: decryptedContent };
            } catch (e) {
              console.error('Erro ao descriptografar mensagem:', e);
              return { ...msg, content: '[Mensagem criptografada não pôde ser lida]' };
            }
          }
          return msg;
        }));
        
        setMessages(processedMessages);
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
      toast({
        title: 'Erro ao carregar mensagens',
        description: 'Não foi possível carregar as mensagens desta conversa.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, chatPartners, toast]);

  /**
   * Envia uma mensagem criptografada
   * @param receiverId ID do destinatário
   * @param message Conteúdo da mensagem
   */
  const sendSecureMessage = async (receiverId: string, message: string) => {
    if (!user || !receiverId || !message.trim()) return;
    
    try {
      setSending(true);
      
      // Obter chave pública do destinatário
      const publicKeyStr = await getPublicKey(receiverId);
      const publicKey = await signalProtocolUtils.importPublicKey(publicKeyStr);
      
      // Criptografar a mensagem
      const encryptedMessage = await signalProtocolUtils.encryptMessage(message, publicKey);
      
      // Ensure the conversationId is a valid UUID
      const conversationId = await findOrCreateConversation(receiverId);
      
      // Salvar mensagem no banco de dados
      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          conversation_id: conversationId,
          content: '[Mensagem criptografada]', // Placeholder para UI
          encrypted_content: JSON.stringify(encryptedMessage),
          is_encrypted: true,
        })
        .select();
      
      if (error) throw error;
      
      // Atualizar última mensagem na conversa
      await updateConversation(conversationId, message);
      
      // Adicionar mensagem à lista local
      if (data && data.length > 0) {
        setMessages(prev => [...prev, {
          ...data[0],
          content: message, // Versão descriptografada para exibição local
          sender: {
            email: user.email || '',
            first_name: user.user_metadata?.first_name,
            last_name: user.user_metadata?.last_name,
          }
        }]);
      }
      
      toast({
        title: 'Mensagem enviada',
        description: 'Sua mensagem foi enviada com segurança.',
      });
      
      return true;
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast({
        title: 'Erro ao enviar mensagem',
        description: 'Não foi possível enviar sua mensagem.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setSending(false);
    }
  };

  /**
   * Encontra ou cria uma conversa com outro usuário
   * @param partnerId ID do parceiro de conversa
   * @returns ID da conversa
   */
  const findOrCreateConversation = async (partnerId: string): Promise<string> => {
    if (!user) throw new Error('Usuário não autenticado');
    
    try {
      // Verificar se já existe uma conversa entre os usuários
      const { data: userConversations } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);
        
      if (!userConversations || userConversations.length === 0) {
        // Criar nova conversa se o usuário não tem nenhuma
        return createNewConversation(partnerId);
      }
        
      const conversationIds = userConversations.map(c => c.conversation_id);
        
      // Verificar se o parceiro está em alguma dessas conversas
      const { data: partnerConversations } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', partnerId)
        .in('conversation_id', conversationIds);
        
      if (partnerConversations && partnerConversations.length > 0) {
        // Retornar a primeira conversa em comum
        return partnerConversations[0].conversation_id;
      }
        
      // Create a valid UUID for the new conversation
      return createNewConversation(partnerId);
    } catch (error) {
      console.error('Erro ao buscar conversa:', error);
      throw error;
    }
  };

  /**
   * Cria uma nova conversa entre dois usuários
   * @param partnerId ID do parceiro de conversa
   * @returns ID da conversa criada
   */
  const createNewConversation = async (partnerId: string): Promise<string> => {
    if (!user) throw new Error('Usuário não autenticado');
    
    try {
      // Create a valid UUID for the new conversation
      const conversationId = uuidv4();
      
      // Create new conversation
      const { data: newConversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          id: conversationId
        })
        .select();
        
      if (convError || !newConversation || newConversation.length === 0) {
        throw new Error('Falha ao criar conversa');
      }
        
      const actualConversationId = newConversation[0].id;
        
      // Add participants
      const { error: partError } = await supabase
        .from('conversation_participants')
        .insert([
          { conversation_id: actualConversationId, user_id: user.id },
          { conversation_id: actualConversationId, user_id: partnerId }
        ]);
        
      if (partError) throw partError;
        
      return actualConversationId;
    } catch (error) {
      console.error('Erro ao criar conversa:', error);
      throw error;
    }
  };

  /**
   * Atualiza informações da conversa
   * @param conversationId ID da conversa
   * @param lastMessage Última mensagem enviada
   */
  const updateConversation = async (conversationId: string, lastMessage: string) => {
    try {
      await supabase
        .from('conversations')
        .update({
          last_message: lastMessage,
          last_message_time: new Date().toISOString()
        })
        .eq('id', conversationId);
    } catch (error) {
      console.error('Erro ao atualizar conversa:', error);
    }
  };

  /**
   * Inicia uma nova conversa com um usuário
   * @param userId ID do usuário
   */
  const startNewChat = async (userId: string) => {
    if (!user || !userId) return;
    
    try {
      // Verificar se o usuário existe
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name')
        .eq('id', userId)
        .single();
      
      if (error || !data) throw new Error('Usuário não encontrado');
      
      // Definir como parceiro de chat atual
      setCurrentChatPartner({
        id: data.id,
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
      });
      
      // Limpar mensagens atuais
      setMessages([]);
      
      return true;
    } catch (error) {
      console.error('Erro ao iniciar nova conversa:', error);
      toast({
        title: 'Erro ao iniciar conversa',
        description: 'Não foi possível iniciar a conversa com este usuário.',
        variant: 'destructive',
      });
      return false;
    }
  };

  /**
   * Busca usuários para iniciar uma nova conversa
   * @param query Termo de busca
   */
  const searchUsers = async (query: string) => {
    if (!user || !query || query.length < 3) return [];
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name')
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`)
        .neq('id', user.id)
        .limit(10);
      
      if (error) throw error;
      
      return data || [];
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      return [];
    }
  };

  // Configurar escuta em tempo real para novas mensagens
  useEffect(() => {
    if (!user) return;
    
    const subscription = supabase
      .channel('public:messages')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages',
          filter: `sender_id=neq.${user.id}`
        },
        async (payload) => {
          console.log('Nova mensagem recebida:', payload);
          
          // Processar apenas se estiver em uma conversa
          if (!currentChatPartner) return;
          
          const message = payload.new as any;
          
          // Verificar se a mensagem faz parte da conversa atual
          const { data } = await supabase
            .from('conversation_participants')
            .select('user_id')
            .eq('conversation_id', message.conversation_id)
            .eq('user_id', currentChatPartner.id);
            
          if (!data || data.length === 0) return;
          
          try {
            // Se for criptografada, descriptografar
            if (message.is_encrypted && message.encrypted_content) {
              const encryptedMessage: EncryptedMessage = JSON.parse(message.encrypted_content);
              const decryptedContent = await signalProtocolUtils.decryptMessage(encryptedMessage);
              
              // Buscar dados do remetente
              const { data: senderData } = await supabase
                .from('profiles')
                .select('email, first_name, last_name')
                .eq('id', message.sender_id)
                .single();
              
              // Adicionar à lista de mensagens
              const newMessage = {
                ...message,
                content: decryptedContent,
                sender: senderData || undefined
              };
              
              setMessages(prev => [...prev, newMessage]);
            } else {
              // Adicionar mensagem não criptografada (não deve ocorrer no fluxo seguro)
              setMessages(prev => [...prev, message]);
            }
          } catch (error) {
            console.error('Erro ao processar nova mensagem:', error);
          }
          
          // Atualizar lista de conversas
          loadChatPartners();
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user, currentChatPartner, loadChatPartners]);

  return {
    loading,
    sending,
    messages,
    chatPartners,
    currentChatPartner,
    loadChatPartners,
    loadMessages,
    sendSecureMessage,
    startNewChat,
    searchUsers,
    setCurrentChatPartner,
  };
};
