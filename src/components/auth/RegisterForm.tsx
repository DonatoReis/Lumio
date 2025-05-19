
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import Logo from '@/components/ui/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

// Define o schema de validação para o formulário
const registerSchema = z.object({
  firstName: z.string().min(2, { message: 'Nome deve ter pelo menos 2 caracteres' }),
  lastName: z.string().min(2, { message: 'Sobrenome deve ter pelo menos 2 caracteres' }),
  email: z.string().email({ message: 'Email inválido' }),
  password: z.string().min(8, { message: 'Senha deve ter pelo menos 8 caracteres' }),
  confirmPassword: z.string(),
  companyName: z.string().optional(),
  position: z.string().optional(),
  agreedToTerms: z.boolean().refine(val => val === true, { message: 'Você deve concordar com os termos' })
}).refine(data => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

const RegisterForm: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { signUp, loading } = useAuth();
  const navigate = useNavigate();

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      companyName: '',
      position: '',
      agreedToTerms: false
    },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setError('');

    try {
      // Extrair os dados do perfil para enviar ao Supabase
      const { email, password, firstName, lastName, companyName, position } = values;
      
      // Enviar os dados de perfil junto com o cadastro
      await signUp(email, password, {
        first_name: firstName,
        last_name: lastName,
        company_name: companyName || undefined,
        position: position || undefined,
      });
      
      navigate('/login', { state: { registrationSuccess: true } });
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error('Erro no registro:', err);
        setError(err.message || 'Ocorreu um erro durante o registro');
      } else {
        console.error('Erro no registro:', err);
        setError('Ocorreu um erro durante o registro');
      }
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 space-y-8">
      <div className="text-center">
        <Logo size="lg" className="mx-auto" />
        <h1 className="mt-6 text-2xl font-semibold text-app-white">
          Registre-se na Plataforma
        </h1>
        <p className="mt-2 text-sm text-app-white/70">
          Crie sua conta para conectar-se com outras empresas
        </p>
      </div>

      <div className="p-6 bg-app-black rounded-lg shadow-lg border border-sidebar-border">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="João" 
                        className="bg-muted" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sobrenome</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Silva" 
                        className="bg-muted" 
                        {...field} 
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
                      type="email"
                      placeholder="nome@empresa.com"
                      className="bg-muted"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Empresa (opcional)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Empresa S.A." 
                        className="bg-muted" 
                        {...field} 
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
                    <FormLabel>Cargo (opcional)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Gerente" 
                        className="bg-muted" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        className="bg-muted pr-10"
                        {...field}
                      />
                    </FormControl>
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirme a Senha</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        className="bg-muted pr-10"
                        {...field}
                      />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="agreedToTerms"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="text-sm font-normal">
                      Concordo com os <a href="/terms" className="text-app-purple hover:text-app-blue">Termos de Serviço</a> e <a href="/privacy" className="text-app-purple hover:text-app-blue">Política de Privacidade</a>
                    </FormLabel>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />
            
            <Button
              type="submit"
              disabled={loading}
              className="w-full app-button-primary"
            >
              {loading ? 'Registrando...' : 'Criar Conta'}
            </Button>
            
            <div className="flex items-center justify-center text-xs text-app-white/70">
              <ShieldCheck size={14} className="mr-1 text-app-green" />
              <span>Conexão segura com criptografia de ponta a ponta</span>
            </div>
          </form>
        </Form>
        
        <div className="mt-6 text-center text-sm">
          <span className="text-app-white/70">Já tem uma conta? </span>
          <a href="/login" className="text-app-purple hover:text-app-blue transition-colors font-medium">
            Fazer login
          </a>
        </div>
      </div>
    </div>
  );
};

export default RegisterForm;
