
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import Logo from '@/components/ui/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';

const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { signIn, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Verificar se há mensagem de registro bem-sucedido
    if (location.state?.registrationSuccess) {
      setSuccess('Registro bem-sucedido! Faça login para continuar.');
    }
  }, [location.state]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await signIn(email, password);
      navigate('/');
    } catch (err) {
      // O erro já é tratado no contexto de autenticação
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 space-y-8">
      <div className="text-center">
        <Logo size="lg" className="mx-auto" />
        <h1 className="mt-6 text-2xl font-semibold text-app-white">
          Login na Plataforma
        </h1>
        <p className="mt-2 text-sm text-app-white/70">
          Acesse sua conta para conectar-se com outras empresas
        </p>
      </div>

      <div className="p-6 bg-app-black rounded-lg shadow-lg border border-sidebar-border">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {success && (
            <Alert>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="nome@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-muted"
              required
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="password">Senha</Label>
              <a 
                href="/forgot-password" 
                className="text-xs text-app-purple hover:text-app-blue transition-colors"
              >
                Esqueceu a senha?
              </a>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-muted pr-10"
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="remember"
              checked={remember}
              onCheckedChange={(checked) => setRemember(checked as boolean)}
            />
            <Label htmlFor="remember" className="text-sm font-normal">
              Lembrar-me neste dispositivo
            </Label>
          </div>
          
          <Button
            type="submit"
            disabled={loading}
            className="w-full app-button-primary"
          >
            {loading ? 'Entrando...' : 'Entrar na Plataforma'}
          </Button>
          
          <div className="flex items-center justify-center text-xs text-app-white/70">
            <ShieldCheck size={14} className="mr-1 text-app-green" />
            <span>Conexão segura com criptografia de ponta a ponta</span>
          </div>
        </form>
        
        <div className="mt-6 text-center text-sm">
          <span className="text-app-white/70">Não tem uma conta? </span>
          <a href="/register" className="text-app-purple hover:text-app-blue transition-colors font-medium">
            Registre sua empresa
          </a>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
