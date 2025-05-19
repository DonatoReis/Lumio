
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  registerDeviceFingerprint, 
  verifyDeviceFingerprint
} from '@/utils/security';

/**
 * Hook para autenticação multi-fator (2FA)
 * Gerencia todo processo de verificação em duas etapas
 */
export const useAuthMFA = () => {
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const { toast } = useToast();

  /**
   * Envia código de verificação via SMS
   * @param phone Número de telefone para enviar o código
   */
  const sendVerificationCode = async (phone: string) => {
    try {
      setLoading(true);
      setPhoneNumber(phone);
      
      // Simulação de envio de OTP (em produção, usaria o serviço da Supabase ou Twilio)
      // Normalmente isso seria feito com uma edge function Supabase
      
      // Em um cenário real, chamaríamos a API:
      /*
      const { error } = await supabase.functions.invoke('send-otp', {
        body: { phone }
      });
      
      if (error) throw error;
      */
      
      // Para demonstração, simulamos uma espera e sucesso
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setOtpSent(true);
      toast({
        title: "Código enviado",
        description: `Um código de verificação foi enviado para ${phone}`,
      });
      
      return true;
    } catch (error: any) {
      console.error('Erro ao enviar código de verificação:', error);
      toast({
        variant: "destructive",
        title: "Erro ao enviar código",
        description: error.message || "Não foi possível enviar o código de verificação",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Verifica o código OTP recebido via SMS
   * @param code Código de verificação
   */
  const verifyOTPCode = async (code: string) => {
    try {
      setLoading(true);
      
      // Simulação de verificação de OTP (em produção, validaria contra Supabase ou Twilio)
      // Normalmente isso seria feito com uma edge function Supabase
      
      // Em um cenário real:
      /*
      const { data, error } = await supabase.functions.invoke('verify-otp', {
        body: { phone: phoneNumber, code }
      });
      
      if (error) throw error;
      */
      
      // Para demonstração, simulamos uma espera e verificamos se código é "123456"
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (code === "123456") {
        setPhoneVerified(true);
        toast({
          title: "Verificação concluída",
          description: "Seu número de telefone foi verificado com sucesso",
        });
        return true;
      } else {
        throw new Error("Código inválido");
      }
      
    } catch (error: any) {
      console.error('Erro ao verificar código:', error);
      toast({
        variant: "destructive",
        title: "Código inválido",
        description: error.message || "O código informado não é válido",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };
  

  /**
   * Ativa 2FA para a conta do usuário
   */
  const enableTwoFactor = async (phoneNumber: string) => {
    try {
      setLoading(true);
      
      // Em produção, esta função atualizaria os flags de 2FA no banco de dados
      // Para demonstração, simulamos uma ativação bem-sucedida
      
      const success = await sendVerificationCode(phoneNumber);
      
      if (success) {
        toast({
          title: "2FA ativado com sucesso",
          description: "A verificação em duas etapas foi habilitada para sua conta",
        });
      }
      
      return success;
    } catch (error: any) {
      console.error('Erro ao ativar 2FA:', error);
      toast({
        variant: "destructive",
        title: "Erro ao ativar 2FA",
        description: error.message || "Não foi possível ativar a verificação em duas etapas",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Desativa 2FA para a conta do usuário
   */
  const disableTwoFactor = async () => {
    try {
      setLoading(true);
      
      // Em produção, removeria as flags de 2FA no banco de dados
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setPhoneVerified(false);
      setOtpSent(false);
      setPhoneNumber('');
      
      toast({
        title: "2FA desativado",
        description: "A verificação em duas etapas foi desabilitada para sua conta",
      });
      
      return true;
    } catch (error: any) {
      console.error('Erro ao desativar 2FA:', error);
      toast({
        variant: "destructive",
        title: "Erro ao desativar 2FA",
        description: error.message || "Não foi possível desativar a verificação em duas etapas",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Verifica se o dispositivo atual está registrado como confiável
   */
  const isDeviceTrusted = () => {
    return verifyDeviceFingerprint();
  };

  return {
    loading,
    otpSent,
    phoneVerified,
    phoneNumber,
    isDeviceTrusted: verifyDeviceFingerprint,
    sendVerificationCode,
    verifyOTPCode,
    enableTwoFactor,
    disableTwoFactor,
    setOtpSent // Exportando essa função para permitir que o componente possa alterá-la
  };
};
