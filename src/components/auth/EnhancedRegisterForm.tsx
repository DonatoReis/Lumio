
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { TwoFactorAuth } from '@/components/auth/TwoFactorAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Loader2, Shield, Eye, EyeOff, Lock, UserCheck } from 'lucide-react';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { checkPasswordStrength } from '@/utils/security';

// Schema para validação do formulário
const registerSchema = z.object({
  email: z.string()
    .email({ message: 'Email inválido' })
    .min(5, { message: 'Email muito curto' })
    .max(100, { message: 'Email muito longo' }),
  password: z.string()
    .min(8, { message: 'Senha deve ter pelo menos 8 caracteres' })
    .max(100, { message: 'Senha muito longa' })
    .refine(
      (password) => /[A-Z]/.test(password),
      { message: 'Senha deve conter pelo menos uma letra maiúscula' }
    )
    .refine(
      (password) => /[0-9]/.test(password),
      { message: 'Senha deve conter pelo menos um número' }
    )
    .refine(
      (password) => /[^A-Za-z0-9]/.test(password),
      { message: 'Senha deve conter pelo menos um caractere especial' }
    ),
  confirmPassword: z.string(),
  terms: z.boolean().refine((val) => val === true, {
    message: 'Você deve aceitar os termos e políticas',
  }),
  enable2FA: z.boolean(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não conferem',
  path: ['confirmPassword'],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

/**
 * Formulário de registro aprimorado com opção de 2FA
 * Implementa verificações de segurança avançadas
 */
export function EnhancedRegisterForm() {
  const [step, setStep] = useState<'form' | '2fa' | 'success'>('form');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    feedback: '',
    isStrong: false,
  });
  const { signUp, loading } = useAuth();
  const navigate = useNavigate();
  const [submittedEmail, setSubmittedEmail] = useState('');

  // Configurar o formulário com validação Zod
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      terms: false,
      enable2FA: true, // Habilitar 2FA por padrão para maior segurança
    },
  });

  // Avaliar força da senha ao digitar
  const onPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const strength = checkPasswordStrength(e.target.value);
    setPasswordStrength(strength);
    form.setValue('password', e.target.value);
  };

  const onSubmit = async (data: RegisterFormValues) => {
    try {
      // 1. Registrar o usuário via Supabase
      await signUp(data.email, data.password);
      
      setSubmittedEmail(data.email);
      
      // 2. Se 2FA estiver habilitado, vá para o passo de verificação
      if (data.enable2FA) {
        setStep('2fa');
      } else {
        // Caso contrário, vá direto para a tela de sucesso
        setStep('success');
      }
      
    } catch (error) {
      console.error('Erro no registro:', error);
      // Os erros já são tratados pelo hook useAuth
    }
  };

  // Lidar com verificação 2FA bem-sucedida
  const handleVerified = () => {
    setStep('success');
  };

  // Redefinir para o formulário inicial
  const handleCancel2FA = () => {
    setStep('form');
  };

  // Redirecionar para o login após registro bem-sucedido
  const goToLogin = () => {
    navigate('/login');
  };

  // Renderizar etapa de formulário
  const renderFormStep = () => (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="seu.email@empresa.com.br" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Senha</FormLabel>
              <div className="relative">
                <FormControl>
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Sua senha segura"
                    onChange={onPasswordChange}
                    value={field.value}
                    onBlur={field.onBlur}
                    name={field.name}
                  />
                </FormControl>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </Button>
              </div>
              {field.value && (
                <div className="mt-2">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          passwordStrength.score === 0
                            ? 'bg-red-500 w-1/5'
                            : passwordStrength.score === 1
                            ? 'bg-orange-500 w-2/5'
                            : passwordStrength.score === 2
                            ? 'bg-yellow-500 w-3/5'
                            : passwordStrength.score === 3
                            ? 'bg-lime-500 w-4/5'
                            : 'bg-green-500 w-full'
                        }`}
                      />
                    </div>
                    <span className="text-xs font-medium">
                      {passwordStrength.score === 0
                        ? 'Muito fraca'
                        : passwordStrength.score === 1
                        ? 'Fraca'
                        : passwordStrength.score === 2
                        ? 'Média'
                        : passwordStrength.score === 3
                        ? 'Boa'
                        : 'Forte'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {passwordStrength.feedback}
                  </p>
                </div>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirmar senha</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Confirme sua senha" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="enable2FA"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel className="flex items-center">
                  <Shield className="w-4 h-4 mr-2 text-app-yellow" />
                  Ativar verificação em duas etapas (2FA)
                </FormLabel>
                <FormDescription>
                  Proteja sua conta com uma camada extra de segurança
                </FormDescription>
              </div>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="terms"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>
                  Concordo com os Termos de Serviço e Política de Privacidade
                </FormLabel>
              </div>
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processando...
            </>
          ) : (
            'Criar conta'
          )}
        </Button>

        <div className="mt-4 text-center">
          <p className="text-sm text-muted-foreground">
            Já tem uma conta?{' '}
            <Button variant="link" className="p-0" onClick={() => navigate('/login')}>
              Entrar
            </Button>
          </p>
        </div>
      </form>
    </Form>
  );

  // Renderizar etapa de autenticação de dois fatores
  const render2FAStep = () => (
    <TwoFactorAuth
      onVerified={handleVerified}
      onCancel={handleCancel2FA}
      email={submittedEmail}
    />
  );

  // Renderizar etapa de sucesso
  const renderSuccessStep = () => (
    <Card className="p-6 w-full max-w-md mx-auto">
      <div className="flex flex-col items-center mb-6">
        <div className="rounded-full bg-green-100 p-3 mb-4">
          <UserCheck className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Registro concluído!</h1>
        <p className="text-muted-foreground text-center">
          Sua conta foi criada com sucesso e está pronta para uso.
        </p>
      </div>

      <div className="space-y-4">
        <Button onClick={goToLogin} className="w-full">
          Ir para o login
        </Button>
      </div>
    </Card>
  );

  // Renderizar a etapa atual
  return (
    <div className="w-full max-w-md mx-auto">
      {step === 'form' && renderFormStep()}
      {step === '2fa' && render2FAStep()}
      {step === 'success' && renderSuccessStep()}
    </div>
  );
}
