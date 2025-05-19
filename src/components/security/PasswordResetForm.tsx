import React, { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { 
  Eye, 
  EyeOff, 
  AlertCircle,
  CheckCircle2, 
  Loader2 
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { sanitizeInput } from '@/utils/security';
import { supabase } from '@/integrations/supabase/client';
import { debounce } from 'lodash';
import zxcvbn from 'zxcvbn';
import { toast as sonnerToast } from 'sonner';

// Interface for password form state
interface PasswordFormState {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// Interface for validation state
interface ValidationState {
  currentPassword: boolean;
  newPassword: {
    hasMinLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSpecial: boolean;
    zxcvbnScore: number;
    isValid: boolean;
  };
  confirmPassword: boolean;
  isFormValid: boolean;
}

interface PasswordResetFormProps {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

// Function to generate a CSRF token
const generateCSRFToken = () => {
  const random = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const timestamp = new Date().getTime().toString();
  return btoa(`${random}:${timestamp}`);
};

const PasswordResetForm: React.FC<PasswordResetFormProps> = ({ 
  onSuccess, 
  onError 
}) => {
  const { user, session } = useAuth();
  const { toast } = useToast();

  // Form state
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>({
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

  // Validation state
  const [validation, setValidation] = useState<ValidationState>({
    currentPassword: false,
    newPassword: {
      hasMinLength: false,
      hasUppercase: false,
      hasLowercase: false,
      hasNumber: false,
      hasSpecial: false,
      zxcvbnScore: 0,
      isValid: false
    },
    confirmPassword: false,
    isFormValid: false
  });

  // Loading and CSRF states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [csrfToken, setCsrfToken] = useState('');

  // Generate CSRF token on component mount
  useEffect(() => {
    const token = generateCSRFToken();
    setCsrfToken(token);
  }, []);

  // Toggle password visibility
  const togglePasswordVisibility = (field: keyof typeof passwordVisibility) => {
    setPasswordVisibility(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  // Password validation function
  const validatePassword = useCallback((password: string) => {
    const hasMinLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    
    // Get zxcvbn score
    const zxcvbnResult = zxcvbn(password);
    const zxcvbnScore = zxcvbnResult.score; // 0-4 where 4 is strongest
    
    const isValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial && zxcvbnScore >= 3;
    
    return {
      hasMinLength,
      hasUppercase,
      hasLowercase,
      hasNumber,
      hasSpecial,
      zxcvbnScore,
      isValid
    };
  }, []);

  // Debounced validation function to prevent excessive re-renders
  const debouncedValidate = useCallback(
    debounce((form: PasswordFormState) => {
      const newPasswordValidation = validatePassword(form.newPassword);
      const confirmPasswordValid = form.newPassword === form.confirmPassword && form.confirmPassword.length > 0;
      const currentPasswordValid = form.currentPassword.length > 0;
      
      setValidation({
        currentPassword: currentPasswordValid,
        newPassword: newPasswordValidation,
        confirmPassword: confirmPasswordValid,
        isFormValid: currentPasswordValid && newPasswordValidation.isValid && confirmPasswordValid
      });
    }, 300),
    [validatePassword]
  );

  // Update form values and trigger validation
  const handlePasswordInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    
    // Sanitize input to prevent XSS
    const sanitizedValue = sanitizeInput(value);
    
    setPasswordForm(prev => {
      const updatedForm = {
        ...prev,
        [id]: sanitizedValue
      };
      
      // Trigger validation
      debouncedValidate(updatedForm);
      
      return updatedForm;
    });
  };

  // Check if the password form is valid for submission
  const isPasswordFormValid = () => {
    return validation.isFormValid;
  };

  // Get color for password strength meter
  const getStrengthColor = (score: number) => {
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
  const getStrengthText = (score: number) => {
    switch (score) {
      case 0: return 'Muito fraca';
      case 1: return 'Fraca';
      case 2: return 'Média';
      case 3: return 'Boa';
      case 4: return 'Forte';
      default: return 'Indeterminada';
    }
  };

  // Handle password change submission
  const handlePasswordChange = async () => {
    try {
      if (!validation.isFormValid) {
        toast({
          variant: "destructive",
          title: "Formulário inválido",
          description: "Por favor, preencha todos os campos corretamente."
        });
        return;
      }

      setIsSubmitting(true);

      // Call the Supabase Edge Function for password reset
      const { data, error } = await supabase.functions.invoke('reset-password', {
        body: {
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
          confirmPassword: passwordForm.confirmPassword,
          userId: user?.id // Include the user ID for additional verification
        },
        headers: {
          'x-csrf-token': csrfToken,
          'Authorization': `Bearer ${session?.access_token}`
        }
      });
      
      if (error) throw new Error(error.message || 'Falha ao processar a solicitação');
      if (!data.success) throw new Error(data.message || 'Erro ao alterar a senha');
      
      // Reset form
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
      // Generate new CSRF token
      const newToken = generateCSRFToken();
      setCsrfToken(newToken);
      
      toast({
        title: "Senha alterada com sucesso",
        description: "Sua nova senha foi configurada. Todas as suas sessões foram encerradas."
      });
      
      // Also show a Sonner toast notification
      sonnerToast.success("Senha alterada com sucesso", {
        description: "Sua nova senha foi configurada com segurança e todas as suas sessões foram encerradas.",
        duration: 5000,
      });

      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('Erro ao alterar senha:', error);
      
      // More specific error handling based on error types
      let errorMessage = "Ocorreu um erro ao tentar alterar sua senha.";
      let errorTitle = "Erro ao alterar senha";
      
      // Check for unauthorized error
      const status = error.status || (error.response && error.response.status);
      if (status === 401) {
        errorMessage = "Sua sessão expirou ou você não tem permissão para realizar esta operação.";
        errorTitle = "Erro de autenticação";
        
        // Generate new CSRF token in case of authentication issues
        const newToken = generateCSRFToken();
        setCsrfToken(newToken);
      } else if (error.message) {
        errorMessage = error.message;
      } else if (error.error_description) {
        errorMessage = error.error_description;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      toast({
        variant: "destructive",
        title: errorTitle,
        description: errorMessage
      });
      
      // Also show a Sonner toast notification
      sonnerToast.error(errorTitle, {
        description: errorMessage,
        duration: 5000,
      });

      // Call onError callback if provided
      if (onError) {
        onError(error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Current Password */}
      <div className="space-y-2">
          <Label htmlFor="currentPassword">Senha Atual</Label>
          <div className="relative">
            <Input
              id="currentPassword"
              type={passwordVisibility.currentPassword ? "text" : "password"}
            placeholder="••••••••"
            className="bg-app-border/30 pr-10"
            value={passwordForm.currentPassword}
            onChange={handlePasswordInputChange}
            autoComplete="current-password"
            disabled={isSubmitting}
            aria-invalid={!validation.currentPassword && passwordForm.currentPassword.length > 0}
          />
          <button 
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            onClick={() => togglePasswordVisibility('currentPassword')}
            disabled={isSubmitting}
          >
            {passwordVisibility.currentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {passwordForm.currentPassword.length > 0 && !validation.currentPassword && (
          <div className="text-red-400 text-xs flex items-center mt-1">
            <AlertCircle className="h-3 w-3 mr-1" />
            A senha atual é obrigatória
          </div>
        )}
      </div>
      
      {/* New Password */}
      <div className="space-y-2">
          <Label htmlFor="newPassword">Nova Senha</Label>
          <div className="relative">
            <Input
              id="newPassword"
              type={passwordVisibility.newPassword ? "text" : "password"}
            placeholder="••••••••"
            className="bg-app-border/30 pr-10"
            value={passwordForm.newPassword}
            onChange={handlePasswordInputChange}
            autoComplete="new-password"
            disabled={isSubmitting}
            aria-invalid={passwordForm.newPassword.length > 0 && !validation.newPassword.isValid}
          />
          <button 
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            onClick={() => togglePasswordVisibility('newPassword')}
            disabled={isSubmitting}
          >
            {passwordVisibility.newPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        
        {/* Password strength meter */}
        {passwordForm.newPassword.length > 0 && (
          <div className="space-y-1 mt-1">
            <div className="flex justify-between items-center text-xs">
              <span>Força da Senha:</span>
              <span className="font-medium">{getStrengthText(validation.newPassword.zxcvbnScore)}</span>
            </div>
            <div className="h-1.5 w-full bg-gray-700 rounded-full overflow-hidden">
              <div 
                className={`h-full ${getStrengthColor(validation.newPassword.zxcvbnScore)}`} 
                style={{ width: `${(validation.newPassword.zxcvbnScore + 1) * 20}%` }}
              ></div>
            </div>
            
            {/* Password requirements checklist */}
            <div className="mt-2 space-y-1">
              <div className="text-xs flex items-center">
                {validation.newPassword.hasMinLength ? 
                  <CheckCircle2 className="h-3 w-3 mr-1 text-green-400" /> : 
                  <AlertCircle className="h-3 w-3 mr-1 text-amber-400" />}
                Mínimo de 8 caracteres
              </div>
              <div className="text-xs flex items-center">
                {validation.newPassword.hasUppercase ? 
                  <CheckCircle2 className="h-3 w-3 mr-1 text-green-400" /> : 
                  <AlertCircle className="h-3 w-3 mr-1 text-amber-400" />}
                Pelo menos uma letra maiúscula (A-Z)
              </div>
              <div className="text-xs flex items-center">
                {validation.newPassword.hasLowercase ? 
                  <CheckCircle2 className="h-3 w-3 mr-1 text-green-400" /> : 
                  <AlertCircle className="h-3 w-3 mr-1 text-amber-400" />}
                Pelo menos uma letra minúscula (a-z)
              </div>
              <div className="text-xs flex items-center">
                {validation.newPassword.hasNumber ? 
                  <CheckCircle2 className="h-3 w-3 mr-1 text-green-400" /> : 
                  <AlertCircle className="h-3 w-3 mr-1 text-amber-400" />}
                Pelo menos um número (0-9)
              </div>
              <div className="text-xs flex items-center">
                {validation.newPassword.hasSpecial ? 
                  <CheckCircle2 className="h-3 w-3 mr-1 text-green-400" /> : 
                  <AlertCircle className="h-3 w-3 mr-1 text-amber-400" />}
                Pelo menos um caractere especial (!@#$%...)
              </div>
              <div className="text-xs flex items-center">
                {validation.newPassword.zxcvbnScore >= 3 ? 
                  <CheckCircle2 className="h-3 w-3 mr-1 text-green-400" /> : 
                  <AlertCircle className="h-3 w-3 mr-1 text-amber-400" />}
                Nível de segurança suficiente
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Confirm Password */}
      <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={passwordVisibility.confirmPassword ? "text" : "password"}
            placeholder="••••••••"
            className="bg-app-border/30 pr-10"
            value={passwordForm.confirmPassword}
            onChange={handlePasswordInputChange}
            autoComplete="new-password"
            disabled={isSubmitting}
            aria-invalid={passwordForm.confirmPassword.length > 0 && !validation.confirmPassword}
          />
          <button 
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            onClick={() => togglePasswordVisibility('confirmPassword')}
            disabled={isSubmitting}
          >
            {passwordVisibility.confirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {passwordForm.confirmPassword.length > 0 && !validation.confirmPassword && (
          <div className="text-red-400 text-xs flex items-center mt-1">
            <AlertCircle className="h-3 w-3 mr-1" />
            As senhas não correspondem
          </div>
        )}
      </div>
      
      {/* Submit Button */}
      <div className="flex justify-end pt-2">
        <Button 
          onClick={handlePasswordChange} 
          disabled={!isPasswordFormValid() || isSubmitting}
          className="min-w-[150px]"
        >
          {isSubmitting ? (
            <div className="flex items-center space-x-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Processando...</span>
            </div>
          ) : (
            "Alterar Senha"
          )}
        </Button>
      </div>
    </div>
  );
};

export default PasswordResetForm;

