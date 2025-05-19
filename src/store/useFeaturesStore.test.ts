import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useFeature, useFeaturesStore } from './useFeaturesStore';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Mock de dependências
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis()
  }
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn()
}));

describe('useFeaturesStore', () => {
  // Estado inicial para resetar o store entre testes
  const initialState = {
    features: new Set<string>(),
    isLoaded: false,
    isLoading: false,
    error: null,
    lastUpdated: null
  };
  
  beforeEach(() => {
    // Resetar o estado do store antes de cada teste
    act(() => {
      useFeaturesStore.setState(initialState);
    });
    
    // Configuração padrão do mock de useAuth (usuário não autenticado)
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      session: null,
      loading: false,
      profile: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      updateProfile: vi.fn(),
      sendPasswordReset: vi.fn(),
      securityScore: 0,
      refreshProfile: vi.fn(),
      getUserDevices: vi.fn(),
      revokeDeviceAccess: vi.fn()
    });
    
    // Limpar mocks do Supabase
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe('useFeature hook', () => {
    it('deve retornar hasAccess=false quando o usuário não está autenticado', () => {
      // Configurar mock para usuário não autenticado
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        session: null,
        loading: false,
        profile: null,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
        updateProfile: vi.fn(),
        sendPasswordReset: vi.fn(),
        securityScore: 0,
        refreshProfile: vi.fn(),
        getUserDevices: vi.fn(),
        revokeDeviceAccess: vi.fn()
      });
      
      // Renderizar o hook
      const { result } = renderHook(() => useFeature('some_feature'));
      
      // Verificar resultado
      expect(result.current.hasAccess).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });
    
    it('deve carregar features do usuário quando autenticado', async () => {
      // Configurar mock para usuário autenticado
      vi.mocked(useAuth).mockReturnValue({
        user: { id: 'test-user-id', email: 'test@example.com' } as any,
        session: {} as any,
        loading: false,
        profile: null,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
        updateProfile: vi.fn(),
        sendPasswordReset: vi.fn(),
        securityScore: 0,
        refreshProfile: vi.fn(),
        getUserDevices: vi.fn(),
        revokeDeviceAccess: vi.fn()
      });
      
      // Configurar mock do Supabase para retornar features
      const mockFeatures = [
        { feature_key: 'feature1' },
        { feature_key: 'feature2' }
      ];
      
      const mockSupabaseResponse = {
        data: mockFeatures,
        error: null
      };
      
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue(mockSupabaseResponse)
        })
      } as any);
      
      // Renderizar o hook
      const { result } = renderHook(() => useFeature('feature1'));
      
      // Inicialmente isLoading deve ser true
      expect(result.current.isLoading).toBe(true);
      
      // Aguardar carregamento
      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('user_features');
      });
      
      // Atualizar o store manualmente para simular o carregamento
      act(() => {
        useFeaturesStore.setState({
          features: new Set(['feature1', 'feature2']),
          isLoaded: true,
          isLoading: false,
          error: null,
          lastUpdated: new Date()
        });
      });
      
      // Verificar se o hook agora tem acesso à feature
      expect(result.current.hasAccess).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });
    
    it('deve retornar hasAccess=true para feature existente', () => {
      // Configurar mock para usuário autenticado
      vi.mocked(useAuth).mockReturnValue({
        user: { id: 'test-user-id', email: 'test@example.com' } as any,
        session: {} as any,
        loading: false,
        profile: null,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
        updateProfile: vi.fn(),
        sendPasswordReset: vi.fn(),
        securityScore: 0,
        refreshProfile: vi.fn(),
        getUserDevices: vi.fn(),
        revokeDeviceAccess: vi.fn()
      });
      
      // Configurar o store com features pré-carregadas
      act(() => {
        useFeaturesStore.setState({
          features: new Set(['feature1', 'feature2', 'feature3']),
          isLoaded: true,
          isLoading: false,
          error: null,
          lastUpdated: new Date()
        });
      });
      
      // Renderizar o hook para uma feature existente
      const { result } = renderHook(() => useFeature('feature2'));
      
      // Verificar resultado
      expect(result.current.hasAccess).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });
    
    it('deve retornar hasAccess=false para feature não existente', () => {
      // Configurar mock para usuário autenticado
      vi.mocked(useAuth).mockReturnValue({
        user: { id: 'test-user-id', email: 'test@example.com' } as any,
        session: {} as any,
        loading: false,
        profile: null,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
        updateProfile: vi.fn(),
        sendPasswordReset: vi.fn(),
        securityScore: 0,
        refreshProfile: vi.fn(),
        getUserDevices: vi.fn(),
        revokeDeviceAccess: vi.fn()
      });
      
      // Configurar o store com features pré-carregadas
      act(() => {
        useFeaturesStore.setState({
          features: new Set(['feature1', 'feature2', 'feature3']),
          isLoaded: true,
          isLoading: false,
          error: null,
          lastUpdated: new Date()
        });
      });
      
      // Renderizar o hook para uma feature inexistente
      const { result } = renderHook(() => useFeature('feature4'));
      
      // Verificar resultado
      expect(result.current.hasAccess).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });
    
    it('deve mostrar isLoading=true durante carregamento', () => {
      // Configurar mock para usuário autenticado
      vi.mocked(useAuth).mockReturnValue({
        user: { id: 'test-user-id', email: 'test@example.com' } as any,
        session: {} as any,
        loading: false,
        profile: null,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
        updateProfile: vi.fn(),
        sendPasswordReset: vi.fn(),
        securityScore: 0,
        refreshProfile: vi.fn(),
        getUserDevices: vi.fn(),
        revokeDeviceAccess: vi.fn()
      });
      
      // Configurar o store para simular carregamento em andamento
      act(() => {
        useFeaturesStore.setState({
          features: new Set<string>(),
          isLoaded: false,
          isLoading: true,
          error: null,
          lastUpdated: null
        });
      });
      
      // Renderizar o hook
      const { result } = renderHook(() => useFeature('any_feature'));
      
      // Verificar estado de carregamento
      expect(result.current.isLoading).toBe(true);
      expect(result.current.hasAccess).toBe(false);
      
      // Simular final do carregamento
      act(() => {
        useFeaturesStore.setState({
          features: new Set(['any_feature']),
          isLoaded: true,
          isLoading: false,
          error: null,
          lastUpdated: new Date()
        });
      });
      
      // Verificar resultado após carregamento
      expect(result.current.isLoading).toBe(false);
      expect(result.current.hasAccess).toBe(true);
    });
  });
});

