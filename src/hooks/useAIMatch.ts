
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface CompanyProfile {
  name: string;
  industry?: string;
  size?: string;
  about?: string;
}

interface MatchPreferences {
  industries?: string[];
  size?: string;
  relationshipType?: string;
}

interface MatchResults {
  suggestions: string;
  timestamp: string;
}

export const useAIMatch = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<MatchResults | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  /**
   * Gera match por IA para uma empresa
   * @param companyProfile Perfil da empresa
   * @param preferences Preferências para match
   * @returns Resultados do match por IA
   */
  const generateMatch = async (companyProfile: CompanyProfile, preferences?: MatchPreferences) => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Não autorizado",
        description: "Você precisa estar logado para usar esta funcionalidade",
      });
      return null;
    }

    try {
      setLoading(true);
      
      // Chamar a edge function ai-match
      const { data, error } = await supabase.functions.invoke('ai-match', {
        body: {
          companyProfile,
          preferences
        }
      });

      if (error) {
        throw error;
      }

      console.log('Resultados do Match por IA:', data);
      setResults(data as MatchResults);
      
      return data as MatchResults;
    } catch (error: any) {
      console.error('Erro na geração de Match por IA:', error);
      
      toast({
        variant: "destructive",
        title: "Erro na geração de Match por IA",
        description: error.message || "Não foi possível processar o match com IA",
      });
      
      return null;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Limpa os resultados do match
   */
  const clearResults = () => {
    setResults(null);
  };

  return {
    loading,
    results,
    generateMatch,
    clearResults
  };
};
