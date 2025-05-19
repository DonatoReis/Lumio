import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Database } from '@/types/supabase';

// Define a dedicated type for payment history row
export type PaymentHistoryRow = Database['public']['Tables']['payment_history']['Row'];

interface PaymentHistoryProps {
  limit?: number;
  showTitle?: boolean;
}

/**
 * Componente para exibir o histórico de pagamentos do usuário
 */
const PaymentHistory: React.FC<PaymentHistoryProps> = ({
  limit = 10,
  showTitle = true
}) => {
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Formato de moeda
  const formatCurrency = (amount: number, currency: string = 'BRL') => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  // Formatar status de pagamento
  const formatStatus = (status: string) => {
    switch (status) {
      case 'succeeded':
        return { label: 'Confirmado', color: 'success' as const };
      case 'pending':
        return { label: 'Pendente', color: 'warning' as const };
      case 'failed':
        return { label: 'Falhou', color: 'destructive' as const };
      case 'refunded':
        return { label: 'Reembolsado', color: 'default' as const };
      default:
        return { label: status, color: 'default' as const };
    }
  };

  // Buscar histórico de pagamentos
  const fetchPaymentHistory = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const { data: paymentData, error: fetchError } = await supabase
        .from('payment_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (fetchError) {
        console.error('Erro ao buscar histórico de pagamentos:', fetchError);
        setError('Não foi possível carregar o histórico de pagamentos.');
        setPayments([]);
      } else {
        const typedPaymentData: PaymentHistoryRow[] | null = paymentData;
        setPayments(typedPaymentData || []);
      }
    } catch (err: any) {
      console.error('Erro ao buscar histórico de pagamentos:', err);
      setError('Não foi possível carregar o histórico de pagamentos.');
      setPayments([]);

      toast({
        title: 'Erro',
        description: 'Não foi possível carregar seu histórico de pagamentos.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Carregar dados ao montar o componente
  useEffect(() => {
    fetchPaymentHistory();
  }, [user]);

  // Abrir fatura em nova aba
  const openInvoice = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <Card>
      <CardHeader>
        {showTitle && (
          <>
            <CardTitle className="flex justify-between items-center">
              <span>Histórico de Pagamentos</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={fetchPaymentHistory}
                disabled={loading}
                title="Atualizar"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </CardTitle>
            <CardDescription>
              Histórico de faturas e pagamentos da sua conta
            </CardDescription>
          </>
        )}
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Carregando histórico de pagamentos...</p>
          </div>
        ) : error ? (
          <div className="text-center py-6">
            <p className="text-destructive">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={fetchPaymentHistory}
            >
              Tentar novamente
            </Button>
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-muted-foreground">Nenhum pagamento encontrado.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>
                    {format(new Date(payment.created_at), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell>{payment.description}</TableCell>
                  <TableCell>{formatCurrency(payment.amount, payment.currency)}</TableCell>
                  <TableCell>
                    <Badge variant={formatStatus(payment.status).color}>
                      {formatStatus(payment.status).label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {payment.invoice_url && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openInvoice(payment.invoice_url!)}
                          title="Ver fatura online"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                      {payment.invoice_pdf_url && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openInvoice(payment.invoice_pdf_url!)}
                          title="Download PDF da fatura"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            {payments.length > 0 && (
              <TableCaption>
                Mostrando {payments.length} transações. {payments.length === limit ? 'Mais transações podem estar disponíveis.' : ''}
              </TableCaption>
            )}
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default PaymentHistory;
