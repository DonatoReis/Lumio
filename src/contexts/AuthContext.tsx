import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, safeQuery } from '@/integrations/supabase/client';
import { Profile } from '@/types/supabase';
import { useToast } from '@/hooks/use-toast';
import { 
  registerDeviceFingerprint, 
  verifyDeviceFingerprint, 
  handleFailedLogin, 
  resetFailedLogin,
  detectSuspiciousActivity,
  // Importar novas funções de gerenciamento de dispositivos
  parseUserAgent,
  getDeviceId,
  fetchApproxLocation,
  registerOrUpdateDevice,
  revokeDevice,
  isCurrentDevice
} from '@/utils/security';

// Interface para dispositivos conectados
export interface ConnectedDevice {
  id: string;
  user_id: string;
  device_id: string;
  device_name: string;
  os: string;
  browser: string;
  location: string;
  ip_address: string;
  last_active: string;
  created_at: string;
  is_current_device?: boolean;
}

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, profileData?: Partial<Profile>) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  securityScore: number;
  refreshProfile: () => Promise<void>;
  // Novas funções para gerenciamento de dispositivos
  getUserDevices: () => Promise<{ devices: ConnectedDevice[] | null; error: any }>;
  revokeDeviceAccess: (deviceId: string) => Promise<{ success: boolean; error?: any }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [securityScore, setSecurityScore] = useState<number>(0);
  const [devices, setDevices] = useState<ConnectedDevice[] | null>(null);
  const { toast } = useToast();

  // Check if Supabase client is available
  const isSupabaseAvailable = () => {
    if (!supabase) {
      console.error('Supabase client is not initialized');
      return false;
    }
    return true;
  };

  useEffect(() => {
    const getInitialSession = async () => {
      try {
        if (!isSupabaseAvailable()) {
          setLoading(false);
          return;
        }

        const isKnownDevice = verifyDeviceFingerprint();
        if (!isKnownDevice) {
          console.log('Novo dispositivo detectado, registrando fingerprint...');
          registerDeviceFingerprint();
        }
        
        const suspicionScore = detectSuspiciousActivity();
        setSecurityScore(100 - suspicionScore);
        
        // First get the session
        const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Erro ao buscar sessão:', sessionError);
          setLoading(false);
          return;
        }
        
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        
        if (initialSession?.user) {
          await fetchProfile(initialSession.user.id);
          
          // Atualizar dispositivo atual após login
          await updateCurrentDeviceInfo(initialSession.user.id);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Erro ao obter sessão inicial:', error);
        setLoading(false);
      }
    };

    if (!isSupabaseAvailable()) {
      setLoading(false);
      return;
    }

    // Set up the auth state change listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        console.log('Auth state changed:', _event, currentSession?.user?.id);
        
        // Only set synchronous state updates here (avoid async operations in the callback)
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        // Use setTimeout to defer async operations to prevent potential deadlocks
        if (currentSession?.user) {
          setTimeout(() => {
            fetchProfile(currentSession.user.id).catch(err => {
              console.error("Error fetching profile in auth change:", err);
            });
            
            if (currentSession.user.email) {
              resetFailedLogin(currentSession.user.email);
            }
            
            // Atualizar último acesso do dispositivo
            updateCurrentDeviceInfo(currentSession.user.id).catch(err => {
              console.error("Error updating device information:", err);
            });
          }, 0);
        } else {
          setProfile(null);
          setDevices(null);
        }
      }
    );

    // Then get the initial session
    getInitialSession();

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    if (!isSupabaseAvailable() || !userId) {
      console.error('Cannot fetch profile: invalid user ID or Supabase client');
      setLoading(false);
      return;
    }
    
    try {
      console.log('Buscando perfil para o usuário:', userId);
      
      // Use safeQuery with arrow function properly
      const { data, error } = await safeQuery<Profile>(
        () => supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle(),
        'fetching user profile'
      );

      if (error) {
        console.error('Erro ao buscar perfil:', error);
        setLoading(false);
        return;
      }

      if (data) {
        console.log('Perfil encontrado:', data);
        setProfile(data as Profile);
      } else {
        console.log('Nenhum perfil encontrado para o usuário:', userId);
        // Create a default profile if none exists
        await createDefaultProfile(userId);
      }
    } catch (error) {
      console.error('Erro ao buscar perfil (exception):', error);
    } finally {
      setLoading(false);
    }
  };
  
  const createDefaultProfile = async (userId: string) => {
    if (!isSupabaseAvailable() || !userId) {
      setLoading(false);
      return;
    }
    
    try {
      console.log('Criando perfil padrão para o usuário:', userId);
      
      // Get user details to create profile
      const { data: userData } = await supabase.auth.getUser();
      const email = userData?.user?.email || '';
      const firstName = userData?.user?.user_metadata?.first_name || '';
      const lastName = userData?.user?.user_metadata?.last_name || '';
      
      // Use safeQuery with arrow function properly
      const { data, error } = await safeQuery<Profile>(
        () => supabase
          .from('profiles')
          .insert({ 
            id: userId, 
            email,
            first_name: firstName,
            last_name: lastName
          })
          .select()
          .single(),
        'creating default profile'
      );
        
      if (error) {
        console.error('Erro ao criar perfil padrão:', error);
        // Don't return yet, we'll set a basic profile object for the UI
      } else if (data) {
        console.log('Perfil padrão criado com sucesso:', data);
        setProfile(data as Profile);
        return;
      }
      
      // If we couldn't create the profile in the database but have user data,
      // create a client-side profile object so the UI can function
      console.log('Usando perfil local temporário para o usuário:', userId);
      setProfile({
        id: userId,
        email,
        first_name: firstName,
        last_name: lastName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as Profile);
    } catch (error) {
      console.error('Erro ao criar perfil padrão (exception):', error);
      // Create a minimal profile to allow the app to function
      if (userId) {
        setProfile({
          id: userId,
          email: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        } as Profile);
      }
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const updateProfile = async (profileData: Partial<Profile>) => {
    if (!isSupabaseAvailable()) {
      throw new Error("Supabase client não está inicializado");
    }
    
    if (!user) {
      throw new Error("Usuário não autenticado");
    }
    
    try {
      setLoading(true);
      
      console.log('Atualizando perfil com dados:', profileData);
      
      const { error } = await supabase
        .from('profiles')
        .update(profileData)
        .eq('id', user.id);
      
      if (error) {
        console.error('Erro ao atualizar perfil no Supabase:', error);
        throw error;
      }
      
      setProfile(prev => prev ? { ...prev, ...profileData } : null);
      
      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram atualizadas com sucesso",
      });
    } catch (error: any) {
      console.error('Erro ao atualizar perfil:', error);
      toast({
        variant: "destructive",
        title: "Erro ao atualizar perfil",
        description: error.message || "Não foi possível atualizar suas informações",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const sendPasswordReset = async (email: string) => {
    if (!isSupabaseAvailable()) {
      throw new Error("Supabase client não está inicializado");
    }
    
    try {
      setLoading(true);
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (error) throw error;
      
      toast({
        title: "Email enviado",
        description: "Verifique seu email para redefinir sua senha",
      });
    } catch (error: any) {
      console.error('Erro ao enviar email de recuperação:', error);
      toast({
        variant: "destructive",
        title: "Erro ao enviar email",
        description: error.message || "Não foi possível enviar o email de recuperação",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Atualiza as informações do dispositivo atual no banco de dados
   * @param userId ID do usuário autenticado
   */
  const updateCurrentDeviceInfo = async (userId: string) => {
    if (!isSupabaseAvailable() || !userId) {
      console.error('Não foi possível atualizar informações do dispositivo');
      return;
    }

    try {
      // Obter informações do dispositivo
      const deviceId = getDeviceId();
      const deviceInfo = parseUserAgent();
      
      // Buscar localização aproximada
      const locationInfo = await fetchApproxLocation();
      
      // Registrar dispositivo no banco de dados
      await registerOrUpdateDevice(supabase, userId, {
        device_id: deviceId,
        device_name: deviceInfo.device_name,
        os: deviceInfo.os,
        browser: deviceInfo.browser,
        location: locationInfo?.location,
        ip_address: locationInfo?.ip_address
      });
      
      // Atualizar lista de dispositivos
      await refreshUserDevices();
      
    } catch (error) {
      console.error('Erro ao atualizar informações do dispositivo:', error);
    }
  };

  /**
   * Busca a lista de dispositivos do usuário atual
   */
  const refreshUserDevices = async () => {
    if (!isSupabaseAvailable() || !user) {
      return { devices: null, error: new Error("Usuário não autenticado ou Supabase indisponível") };
    }
    
    try {
      const { data, error } = await supabase
        .from('connected_devices')
        .select('*')
        .eq('user_id', user.id)  // Explicitly filter by user ID to ensure we get all devices for this user
        .order('last_active', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      // Marcar dispositivo atual
      const currentDeviceId = getDeviceId();
      const devicesList = data.map((device: ConnectedDevice) => ({
        ...device,
        is_current_device: device.device_id === currentDeviceId
      }));
      
      setDevices(devicesList);
      return { devices: devicesList, error: null };
    } catch (error) {
      console.error('Erro ao buscar dispositivos:', error);
      return { devices: null, error };
    }
  };

  /**
   * Função exposta no contexto para buscar dispositivos do usuário
   */
  const getUserDevices = async () => {
    return refreshUserDevices();
  };

  /**
   * Revoga acesso de um dispositivo específico
   * @param deviceId ID do dispositivo a ser revogado
   */
  const revokeDeviceAccess = async (deviceId: string) => {
    if (!isSupabaseAvailable() || !user) {
      return { success: false, error: new Error("Usuário não autenticado ou Supabase indisponível") };
    }
    
    try {
      setLoading(true);
      
      // Verificar se é o dispositivo atual
      const isCurrentDev = isCurrentDevice(deviceId);
      
      // Revogar acesso
      const result = await revokeDevice(supabase, deviceId, isCurrentDev);
      
      if (!result.success) {
        throw result.error;
      }
      
      // Se não for o dispositivo atual, atualizar a lista
      if (!isCurrentDev) {
        await refreshUserDevices();
        
        toast({
          title: "Dispositivo revogado",
          description: "O acesso deste dispositivo foi revogado com sucesso",
        });
      }
      
      return { success: true };
    } catch (error) {
      console.error('Erro ao revogar dispositivo:', error);
      
      toast({
        variant: "destructive",
        title: "Erro ao revogar dispositivo",
        description: error instanceof Error ? error.message : "Não foi possível revogar o acesso",
      });
      
      return { success: false, error };
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseAvailable()) {
      throw new Error("Supabase client não está inicializado");
    }
    
    try {
      const isBlocked = handleFailedLogin(email, false);
      if (isBlocked) {
        throw new Error("Conta temporariamente bloqueada devido a muitas tentativas. Tente novamente mais tarde.");
      }
      
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        handleFailedLogin(email);
        throw error;
      }
      
      resetFailedLogin(email);
      
      // Registrar fingerprint de segurança do dispositivo
      registerDeviceFingerprint();
      
      // Obter o usuário atual após login bem-sucedido
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        // Registrar informações do dispositivo
        await updateCurrentDeviceInfo(userData.user.id);
      }
      
      toast({
        title: "Login realizado com sucesso",
        description: `Bem-vindo de volta!`,
      });
    } catch (error: any) {
      console.error('Erro ao fazer login:', error);
      toast({
        variant: "destructive",
        title: "Erro ao fazer login",
        description: error.message || "Verifique suas credenciais e tente novamente",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, profileData?: Partial<Profile>) => {
    if (!isSupabaseAvailable()) {
      throw new Error("Supabase client não está inicializado");
    }
    
    try {
      setLoading(true);
      
      console.log('Iniciando registro com dados de perfil:', profileData);
      
      const { data: authData, error: authError } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: profileData
        }
      });
      
      if (authError) {
        console.error('Erro ao criar conta:', authError);
        throw authError;
      }
      
      const newUserId = authData.user?.id;
      
      if (newUserId) {
      console.log('Usuário criado com sucesso, ID:', newUserId);
      
      // Registrar fingerprint de segurança do dispositivo
      registerDeviceFingerprint();
      
      // Registrar informações do dispositivo conectado
      await updateCurrentDeviceInfo(newUserId);
      
      toast({
          title: "Conta criada com sucesso",
          description: "Verifique seu e-mail para confirmar seu cadastro",
        });
      } else {
        console.error('Usuário não foi criado corretamente');
        throw new Error('Não foi possível criar a conta de usuário');
      }
      
    } catch (error: any) {
      console.error('Erro ao criar conta:', error);
      toast({
        variant: "destructive",
        title: "Erro ao criar conta",
        description: error.message || "Não foi possível criar sua conta",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    if (!isSupabaseAvailable()) {
      throw new Error("Supabase client não está inicializado");
    }
    
    try {
      setLoading(true);
      await supabase.auth.signOut();
      toast({
        title: "Logout realizado com sucesso",
      });
    } catch (error: any) {
      console.error('Erro ao fazer logout:', error);
      toast({
        variant: "destructive",
        title: "Erro ao fazer logout",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      session, 
      user, 
      profile, 
      loading, 
      signIn, 
      signUp, 
      signOut,
      updateProfile,
      sendPasswordReset,
      securityScore,
      refreshProfile,
      // Adicionar novas funções de gerenciamento de dispositivos
      getUserDevices,
      revokeDeviceAccess
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
