
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

// Tipos de análise suportados pela IA
export type AnalysisType = 'summarize' | 'sentiment' | 'suggest' | 'keypoints';

// Interface para estrutura de cache
interface CacheEntry {
  result: string;
  timestamp: number;
  expiresAt: number;
}

// Duração do cache em milissegundos (30 minutos)
const CACHE_DURATION = 30 * 60 * 1000;

/**
 * Hook para análise de conteúdo usando IA via GPT-4o-mini
 * Permite analisar mensagens, resumir conversas, extrair pontos-chave e sugerir respostas
 * Inclui sistema de cache para otimizar requisições e melhorar desempenho
 */
export const useAIAnalysis = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Cache local para otimização
  const getCache = useCallback(() => {
    try {
      const cacheStr = localStorage.getItem('ai_analysis_cache');
      return cacheStr ? JSON.parse(cacheStr) : {};
    } catch (error) {
      console.error('Erro ao ler cache:', error);
      return {};
    }
  }, []);
  
  const setCache = useCallback((key: string, result: string) => {
    try {
      const cache = getCache();
      const now = Date.now();
      
      cache[key] = {
        result,
        timestamp: now,
        expiresAt: now + CACHE_DURATION
      };
      
      // Limpar cache expirado
      Object.keys(cache).forEach(cacheKey => {
        if (cache[cacheKey].expiresAt < now) {
          delete cache[cacheKey];
        }
      });
      
      localStorage.setItem('ai_analysis_cache', JSON.stringify(cache));
    } catch (error) {
      console.error('Erro ao salvar cache:', error);
    }
  }, [getCache]);
  
  const getCachedResult = useCallback((key: string): string | null => {
    try {
      const cache = getCache();
      const entry = cache[key];
      
      if (entry && entry.expiresAt > Date.now()) {
        console.log('Usando resultado em cache para:', key);
        return entry.result;
      }
      
      return null;
    } catch (error) {
      console.error('Erro ao verificar cache:', error);
      return null;
    }
  }, [getCache]);

  /**
   * Analisa o conteúdo utilizando IA
   * Com cache local para otimizar requisições repetidas
   * 
   * @param messageContent Conteúdo a ser analisado
   * @param analysisType Tipo de análise a ser realizada
   * @param conversationHistory Opcional: histórico da conversa para contexto
   * @returns Resultado da análise
   */
  const analyzeContent = async (
    messageContent: string,
    analysisType: AnalysisType,
    conversationHistory?: string
  ) => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Não autorizado",
        description: "Você precisa estar logado para usar esta funcionalidade",
      });
      return null;
    }

    try {
      // Criar chave única para o cache
      const cacheKey = `${analysisType}:${messageContent.substring(0, 100)}:${conversationHistory?.substring(0, 100) || ''}`;
      
      // Verificar se já temos um resultado em cache
      const cachedResult = getCachedResult(cacheKey);
      if (cachedResult) {
        setResult(cachedResult);
        return cachedResult;
      }
      
      setLoading(true);
      
      // Chamar a edge function gpt-analyst
      const { data, error } = await supabase.functions.invoke('gpt-analyst', {
        body: {
          messageContent,
          analysisType,
          conversationHistory
        }
      });

      if (error) {
        throw error;
      }

      console.log('Resultado da análise:', data);
      
      // Salvar resultado no cache
      if (data.result) {
        setCache(cacheKey, data.result);
      }
      
      setResult(data.result);
      
      return data.result;
    } catch (error: any) {
      console.error('Erro na análise de conteúdo:', error);
      
      toast({
        variant: "destructive",
        title: "Erro na análise de conteúdo",
        description: error.message || "Não foi possível processar a análise",
      });
      
      return null;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Resumir o conteúdo de uma conversa ou reunião
   * @param content Conteúdo a ser resumido
   */
  const summarize = async (content: string) => {
    return analyzeContent(content, 'summarize');
  };

  /**
   * Analisa o sentimento de uma mensagem
   * @param content Conteúdo a ser analisado
   */
  const analyzeSentiment = async (content: string) => {
    return analyzeContent(content, 'sentiment');
  };

  /**
   * Sugere uma resposta com base no histórico e última mensagem
   * @param lastMessage Última mensagem recebida
   * @param conversationHistory Histórico da conversa
   */
  const suggestResponse = async (lastMessage: string, conversationHistory?: string) => {
    return analyzeContent(lastMessage, 'suggest', conversationHistory);
  };

  /**
   * Extrai pontos-chave de uma conversa ou documento
   * @param content Conteúdo a ser analisado
   */
  const extractKeyPoints = async (content: string) => {
    return analyzeContent(content, 'keypoints');
  };

  /**
   * Limpa os resultados da análise e o cache específico
   * @param analysisType Tipo de análise para limpar cache (opcional)
   */
  const clearResult = (analysisType?: AnalysisType) => {
    setResult(null);
    
    if (analysisType) {
      try {
        const cache = getCache();
        const now = Date.now();
        let modified = false;
        
        // Remover apenas cache do tipo especificado
        Object.keys(cache).forEach(key => {
          if (key.startsWith(`${analysisType}:`)) {
            delete cache[key];
            modified = true;
          }
        });
        
        if (modified) {
          localStorage.setItem('ai_analysis_cache', JSON.stringify(cache));
        }
      } catch (error) {
        console.error('Erro ao limpar cache:', error);
      }
    }
  };

  return {
    loading,
    result,
    analyzeContent,
    summarize,
    analyzeSentiment,
    suggestResponse,
    extractKeyPoints,
    clearResult
  };
};
