import express from 'express';
const router = express.Router();
import fetch from 'node-fetch';
import { load } from 'cheerio';
import { authenticateJWT } from './auth.js';

// Detectar se um user-agent é um bot/crawler
const isBotUserAgent = (userAgent) => {
  if (!userAgent) return false;
  const botRegex = /bot|googlebot|crawler|spider|robot|crawling|facebook|whatsapp|telegram|discord|slack/i;
  return botRegex.test(userAgent);
};

// Middleware para preview de links
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const { url } = req.query;
    const userAgent = req.headers['user-agent'];
    
    // Log de requisição
    console.log('Preview Request:', { 
      url, 
      userId: req.user?.id,
      userAgent: userAgent?.substring(0, 20) // Apenas primeiros 20 caracteres para deixar o log limpo
    });
    
    if (!url) {
      console.log('URL não fornecida');
      return res.status(400).json({
        status: 'error',
        message: 'URL não fornecida'
      });
    }
    
    // Verificar se é um crawler/bot baseado no User-Agent
    if (isBotUserAgent(userAgent)) {
      console.log('Bot/Crawler detectado via User-Agent');
      // Se for um bot, não retorna preview
      return res.status(200).json(null);
    }
    
    // Buscar configurações do usuário
    const userId = req.user.id;
    console.log('Buscando configurações para userId:', userId);
    
    try {
      const { data, error } = await req.supabase
        .from('user_security_settings')
        .select('disable_preview_links')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error) {
        console.error('Erro ao buscar configurações:', error);
        throw error;
      }
      
      console.log('Configurações encontradas:', data);
      
      // Se o usuário desativou previews de links, retorna null
      if (data && data.length > 0 && data[0].disable_preview_links) {
        console.log('Prévia de links desativada pelo usuário');
        return res.status(200).json(null);
      }
    } catch (settingsError) {
      console.error('Erro de configurações, continuando com previews habilitados:', settingsError);
      // Em caso de erro nas configurações, assumimos que previews estão habilitados
    }
    
    console.log('Buscando prévia para URL:', url);
    
    // Tentar extrair o domínio para fallback
    let domain = '';
    try {
      const urlObj = new URL(url);
      domain = urlObj.hostname;
    } catch (urlError) {
      console.error('Erro ao parsear URL:', urlError);
    }
    
    try {
      // Fazer fetch da URL para extrair metadados
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        },
        timeout: 10000 // 10 segundos de timeout
      });
      
      console.log('Resposta do servidor:', response.status, response.statusText);
      
      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status} ${response.statusText}`);
      }
      
      const contentType = response.headers.get('content-type') || '';
      console.log('Content-Type:', contentType);
      
      // Se não for HTML, retorna informações básicas
      if (!contentType.includes('text/html')) {
        const fileType = contentType.split('/')[0];
        return res.status(200).json({
          url,
          title: `${domain} - ${fileType.charAt(0).toUpperCase() + fileType.slice(1)}`,
          description: `Este link contém um arquivo do tipo ${contentType}`,
          image: null,
          type: fileType
        });
      }
      
      const html = await response.text();
      const $ = load(html);
      
      console.log('HTML carregado, extraindo metadados');
      
      // Extrair metadados Open Graph
      let title = $('meta[property="og:title"]').attr('content') || 
                 $('title').text() || 
                 domain || 'Link';
                 
      let description = $('meta[property="og:description"]').attr('content') || 
                        $('meta[name="description"]').attr('content') || 
                        '';
                        
      let image = $('meta[property="og:image"]').attr('content');
      
      // Se não houver og:image, tenta encontrar outras imagens
      if (!image) {
        // Tenta primeiro favicon
        const favicon = $('link[rel="icon"]').attr('href') || 
                       $('link[rel="shortcut icon"]').attr('href');
                       
        if (favicon) {
          // Converter para URL absoluta se for relativa
          try {
            image = new URL(favicon, url).toString();
          } catch (e) {
            console.error('Erro ao converter favicon para URL absoluta:', e);
          }
        }
        
        // Se ainda não tem imagem, procura por uma imagem no conteúdo
        if (!image) {
          const firstImg = $('img[src]').first().attr('src');
          if (firstImg) {
            try {
              image = new URL(firstImg, url).toString();
            } catch (e) {
              console.error('Erro ao converter imagem para URL absoluta:', e);
            }
          }
        }
      }
      
      // Gerar um título a partir do domínio se nenhum for encontrado
      if (!title || title.trim() === '') {
        title = domain || 'Link';
      }
      
      // Limitar tamanho
      title = title.slice(0, 100);
      description = description.slice(0, 200);
      
      const previewData = {
        url,
        title,
        description,
        image,
        timestamp: new Date().toISOString()
      };
      
      console.log('Enviando prévia:', { 
        url: previewData.url,
        title: previewData.title,
        hasImage: !!previewData.image
      });
      
      res.status(200).json(previewData);
    } catch (fetchError) {
      console.error('Erro ao gerar preview de link:', fetchError.message);
      
      // Retornar informações básicas com o domínio
      return res.status(200).json({
        url,
        title: domain || 'Link',
        description: 'Conteúdo da página indisponível no momento.',
        image: null,
        error: true
      });
    }
  } catch (error) {
    console.error('Erro geral na geração de preview:', error.message);
    console.error('Stack trace:', error.stack);
    
    // Extrair domínio da URL para fallback
    let domain = 'Link';
    try {
      domain = new URL(req.query.url).hostname;
    } catch (e) {
      // Ignora erro de URL inválida
    }
    
    // Retornar um objeto básico em caso de erro
    res.status(200).json({
      url: req.query.url,
      title: domain,
      description: 'Não foi possível carregar a prévia deste link',
      image: null,
      error: true
    });
  }
});

export default router;
