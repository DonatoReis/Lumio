
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import axios from 'axios';
// URL base para a API de segurança (Vite)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

interface SecuritySettings {
  disable_preview_links: boolean;
  block_unknown_senders: boolean;
  block_threshold: number;
  hide_ip_address: boolean;
}

export const useConversationProtection = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<SecuritySettings>({
    disable_preview_links: false,
    block_unknown_senders: false, 
    block_threshold: 10,
    hide_ip_address: false
  });
  const [loading, setLoading] = useState(true);

  // Função para obter token JWT para autenticação das requisições
  const getAuthHeader = async () => {
    const session = await supabase.auth.getSession();
    const token = session?.data?.session?.access_token;
    
    if (!token) {
      throw new Error('Não foi possível obter token de autenticação');
    }
    
    return {
      headers: {
        Authorization: `Bearer ${token}`
      }
    };
  };

  // Load security settings for the user from the API
  useEffect(() => {
    const loadSettings = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const authHeader = await getAuthHeader();
        
        // Tentar obter configurações do backend
        const response = await axios.get(`${API_BASE_URL}/security/settings`, authHeader);
        
        if (response.data) {
          setSettings(response.data);
        } else {
          // Fallback para configurações padrão se o backend não retornar dados
          setSettings({
            disable_preview_links: false,
            block_unknown_senders: false,
            block_threshold: 10,
            hide_ip_address: false
          });
        }
      } catch (error) {
        console.error('Erro ao carregar configurações de segurança:', error);
        
        // Tentar obter configurações localmente do Supabase como fallback
        try {
          const { data, error: supabaseError } = await supabase
            .from('user_security_settings')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1);
            
          if (supabaseError) throw supabaseError;
          
          if (data && data.length > 0) {
            setSettings(data[0]);
          } else {
            // Configurações padrão
            setSettings({
              disable_preview_links: false,
              block_unknown_senders: false,
              block_threshold: 10,
              hide_ip_address: false
            });
          }
        } catch (fallbackError) {
          console.error('Erro no fallback para obter configurações:', fallbackError);
          // Usar configurações padrão em caso de erro
          setSettings({
            disable_preview_links: false,
            block_unknown_senders: false,
            block_threshold: 10,
            hide_ip_address: false
          });
        }
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [user]);

  // Atualizar configurações de segurança usando a API
  const updateSettings = async (newSettings: Partial<SecuritySettings>) => {
    if (!user) return false;
    
    setLoading(true);
    try {
      const updatedSettings = { ...settings, ...newSettings };
      const authHeader = await getAuthHeader();
      
      // Atualizar configurações via API
      const response = await axios.put(
        `${API_BASE_URL}/security/settings`, 
        updatedSettings, 
        authHeader
      );
      
      if (response.status !== 200) {
        throw new Error('Falha ao atualizar configurações');
      }
      
      // Atualizar estado local
      setSettings(updatedSettings);
      
      toast({
        title: "Configurações atualizadas",
        description: "Suas configurações de segurança foram salvas.",
      });
      
      return true;
    } catch (error) {
      console.error('Erro ao atualizar configurações:', error);
      
      // Tentar atualizar diretamente no Supabase como fallback
      try {
        const updatedSettings = { ...settings, ...newSettings };
        
        const { error: supabaseError } = await supabase
          .from('user_security_settings')
          .update(updatedSettings)
          .eq('user_id', user.id);
        
        if (supabaseError) throw supabaseError;
        
        setSettings(updatedSettings);
        
        toast({
          title: "Configurações atualizadas",
          description: "Suas configurações de segurança foram salvas no modo offline.",
        });
        
        return true;
      } catch (fallbackError) {
        console.error('Erro no fallback para atualizar configurações:', fallbackError);
        
        toast({
          title: "Erro ao atualizar configurações",
          description: "Não foi possível salvar suas configurações de segurança.",
          variant: "destructive",
        });
        
        return false;
      }
    } finally {
      setLoading(false);
    }
  };
  
  // Alternar a proteção de IP especificamente
  const toggleIpProtection = async () => {
    return updateSettings({ hide_ip_address: !settings.hide_ip_address });
  };

  // Obter configuração WebRTC com base nas configurações de segurança
  const getWebRTCConfiguration = async () => {
    try {
      if (!user) {
        throw new Error('Usuário não autenticado');
      }
      
      const authHeader = await getAuthHeader();
      const response = await axios.get(`${API_BASE_URL}/webrtc/config`, authHeader);
      
      return response.data;
    } catch (error) {
      console.error('Erro ao obter configuração WebRTC:', error);
      // Configuração fallback
      return {
        iceServers: [
          { urls: ['stun:stun1.l.google.com:19302'] },
          ...(settings.hide_ip_address
            ? [{ urls: import.meta.env.VITE_TURN_URL || 'turn:turn.myserver.com:3478', username: 'demo', credential: 'demo' }]
            : [])
        ],
        iceTransportPolicy: settings.hide_ip_address ? 'relay' : 'all'
      };
    }
  };

  // Process message content based on security settings
  const processMessageContent = (content: string): string => {
    if (!settings || loading) return content;

    let processedContent = content;

    // Apply content processing based on settings
    if (settings.disable_preview_links) {
      // Replace URLs with non-previewable format using a simple regex
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      processedContent = processedContent.replace(urlRegex, '[Link: $1]');
    }

    return processedContent;
  };

  // Check if a message should be blocked based on security settings
  const shouldBlockMessage = async (senderId: string, content: string) => {
    // Default - do not block
    const defaultResponse = { blocked: false, reason: '' };
    
    // If settings aren't loaded or we're still loading, don't block anything
    if (!settings || loading || !user) {
      return defaultResponse;
    }

    try {
      // Block unknown senders if setting is enabled
      if (settings.block_unknown_senders) {
        // Check if this is a known contact
        const { data } = await supabase.rpc('is_known_contact', {
          p_user_id: user.id,
          p_contact_id: senderId
        });
        
        const isKnown = !!data;
        
        if (!isKnown) {
          return {
            blocked: true,
            reason: 'Remetente desconhecido bloqueado pelas suas configurações de segurança.'
          };
        }
      }
      
      // Check for shortened URLs if applicable
      if (settings.disable_preview_links) {
        const shortUrlServices = ['bit.ly', 'tinyurl', 'goo.gl', 't.co', 'tiny.cc', 'is.gd', 'cli.gs', 'ff.im', 'su.pr', 'ow.ly'];
        const containsShortUrl = shortUrlServices.some(service => content.includes(service));
        
        if (containsShortUrl) {
          return {
            blocked: false,
            reason: 'Mensagem contém links encurtados. Estes links são potencialmente perigosos.'
          };
        }
      }
      
      return defaultResponse;
      
    } catch (err) {
      console.error('Error in message blocking:', err);
      // On error, default to not blocking
      return defaultResponse;
    }
  };

  return {
    settings,
    loading,
    processMessageContent,
    shouldBlockMessage,
    updateSettings,
    toggleIpProtection,
    getWebRTCConfiguration
  };
};
