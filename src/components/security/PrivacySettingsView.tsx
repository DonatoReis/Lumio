import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { useConversationProtection } from '@/hooks/useConversationProtection';
import { Shield, Link2, UserPlus, Globe, RefreshCw, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

const PrivacySettingsView: React.FC = () => {
  const [isUpdating, setIsUpdating] = useState(false);
  
  const { 
    loading,
    settings,
    updateSettings,
    toggleIpProtection
  } = useConversationProtection();
  
  const handleUpdateSettings = async (newSettings: Partial<typeof settings>) => {
    try {
      setIsUpdating(true);
      await updateSettings(newSettings);
    } finally {
      setIsUpdating(false);
    }
  };
  
  const handleToggleIpProtection = async () => {
    try {
      setIsUpdating(true);
      await toggleIpProtection();
    } finally {
      setIsUpdating(false);
    }
  };
  
  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 px-4 sm:px-6">
      <div className="flex items-center space-x-2">
        <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-app-purple" />
        <h2 className="text-xl sm:text-2xl font-bold">Privacidade e Proteção</h2>
      </div>
      
      <p className="text-sm sm:text-base text-muted-foreground">
        Configure suas preferências de privacidade e proteção para mensagens e chamadas.
        Mantenha o controle total sobre suas interações e dados pessoais.
      </p>
      
      {loading && (
        <div className="flex justify-center p-4">
          <RefreshCw className="h-6 w-6 animate-spin text-app-purple" />
          <span className="ml-2 text-muted-foreground">Carregando configurações...</span>
        </div>
      )}
      
      <div className="grid gap-6">
        <Card className="p-4 sm:p-6 space-y-6">
          <h3 className="text-base sm:text-lg font-medium">Proteção de Mensagens</h3>
          
          <div className="space-y-6">
            {/* Desativar Prévia de Links */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
              <div className="space-y-0.5">
                <div className="font-medium flex items-center">
                  <Link2 className="h-4 w-4 mr-2 text-muted-foreground" />
                  Desativar prévia de links
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 ml-1 text-muted-foreground/70 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">
                          Quando ativado, links compartilhados não mostrarão pré-visualização 
                          automática do conteúdo, protegendo sua privacidade.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">
                  Links compartilhados não mostrarão prévia do conteúdo
                </div>
                {settings.disable_preview_links && (
                  <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500 mt-1">
                    Ativo
                  </Badge>
                )}
              </div>
              
              <Switch
                checked={settings.disable_preview_links}
                onCheckedChange={(checked) => handleUpdateSettings({ disable_preview_links: checked })}
                disabled={loading || isUpdating}
                className="mt-2 sm:mt-0"
              />
            </div>
            
            {/* Bloquear Remetentes Desconhecidos */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
              <div className="space-y-0.5">
                <div className="font-medium flex items-center">
                  <UserPlus className="h-4 w-4 mr-2 text-muted-foreground" />
                  Bloquear remetentes desconhecidos
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 ml-1 text-muted-foreground/70 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">
                          Bloqueia automaticamente mensagens de pessoas que não estão 
                          na sua lista de contatos após excederem o limite definido.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">
                  Bloquear mensagens de contas desconhecidas quando excederem o limite
                </div>
                {settings.block_unknown_senders && (
                  <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500 mt-1">
                    Ativo
                  </Badge>
                )}
              </div>
              
              <Switch
                checked={settings.block_unknown_senders}
                onCheckedChange={(checked) => handleUpdateSettings({ block_unknown_senders: checked })}
                disabled={loading || isUpdating}
                className="mt-2 sm:mt-0"
              />
            </div>
            
            {settings.block_unknown_senders && (
              <div className="pl-4 sm:pl-6 border-l-2 border-muted space-y-2">
                <div className="text-xs sm:text-sm font-medium">
                  Limite de mensagens de remetentes desconhecidos
                </div>
                
                <div className="flex items-center space-x-2">
                  <Slider 
                    value={[settings.block_threshold]} 
                    min={1}
                    max={50}
                    step={1}
                    onValueChange={(value) => handleUpdateSettings({ block_threshold: value[0] })}
                    disabled={loading || isUpdating}
                    className="flex-1"
                  />
                  <span className="w-8 text-center">{settings.block_threshold}</span>
                </div>
                
                <div className="text-xs text-muted-foreground">
                  Bloquear automaticamente remetentes desconhecidos após este número de mensagens
                </div>
              </div>
            )}
          </div>
        </Card>
        
        <Card className="p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-medium mb-4">Proteção de Chamadas</h3>
          
          <div className="space-y-6">
            {/* Ocultar Endereço IP */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
              <div className="space-y-0.5">
                <div className="font-medium flex items-center">
                  <Globe className="h-4 w-4 mr-2 text-muted-foreground" />
                  Ocultar endereço IP
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 ml-1 text-muted-foreground/70 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">
                          Utiliza servidores TURN para mascarar seu IP durante chamadas, 
                          aumentando sua privacidade mas podendo afetar ligeiramente a qualidade.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">
                  As chamadas serão retransmitidas usando diferentes servidores
                </div>
                {settings.hide_ip_address && (
                  <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500 mt-1">
                    Ativo
                  </Badge>
                )}
              </div>
              
              <Switch
                checked={settings.hide_ip_address}
                onCheckedChange={handleToggleIpProtection}
                disabled={loading || isUpdating}
                className="mt-2 sm:mt-0"
              />
            </div>
            
            {settings.hide_ip_address && (
              <div className="rounded-md bg-muted/30 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <RefreshCw className="h-4 sm:h-5 w-4 sm:w-5 text-green-500" />
                <div>
                  <p className="text-xs sm:text-sm font-medium">Proteção de IP ativa</p>
                  <p className="text-xs text-muted-foreground">
                    Seu endereço IP está protegido durante as chamadas
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>
        
        <Button 
          onClick={() => handleUpdateSettings(settings)} 
          disabled={loading || isUpdating}
          className="w-full sm:w-auto"
        >
          {isUpdating ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : 'Salvar todas as configurações'}
        </Button>
      </div>
    </div>
  );
};

export default PrivacySettingsView;
