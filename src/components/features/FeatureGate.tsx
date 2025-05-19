import React from 'react';
import { useFeature } from '@/store/useFeaturesStore';
import { Skeleton } from '@/components/ui/skeleton';

interface FeatureGateProps {
  /**
   * A chave da feature que será verificada
   */
  featureKey: string;
  
  /**
   * Componente ou elemento a ser renderizado se o usuário não tiver acesso
   * Se não for fornecido, nada será renderizado
   */
  fallback?: React.ReactNode;
  
  /**
   * Conteúdo a ser renderizado se o usuário tiver acesso
   */
  children: React.ReactNode;
  
  /**
   * Se true, mostra um loader enquanto verifica o acesso
   * @default true
   */
  showLoader?: boolean;
}

/**
 * Componente que condiciona a renderização do conteúdo baseado
 * nas permissões do usuário para acessar uma feature específica.
 */
export function FeatureGate({ 
  featureKey, 
  fallback, 
  children,
  showLoader = true
}: FeatureGateProps) {
  const { hasAccess, isLoading } = useFeature(featureKey);
  
  // Mostrar loader durante a verificação de permissões
  if (isLoading && showLoader) {
    return (
      <div className="w-full space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }
  
  // Se tem acesso, renderiza o conteúdo principal
  if (hasAccess) {
    return <>{children}</>;
  }
  
  // Se não tem acesso e há fallback, renderiza o fallback
  if (fallback) {
    return <>{fallback}</>;
  }
  
  // Caso não tenha acesso e não haja fallback, não renderiza nada
  return null;
}

export default FeatureGate;

