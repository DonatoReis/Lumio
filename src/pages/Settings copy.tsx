import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  CreditCard
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useAuthMFA } from '@/hooks/useAuthMFA';
import { ConnectedDevicesPage } from '@/pages/settings/ConnectedDevicesPage';

// Wrapper component for the Devices tab
const DevicesTabContent = () => {
  return <ConnectedDevicesPage />;
};

const Settings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { enableTwoFactor, disableTwoFactor } = useAuthMFA();
  
  const [profile, setProfile] = useState({
    firstName: 'João',
    lastName: 'Silva',
    email: 'joao.silva@example.com',
    phone: '+55 (11) 98765-4321',
    bio: 'Gerente de produtos com experiência em desenvolvimento de software e marketing digital.'
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
    fontSize: 'medium',
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

  const handlePasswordChange = () => {
    toast({
      title: "Senha alterada com sucesso",
      description: "Sua nova senha foi configurada"
    });
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
        
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid grid-cols-1 md:grid-cols-5 lg:grid-cols-6 h-auto gap-2">
            <TabsTrigger value="profile" className="flex items-center">
              <UserCircle className="mr-2 h-4 w-4" /> Perfil
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center">
              <Shield className="mr-2 h-4 w-4" /> Segurança
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
                    <Label htmlFor="firstName">Nome</Label>
                    <Input
                      id="firstName"
                      value={profile.firstName}
                      onChange={(e) => setProfile({...profile, firstName: e.target.value})}
                      className="bg-app-border/30"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Sobrenome</Label>
                    <Input
                      id="lastName"
                      value={profile.lastName}
                      onChange={(e) => setProfile({...profile, lastName: e.target.value})}
                      className="bg-app-border/30"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={profile.email}
                    onChange={(e) => setProfile({...profile, email: e.target.value})}
                    className="bg-app-border/30"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={profile.phone}
                    onChange={(e) => setProfile({...profile, phone: e.target.value})}
                    className="bg-app-border/30"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="bio">Biografia</Label>
                  <Textarea
                    id="bio"
                    value={profile.bio}
                    onChange={(e) => setProfile({...profile, bio: e.target.value})}
                    rows={4}
                    className="bg-app-border/30"
                  />
                </div>
                
                <div className="flex justify-end">
                  <Button onClick={handleProfileUpdate}>Salvar Alterações</Button>
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
            <Card className="bg-app-black border-app-border">
              <CardHeader>
                <CardTitle>Alterar Senha</CardTitle>
                <CardDescription>
                  Altere sua senha regularmente para maior segurança
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Senha Atual</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type="password"
                      placeholder="••••••••"
                      className="bg-app-border/30 pr-10"
                    />
                    <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nova Senha</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type="password"
                      placeholder="••••••••"
                      className="bg-app-border/30 pr-10"
                    />
                    <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <EyeOff className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      className="bg-app-border/30 pr-10"
                    />
                    <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <EyeOff className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <Button onClick={handlePasswordChange}>Alterar Senha</Button>
                </div>
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
                
                <Separator />
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-medium">Notificações de Segurança</div>
                    <div className="text-sm text-muted-foreground">
                      Receba alertas sobre atividades suspeitas
                    </div>
                  </div>
                  <Switch
                    checked={security.emailNotificationsEnabled}
                    onCheckedChange={(checked) => 
                      setSecurity({...security, emailNotificationsEnabled: checked})
                    }
                  />
                </div>
                
                <div className="flex justify-end">
                  <Button onClick={handleSecurityUpdate}>Salvar Configurações</Button>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-app-black border-app-border">
              <CardHeader>
                <CardTitle>Sessões Ativas</CardTitle>
                <CardDescription>
                  Encerre sua sessão em todos os dispositivos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="text-amber-500 border-amber-500/30 hover:bg-amber-500/10 flex items-center">
                  <LogOut className="mr-2 h-4 w-4" /> Sair de Todos os Dispositivos
                </Button>
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
                
                <div className="space-y-2">
                  <div className="font-medium">Tamanho da Fonte</div>
                  <div className="flex gap-4">
                    <Button 
                      variant={appearance.fontSize === 'small' ? 'default' : 'outline'}
                      className="flex-1"
                      onClick={() => setAppearance({...appearance, fontSize: 'small'})}
                    >
                      Pequena
                    </Button>
                    <Button 
                      variant={appearance.fontSize === 'medium' ? 'default' : 'outline'}
                      className="flex-1"
                      onClick={() => setAppearance({...appearance, fontSize: 'medium'})}
                    >
                      Média
                    </Button>
                    <Button 
                      variant={appearance.fontSize === 'large' ? 'default' : 'outline'}
                      className="flex-1"
                      onClick={() => setAppearance({...appearance, fontSize: 'large'})}
                    >
                      Grande
                    </Button>
                  </div>
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
                  <Button variant="outline">Alterar Plano</Button>
                  <Button variant="destructive">Cancelar Assinatura</Button>
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
    </Layout>
  );
};

export default Settings;
