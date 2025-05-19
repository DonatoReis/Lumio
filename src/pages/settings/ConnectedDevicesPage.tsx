import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ConnectedDevice } from '@/contexts/AuthContext';
import { 
  AlertCircle, 
  Clock, 
  Shield, 
  Laptop, 
  Smartphone, 
  Monitor, 
  Tablet, 
  LogOut, 
  MapPin, 
  Info, 
  CheckCircle2,
  Loader2,
  HelpCircle,
  Ban,
  Globe
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Formata timestamps para exibição amigável
 */
const formatTimeAgo = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
  } catch (error) {
    console.error('Erro ao formatar data:', error);
    return 'Data desconhecida';
  }
};

/**
 * Estado para as notificações de segurança
 */
const useSecurityNotifications = () => {
  const [securityNotifications, setSecurityNotifications] = useState(true);
  
  const toggleSecurityNotifications = (checked: boolean) => {
    setSecurityNotifications(checked);
    // Aqui você pode adicionar a lógica para salvar esta configuração no backend
  };
  
  return { securityNotifications, toggleSecurityNotifications };
};

/**
 * Componente para exibição de um dispositivo conectado
 */
const DeviceCard = ({ 
  device, 
  onRevoke 
}: { 
  device: ConnectedDevice; 
  onRevoke: (deviceId: string) => void;
}) => {
  // Determinar ícone com base no tipo de dispositivo
  const getDeviceIcon = () => {
    const deviceNameLower = device.device_name.toLowerCase();
    
    if (deviceNameLower.includes('iphone') || 
        deviceNameLower.includes('android') || 
        deviceNameLower.includes('celular') ||
        deviceNameLower.includes('mobile')) {
      return <Smartphone className="w-10 h-10 text-app-purple" />;
    } else if (deviceNameLower.includes('ipad') || 
              deviceNameLower.includes('tablet')) {
      return <Tablet className="w-10 h-10 text-app-purple" />;
    } else if (deviceNameLower.includes('tv') || 
              deviceNameLower.includes('smart tv')) {
      return <Monitor className="w-10 h-10 text-app-purple" />;
    } else {
      return <Laptop className="w-10 h-10 text-app-purple" />;
    }
  };

  return (
    <Card className={`mb-4 ${device.is_current_device ? 'border-app-purple bg-app-black' : 'bg-muted/5'}`}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            {getDeviceIcon()}
            <div>
              <CardTitle className="text-lg">
                {device.device_name}
                 {device.is_current_device && (
                   <Badge className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent ml-2 bg-app-green text-black hover:bg-app-green" >
                     Dispositivo atual
                   </Badge>
                 )}
              </CardTitle>
              <CardDescription>
                <div className="flex items-center mt-1">
                  <Clock className="mr-1 h-3 w-3" />
                  <span>Ativo {formatTimeAgo(device.last_active)}</span>
                </div>
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-500 hover:text-red-700 hover:bg-red-100/10"
            onClick={() => onRevoke(device.device_id)}
            disabled={device.is_current_device}
            title={device.is_current_device ? "Não é possível revogar o dispositivo atual" : "Revogar acesso"}
          >
            <LogOut className="h-4 w-4 mr-1" />
            Revogar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground mb-1">Sistema Operacional</p>
            <p className="font-medium">{device.os || 'Desconhecido'}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-1">Navegador</p>
            <p className="font-medium">{device.browser || 'Desconhecido'}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-1">Localização</p>
            <div className="flex items-center">
              {device.location === 'Localização indisponível' ? (
                <>
                  <Ban className="h-3.5 w-3.5 mr-1 text-gray-400" />
                  <p className="text-gray-400 italic text-sm">
                    Localização não disponível
                    <HelpCircle className="h-3 w-3 ml-1 inline-block cursor-help" 
                      aria-label="A informação de localização pode estar indisponível devido a ferramentas de privacidade do navegador" />
                  </p>
                </>
              ) : (
                <>
                  <MapPin className="h-3.5 w-3.5 mr-1 text-app-blue" />
                  <p className="font-medium">{device.location || 'Localização desconhecida'}</p>
                </>
              )}
            </div>
          </div>
          <div>
            <p className="text-muted-foreground mb-1">Endereço IP</p>
            {device.ip_address === 'IP indisponível' ? (
              <div className="flex items-center">
                <Ban className="h-3.5 w-3.5 mr-1 text-gray-400" />
                <p className="text-gray-400 italic text-sm">
                  IP não disponível
                </p>
              </div>
            ) : (
              <div className="flex items-center">
                <Globe className="h-3.5 w-3.5 mr-1 text-app-blue" />
                <p className="font-medium font-mono text-xs break-all">{device.ip_address || 'Desconhecido'}</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
      {device.is_current_device && (
        <CardFooter className="pt-0 pb-4">
          <Alert className="bg-app-purple/10 border-app-purple">
            <Shield className="h-4 w-4 text-app-purple" />
            <AlertTitle className="text-xs ml-2">
              Este é seu dispositivo atual
            </AlertTitle>
            <AlertDescription className="text-xs ml-2">
              Para revogar o acesso deste dispositivo, faça logout e exclua o dispositivo a partir de outro dispositivo.
            </AlertDescription>
          </Alert>
        </CardFooter>
      )}
    </Card>
  );
};

/**
 * Componente de página principal para exibição de dispositivos conectados
 */
export const ConnectedDevicesPage = () => {
  const { getUserDevices, revokeDeviceAccess, signOut } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<ConnectedDevice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deviceToRevoke, setDeviceToRevoke] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);
  const { securityNotifications, toggleSecurityNotifications } = useSecurityNotifications();

  // Carregar dispositivos ao iniciar
  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await getUserDevices();
      
      if (result.error) {
        setError('Não foi possível carregar os dispositivos conectados.');
        console.error('Erro ao carregar dispositivos:', result.error);
      } else {
        setDevices(result.devices);
      }
    } catch (err) {
      console.error('Exceção ao carregar dispositivos:', err);
      setError('Ocorreu um erro ao carregar seus dispositivos.');
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = (deviceId: string) => {
    setDeviceToRevoke(deviceId);
  };

  const confirmRevoke = async () => {
    if (!deviceToRevoke) return;
    
    try {
      setRevoking(true);
      
      const result = await revokeDeviceAccess(deviceToRevoke);
      
      if (result.success) {
        // Filtrar o dispositivo revogado da lista
        if (devices) {
          setDevices(devices.filter(d => d.device_id !== deviceToRevoke));
        }
        
        toast({
          title: "Acesso revogado",
          description: "O dispositivo não poderá mais acessar sua conta",
          variant: "default",
        });
      } else {
        toast({
          title: "Erro ao revogar acesso",
          description: "Não foi possível revogar o acesso deste dispositivo",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error('Erro ao revogar dispositivo:', err);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao revogar o acesso do dispositivo",
        variant: "destructive",
      });
    } finally {
      setRevoking(false);
      setDeviceToRevoke(null);
    }
  };

  const cancelRevoke = () => {
    setDeviceToRevoke(null);
  };

  const handleSignOutAllDevices = async () => {
    try {
      setLoading(true);
      // Get all devices
      const result = await getUserDevices();
      
      if (result.error) {
        toast({
          title: "Erro",
          description: "Não foi possível obter a lista de dispositivos",
          variant: "destructive",
        });
        return;
      }
      
      // Revoke access for all non-current devices
      if (result.devices && result.devices.length > 0) {
        const nonCurrentDevices = result.devices.filter(d => !d.is_current_device);
        
        for (const device of nonCurrentDevices) {
          await revokeDeviceAccess(device.device_id);
        }
      }
      
      // Sign out current device last
      await signOut();
      
      toast({
        title: "Sessão encerrada",
        description: "Você foi desconectado de todos os dispositivos",
        variant: "default",
      });
    } catch (err) {
      console.error('Erro ao encerrar sessões:', err);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao encerrar suas sessões",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Renderizar estado de carregamento
  if (loading) {
    return (
      <Card className="bg-app-black border-app-border">
        <CardHeader>
          <CardTitle>Dispositivos Conectados</CardTitle>
          <CardDescription>
            Gerencie os dispositivos que têm acesso à sua conta
          </CardDescription>
        </CardHeader>
        <CardContent>
          {[1, 2, 3].map((i) => (
            <Card key={i} className="mb-4">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded" />
                    <div>
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-3 w-24 mt-2" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Skeleton className="h-3 w-32 mb-2" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                  <div>
                    <Skeleton className="h-3 w-32 mb-2" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                  <div>
                    <Skeleton className="h-3 w-32 mb-2" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                  <div>
                    <Skeleton className="h-3 w-32 mb-2" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-app-black border-app-border">
      <CardHeader>
        <CardTitle>Dispositivos Conectados</CardTitle>
        <CardDescription>
          Gerencie os dispositivos que têm acesso à sua conta
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center mb-6">
          <div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={loadDevices}
              disabled={loading}
              className="float-right"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Atualizando...
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4 mr-2" />
                  Atualizar
                </>
              )}
            </Button>
          </div>
        </div>
      
      <p className="text-muted-foreground mb-4">
        Visualize e gerencie os dispositivos que acessaram sua conta. Você pode revogar o acesso de dispositivos que não reconhece.
      </p>
      
      <Alert variant="default" className="mb-6 bg-blue-950/20 border-blue-500/30">
        <Info className="h-4 w-4 text-blue-400" />
        <AlertTitle className="text-sm font-normal text-blue-300">Informação sobre dados de dispositivos</AlertTitle>
        <AlertDescription className="text-xs text-blue-300/80">
          Algumas informações como localização e endereço IP podem não estar disponíveis devido a ferramentas 
          de privacidade ou bloqueadores de rastreamento no seu navegador. Isso não afeta a segurança da sua conta.
        </AlertDescription>
      </Alert>
      
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {!devices || devices.length === 0 ? (
        <div className="text-center py-12">
          <Info className="h-12 w-12 mx-auto text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium">Nenhum dispositivo encontrado</h3>
          <p className="mt-2 text-muted-foreground">
            Não foram encontrados dispositivos conectados à sua conta.
          </p>
        </div>
      ) : (
        <div>
          {/* Destacar o dispositivo atual em primeiro lugar */}
          {devices?.filter(d => d.is_current_device).map(device => (
            <DeviceCard 
              key={device.id} 
              device={device} 
              onRevoke={handleRevoke} 
            />
          ))}
          
          {/* Outros dispositivos em seguida */}
          {devices?.filter(d => !d.is_current_device).map(device => (
            <DeviceCard 
              key={device.id} 
              device={device} 
              onRevoke={handleRevoke} 
            />
          ))}
        </div>
      )}
      
      {/* Security Notifications */}
      <Separator className="my-6" />
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="font-medium">Notificações de Segurança</div>
          <div className="text-sm text-muted-foreground">Receba alertas sobre atividades suspeitas</div>
        </div>
        <Switch
          checked={securityNotifications}
          onCheckedChange={toggleSecurityNotifications}
        />
      </div>
      
      {/* Sessões Ativas */}
      <Separator className="my-6" />
      <Card className="bg-app-black border-app-border mt-6">
        <CardHeader>
          <CardTitle>Sessões Ativas</CardTitle>
          <CardDescription>
            Encerre sua sessão em todos os dispositivos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            variant="outline" 
            className="text-amber-500 border-amber-500/30 hover:bg-amber-500/10 flex items-center"
            onClick={handleSignOutAllDevices}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Encerrando...
              </>
            ) : (
              <>
                <LogOut className="mr-2 h-4 w-4" /> Sair de Todos os Dispositivos
              </>
            )}
          </Button>
        </CardContent>
      </Card>
      
      {/* Diálogo de confirmação para revogação */}
      {/* Diálogo de confirmação para revogação */}
        <AlertDialog open={!!deviceToRevoke} onOpenChange={() => !revoking && setDeviceToRevoke(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revogar acesso do dispositivo?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação irá desconectar o dispositivo da sua conta. O usuário precisará fazer login novamente para acessar a conta.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={revoking}>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={confirmRevoke}
                disabled={revoking}
                className="bg-red-500 hover:bg-red-600"
              >
                {revoking ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Revogando...
                  </>
                ) : (
                  <>Revogar Acesso</>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};

export default ConnectedDevicesPage;

