import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { GlowEffectCard } from './GlowEffectCard';

interface ProPlanCardProps {
  plan: {
    id: string;
    name: string;
  };
  isCurrent: boolean;
  price: string;
  description: string;
  annualMonthlyPrice?: string;
  billingInterval: 'monthly' | 'yearly';
  loading: boolean;
  children: React.ReactNode;
  onSelectPlan: () => void;
}

export const ProPlanCard: React.FC<ProPlanCardProps> = ({
  plan,
  isCurrent,
  price,
  description,
  annualMonthlyPrice,
  billingInterval,
  loading,
  children,
  onSelectPlan
}) => {
  return (
    <GlowEffectCard>
      <Card 
        className="w-full relative overflow-hidden transition-all duration-300 hover:scale-105
          min-h-[600px] flex flex-col
          bg-transparent border-none text-white z-10"
      >
        {isCurrent && (
          <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-xs transform translate-x-2 -translate-y-0 rotate-45 origin-bottom-left shadow-sm">
            Seu plano
          </div>
        )}
        
        {!isCurrent && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-gradient-to-r from-yellow-500 to-pink-500 hover:from-yellow-600 hover:to-pink-600 text-white border-none px-3 py-1">
              Mais Popular
            </Badge>
          </div>
        )}
        
        <CardHeader className="relative z-10 bg-transparent">
          <CardTitle className="text-xl text-[#f1f1f1] font-bold">{plan.name}</CardTitle>
          <CardDescription className="text-white/80">
            {description} <span className="animate-pulse ml-1">|</span>
          </CardDescription>
          <div className="mt-4">
            <span className="text-3xl font-bold text-white">
              R$ {price}
            </span>
            <span className="text-gray-300">
              {price === "0,00" ? '' : `/${billingInterval === 'monthly' ? 'mês' : 'ano'}`}
            </span>
            {annualMonthlyPrice && (
              <div className="text-sm text-muted-foreground mt-1">
                {annualMonthlyPrice}/mês
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4 flex-grow relative z-10 bg-transparent">
          <div className="space-y-1">
            {children}
          </div>
        </CardContent>
        
        <CardFooter className="mt-auto relative z-10 bg-transparent">
          <Button 
            className="w-full transition-all duration-300 cursor-pointer 
              bg-[rgb(245,212,150)] hover:bg-[rgb(223,142,73)] text-black font-medium"
            disabled={loading || isCurrent}
            onClick={onSelectPlan}
            aria-label={`Selecionar plano ${plan.name}`}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                {isCurrent ? "Plano Atual" : "Adquirir Pro"}
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2">
                  <path d="M5 12h14"></path>
                  <path d="m12 5 7 7-7 7"></path>
                </svg>
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </GlowEffectCard>
  );
};
