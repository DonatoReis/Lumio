
import React, { useState } from 'react';
import { useConversationProtection } from '@/hooks/useConversationProtection';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import { ShieldCheck, AlertTriangle } from 'lucide-react';

const SecureChat: React.FC = () => {
  const { settings, updateSettings, loading } = useConversationProtection();
  const [showDialog, setShowDialog] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6 flex items-center">
        <ShieldCheck className="mr-2 text-green-500" />
        Proteção de Mensagens
      </h1>

      <div className="space-y-6">
        <div className="bg-card p-4 rounded-lg border">
          <h2 className="font-semibold mb-3">Configurações de Proteção</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Bloquear remetentes desconhecidos</p>
                <p className="text-sm text-muted-foreground">Bloqueie mensagens de pessoas com quem você nunca conversou antes</p>
              </div>
              <Button 
                variant={settings.block_unknown_senders ? "default" : "outline"}
                disabled={loading}
                onClick={() => updateSettings({ block_unknown_senders: !settings.block_unknown_senders })}
              >
                {settings.block_unknown_senders ? "Ativado" : "Desativado"}
              </Button>
            </div>

            {settings.block_unknown_senders && (
              <div className="ml-6 border-l-2 pl-4 border-muted">
                <p className="text-sm mb-2">Limite de mensagens antes de bloquear</p>
                <div className="flex items-center space-x-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    disabled={settings.block_threshold <= 5 || loading}
                    onClick={() => updateSettings({ block_threshold: settings.block_threshold - 5 })}
                  >
                    -5
                  </Button>
                  <span className="font-medium">{settings.block_threshold}</span>
                  <Button 
                    size="sm" 
                    variant="outline"
                    disabled={settings.block_threshold >= 50 || loading}
                    onClick={() => updateSettings({ block_threshold: settings.block_threshold + 5 })}
                  >
                    +5
                  </Button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between border-t pt-4">
              <div>
                <p className="font-medium">Desativar pré-visualização de links</p>
                <p className="text-sm text-muted-foreground">Links serão exibidos como texto, sem pré-visualização</p>
              </div>
              <Button 
                variant={settings.disable_preview_links ? "default" : "outline"}
                disabled={loading}
                onClick={() => updateSettings({ disable_preview_links: !settings.disable_preview_links })}
              >
                {settings.disable_preview_links ? "Ativado" : "Desativado"}
              </Button>
            </div>

            <div className="flex items-center justify-between border-t pt-4">
              <div>
                <p className="font-medium">Proteção de endereço IP</p>
                <p className="text-sm text-muted-foreground">Esconda seu endereço IP durante ligações de vídeo e áudio</p>
              </div>
              <Button 
                variant={settings.hide_ip_address ? "default" : "outline"}
                disabled={loading}
                onClick={() => setShowDialog(true)}
              >
                {settings.hide_ip_address ? "Ativado" : "Desativado"}
              </Button>
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mr-2 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-800 dark:text-yellow-300">Sobre links suspeitos</h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                Links de encurtadores como bit.ly, tinyurl e outros similares são automaticamente bloqueados para sua proteção.
                Peça para o remetente enviar o link original completo.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Diálogo de confirmação para proteção de IP */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Proteção de endereço IP</DialogTitle>
            <DialogDescription>
              {settings.hide_ip_address 
                ? "Desativar a proteção de IP vai melhorar a qualidade das chamadas mas seu endereço poderá ser exposto."
                : "Ativar a proteção de IP pode reduzir a qualidade das chamadas, mas aumenta sua privacidade."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={async () => {
              await updateSettings({ hide_ip_address: !settings.hide_ip_address });
              setShowDialog(false);
            }}>
              {settings.hide_ip_address ? "Desativar" : "Ativar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Diálogo de alerta para mensagem bloqueada */}
      <AlertDialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mensagem bloqueada</AlertDialogTitle>
            <AlertDialogDescription>
              Esta mensagem foi bloqueada pela sua configuração de segurança.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => setShowBlockDialog(false)}>Entendi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SecureChat;
