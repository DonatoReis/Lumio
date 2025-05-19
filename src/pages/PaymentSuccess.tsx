
import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { usePayment } from '@/hooks/usePayment';
import { useAuth } from '@/contexts/AuthContext';

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const { verifyPayment, verifying, paymentResult } = usePayment();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [verificationAttempted, setVerificationAttempted] = useState(false);
  
  const sessionId = searchParams.get('session_id');
  
  useEffect(() => {
    // Verificar se temos um ID de sessão e se o usuário está autenticado
    if (sessionId && user && !verificationAttempted) {
      verifyPayment(sessionId);
      setVerificationAttempted(true);
    } else if (!user) {
      // Se o usuário não estiver autenticado, redirecionamos para o login
      navigate('/login', { state: { returnTo: `/payment-success?session_id=${sessionId}` } });
    }
  }, [sessionId, user, verifyPayment, navigate, verificationAttempted]);
  
  // Determinamos o status de verificação
  const isVerified = paymentResult?.paymentVerified;
  const isPending = !paymentResult && verifying;
  const hasFailed = !isVerified && !isPending && verificationAttempted;
  
  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md border border-sidebar-border">
        <CardHeader>
          <CardTitle className="text-center text-2xl">
            {isPending ? 'Verificando Pagamento...' :
             isVerified ? 'Pagamento Confirmado!' :
             'Verificação de Pagamento'}
          </CardTitle>
          <CardDescription className="text-center">
            {isPending ? 'Aguarde enquanto verificamos seu pagamento.' :
             isVerified ? 'Seu pagamento foi processado com sucesso.' :
             'Não foi possível confirmar seu pagamento.'}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="flex flex-col items-center py-6">
          {isPending && (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-16 w-16 text-app-purple animate-spin" />
              <p className="text-muted-foreground">Processando sua transação...</p>
            </div>
          )}
          
          {isVerified && (
            <div className="flex flex-col items-center gap-4">
              <CheckCircle className="h-16 w-16 text-app-green" />
              <div className="text-center space-y-2">
                <p className="font-medium">Parabéns! Seu pagamento foi confirmado.</p>
                <p className="text-muted-foreground">
                  Você agora tem acesso a todos os recursos do 
                  <span className="font-medium"> {paymentResult?.details?.planId || 'seu plano'}</span>.
                </p>
              </div>
            </div>
          )}
          
          {hasFailed && (
            <div className="flex flex-col items-center gap-4">
              <AlertCircle className="h-16 w-16 text-destructive" />
              <div className="text-center space-y-2">
                <p className="font-medium">Não foi possível verificar seu pagamento.</p>
                <p className="text-muted-foreground">
                  Por favor, entre em contato com o suporte se você acredita que isso é um erro.
                </p>
              </div>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="flex justify-center gap-4">
          <Button onClick={() => navigate('/')} variant="default">
            Ir para o Dashboard
          </Button>
          
          {hasFailed && (
            <Button 
              onClick={() => {
                setVerificationAttempted(false);
                verifyPayment(sessionId || '');
              }} 
              variant="outline"
              disabled={verifying}
            >
              {verifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : 'Tentar Novamente'}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
};

export default PaymentSuccess;
