import express from 'express';
const router = express.Router();
import { authenticateJWT } from './auth.js';

// Lista de domínios de encurtadores de URLs
const shortUrlDomains = [
  'bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'tiny.cc', 
  'is.gd', 'cli.gs', 'ff.im', 'su.pr', 'ow.ly', 'trim.me',
  'x.co', 'tr.im', 'snip.ly', 'shorturl.at', 'cutt.ly',
  'www.shorturl.at', 'buly.io', 'rb.gy', 'tny.im'
];

// Verificar presença de URLs encurtadas
const checkForShortUrls = (content) => {
  try {
    // Expressão regular para extrair URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = content.match(urlRegex) || [];
    
    // Verificar cada URL
    for (const url of urls) {
      try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        
        // Verificar se o hostname está na lista de domínios encurtadores
        if (shortUrlDomains.some(domain => hostname.includes(domain))) {
          return true;
        }
      } catch (error) {
        // Ignorar URLs inválidas
        console.error('URL inválida:', url, error.message);
      }
    }
    
    return false;
  } catch (error) {
    console.error('Erro ao verificar URLs encurtadas:', error);
    return false; // Em caso de erro, permitir a mensagem
  }
};

// Incrementar contador de mensagens de remetentes desconhecidos
const incrementMessageCounter = async (supabase, senderId, receiverId) => {
  try {
    const today = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD
    
    // Verificar se já existe um contador para hoje
    const { data, error } = await supabase
      .from('message_counters')
      .select('*')
      .eq('sender_id', senderId)
      .eq('receiver_id', receiverId)
      .eq('date', today)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 é "não encontrado", que é esperado
      throw error;
    }
    
    if (data) {
      // Incrementar contador existente
      const { error: updateError } = await supabase
        .from('message_counters')
        .update({ count: data.count + 1 })
        .eq('id', data.id);
      
      if (updateError) throw updateError;
      
      return data.count + 1;
    } else {
      // Criar novo contador
      const { data: newData, error: insertError } = await supabase
        .from('message_counters')
        .insert({
          sender_id: senderId,
          receiver_id: receiverId,
          date: today,
          count: 1
        })
        .select();
      
      if (insertError) throw insertError;
      
      return 1;
    }
  } catch (error) {
    console.error('Erro ao incrementar contador de mensagens:', error);
    return 0;
  }
};

// Verificar se remetente é conhecido
const isKnownSender = async (supabase, userId, senderId) => {
  try {
    // Verificar se o remetente está nos contatos do usuário
    const { data, error } = await supabase.rpc('is_known_contact', {
      p_user_id: userId,
      p_contact_id: senderId
    });
    
    if (error) throw error;
    
    return !!data;
  } catch (error) {
    console.error('Erro ao verificar se remetente é conhecido:', error);
    return false; // Em caso de erro, considerar como conhecido
  }
};

// Middleware para verificar mensagens antes de enviar
router.post('/check', authenticateJWT, async (req, res) => {
  try {
    const { senderId, receiverId, content } = req.body;
    
    if (!senderId || !receiverId || !content) {
      return res.status(400).json({
        status: 'error',
        message: 'Parâmetros incompletos'
      });
    }
    
    // Validar que o sender é o usuário autenticado ou permitir receber mensagens
    if (senderId !== req.user.id && receiverId !== req.user.id) {
      return res.status(403).json({
        status: 'error',
        message: 'Não autorizado a enviar mensagens como outro usuário'
      });
    }
    
    // Verificar links encurtados no conteúdo
    const containsShortUrl = checkForShortUrls(content);
    if (containsShortUrl) {
      return res.status(400).json({
        status: 'error',
        message: 'Use o link completo, sem encurtadores.',
        code: 'SHORT_URL_DETECTED'
      });
    }
    
    // Buscar configurações do usuário receptor
    const { data: settings, error: settingsError } = await req.supabase
      .from('user_security_settings')
      .select('block_unknown_senders, block_threshold')
      .eq('user_id', receiverId)
      .single();
    
    if (settingsError) throw settingsError;
    
    // Se o bloqueio de remetentes desconhecidos estiver ativado
    if (settings?.block_unknown_senders) {
      // Verificar se o remetente é conhecido pelo receptor
      const isKnown = await isKnownSender(req.supabase, receiverId, senderId);
      
      if (!isKnown) {
        // Incrementar contador de mensagens
        const count = await incrementMessageCounter(req.supabase, senderId, receiverId);
        
        // Se excedeu o limite, bloquear
        if (count > settings.block_threshold) {
          return res.status(403).json({
            status: 'error',
            message: 'Remetente bloqueado por excesso de mensagens',
            code: 'SENDER_BLOCKED'
          });
        }
        
        // Avisar que está se aproximando do limite
        if (count >= settings.block_threshold - 2) {
          return res.status(200).json({
            status: 'warning',
            message: `Você enviou ${count}/${settings.block_threshold} mensagens. 
                      Após o limite, suas mensagens serão bloqueadas.`,
            shouldProceed: true
          });
        }
      }
    }
    
    // Mensagem pode ser enviada
    res.status(200).json({
      status: 'success',
      message: 'Mensagem verificada com sucesso',
      shouldProceed: true
    });
  } catch (error) {
    console.error('Erro ao verificar mensagem:', error);
    res.status(500).json({
      status: 'error',
      message: 'Erro ao processar verificação de mensagem',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;

