import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpCircle, Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

interface UpgradeBannerProps {
  /**
   * Nome do plano necessário para acessar a funcionalidade
   */
  requiredPlan: string;
  
  /**
   * Mensagem personalizada a ser exibida
   * Se não fornecida, usa uma mensagem padrão
   */
  message?: string;
  
  /**
   * Texto do botão de ação
   * @default "Ver Planos"
   */
  ctaText?: string;
  
  /**
   * Caminho para a página de planos
   * @default "/pricing"
   */
  pricingPath?: string;
  
  /**
   * Classe CSS adicional para personalizar o componente
   */
  className?: string;
  
  /**
   * Se deve usar um estilo mais compacto
   * @default false
   */
  compact?: boolean;
}

/**
 * Banner que indica ao usuário que ele precisa fazer upgrade para acessar uma funcionalidade
 */
export function UpgradeBanner({
  requiredPlan,
  message,
  ctaText = "Ver Planos",
  pricingPath = "/pricing",
  className = "",
  compact = false
}: UpgradeBannerProps) {
  const defaultMessage = `Esta funcionalidade está disponível apenas no plano ${requiredPlan} ou superior.`;
  
  // Versão compacta (inline)
  if (compact) {
    return (
      <div className={`flex items-center gap-2 p-2 rounded-md bg-muted/30 ${className}`}>
        <Lock className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {message || defaultMessage}
        </p>
        <Button variant="link" size="sm" asChild>
          <Link to={pricingPath}>{ctaText}</Link>
        </Button>
      </div>
    );
  }
  
  // Versão completa (card)
  return (
    <Card className={`border-2 border-primary/20 bg-primary/5 ${className}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle>Recurso Premium</CardTitle>
        </div>
        <CardDescription>
          {message || defaultMessage}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pb-2">
        <div className="rounded-md bg-primary/10 p-3">
          <p className="text-sm font-medium">
            Faça upgrade para o plano <span className="text-primary font-bold">{requiredPlan}</span> e desbloqueie:
          </p>
          <ul className="mt-2 text-sm list-disc list-inside space-y-1 text-muted-foreground">
            <li>Acesso completo a esta funcionalidade</li>
            <li>Ferramentas avançadas de produtividade</li>
            <li>Suporte prioritário</li>
          </ul>
        </div>
      </CardContent>
      
      <CardFooter>
        <Button asChild className="w-full gap-2">
          <Link to={pricingPath}>
            <ArrowUpCircle className="h-4 w-4" /> {ctaText}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

export default UpgradeBanner;

