
import { useState } from "react";
import { useAuthMFA } from "@/hooks/useAuthMFA";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Shield, Smartphone } from "lucide-react";

interface TwoFactorAuthProps {
  onVerified: () => void;
  onCancel: () => void;
  email: string;
}

/**
 * Componente de autenticação em duas etapas (2FA)
 * Oferece verificação via SMS ou biometria
 */
export function TwoFactorAuth({ onVerified, onCancel, email }: TwoFactorAuthProps) {
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [method, setMethod] = useState<"sms">("sms");
  
  const {
    loading,
    otpSent,
    sendVerificationCode,
    verifyOTPCode,
    setOtpSent // Certifique-se de que esta função está sendo desestruturada aqui
  } = useAuthMFA();

  const handleSendCode = async () => {
    if (phone.trim()) {
      await sendVerificationCode(phone);
    }
  };

  const handleVerifyCode = async () => {
    if (otpCode.trim()) {
      const success = await verifyOTPCode(otpCode);
      if (success) {
        onVerified();
      }
    }
  };


  return (
    <Card className="p-6 w-full max-w-md mx-auto">
      <div className="flex flex-col items-center mb-6">
        <Shield className="h-12 w-12 text-app-yellow mb-2" />
        <h1 className="text-2xl font-bold mb-1">Verificação em duas etapas</h1>
        <p className="text-muted-foreground text-center">
          Precisamos verificar sua identidade para continuar
        </p>
        <div className="bg-muted/50 text-sm rounded-md px-3 py-1 mt-2">
          {email}
        </div>
      </div>

      <Tabs 
        value={method} 
        onValueChange={(v) => setMethod(v as "sms")} 
        className="w-full"
      >
        <TabsList className="grid grid-cols-1 mb-6">
          <TabsTrigger value="sms" className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" /> SMS
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sms" className="space-y-4">
          {!otpSent ? (
            <>
              <div className="space-y-2">
                <label htmlFor="phone" className="text-sm font-medium block">
                  Número de telefone
                </label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+55 (11) 98765-4321"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Enviaremos um código de verificação para este número
                </p>
              </div>
              
              <Button 
                onClick={handleSendCode} 
                disabled={loading || !phone.trim()} 
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Enviar código'
                )}
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <label htmlFor="otp" className="text-sm font-medium block">
                  Código de verificação
                </label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="123456"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Digite o código de 6 dígitos enviado para seu telefone
                </p>
              </div>
              
              <Button 
                onClick={handleVerifyCode} 
                disabled={loading || otpCode.length < 6} 
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  'Verificar código'
                )}
              </Button>
              
              <Button
                variant="link"
                onClick={() => setOtpSent(false)}
                className="w-full"
                disabled={loading}
              >
                Voltar e alterar número
              </Button>
            </>
          )}
        </TabsContent>

      </Tabs>

      <div className="mt-6 pt-4 border-t">
        <Button
          variant="ghost"
          onClick={onCancel}
          className="w-full"
          disabled={loading}
        >
          Cancelar
        </Button>
      </div>
    </Card>
  );
}
