import React, { useState, useEffect } from 'react';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import "@/style_inputs.css";
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { UserCircle, Mail, Building2, Briefcase, FileEdit, Save, Shield, AlertCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import AvatarUpload from '@/components/profile/AvatarUpload';
import { ensureStorageBuckets, testStorageConnection } from '@/utils/storage-config';
import { testConnection } from '@/integrations/supabase/client';

// Validation schema for the profile form
const profileSchema = z.object({
  first_name: z.string().min(2, { message: 'Nome deve ter pelo menos 2 caracteres' }).optional(),
  last_name: z.string().min(2, { message: 'Sobrenome deve ter pelo menos 2 caracteres' }).optional(),
  email: z.string().email({ message: 'Email inválido' }).optional(),
  company_name: z.string().optional(),
  position: z.string().optional(),
  industry: z.string().optional(),
  about: z.string().max(500, { message: 'Biografia deve ter no máximo 500 caracteres' }).optional(),
  avatar_url: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const ProfilePage: React.FC = () => {
  const { user, profile, updateProfile, loading, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [storageStatus, setStorageStatus] = useState<{
    checking: boolean;
    ready: boolean;
    error: string | null;
  }>({
    checking: true,
    ready: false,
    error: null
  });

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: profile?.first_name || '',
      last_name: profile?.last_name || '',
      email: profile?.email || user?.email || '',
      company_name: profile?.company_name || '',
      position: profile?.position || '',
      industry: profile?.industry || '',
      about: profile?.about || '',
      avatar_url: profile?.avatar_url || '',
    },
  });

  // Check connection and configure storage on load
  useEffect(() => {
    const checkConnectionAndStorage = async () => {
      setStorageStatus(prev => ({ ...prev, checking: true }));
      try {
        // Test connection with Supabase
        const connectionTest = await testConnection();
        if (!connectionTest.success) {
          console.error('Failed to connect to Supabase:', connectionTest.error);
          setStorageStatus({
            checking: false,
            ready: false,
            error: 'Não foi possível conectar ao servidor de dados. Algumas funcionalidades podem estar indisponíveis.'
          });
          
          toast({
            variant: "destructive", 
            title: "Erro de conexão",
            description: "Não foi possível conectar ao servidor de dados. Algumas funcionalidades podem estar indisponíveis."
          });
          return;
        }
        
        // If connection is OK, check storage
        const storageTest = await testStorageConnection();
        if (!storageTest.success) {
          console.error('Storage connection test failed:', storageTest.error);
          setStorageStatus({
            checking: false,
            ready: false,
            error: 'Não foi possível acessar o armazenamento de imagens.'
          });
          return;
        }
        
        // Ensure storage buckets are configured
        const bucketsResult = await ensureStorageBuckets();
        setStorageStatus({
          checking: false,
          ready: bucketsResult.success,
          error: bucketsResult.success ? null : 'Não foi possível configurar o armazenamento de imagens: ' + bucketsResult.error
        });
        
        if (!bucketsResult.success) {
          toast({
            variant: "destructive",
            title: "Erro de configuração",
            description: "Não foi possível configurar o armazenamento de imagens."
          });
        }
      } catch (error) {
        console.error('Error checking connection:', error);
        setStorageStatus({
          checking: false,
          ready: false,
          error: 'Erro ao verificar conexão com o servidor.'
        });
      }
    };
    
    checkConnectionAndStorage();
  }, [toast]);

  // Update the form when the profile is loaded
  useEffect(() => {
    if (profile) {
      form.reset({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        email: profile.email || user?.email || '',
        company_name: profile.company_name || '',
        position: profile.position || '',
        industry: profile.industry || '',
        about: profile.about || '',
        avatar_url: profile.avatar_url || '',
      });
    }
  }, [profile, user, form]);

  // Request profile update if not available
  useEffect(() => {
    if (!profile && user) {
      refreshProfile();
    }
  }, [profile, user, refreshProfile]);

  const onSubmit = async (data: ProfileFormValues) => {
    try {
      await updateProfile(data);
      setIsEditing(false);
      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram salvas com sucesso"
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar perfil",
        description: error.message || "Não foi possível atualizar seu perfil"
      });
    }
  };

  // Handle avatar URL update
  const handleAvatarChange = async (url: string) => {
    try {
      await updateProfile({ avatar_url: url });
      form.setValue('avatar_url', url);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar avatar",
        description: error.message || "Não foi possível atualizar sua foto de perfil"
      });
    }
  };

  // Retry storage configuration
  const handleRetryStorageConfig = async () => {
    setStorageStatus({
      checking: true,
      ready: false,
      error: null
    });
    
    try {
      const bucketsResult = await ensureStorageBuckets();
      setStorageStatus({
        checking: false,
        ready: bucketsResult.success,
        error: bucketsResult.success ? null : 'Não foi possível configurar o armazenamento de imagens: ' + bucketsResult.error
      });
      
      if (bucketsResult.success) {
        toast({
          title: "Configuração concluída",
          description: "O armazenamento de imagens foi configurado com sucesso."
        });
      } else {
        toast({
          variant: "destructive",
          title: "Erro de configuração",
          description: "Não foi possível configurar o armazenamento de imagens."
        });
      }
    } catch (error) {
      console.error('Error configuring storage:', error);
      setStorageStatus({
        checking: false,
        ready: false,
        error: 'Erro ao configurar o armazenamento de imagens.'
      });
    }
  };

  if (!user) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-full">
          <Card className="w-full max-w-md bg-app-black border-sidebar-border">
            <CardHeader>
              <CardTitle className="text-center">Acesso Restrito</CardTitle>
              <CardDescription className="text-center">
                Você precisa estar logado para acessar esta página
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button className="w-full" onClick={() => window.location.href = '/login'}>
                Faça login para continuar
              </Button>
            </CardFooter>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container p-4 md:p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 flex items-center">
          <UserCircle className="mr-2" /> 
          Meu Perfil
        </h1>
        
        {storageStatus.error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {storageStatus.error}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRetryStorageConfig} 
                className="ml-2"
                disabled={storageStatus.checking}
              >
                {storageStatus.checking ? 'Verificando...' : 'Tentar novamente'}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Card className="bg-app-black border-sidebar-border mb-6">
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-4">
              <AvatarUpload 
                avatarUrl={profile?.avatar_url || undefined}
                onAvatarChange={handleAvatarChange}
                size="lg"
                showUploadButton={storageStatus.ready}
              />
              
              <div className="flex-1 text-center md:text-left">
                <CardTitle className="text-xl">
                  {profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}` : 'Usuário'}
                </CardTitle>
                <CardDescription className="flex items-center justify-center md:justify-start mt-1">
                  <Mail className="w-4 h-4 mr-1" /> {profile?.email || user.email}
                </CardDescription>
                {profile?.company_name && (
                  <div className="flex items-center justify-center md:justify-start mt-1 text-sm text-muted-foreground">
                    <Building2 className="w-4 h-4 mr-1" /> {profile.company_name}
                    {profile.position && (
                      <span className="ml-2 flex items-center">
                        <Briefcase className="w-4 h-4 mr-1" /> {profile.position}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div>
                <Button 
                  variant={isEditing ? "default" : "outline"} 
                  size="sm" 
                  onClick={() => setIsEditing(!isEditing)}
                  className="flex items-center"
                >
                  {isEditing ? (
                    <>Cancelar</>
                  ) : (
                    <>
                      <FileEdit className="w-4 h-4 mr-1" /> Editar Perfil
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {isEditing ? (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="first_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Seu nome" 
                              className="bg-app-border/30 input-text-dark" 
                              {...field} 
                              value={field.value || ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="last_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sobrenome</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Seu sobrenome" 
                              className="bg-app-border/30 input-text-dark" 
                              {...field} 
                              value={field.value || ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="nome@empresa.com"
                            className="bg-app-border/30 input-text-dark"
                            {...field}
                            value={field.value || ''}
                            disabled // Email não pode ser alterado por aqui
                          />
                        </FormControl>
                        <FormDescription>
                          O email não pode ser alterado por questões de segurança.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="company_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome da Empresa</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Sua empresa" 
                              className="bg-app-border/30 input-text-dark" 
                              {...field} 
                              value={field.value || ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="position"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cargo</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Seu cargo" 
                              className="bg-app-border/30 input-text-dark" 
                              {...field} 
                              value={field.value || ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="industry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Indústria/Setor</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Ex: Tecnologia, Saúde, Finanças..." 
                            className="bg-app-border/30 input-text-dark" 
                            {...field} 
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="about"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sobre</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Um pouco sobre você ou sua empresa" 
                            className="bg-app-border/30 h-24 input-text-dark" 
                            {...field} 
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex justify-end">
                    <Button 
                      type="submit" 
                      disabled={loading}
                      className="app-button-primary"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {loading ? 'Salvando...' : 'Salvar Alterações'}
                    </Button>
                  </div>
                </form>
              </Form>
            ) : (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Sobre</h3>
                  <p className="text-app-white/90">
                    {profile?.about || 'Nenhuma informação disponível'}
                  </p>
                </div>
                
                <Separator />
                
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Indústria/Setor</h3>
                  <p className="text-app-white/90">
                    {profile?.industry || 'Não especificado'}
                  </p>
                </div>
                
                <div className="p-4 border border-app-purple/20 rounded-lg bg-app-purple/5">
                  <div className="flex items-center mb-2">
                    <Shield className="w-5 h-5 text-app-purple mr-2" />
                    <h3 className="font-medium">Segurança de dados</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Seus dados pessoais são protegidos por criptografia e políticas 
                    de segurança. Apenas você pode visualizar e editar seus dados.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ProfilePage;
