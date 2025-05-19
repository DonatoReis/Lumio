import express from 'express';
import { createClient } from '@supabase/supabase-js';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bodyParser from 'body-parser';
import { config } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Carregar variáveis de ambiente do próprio diretório server
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '.env') });

// Middlewares de segurança
import linkPreviewMiddleware from './middleware/linkPreview.js';
import messageSecurityMiddleware from './middleware/messageSecurity.js';
import * as securityService from './services/turnServer.js';

// Inicializar Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Configuração do servidor
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware de segurança básicos
app.use(helmet());
app.use(cors());
app.use(bodyParser.json());

// Limitador de requisições para evitar ataques de DDoS
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Limite de 100 requisições por IP no período
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Muitas requisições deste IP, tente novamente após 15 minutos'
});

// Aplicar limitador em todas as rotas
app.use(apiLimiter);

// Passa a instância do Supabase para os requests
app.use((req, res, next) => {
  req.supabase = supabase;
  next();
});

// Middleware de autenticação JWT
import { authenticateJWT } from './middleware/auth.js';

// Rotas da API
app.use('/api/preview', linkPreviewMiddleware);
app.use('/api/messages', messageSecurityMiddleware);

// Rota para obter configurações WebRTC/TURN
app.get('/api/webrtc/config', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    const iceConfig = await securityService.getIceConfiguration(supabase, userId);
    
    res.status(200).json(iceConfig);
  } catch (error) {
    console.error('Erro ao obter configuração WebRTC:', error);
    
    // Fallback para configuração básica
    res.status(200).json({
      iceServers: [
        { urls: ['stun:stun1.l.google.com:19302'] }
      ]
    });
  }
});

// Rota para obter configurações de segurança do usuário
app.get('/api/security/settings', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const { data, error } = await supabase
      .from('user_security_settings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error) throw error;
    
    if (data && data.length > 0) {
      res.status(200).json(data[0]);
    } else {
      // Criar configurações padrão se não existirem
      const defaultSettings = {
        user_id: userId,
        disable_preview_links: false,
        block_unknown_senders: false,
        block_threshold: 10,
        hide_ip_address: false
      };
      
      // Usar upsert sem especificar onConflict para usar a chave primária
      const { error: insertError } = await supabase
        .from('user_security_settings')
        .upsert(defaultSettings);
      
      if (insertError) throw insertError;
      
      res.status(200).json(defaultSettings);
    }
  } catch (error) {
    console.error('Erro ao buscar configurações de segurança:', error);
    res.status(500).json({
      status: 'error',
      message: 'Erro ao buscar configurações de segurança',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Rota para atualizar configurações de segurança
app.put('/api/security/settings', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    const newSettings = req.body;
    
    // Validar campos
    const allowedFields = ['disable_preview_links', 'block_unknown_senders', 'block_threshold', 'hide_ip_address'];
    const validSettings = {};
    
    allowedFields.forEach(field => {
      if (newSettings[field] !== undefined) {
        validSettings[field] = newSettings[field];
      }
    });
    
    // Verificar se há campos para atualizar
    if (Object.keys(validSettings).length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Nenhum campo válido para atualização'
      });
    }
    
    // Certifique-se de incluir o user_id nas configurações para permitir upsert caso necessário
    validSettings.user_id = userId;
    
    // Atualizar configurações usando upsert para garantir que o registro existe
    const { error } = await supabase
      .from('user_security_settings')
      .upsert(validSettings);
    
    if (error) throw error;
    
    res.status(200).json({
      status: 'success',
      message: 'Configurações de segurança atualizadas com sucesso'
    });
  } catch (error) {
    console.error('Erro ao atualizar configurações de segurança:', error);
    res.status(500).json({
      status: 'error',
      message: 'Erro ao atualizar configurações de segurança',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Rota de saúde para verificar se o servidor está rodando
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Tratamento de erros
app.use((err, req, res, next) => {
  console.error('Erro global:', err);
  res.status(500).json({
    status: 'error',
    message: 'Erro interno do servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor de segurança rodando na porta ${PORT}`);
});

export default app;  // ESM export

