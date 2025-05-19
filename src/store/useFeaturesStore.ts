import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

// Tipo para a feature_key_enum do banco de dados
export type FeatureKey = 
  | 'prospecting_ai'
  | 'bots'
  | 'crm_sync'
  | 'analytics_plus'
  | 'priority_support';

interface FeaturesState {
  // Estado
  features: Set<string>;
  isLoaded: boolean;
  isLoading: boolean;
  error: Error | null;
  lastUpdated: Date | null;

  // Ações
  setFeatures: (features: string[]) => void;
  addFeature: (feature: string) => void;
  removeFeature: (feature: string) => void;
  clearFeatures: () => void;
  
  // Operações de carregamento
  loadFeatures: (userId: string) => Promise<boolean>;
  refreshFeatures: (userId: string) => Promise<boolean>;
  
  // Utilitários
  hasFeature: (featureKey: string) => boolean;
}

// Criar o store usando Zustand
export const useFeaturesStore = create<FeaturesState>()(
  devtools(
    persist(
      (set, get) => ({
        // Estado inicial
        features: new Set<string>(),
        isLoaded: false,
        isLoading: false,
        error: null,
        lastUpdated: null,

        // Métodos para manipular o conjunto de features
        setFeatures: (features: string[]) => {
          set({
            features: new Set(features),
            isLoaded: true,
            lastUpdated: new Date(),
            error: null
          });
        },

        addFeature: (feature: string) => {
          const newFeatures = new Set(get().features);
          newFeatures.add(feature);
          set({ features: newFeatures, lastUpdated: new Date() });
        },

        removeFeature: (feature: string) => {
          const newFeatures = new Set(get().features);
          newFeatures.delete(feature);
          set({ features: newFeatures, lastUpdated: new Date() });
        },

        clearFeatures: () => {
          set({ features: new Set(), isLoaded: false, lastUpdated: new Date() });
        },

        // Carregar features do usuário do Supabase
        loadFeatures: async (userId: string): Promise<boolean> => {
          // Evitar carregamento desnecessário se já temos os dados e são recentes
          const state = get();
          if (
            state.isLoaded && 
            state.lastUpdated && 
            (new Date().getTime() - state.lastUpdated.getTime() < 5 * 60 * 1000) // 5 minutos
          ) {
            return true;
          }

          try {
            set({ isLoading: true, error: null });

            // Consultar as features do usuário no Supabase
            const { data, error } = await supabase
              .from('user_features')
              .select('feature_key')
              .eq('user_id', userId);

            if (error) {
              console.error('Erro ao carregar features:', error);
              set({ error, isLoading: false });
              return false;
            }

            // Extrair as chaves das features e armazenar no estado
            const featureKeys = data.map(item => item.feature_key);
            set({
              features: new Set(featureKeys),
              isLoaded: true,
              isLoading: false,
              lastUpdated: new Date()
            });

            // Debug
            console.log(`[Features] Carregadas ${featureKeys.length} features para o usuário`, featureKeys);
            return true;
          } catch (error) {
            console.error('Exceção ao carregar features:', error);
            set({
              error: error instanceof Error ? error : new Error(String(error)),
              isLoading: false
            });
            return false;
          }
        },

        // Força recarregar as features do usuário
        refreshFeatures: async (userId: string): Promise<boolean> => {
          // Limpa o estado isLoaded para forçar a recarga
          set({ isLoaded: false });
          return get().loadFeatures(userId);
        },

        // Verifica se o usuário tem uma feature específica
        hasFeature: (featureKey: string): boolean => {
          return get().features.has(featureKey);
        }
      }),
      {
        name: 'features-storage',
        // Personalizar o que é persistido para evitar estado inválido
        partialize: (state) => ({ 
          features: Array.from(state.features),
          isLoaded: state.isLoaded,
          lastUpdated: state.lastUpdated ? state.lastUpdated.toISOString() : null
        }),
        // Converter de volta os tipos serializados
        onRehydrateStorage: () => (state) => {
          if (state) {
            // Converter Array para Set
            state.features = new Set(state.features);
            // Converter string ISO para Date
            if (state.lastUpdated) {
              state.lastUpdated = new Date(state.lastUpdated);
            }
          }
        }
      }
    )
  )
);

/**
 * Hook que inicializa a escuta de eventos de features quando o usuário fizer login.
 * Deve ser usado no componente raiz da aplicação.
 */
export const useFeatureSync = () => {
  const { user } = useAuth();
  const loadFeatures = useFeaturesStore(state => state.loadFeatures);
  const clearFeatures = useFeaturesStore(state => state.clearFeatures);
  
  // Carregar features quando o usuário mudar
  useEffect(() => {
    let subscription: any;
    
    if (user) {
      // Carregar features iniciais
      loadFeatures(user.id);
      
      // Configurar canal para receber atualizações em tempo real
      subscription = supabase
        .channel('feature_updates')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'user_features',
          filter: `user_id=eq.${user.id}`
        }, (payload) => {
          // Recarregar features quando houver mudanças
          loadFeatures(user.id)
            .then(success => {
              if (success) {
                toast({
                  title: "Recursos atualizados",
                  description: "Suas permissões foram atualizadas.",
                  variant: "default"
                });
              }
            });
        })
        .subscribe();
    } else {
      // Limpar features quando o usuário não estiver logado
      clearFeatures();
    }
    
    // Cleanup: desinscrever do canal ao desmontar
    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [user, loadFeatures, clearFeatures]);
  
  return null; // Este hook não retorna nada, apenas tem efeitos colaterais
};

/**
 * Hook para verificar se o usuário tem acesso a uma feature específica
 * @param featureKey Chave da feature a ser verificada
 * @returns Boolean indicando se o usuário tem acesso + estado de carregamento
 */
export const useFeature = (featureKey: string): { 
  hasAccess: boolean; 
  isLoading: boolean;
} => {
  const { user } = useAuth();
  const { hasFeature, isLoaded, isLoading, loadFeatures } = useFeaturesStore(state => ({
    hasFeature: state.hasFeature,
    isLoaded: state.isLoaded,
    isLoading: state.isLoading,
    loadFeatures: state.loadFeatures,
  }));
  
  // Carregar features se ainda não foram carregadas
  useEffect(() => {
    if (user && !isLoaded && !isLoading) {
      loadFeatures(user.id).catch(error => {
        console.error('Erro ao carregar features:', error);
      });
    }
  }, [user, isLoaded, isLoading, loadFeatures]);
  
  // Verificar se o usuário tem a feature 
  return {
    hasAccess: user ? hasFeature(featureKey) : false,
    isLoading: isLoading || (!!user && !isLoaded)
  };
};

