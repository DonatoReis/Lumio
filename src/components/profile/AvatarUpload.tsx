import React, { useState, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, Camera, AlertCircle, WifiOff, RotateCw, ImageUp, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Progress } from '@/components/ui/progress';
import { testStorageConnection, ensureStorageBuckets } from '@/utils/storage-config';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AvatarUploadProps {
  avatarUrl?: string | null;
  onAvatarChange: (url: string) => void;
  size?: 'sm' | 'md' | 'lg';
  showUploadButton?: boolean;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const UPLOAD_TIMEOUT = 10000; // 10 segundos
const MAX_RETRY_ATTEMPTS = 3;

const AvatarUpload: React.FC<AvatarUploadProps> = ({
  avatarUrl,
  onAvatarChange,
  size = 'md',
  showUploadButton = true
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'checking' | 'offline'>('offline');
  const [connectionErrorDetails, setConnectionErrorDetails] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const { toast } = useToast();
  const { user, refreshProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileToUploadRef = useRef<File | null>(null);
  
  // Tamanhos disponíveis para o avatar
  const sizeMap = {
    sm: 'w-16 h-16',
    md: 'w-20 h-20',
    lg: 'w-32 h-32'
  };

  // Verificar conexão com Supabase ao montar o componente e quando retry é acionado
  useEffect(() => {
    checkSupabaseConnection();
    
    // Configurar verificações periódicas de conexão
    const intervalId = setInterval(() => {
      if (connectionStatus === 'offline') {
        checkSupabaseConnection();
      }
    }, 30000); // Verificar a cada 30 segundos se estiver offline
    
    return () => clearInterval(intervalId);
  }, [retryCount]);

  const checkSupabaseConnection = async () => {
    
    setConnectionStatus('checking');
    setConnectionErrorDetails(null);
    
    try {
      console.log('Verificando conexão com Supabase...');
      
      // 1. Verificar se o cliente Supabase está inicializado
      if (!supabase) {
        const errorMsg = 'Cliente Supabase não está inicializado';
        console.error(errorMsg);
        setConnectionErrorDetails('Erro de inicialização do cliente Supabase');
        setConnectionStatus('offline');
        return false;
      }
      
      // 2. Verificar se a autenticação está funcionando
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Erro na sessão do Supabase:', sessionError);
          setConnectionErrorDetails(`Erro de autenticação: ${sessionError.message}`);
          setConnectionStatus('offline');
          return false;
        }
        
        if (!session) {
          console.error('Nenhuma sessão ativa encontrada');
          setConnectionErrorDetails('Nenhuma sessão ativa. Faça login novamente.');
          setConnectionStatus('offline');
          return false;
        }
        
        console.log('✅ Autenticação verificada com sucesso');
      } catch (authError) {
        console.error('Exceção ao verificar autenticação:', authError);
        setConnectionErrorDetails(`Erro ao verificar autenticação: ${authError.message}`);
        setConnectionStatus('offline');
        return false;
      }
      
      // 3. Verificar se o banco de dados está funcionando
      try {
        console.log('Testando conexão com banco de dados...');
        const { data, error } = await supabase.from('profiles').select('id').limit(1).maybeSingle();
        
        if (error) {
          console.error('Erro de conexão com banco de dados:', error);
          setConnectionErrorDetails(`Erro de banco de dados: ${error.message}`);
          setConnectionStatus('offline');
          return false;
        }
        
        console.log('✅ Conexão com banco de dados funcionando');
      } catch (dbError) {
        console.error('Exceção ao conectar com banco de dados:', dbError);
        setConnectionErrorDetails(`Erro de banco de dados: ${dbError.message}`);
        setConnectionStatus('offline');
        return false;
      }
      
      // 4. Verificar se o storage está funcionando
      try {
        console.log('Testando conexão com storage...');
        const storageResult = await testStorageConnection();
        
        if (!storageResult.success) {
          console.error('Erro de conexão com storage:', storageResult.error);
          setConnectionErrorDetails(`Erro de storage: ${storageResult.error}`);
          setConnectionStatus('offline');
          return false;
        }
        
        console.log('✅ Conexão com storage funcionando');
      } catch (storageError) {
        console.error('Exceção ao conectar com storage:', storageError);
        setConnectionErrorDetails(`Erro de storage: ${storageError.message}`);
        setConnectionStatus('offline');
        return false;
      }
      
      // 5. Verificar se o bucket necessário existe
      try {
        console.log('Verificando bucket profile_images...');
        const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
        
        if (bucketsError) {
          console.error('Erro ao listar buckets:', bucketsError);
          setConnectionErrorDetails(`Erro ao listar buckets: ${bucketsError.message}`);
          setConnectionStatus('offline');
          return false;
        }
        
        const bucketExists = buckets.some(b => b.name === 'profile_images');
        
        if (!bucketExists) {
          console.warn('Bucket profile_images não encontrado, tentando criar...');
          
          try {
            const bucketsResult = await ensureStorageBuckets();
            
            if (!bucketsResult.success) {
              console.error('Falha ao criar bucket:', bucketsResult.error);
              setConnectionErrorDetails(`Falha ao criar bucket: ${bucketsResult.error}`);
              setConnectionStatus('offline');
              return false;
            }
            
            console.log('✅ Bucket profile_images criado com sucesso');
          } catch (createError) {
            console.error('Exceção ao criar bucket:', createError);
            setConnectionErrorDetails(`Erro ao criar bucket: ${createError.message}`);
            setConnectionStatus('offline');
            return false;
          }
        } else {
          console.log('✅ Bucket profile_images existe');
        }
      } catch (bucketError) {
        console.error('Exceção ao verificar bucket:', bucketError);
        setConnectionErrorDetails(`Erro ao verificar bucket: ${bucketError.message}`);
        setConnectionStatus('offline');
        return false;
      }
      
      console.log('✅ Todos os testes de conexão passaram com sucesso!');
      setConnectionStatus('online');
      return true;
    } catch (err) {
      console.error('Exceção geral na verificação de conexão:', err);
      setConnectionErrorDetails(`Erro de conexão: ${err.message}`);
      setConnectionStatus('offline');
      return false;
    } finally {
      if (uploading) {
        setUploadProgress(prev => Math.min(prev + 5, 90));
      }
    }
  };
  
  // Retry forçado de conexão
  const handleRetryConnection = async () => {
    setRetryCount(prevCount => prevCount + 1);
    setUploadError(null);
    
    console.log("Tentando reconectar...");
    const isConnected = await checkSupabaseConnection();
    
    if (isConnected) {
      toast({
        title: "Conexão restaurada",
        description: "A conexão com o servidor foi restabelecida"
      });
      
      // Se tiver um arquivo pendente para upload, tenta novamente
      if (fileToUploadRef.current) {
        handleUploadFile(fileToUploadRef.current);
      }
    } else {
      toast({
        variant: "destructive",
        title: "Ainda sem conexão",
        description: connectionErrorDetails || "Não foi possível conectar. Verifique sua conexão com a internet."
      });
    }
  };

  // Obter iniciais do usuário para fallback
  const getInitials = (): string => {
    if (!user) return '?';
    
    if (user.user_metadata?.first_name && user.user_metadata?.last_name) {
      return `${user.user_metadata.first_name[0]}${user.user_metadata.last_name[0]}`.toUpperCase();
    }
    
    return user.email ? user.email[0].toUpperCase() : '?';
  };

  // Resetar estado do upload
  const resetUploadState = () => {
    setUploading(false);
    setUploadProgress(0);
    setUploadError(null);
    setRetryAttempt(0);
    fileToUploadRef.current = null;
    if (uploadTimeoutRef.current) {
      clearTimeout(uploadTimeoutRef.current);
      uploadTimeoutRef.current = null;
    }
    // Limpar input para permitir selecionar o mesmo arquivo novamente
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };


  // Extrair o caminho de uma URL pública do Storage
  const extractStoragePath = (url: string): string | null => {
    try {
      // O formato típico da URL é: https://xxx.supabase.co/storage/v1/object/public/bucket-name/path/to/file.ext
      const matches = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
      
      if (matches && matches.length === 3) {
        const bucketName = matches[1];
        const filePath = matches[2];
        return `${bucketName}/${filePath}`;
      }
      
      return null;
    } catch (error) {
      console.error('Erro ao extrair caminho de storage:', error);
      return null;
    }
  };

  // Remover avatar antigo
  const removeOldAvatar = async (url: string): Promise<boolean> => {
    try {
      // Extrair o caminho completo
      const storagePath = extractStoragePath(url);
      
      if (!storagePath) {
        console.error('Não foi possível extrair o caminho do storage da URL:', url);
        return false;
      }
      
      // Separar o bucket do caminho do arquivo
      const [bucketName, ...fileParts] = storagePath.split('/');
      const filePath = fileParts.join('/');
      
      if (!bucketName || !filePath) {
        console.error('Formato de caminho inválido:', storagePath);
        return false;
      }
      
      console.log(`Removendo avatar antigo: bucket=${bucketName}, filePath=${filePath}`);
      
      // Tentar remover o arquivo
      const { error } = await supabase.storage
        .from(bucketName)
        .remove([filePath]);
        
      if (error) {
        console.warn('Erro ao remover avatar antigo:', error);
        return false;
      }
      
      console.log('Avatar antigo removido com sucesso');
      return true;
    } catch (error) {
      console.error('Exceção ao remover avatar antigo:', error);
      return false;
    }
  };

  // Processar o upload de arquivo
  const handleUploadFile = async (file: File, retryNum = 0) => {
    try {
      setUploadError(null);
      setRetryAttempt(retryNum);
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      
      // Validar tamanho e formato do arquivo
      if (file.size > MAX_FILE_SIZE) {
        setUploadError(`O arquivo é muito grande (${(file.size / (1024 * 1024)).toFixed(2)}MB). O tamanho máximo permitido é 5MB.`);
        toast({
          variant: "destructive",
          title: "Arquivo muito grande",
          description: "O tamanho máximo permitido é 5MB"
        });
        resetUploadState();
        return;
      }
      
      if (!['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt || '')) {
        setUploadError("Formato inválido. Apenas formatos JPG, PNG, GIF e WEBP são permitidos.");
        toast({
          variant: "destructive",
          title: "Formato inválido",
          description: "Apenas formatos JPG, PNG, GIF e WEBP são permitidos"
        });
        resetUploadState();
        return;
      }

      // Verificar conexão com Supabase antes do upload
      setUploading(true);
      setUploadProgress(10);
      
      const isConnected = await checkSupabaseConnection();
      if (!isConnected) {
        setUploadError("Erro de conexão\n\nNão foi possível conectar ao servidor. Verifique sua conexão.");
        toast({
          variant: "destructive",
          title: "Erro de conexão",
          description: "Não foi possível conectar ao servidor. Verifique sua conexão."
        });
        // Guardar o arquivo para possível retry
        fileToUploadRef.current = file;
        setUploading(false);
        return;
      }

      // Configurar timeout para upload
      uploadTimeoutRef.current = setTimeout(() => {
        if (uploading) {
          // Se for um retry e ainda tem tentativas disponíveis
          if (retryNum < MAX_RETRY_ATTEMPTS - 1) {
            console.log(`Tentativa ${retryNum + 1} de ${MAX_RETRY_ATTEMPTS} expirou. Tentando novamente...`);
            // Tenta novamente com backoff exponencial
            setTimeout(() => {
              handleUploadFile(file, retryNum + 1);
            }, Math.pow(2, retryNum) * 1000); // 1s, 2s, 4s
            return;
          }
          
          setUploading(false);
          setUploadError("O upload demorou muito. Verifique sua conexão e tente novamente.");
          toast({
            variant: "destructive",
            title: "Tempo esgotado",
            description: "O upload demorou muito. Por favor, verifique sua conexão e tente novamente."
          });
          resetUploadState();
        }
      }, UPLOAD_TIMEOUT);

      // Simular atualizações de progresso
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev < 80) return prev + 10;
          return prev;
        });
      }, 800);

      // Criar um nome de arquivo único para evitar colisões
      const userId = user?.id?.toString() || 'unknown';
      console.log('ID do usuário para caminho:', userId);
      
      const filePath = `${userId}/${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      
      console.log('Detalhes do upload:', {
        userId,
        userIdType: typeof user?.id,
        firstPathSegment: filePath.split('/')[0],
        fullFilePath: filePath,
        idMatchesPath: userId === filePath.split('/')[0]
      });

      // Tentar remover avatar antigo se existir
      if (avatarUrl) {
        try {
          const removed = await removeOldAvatar(avatarUrl);
          if (removed) {
            console.log('Avatar anterior removido com sucesso');
          }
        } catch (error) {
          console.error('Erro ao remover avatar anterior:', error);
          // Não interrompe o fluxo se falhar ao remover o avatar antigo
        }
      }

      setUploadProgress(90); // Mudando para 90% antes do upload

      console.log('Fazendo upload para o caminho:', filePath);
      
      // Upload do novo avatar com content type explícito
      const { error: uploadError, data } = await supabase.storage
        .from('profile_images')
        .upload(filePath, file, {
          cacheControl: '3600',
          contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`, // Garantir content type correto
          upsert: true // Usar upsert para lidar com conflitos potenciais
        });

      // Limpar o intervalo de progresso
      clearInterval(progressInterval);
      
      if (uploadError) {
        console.error('Erro ao fazer upload para o Supabase:', uploadError);
        throw uploadError;
      }

      // Gerar URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('profile_images')
        .getPublicUrl(filePath);

      console.log('Upload bem-sucedido, URL pública:', publicUrl);

      // Upload completo e bem-sucedido
      setUploadProgress(100);

      // Atualizar URL do avatar
      onAvatarChange(publicUrl);
      
      // Atualizar globalmente o perfil para refletir o novo avatar em toda a interface
      refreshProfile();
      
      toast({
        title: "Upload concluído",
        description: "Sua foto de perfil foi atualizada com sucesso"
      });
      
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Erro de upload:', error);
        setUploadError(error.message || "Não foi possível fazer upload da imagem");
      }
      if (retryNum < MAX_RETRY_ATTEMPTS - 1) {
        console.log(`Tentativa ${retryNum + 1} falhou. Tentando novamente...`);
        // Tenta novamente com backoff exponencial
        setTimeout(() => {
          handleUploadFile(file, retryNum + 1);
        }, Math.pow(2, retryNum) * 1000); // 1s, 2s, 4s
        return;
      }

      setUploadError("Não foi possível fazer upload da imagem");
      toast({
        variant: "destructive",
        title: "Falha no upload",
        description: (error as Error).message || "Não foi possível fazer upload da imagem. Tente novamente."
      });
      resetUploadState();
    } finally {
      if (uploadTimeoutRef.current) {
        clearTimeout(uploadTimeoutRef.current);
        uploadTimeoutRef.current = null;
      }
      
      if (retryNum === MAX_RETRY_ATTEMPTS - 1 || uploadError) {
        // Reset completo apenas quando acabarem as tentativas ou houver erro
        resetUploadState();
      } else if (uploadProgress === 100) {
        // Pequeno delay antes de resetar para mostrar conclusão do progresso
        setTimeout(() => {
          resetUploadState();
        }, 1000);
      }
    }
  };

  // Iniciar o processo de upload quando um arquivo é selecionado
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) {
        return;
      }
      
      const file = e.target.files[0];
      handleUploadFile(file);
      
    } catch (error: any) {
      console.error('Erro ao iniciar upload:', error);
      toast({
        variant: "destructive",
        title: "Erro ao processar arquivo",
        description: error.message || "Ocorreu um erro ao processar o arquivo selecionado"
      });
      resetUploadState();
    }
  };

  // Abrir diálogo de seleção de arquivo
  const handleButtonClick = () => {
    setUploadError(null);
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative group">
        <Avatar className={`${sizeMap[size]} border-2 border-app-yellow/30 ${!uploading ? 'group-hover:border-app-yellow/50' : ''} transition-all`}>
          <AvatarImage src={avatarUrl || ""} alt="User avatar" />
          <AvatarFallback className="bg-app-yellow/20 text-app-white text-xl">
            {getInitials()}
          </AvatarFallback>
        </Avatar>
        
        {showUploadButton && !uploading && (
          <div 
            className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            onClick={handleButtonClick}
          >
            <Camera className="w-6 h-6 text-white" />
          </div>
        )}
      </div>
      
      {showUploadButton && (
        <>
          <input 
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleUpload}
            disabled={uploading || connectionStatus === 'offline'}
          />
          
          {uploading ? (
            <div className="w-full max-w-[200px] space-y-2">
              <Progress value={uploadProgress} className="h-2" />
              <div className="flex items-center justify-center text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                {retryAttempt > 0 && `Tentativa ${retryAttempt+1}/${MAX_RETRY_ATTEMPTS} - `}
                Enviando... {uploadProgress}%
              </div>
            </div>
          ) : (
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleButtonClick}
              disabled={uploading || connectionStatus === 'offline'}
              className="mt-1 flex items-center border-dashed border-app-yellow/50 hover:bg-app-yellow/10 hover:border-app-yellow"
            >
              {connectionStatus === 'offline' ? (
                <>
                  <WifiOff className="w-4 h-4 mr-2 text-destructive" />
                  Sem conexão
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  {avatarUrl ? 'Alterar foto' : 'Adicionar foto'}
                </>
              )}
            </Button>
          )}

          {uploadError && (
            <Alert variant="destructive" className="mt-2 py-2">
              <AlertDescription className="text-xs flex items-center">
                <AlertCircle className="w-3 h-3 mr-1" />
                {uploadError}
              </AlertDescription>
            </Alert>
          )}

          {connectionStatus === 'offline' && !uploading && !uploadError && (
            <div className="mt-2 w-full">
              <Alert variant="destructive" className="py-2 bg-amber-900/10 border-amber-600/30">
                <AlertDescription className="text-xs flex items-center text-amber-500">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Verifique sua conexão para fazer upload de imagens
                </AlertDescription>
              </Alert>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRetryConnection}
                className="mt-2 w-full text-xs flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <RotateCw className="w-3 h-3 mr-1" />
                Tentar reconectar
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AvatarUpload;
