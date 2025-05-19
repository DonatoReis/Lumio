/**
 * Configuração e serviço para TURN Server
 * 
 * Este serviço gerencia a configuração WebRTC para proteção de IP
 * usando servidores TURN conforme as configurações de privacidade do usuário.
 */

import crypto from 'crypto';

// Função para gerar credenciais HMAC para TURN
const generateTurnCredentials = (username, sharedSecret) => {
  // Calcular um HMAC para autenticação temporária
  const hmac = crypto.createHmac('sha1', sharedSecret);
  hmac.update(username);
  return hmac.digest('base64');
};

// Gerar credenciais de acordo com RFC 8489 (credenciais temporárias)
const getTurnCredentials = (userId, expirationTimeSeconds = 86400) => {
  if (!process.env.TURN_SECRET) {
    console.warn('TURN_SECRET não definido. Usando chave padrão (inseguro em produção)');
  }

  const sharedSecret = process.env.TURN_SECRET || 'default_turn_secret';
  
  // Username = timestamp de expiração + ":" + userId
  const expirationTime = Math.floor(Date.now() / 1000) + expirationTimeSeconds;
  const username = `${expirationTime}:${userId}`;
  
  // Gerar credencial baseada em HMAC
  const credential = generateTurnCredentials(username, sharedSecret);
  
  return {
    username,
    credential,
    expirationTime
  };
};

// Obter configuração ICE para WebRTC com base nas preferências do usuário
const getIceConfiguration = async (supabase, userId) => {
  try {
    // Buscar configurações de segurança do usuário
    const { data, error } = await supabase
      .from('user_security_settings')
      .select('hide_ip_address')
      .eq('user_id', userId)
      .single();
    
    if (error) throw error;
    
    // Configuração base de servidores ICE
    const iceServers = [];
    
    // Configuração que varia baseada nas preferências de privacidade
    const hideIpAddress = data?.hide_ip_address || false;
    
    if (hideIpAddress) {
      // Modo de alta privacidade - Apenas TURN, sem STUN
      const { username, credential } = getTurnCredentials(userId);
      
      // Adicionar apenas servidor TURN
      iceServers.push({
        urls: process.env.TURN_SERVER_URL || 'turn:turn.myserver.com:3478',
        username,
        credential
      });
      
      // Configuração que força o uso exclusivo de servidores TURN
      return {
        iceServers,
        iceTransportPolicy: 'relay' // Força modo relay, usa apenas TURN
      };
    } else {
      // Modo padrão - Inclui STUN para melhor performance quando privacidade não é crucial
      iceServers.push({
        urls: [
          'stun:stun1.l.google.com:19302',
          'stun:stun2.l.google.com:19302'
        ]
      });
      
      // Também adiciona TURN como fallback
      const { username, credential } = getTurnCredentials(userId);
      iceServers.push({
        urls: process.env.TURN_SERVER_URL || 'turn:turn.myserver.com:3478',
        username,
        credential
      });
      
      return {
        iceServers,
        iceTransportPolicy: 'all' // Permite qualquer tipo de conexão (padrão)
      };
    }
  } catch (error) {
    console.error('Erro ao gerar configuração ICE:', error);
    // Fallback para configuração padrão em caso de erro
    return {
      iceServers: [
        {
          urls: ['stun:stun1.l.google.com:19302']
        }
      ]
    };
  }
};

export { getTurnCredentials, getIceConfiguration }; // ESM export

