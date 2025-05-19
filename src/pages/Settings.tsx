import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  UserCircle, 
  Shield, 
  Bell, 
  Globe, 
  Palette, 
  Smartphone, 
  Trash2,
  Key,
  Lock,
  Eye,
  EyeOff,
  LogOut,
  Check,
  X,
  FileText,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useAuthMFA } from '@/hooks/useAuthMFA';
import { ConnectedDevicesPage } from '@/pages/settings/ConnectedDevicesPage';
import { checkPasswordStrength, sanitizeInput } from '@/utils/security';
import { supabase } from '@/integrations/supabase/client';
import { debounce } from 'lodash';
import zxcvbn from 'zxcvbn';
import PasswordResetForm from '@/components/security/PasswordResetForm';
import PrivacySettingsView from '@/components/security/PrivacySettingsView';
import KYCVerificationView from '@/components/security/KYCVerificationView';
import CancelSubscriptionModal from '@/components/subscription/CancelSubscriptionModal';
import { usePayment } from '@/hooks/usePayment';

// Security Score component
const SecurityScore = () => {
  const { securityScore = 0 } = useAuth();
  return (
    <div className="flex items-center bg-muted/30 p-3 rounded-md mb-6">
      <div className="text-sm mr-3">
        <span className="text-muted-foreground">Pontuação de segurança:</span>
      </div>
      <div className="flex items-center">
        <div className="h-2 w-24 bg-muted rounded-full mr-2 overflow-hidden">
          <div 
            className="h-full bg-app-purple rounded-full"
            style={{ width: `${securityScore}%` }}
          />
        </div>
        <span className="font-medium">{securityScore}%</span>
      </div>
    </div>
  );
};

// Function to generate a CSRF token
const generateCSRFToken = () => {
  const random = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const timestamp = new Date().getTime().toString();
  return btoa(`${random}:${timestamp}`);
};

// Wrapper component for the Devices tab
const DevicesTabContent = () => {
  return <ConnectedDevicesPage />;
};

const Settings = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('profile'); // Default tab
  const { user } = useAuth();
  const { toast } = useToast();
  const { enableTwoFactor, disableTwoFactor } = useAuthMFA();
  
  // Password reset form states
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  // Password visibility states
  const [passwordVisibility, setPasswordVisibility] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false
  });
  
  // Password validation state
  const [passwordValidation, setPasswordValidation] = useState({
    hasMinLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecial: false,
    passwordsMatch: false,
    strongEnough: false,
    score: 0
  });
  
  // Form submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [csrfToken, setCsrfToken] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelingSubscription, setCancelingSubscription] = useState(false);
  
  // Generate CSRF token on component mount
  useEffect(() => {
    setCsrfToken(generateCSRFToken());
  }, []);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['profile', 'security', 'notifications', 'appearance', 'devices', 'billing'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);
  
  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    bio: ''
  });
  
  const [security, setSecurity] = useState({
    twoFactorEnabled: true,
    emailNotificationsEnabled: true
  });
  
  const [notifications, setNotifications] = useState({
    messageNotifications: true,
    meetingReminders: true,
    securityAlerts: true,
    marketplaceUpdates: false,
    teamMentions: true
  });
  
  const [appearance, setAppearance] = useState({
    theme: 'dark',
    reducedMotion: false,
    highContrast: false
  });
  
  const [devices, setDevices] = useState([
    { id: '1', name: 'Chrome - Windows', lastActive: 'Agora', current: true },
    { id: '2', name: 'Safari - iPhone', lastActive: '2 horas atrás', current: false },
    { id: '3', name: 'Firefox - MacBook', lastActive: '3 dias atrás', current: false }
  ]);

  const handleProfileUpdate = () => {
    toast({
      title: "Perfil atualizado",
      description: "Suas informações foram salvas com sucesso"
    });
  };

  const handleSecurityUpdate = () => {
    toast({
      title: "Configurações de segurança atualizadas",
      description: "Suas preferências de segurança foram salvas"
    });
  };

  // Toggle password visibility
  const togglePasswordVisibility = (field) => {
    setPasswordVisibility(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  // Validate password requirements
  const validatePassword = useCallback((password, confirmPassword) => {
    // Basic validation checks
    const hasMinLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    const passwordsMatch = password === confirmPassword;
    
    // Use zxcvbn for password strength evaluation
    const result = zxcvbn(password);
    const score = result.score; // 0-4 scale
    const strongEnough = score >= 3;
    
    setPasswordValidation({
      hasMinLength,
      hasUppercase,
      hasLowercase,
      hasNumber,
      hasSpecial,
      passwordsMatch,
      strongEnough,
      score
    });
  }, []);

  // Debounced validation to prevent excessive re-renders
  const debouncedValidation = useCallback(
    debounce((password, confirmPassword) => {
      validatePassword(password, confirmPassword);
    }, 300),
    [validatePassword]
  );

  // Update validation when password changes
  useEffect(() => {
    debouncedValidation(
      passwordForm.newPassword, 
      passwordForm.confirmPassword
    );
  }, [passwordForm.newPassword, passwordForm.confirmPassword, debouncedValidation]);

  // Handle password form input changes
  const handlePasswordInputChange = (e) => {
    const { id, value } = e.target;
    setPasswordForm(prev => ({
      ...prev,
      [id]: value
    }));
  };

  // Get color for password strength meter
  const getStrengthColor = (score) => {
    switch (score) {
      case 0: return 'bg-red-500';
      case 1: return 'bg-red-400';
      case 2: return 'bg-yellow-400';
      case 3: return 'bg-green-400';
      case 4: return 'bg-green-500';
      default: return 'bg-gray-300';
    }
  };

  // Get feedback text for password strength
  const getStrengthText = (score) => {
    switch (score) {
      case 0: return 'Muito fraca';
      case 1: return 'Fraca';
      case 2: return 'Média';
      case 3: return 'Boa';
      case 4: return 'Forte';
      default: return 'Indeterminada';
    }
  };


  // Check if the password form is valid for submission
  const isPasswordFormValid = () => {
    return (
      passwordForm.currentPassword &&
      passwordValidation.hasMinLength &&
      passwordValidation.hasUppercase &&
      passwordValidation.hasLowercase &&
      passwordValidation.hasNumber &&
      passwordValidation.hasSpecial &&
      passwordValidation.passwordsMatch &&
      passwordValidation.strongEnough
    );
  };


  // Handle password reset form submission
  const handlePasswordReset = async () => {
    try {
      setIsSubmitting(true);
      
      // For demonstration, we'll simulate the API call
      /*
      const { data, error } = await supabase.functions.invoke('reset-password', {
        body: {
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
          confirmPassword: passwordForm.confirmPassword
        },
        headers: {
          'X-CSRF-Token': csrfToken
        }
      });
      
      if (error) throw error;
      */
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Reset form
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
      // Generate new CSRF token
      setCsrfToken(generateCSRFToken());
      
      toast({
        title: "Senha alterada com sucesso",
        description: "Sua nova senha foi configurada. Todas as suas sessões foram encerradas."
      });
    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      toast({
        variant: "destructive",
        title: "Erro ao alterar senha",
        description: error.message || "Ocorreu um erro ao tentar alterar sua senha."
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Funções para o modal de cancelamento
  const openCancelModal = () => {
    setShowCancelModal(true);
  };

  const closeCancelModal = () => {
    setShowCancelModal(false);
  };

  // Função para cancelar a assinatura
  const handleCancelSubscription = async () => {
    if (!user?.id) {
      toast({
        title: 'Erro',
        description: 'Você precisa estar logado para cancelar sua assinatura.',
        variant: 'destructive'
      });
      return;
    }
    
    try {
      setCancelingSubscription(true);
      
      // Buscar ID da assinatura
      const { data: userPlan, error: planError } = await supabase
        .from('user_plans_table' as any)
        .select('stripe_subscription_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();
      
      if (planError) throw new Error(planError.message);
      
      if (!userPlan?.stripe_subscription_id) {
        throw new Error('Não foi possível identificar sua assinatura.');
      }
      
      // Chamar função do Supabase para cancelar a assinatura
      const { data, error } = await supabase.functions.invoke('cancel-subscription', {
        body: { 
          subscriptionId: userPlan.stripe_subscription_id 
        }
      });
      
      if (error) throw new Error(error.message);
      
      if (data?.success) {
        // Atualizar UI - opcional: recarregar a página ou atualizar o estado
        
        toast({
          title: 'Assinatura cancelada',
          description: 'Sua assinatura foi cancelada com sucesso. Você terá acesso até o final do período já pago.',
          variant: 'default'
        });
        
        // Fechar modal após cancelamento bem-sucedido
        closeCancelModal();
      } else {
        throw new Error(data?.message || 'Erro ao cancelar assinatura');
      }
    } catch (error) {
      console.error('Erro ao cancelar assinatura:', error);
      toast({
        title: 'Erro ao cancelar assinatura',
        description: error instanceof Error ? error.message : 'Ocorreu um erro inesperado',
        variant: 'destructive'
      });
    } finally {
      setCancelingSubscription(false);
    }
  };

  const handleDeviceRevoke = (deviceId: string) => {
    setDevices(devices.filter(device => device.id !== deviceId));
    toast({
      title: "Dispositivo desconectado",
      description: "O dispositivo não tem mais acesso à sua conta"
    });
  };

  const handleEnableTwoFactor = async () => {
    const success = await enableTwoFactor('+5511987654321');
    if (success) {
      setSecurity(prev => ({ ...prev, twoFactorEnabled: true }));
    }
  };

  const handleDisableTwoFactor = async () => {
    const success = await disableTwoFactor();
    if (success) {
      setSecurity(prev => ({ ...prev, twoFactorEnabled: false }));
    }
  };

  return (
    <Layout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Configurações</h1>
        
        <Tabs defaultValue={activeTab} className="space-y-6" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-1 md:grid-cols-5 lg:grid-cols-6 h-auto gap-2">
            <TabsTrigger value="profile" className="flex items-center">
              <UserCircle className="mr-2 h-4 w-4" /> Perfil
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center">
              <Shield className="mr-2 h-4 w-4" /> Segurança e Privacidade
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center">
              <Bell className="mr-2 h-4 w-4" /> Notificações
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex items-center">
              <Palette className="mr-2 h-4 w-4" /> Aparência
            </TabsTrigger>
            <TabsTrigger value="devices" className="flex items-center">
              <Smartphone className="mr-2 h-4 w-4" /> Dispositivos
            </TabsTrigger>
            <TabsTrigger value="billing" className="flex items-center">
              <CreditCard className="mr-2 h-4 w-4" /> Pagamento
            </TabsTrigger>
          </TabsList>
          
          {/* Aba de Perfil */}
          <TabsContent value="profile" className="space-y-6">
            <Card className="bg-app-black border-app-border">
              <CardHeader>
                <CardTitle>Informações Pessoais</CardTitle>
                <CardDescription>
                  Atualize suas informações de perfil
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-foreground">Nome</Label>
                    <Input
                      id="firstName"
                      value={profile.firstName}
                      onChange={(e) => setProfile({...profile, firstName: e.target.value})}
                      className="bg-input"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-foreground">Sobrenome</Label>
                    <Input
                      id="lastName"
                      value={profile.lastName}
                      onChange={(e) => setProfile({...profile, lastName: e.target.value})}
                      className="bg-input"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground">Email</Label>
                  <Input
                    id="email"
                    value={profile.email}
                    onChange={(e) => setProfile({...profile, email: e.target.value})}
                    className="bg-input"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-foreground">Telefone</Label>
                  <Input
                    id="phone"
                    value={profile.phone}
                      onChange={(e) => setProfile({...profile, phone: e.target.value})}
                      className="bg-input"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="bio" className="text-foreground">Biografia</Label>
                  <Textarea
                    id="bio"
                    value={profile.bio}
                    onChange={(e) => setProfile({...profile, bio: e.target.value})}
                    rows={4}
                    className="bg-input"
                  />
                </div>
                
                <div className="flex justify-end">
                  <Button className="rounded-full" onClick={handleProfileUpdate}>Salvar Alterações</Button>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-app-black border-app-border">
              <CardHeader>
                <CardTitle>Excluir Conta</CardTitle>
                <CardDescription>
                  Esta ação é permanente e não pode ser desfeita
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" className="flex items-center">
                  <Trash2 className="mr-2 h-4 w-4" /> Excluir Minha Conta
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Aba de Segurança */}
          <TabsContent value="security" className="space-y-6">
            <SecurityScore />

            <Card className="bg-app-black border-app-border">
              <CardHeader>
                <CardTitle>Alterar Senha</CardTitle>
                <CardDescription>
                  Altere sua senha regularmente para maior segurança
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PasswordResetForm 
                  onSuccess={() => {
                    toast({
                      title: "Senha alterada com sucesso",
                      description: "Todas as suas sessões foram encerradas. Você precisará fazer login novamente."
                    });
                  }}
                  onError={(error) => {
                    toast({
                      variant: "destructive",
                      title: "Erro ao alterar senha",
                      description: error.message || "Ocorreu um erro ao tentar alterar sua senha."
                    });
                  }}
                />
              </CardContent>
            </Card>
            
            <Card className="bg-app-black border-app-border">
              <CardHeader>
                <CardTitle>Verificação em Duas Etapas</CardTitle>
                <CardDescription>
                  Adicione uma camada extra de segurança à sua conta
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-medium">Autenticação de Dois Fatores (2FA)</div>
                    <div className="text-sm text-muted-foreground">
                      Receba códigos de verificação por SMS ao fazer login
                    </div>
                  </div>
                  <Switch
                    checked={security.twoFactorEnabled}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        handleEnableTwoFactor();
                      } else {
                        handleDisableTwoFactor();
                      }
                    }}
                  />
                </div>
                
                <div className="flex justify-end">
                  <Button onClick={handleSecurityUpdate}>Salvar Configurações</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-app-black border-app-border mt-6">
              <CardHeader>
                <CardTitle>Privacidade e Proteção</CardTitle>
                <CardDescription>
                  Configure suas preferências de privacidade e proteção
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PrivacySettingsView />
              </CardContent>
            </Card>

            <Card className="bg-app-black border-app-border mt-6">
              <CardHeader>
                <CardTitle>Verificação KYC</CardTitle>
                <CardDescription>
                  Complete a verificação de identidade para aumentar os limites de transação
                </CardDescription>
              </CardHeader>
              <CardContent>
                <KYCVerificationView />
              </CardContent>
            </Card>

          </TabsContent>
          
          {/* Aba de Notificações */}
          <TabsContent value="notifications" className="space-y-6">
            <Card className="bg-app-black border-app-border">
              <CardHeader>
                <CardTitle>Preferências de Notificações</CardTitle>
                <CardDescription>
                  Escolha quais notificações você deseja receber
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-medium">Mensagens</div>
                    <div className="text-sm text-muted-foreground">
                      Notificações para novas mensagens e menções
                    </div>
                  </div>
                  <Switch
                    checked={notifications.messageNotifications}
                    onCheckedChange={(checked) => 
                      setNotifications({...notifications, messageNotifications: checked})
                    }
                  />
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-medium">Lembretes de Reuniões</div>
                    <div className="text-sm text-muted-foreground">
                      Receba lembretes antes de reuniões agendadas
                    </div>
                  </div>
                  <Switch
                    checked={notifications.meetingReminders}
                    onCheckedChange={(checked) => 
                      setNotifications({...notifications, meetingReminders: checked})
                    }
                  />
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-medium">Alertas de Segurança</div>
                    <div className="text-sm text-muted-foreground">
                      Notificações sobre logins ou atividades suspeitas
                    </div>
                  </div>
                  <Switch
                    checked={notifications.securityAlerts}
                    onCheckedChange={(checked) => 
                      setNotifications({...notifications, securityAlerts: checked})
                    }
                  />
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-medium">Atualizações do Marketplace</div>
                    <div className="text-sm text-muted-foreground">
                      Novidades e promoções do marketplace
                    </div>
                  </div>
                  <Switch
                    checked={notifications.marketplaceUpdates}
                    onCheckedChange={(checked) => 
                      setNotifications({...notifications, marketplaceUpdates: checked})
                    }
                  />
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-medium">Menções em Equipes</div>
                    <div className="text-sm text-muted-foreground">
                      Quando alguém mencionar você em uma equipe
                    </div>
                  </div>
                  <Switch
                    checked={notifications.teamMentions}
                    onCheckedChange={(checked) => 
                      setNotifications({...notifications, teamMentions: checked})
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Aba de Aparência */}
          <TabsContent value="appearance" className="space-y-6">
            <Card className="bg-app-black border-app-border">
              <CardHeader>
                <CardTitle>Tema e Cores</CardTitle>
                <CardDescription>
                  Personalize a aparência da aplicação
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-medium">Tema Escuro</div>
                    <div className="text-sm text-muted-foreground">
                      Ative o modo escuro para reduzir o cansaço visual
                    </div>
                  </div>
                  <Switch
                    checked={appearance.theme === 'dark'}
                    onCheckedChange={(checked) => 
                      setAppearance({...appearance, theme: checked ? 'dark' : 'light'})
                    }
                  />
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-medium">Reduzir Movimento</div>
                    <div className="text-sm text-muted-foreground">
                      Reduz animações e efeitos visuais
                    </div>
                  </div>
                  <Switch
                    checked={appearance.reducedMotion}
                    onCheckedChange={(checked) => 
                      setAppearance({...appearance, reducedMotion: checked})
                    }
                  />
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-medium">Alto Contraste</div>
                    <div className="text-sm text-muted-foreground">
                      Aumenta o contraste para melhor visibilidade
                    </div>
                  </div>
                  <Switch
                    checked={appearance.highContrast}
                    onCheckedChange={(checked) => 
                      setAppearance({...appearance, highContrast: checked})
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Aba de Dispositivos */}
          <TabsContent value="devices" className="space-y-6">
            <DevicesTabContent />
          </TabsContent>
          
          {/* Aba de Pagamento */}
          <TabsContent value="billing" className="space-y-6">
            <Card className="bg-app-black border-app-border">
              <CardHeader>
                <CardTitle>Plano Atual</CardTitle>
                <CardDescription>
                  Gerencie seu plano e forma de pagamento
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 border border-app-border rounded-md">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-bold text-lg">Plano Business</div>
                      <div className="text-sm text-muted-foreground">Faturado mensalmente</div>
                    </div>
                    <div className="font-bold">R$ 99,90/mês</div>
                  </div>
                  
                  <Separator className="my-4" />
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>Acesso ilimitado a todos os recursos</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>Suporte prioritário</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>Equipes de até 20 pessoas</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => navigate('/pricing?source=settings')}
                  >
                    Alterar Plano
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={openCancelModal}
                    disabled={cancelingSubscription}
                  >
                    Cancelar Assinatura
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-app-black border-app-border">
              <CardHeader>
                <CardTitle>Métodos de Pagamento</CardTitle>
                <CardDescription>
                  Gerencie seus cartões e formas de pagamento
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 border border-app-border rounded-md">
                  <div className="flex items-center gap-3">
                    <div className="rounded-md bg-slate-800 p-2 font-bold text-white">
                      VISA
                    </div>
                    <div>
                      <div>Visa •••• 4242</div>
                      <div className="text-sm text-muted-foreground">Expira em 04/2025</div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">Remover</Button>
                </div>
                
                <Button className="w-full" variant="outline">
                  + Adicionar Nova Forma de Pagamento
                </Button>
              </CardContent>
            </Card>
            
            <Card className="bg-app-black border-app-border">
              <CardHeader>
                <CardTitle>Histórico de Faturas</CardTitle>
                <CardDescription>
                  Acesse suas faturas anteriores
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between py-2 border-b border-app-border">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span>Fatura de Abril 2025</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div>R$ 99,90</div>
                    <Button variant="outline" size="sm">Baixar</Button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between py-2 border-b border-app-border">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span>Fatura de Março 2025</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div>R$ 99,90</div>
                    <Button variant="outline" size="sm">Baixar</Button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span>Fatura de Fevereiro 2025</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div>R$ 99,90</div>
                    <Button variant="outline" size="sm">Baixar</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal de confirmação de cancelamento de assinatura */}
      <CancelSubscriptionModal
        isOpen={showCancelModal}
        onClose={closeCancelModal}
        onConfirm={handleCancelSubscription}
        isLoading={cancelingSubscription}
      />
    </Layout>
  );
};

export default Settings;
