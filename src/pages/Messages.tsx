import React, { useState, useRef, useCallback } from 'react';
import { useConversations } from '@/hooks/useConversations';
import { useAuth } from '@/contexts/AuthContext';
import { Search, MessageSquarePlus, Loader2, ChevronLeft, Users, Filter, MoreVertical, Pin, BellOff, Archive, Trash, Settings, X, Eye, Download, Mail } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ChatView from '@/components/chat/ChatView';
import { MessageUpdateEvent } from '@/hooks/useMessages';
import { useSwipe } from '@/hooks/use-swipe';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import Layout from '@/components/layout/Layout';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
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
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSubContent,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubTrigger
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { isCompleteEmail } from '@/utils/validation';
type UserResult = {
  id: string;
  email: string;
};


const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const Messages: React.FC = () => {
  const { user, profile } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newParticipantEmail, setNewParticipantEmail] = useState<string>('');
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [isEmailValid, setIsEmailValid] = useState(false);
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [selectedParticipant, setSelectedParticipant] = useState<UserResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState('all');
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [swipeMenuOpen, setSwipeMenuOpen] = useState<string | null>(null);
  const [searchingUser, setSearchingUser] = useState(false);
  const [isSearchingUser, setIsSearchingUser] = useState(false);
  const [lastSearchedEmail, setLastSearchedEmail] = useState('');
  const [searchDebounce, setSearchDebounce] = useState<NodeJS.Timeout | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isMarking, setIsMarking] = useState(false);
  const [isPinning, setIsPinning] = useState(false);
  const [isMuting, setIsMuting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [actionConversationId, setActionConversationId] = useState<string | null>(null);
  

  const { 
    conversations, 
    loading: conversationsLoading, 
    createConversation, 
    deleteConversation, 
    clearMessages, 
    archiveConversation, 
    muteConversation, 
    pinConversation,
    findUserByEmail,
    refreshConversations,
    handleMessageUpdate // Add the new message update handler from useConversations
  } = useConversations();

  // Memoize o handler de atualização de mensagem para não recriar a cada render
  const handleChatViewMessageUpdate = useCallback(
    (event: MessageUpdateEvent) => {
      console.log("Message update from ChatView:", event);
      handleMessageUpdate(event);
    },
    [handleMessageUpdate]
  );
  
  React.useEffect(() => {
    // Ajuste de visualização para telas maiores
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setShowSidebar(true);
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Estado para validação de formato de email
  const [isSearching, setIsSearching] = useState(false);

  // Improved email validation with increased debounce time

React.useEffect(() => {
  // se formato inválido, limpa tudo
  if (!emailRegex.test(newParticipantEmail)) {
    setIsSearching(false);
    setSearchResults([]);
    setSelectedParticipant(null);
    return;
  }

  setIsSearching(true);
  const timer = setTimeout(async () => {
    try {
      const user = await findUserByEmail(newParticipantEmail);
      if (user) {
        const result: UserResult = {
          id: user.id,
          email: user.email
        };
        setSearchResults([result]);
        // se for um email diferente, limpa seleção anterior
        if (selectedParticipant?.email !== result.email) {
          setSelectedParticipant(null);
        }
      } else {
        setSearchResults([]);
        setSelectedParticipant(null);
      }
    } catch {
      setSearchResults([]);
      setSelectedParticipant(null);
    } finally {
      setIsSearching(false);
    }
  }, 500);

  return () => clearTimeout(timer);
}, [newParticipantEmail, findUserByEmail]);


  
  const filteredConversations = conversations.filter((conversation) => {
    // Aplicar filtro de busca
    const matchesSearch = !search.trim() || 
      conversation.name?.toLowerCase().includes(search.toLowerCase()) ||
      conversation.participants.some(
        p => 
          p.first_name?.toLowerCase().includes(search.toLowerCase()) ||
          p.last_name?.toLowerCase().includes(search.toLowerCase()) ||
          p.company_name?.toLowerCase().includes(search.toLowerCase())
      );
    
    // Aplicar filtros de categoria
    switch (activeFilterTab) {
      case 'unread':
        return matchesSearch && conversation.unread_count > 0;
      case 'favorites':
        // por enquanto, exibe todos (ou adapte a um campo real que exista)
        return matchesSearch;
      case 'groups':
        return matchesSearch && conversation.participants.length > 2;
      case 'all':
      default:
        return matchesSearch;
    }
  });
  
  const getConversationName = (conversation: typeof conversations[0]) => {
    if (conversation.name) return conversation.name;
    
    const otherParticipants = conversation.participants.filter(p => p.id !== user?.id);
    if (otherParticipants.length === 0) return "Somente você";
    
    return otherParticipants
      .map(p => p.first_name || p.company_name || p.email.split('@')[0])
      .join(', ');
  };
  
  const getLastMessagePreview = (conversation: typeof conversations[0]) => {
    // Pega o conteúdo — pode ser undefined ou null
    const text = conversation.last_message?.content;
    // Se não for string não vazia, mostra placeholder
    if (typeof text !== 'string' || text.trim() === '') {
      return "Nenhuma mensagem";
    }
    // Se for maior que 30 caracteres, corta e adiciona "..."
    return text.length > 30 ? text.slice(0, 30) + "…" : text;
  };


  const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return format(date, 'HH:mm');
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Ontem";
    } else {
      return format(date, 'dd/MM/yyyy', { locale: ptBR });
    }
  };

  const handleSwipeRight = useCallback(() => {
    if (!showSidebar) {
      setShowSidebar(true);
    }
  }, [showSidebar]);

  const handleSwipeLeft = useCallback(() => {
    if (showSidebar && window.innerWidth < 768) {
      setShowSidebar(false);
    }
  }, [showSidebar]);

  useSwipe(chatContainerRef, {
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
  });
  
  const handleCreateNewConversation = async () => {
    if (!selectedParticipant) {
      toast({
        variant: "destructive",
        title: "Selecione um usuário",
        description: "Clique em um dos resultados para iniciar."
      });
      return;
    }

    try {
      setCreatingConversation(true);
      const newId = await createConversation([selectedParticipant.id]);
      toast({
        title: "Nova conversa",
        description: `Conversa com ${selectedParticipant.email} criada com sucesso!`,
      });
      setDialogOpen(false);
      setNewParticipantEmail('');
      setSearchResults([]);
      setSelectedParticipant(null);
      setSelectedConversationId(newId);
      if (window.innerWidth < 768) setShowSidebar(false);
    } catch {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível criar a conversa. Tente novamente.",
      });
    } finally {
      setCreatingConversation(false);
    }
  };

  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase();
  };


  const handleCreate = handleCreateNewConversation;
  // Estados para confirmação de exclusão
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
  const [clearConfirmationOpen, setClearConfirmationOpen] = useState(false);
  const [conversationToClear, setConversationToClear] = useState<string | null>(null);
  const [contactInfoOpen, setContactInfoOpen] = useState(false);
  const [selectedContactInfo, setSelectedContactInfo] = useState<{conversation: typeof conversations[0]; email: string; name: string;} | null>(null);
  const [exportConfirmOpen, setExportConfirmOpen] = useState(false);
  const [conversationToExport, setConversationToExport] = useState<string | null>(null);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [conversationToClose, setConversationToClose] = useState<string | null>(null);

  const handleSwipeAction = async (action: string, conversationId: string) => {
    let message = '';
    let description = '';
    let success = false;
    
    setSwipeMenuOpen(null);
    
    try {
      switch (action) {
        case 'pin':
          success = await pinConversation(conversationId);
          message = 'Conversa fixada';
          description = 'A conversa foi fixada no topo da lista';
          break;
        case 'mute':
          success = await muteConversation(conversationId);
          message = 'Conversa silenciada';
          description = 'Você não receberá notificações desta conversa';
          break;
        case 'archive':
          success = await archiveConversation(conversationId);
          message = 'Conversa arquivada';
          description = 'A conversa foi movida para a seção de arquivados';
          break;
        case 'delete':
          // Para exclusão, vamos adicionar uma confirmação
          setDeleteConfirmationOpen(true);
          setConversationToDelete(conversationId);
          return; // Não mostra toast aqui, vai esperar confirmação
        case 'clear':
          success = await clearMessages(conversationId);
          message = 'Mensagens apagadas';
          description = 'Todas as mensagens desta conversa foram removidas';
          break;
      }
      
      if (success) {
        toast({
          title: message,
          description: description
        });
        refreshConversations(); // Adicionar esta linha para atualizar a lista de conversas
      }
    } catch (error) {
      console.error(`Erro ao executar ação ${action}:`, error);
      toast({
        variant: "destructive",
        title: "Erro ao executar ação",
        description: "Não foi possível completar a operação solicitada"
      });
    }
  };
  
  // Função para confirmar exclusão
  const handleConfirmDelete = async () => {
    if (!conversationToDelete) {
      setDeleteConfirmationOpen(false);
      return;
    }
    
    try {
      setIsDeleting(true);
      const success = await deleteConversation(conversationToDelete);
      
      if (success) {
        toast({
          title: 'Conversa excluída',
          description: 'A conversa foi excluída permanentemente'
        });
        
        // Se a conversa atual foi excluída, desselecionar
        if (selectedConversationId === conversationToDelete) {
          setSelectedConversationId(null);
        }
        
        refreshConversations();
      } else {
        toast({
          variant: "destructive",
          title: "Erro ao excluir",
          description: "Não foi possível excluir a conversa. Tente novamente."
        });
      }
    } catch (error) {
      console.error("Erro ao excluir conversa:", error);
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: "Ocorreu um erro ao tentar excluir a conversa"
      });
    } finally {
      setIsDeleting(false);
      setDeleteConfirmationOpen(false);
      setConversationToDelete(null);
    }
  };

  // Função para confirmar limpar mensagens
  const handleConfirmClear = async () => {
    if (!conversationToClear) {
      setClearConfirmationOpen(false);
      return;
    }
    
    try {
      setIsClearing(true);
      const success = await clearMessages(conversationToClear);
      
      if (success) {
        toast({
          title: 'Mensagens apagadas',
          description: 'Todas as mensagens desta conversa foram removidas'
        });
        refreshConversations();
      } else {
        toast({
          variant: "destructive",
          title: "Erro ao limpar mensagens",
          description: "Não foi possível limpar as mensagens da conversa"
        });
      }
    } catch (error) {
      console.error("Erro ao limpar mensagens:", error);
      toast({
        variant: "destructive",
        title: "Erro ao limpar mensagens",
        description: "Ocorreu um erro ao tentar limpar as mensagens"
      });
    } finally {
      setIsClearing(false);
      setClearConfirmationOpen(false);
      setConversationToClear(null);
    }
  };

  // Função para fechar conversa
  const handleConfirmClose = () => {
    if (!conversationToClose) {
      setCloseConfirmOpen(false);
      return;
    }
    
    try {
      setIsClosing(true);
      
      // Se a conversa atual foi selecionada, desselecionar
      if (selectedConversationId === conversationToClose) {
        setSelectedConversationId(null);
      }
      
      toast({
        title: 'Conversa fechada',
        description: 'A conversa foi fechada'
      });
      
    } catch (error) {
      console.error("Erro ao fechar conversa:", error);
      toast({
        variant: "destructive",
        title: "Erro ao fechar conversa",
        description: "Ocorreu um erro ao tentar fechar a conversa"
      });
    } finally {
      setIsClosing(false);
      setCloseConfirmOpen(false);
      setConversationToClose(null);
    }
  };

  // Função para marcar conversa como não lida
  const handleMarkAsUnread = async (conversationId: string) => {
    try {
      setIsMarking(true);
      setActionConversationId(conversationId);
      
      // Como não temos uma implementação real, simulamos um atraso
      await new Promise(resolve => setTimeout(resolve, 500));
      
      toast({
        title: 'Conversa marcada como não lida',
        description: 'A conversa foi marcada como não lida'
      });
      
      // Normalmente você atualizaria o estado aqui
      refreshConversations();
      
    } catch (error) {
      console.error("Erro ao marcar conversa como não lida:", error);
      toast({
        variant: "destructive",
        title: "Erro ao marcar como não lida",
        description: "Ocorreu um erro ao marcar a conversa como não lida"
      });
    } finally {
      setIsMarking(false);
      setActionConversationId(null);
    }
  };

  // Função para exportar conversa
  const handleConfirmExport = async () => {
    if (!conversationToExport) {
      setExportConfirmOpen(false);
      return;
    }
    
    try {
      setIsExporting(true);
      
      // Simulamos um processo de exportação
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Criamos um objeto fictício para download
      const conversation = conversations.find(c => c.id === conversationToExport);
      const exportData = {
        id: conversationToExport,
        name: getConversationName(conversation || conversations[0]),
        messages: ["Mensagem 1", "Mensagem 2", "Mensagem 3"],
        exportDate: new Date().toISOString()
      };
      
      // Criamos um arquivo para download
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversa_${conversationToExport.substring(0, 8)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: 'Conversa exportada',
        description: 'A conversa foi exportada com sucesso'
      });
      
    } catch (error) {
      console.error("Erro ao exportar conversa:", error);
      toast({
        variant: "destructive",
        title: "Erro ao exportar",
        description: "Ocorreu um erro ao tentar exportar a conversa"
      });
    } finally {
      setIsExporting(false);
      setExportConfirmOpen(false);
      setConversationToExport(null);
    }
  };

  // Função para arquivar conversa
  const handleArchiveConversation = async (conversationId: string) => {
    try {
      setIsArchiving(true);
      setActionConversationId(conversationId);
      
      const success = await archiveConversation(conversationId);
      
      if (success) {
        toast({
          title: 'Conversa arquivada',
          description: 'A conversa foi arquivada com sucesso'
        });
        refreshConversations();
      } else {
        toast({
          variant: "destructive",
          title: "Erro ao arquivar",
          description: "Não foi possível arquivar a conversa"
        });
      }
    } catch (error) {
      console.error("Erro ao arquivar conversa:", error);
      toast({
        variant: "destructive",
        title: "Erro ao arquivar",
        description: "Ocorreu um erro ao tentar arquivar a conversa"
      });
    } finally {
      setIsArchiving(false);
      setActionConversationId(null);
    }
  };

  // Função para fixar conversa
  const handlePinConversation = async (conversationId: string) => {
    try {
      setIsPinning(true);
      setActionConversationId(conversationId);
      
      const success = await pinConversation(conversationId);
      
      if (success) {
        toast({
          title: 'Conversa fixada',
          description: 'A conversa foi fixada no topo da lista'
        });
        refreshConversations();
      } else {
        toast({
          variant: "destructive",
          title: "Erro ao fixar",
          description: "Não foi possível fixar a conversa"
        });
      }
    } catch (error) {
      console.error("Erro ao fixar conversa:", error);
      toast({
        variant: "destructive",
        title: "Erro ao fixar",
        description: "Ocorreu um erro ao tentar fixar a conversa"
      });
    } finally {
      setIsPinning(false);
      setActionConversationId(null);
    }
  };

  return (
    <Layout>
      <div className="flex h-full w-full" ref={chatContainerRef}>
        {/* Lista de conversas */}
        <div 
          className={`w-full md:w-80 lg:w-96 h-full bg-app-black border-r border-sidebar-border flex flex-col transition-all duration-300 ${
            showSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          } ${selectedConversationId && window.innerWidth < 768 ? 'absolute z-10' : 'relative'}`}
        >
          <div className="p-3 border-b border-sidebar-border shrink-0">
            <div className="relative">
              <Input
                type="text"
                placeholder="Pesquisar conversas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 bg-muted-foreground/10"
              />
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          
          {/* Filtros por tabs */}
          <div className="flex border-b border-sidebar-border overflow-x-auto">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'unread', label: 'Não lidos' },
              { id: 'favorites', label: 'Favoritos' },
              { id: 'groups', label: 'Grupos' }
            ].map(tab => (
              <button 
                key={tab.id}
                className={`flex-1 py-2 px-3 text-sm font-medium ${
                  activeFilterTab === tab.id 
                    ? 'text-app-purple border-b-2 border-app-purple' 
                    : 'text-muted-foreground'
                }`}
                onClick={() => setActiveFilterTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          
          <div className="px-3 py-2 flex justify-between items-center border-b border-sidebar-border shrink-0">
            <h2 className="font-semibold">Conversas</h2>
            <div className="flex items-center space-x-1">
              <Button variant="ghost" size="icon" onClick={() => toast({ title: "Filtros", description: "Opção de filtros avançados" })}>
                <Filter className="h-4 w-4" />
              </Button>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MessageSquarePlus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nova Conversa</DialogTitle>
                    <DialogDescription>
                      Digite o email de um usuário para iniciar uma conversa.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Email do participante</label>
                      <div className="relative">
                        <Input 
                          type="email" 
                          placeholder="Digite o email do participante"
                          value={newParticipantEmail}
                          onChange={(e) => setNewParticipantEmail(e.target.value)}
                        />
                      </div>
                    </div>
                    
                    {searchResults.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Usuários encontrados</label>
                        {searchResults.map(user => (
                          <div
                            key={user.id}
                            className={`
                              flex items-center p-2 rounded-md cursor-pointer
                              ${selectedParticipant?.id === user.id ? 'bg-app-purple/20' : 'bg-muted'}
                            `}
                            onClick={() => setSelectedParticipant(user)}
                          >
                            <Avatar className="h-8 w-8 mr-2">
                              <AvatarFallback>{user.email.slice(0,2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <p className="text-sm font-medium">
                                {user.email.split('@')[0]}
                              </p>
                              <p className="text-xs text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    
                    <DialogFooter>
                      <Button
                        type="button"
                        onClick={handleCreateNewConversation}
                        disabled={!selectedParticipant || creatingConversation}
                        className="w-full"
                      >
                        {creatingConversation
                          ? <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Criando...
                            </>
                          : <>
                              <MessageSquarePlus className="h-4 w-4 mr-2" />
                              Iniciar Conversa
                            </>
                        }
                      </Button>
                    </DialogFooter>
                  </div>
                </DialogContent>
              </Dialog>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => toast({ title: "Novo grupo", description: "Criar uma nova conversa em grupo" })}>
                    <Users className="h-4 w-4 mr-2" />
                    Novo grupo
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast({ title: "Dispositivos conectados", description: "Gerenciar dispositivos conectados à sua conta" })}>
                    <span className="h-4 w-4 mr-2">💻</span>
                    Dispositivos conectados
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => toast({ title: "Mensagens favoritas", description: "Ver mensagens marcadas como favoritas" })}>
                    <span className="h-4 w-4 mr-2">⭐</span>
                    Mensagens favoritas
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast({ title: "Configurações", description: "Configurações de mensagens" })}>
                    <Settings className="h-4 w-4 mr-2" />
                    Configurações
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              {conversationsLoading ? (
                <div className="flex items-center justify-center h-24">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  <p>Nenhuma conversa encontrada</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => setDialogOpen(true)}
                  >
                    <MessageSquarePlus className="h-4 w-4 mr-2" />
                    Nova conversa
                  </Button>
                </div>
              ) : (
                filteredConversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className="relative group"
                  >
                    {/* Item da conversa */}
                    <div
                      onClick={() => {
                        setSelectedConversationId(conversation.id);
                        if (window.innerWidth < 768) {
                          setShowSidebar(false);
                        }
                      }}
                      className={`p-3 cursor-pointer ${
                        selectedConversationId === conversation.id ? 'bg-muted-foreground/10' : ''
                      } group`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>
                              {getInitials(conversation.participants[0]?.email || 'U')}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between">
                              <div className="font-medium truncate">
                                {getConversationName(conversation)}
                                  {conversation.participants.find(p => p.id === user?.id)?.isFavorite && (
                                     <span className="ml-1 text-yellow-500">⭐</span>
                                   )}
                              </div>
                              <div className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                                {formatDate(conversation.last_message?.created_at)}
                              </div>
                            </div>
                            <div className="flex items-center">
                              <p className="text-sm text-muted-foreground truncate flex-1">
                                {getLastMessagePreview(conversation)}
                              </p>
                              {conversation.unread_count > 0 && (
                                <Badge variant="default" className="ml-2 bg-app-purple hover:bg-app-purple">
                                  {conversation.unread_count}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="ml-2 mt-1 flex-shrink-0 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity duration-200"
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              // Implement close conversation functionality
                              setConversationToClose(conversation.id);
                              setCloseConfirmOpen(true);
                            }}
                          >
                            Fechar Conversa
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              // Implement mark as unread functionality
                              handleMarkAsUnread(conversation.id);
                            }}
                          >
                            Marcar como não lida
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleArchiveConversation(conversation.id);
                            }}
                          >
                            Arquivar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePinConversation(conversation.id);
                            }}
                          >
                            Fixar
                          </DropdownMenuItem>
                          
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger 
                              onClick={(e) => e.stopPropagation()}
                            >
                              Silenciar
                            </DropdownMenuSubTrigger>
                            <DropdownMenuPortal>
                              <DropdownMenuSubContent>
                                <DropdownMenuItem 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSwipeAction('mute', conversation.id);
                                    toast({
                                      title: 'Silenciado por 8 horas',
                                      description: 'A conversa foi silenciada por 8 horas'
                                    });
                                  }}
                                >
                                  8hs
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSwipeAction('mute', conversation.id);
                                    toast({
                                      title: 'Silenciado por 1 semana',
                                      description: 'A conversa foi silenciada por 1 semana'
                                    });
                                  }}
                                >
                                  1 semana
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSwipeAction('mute', conversation.id);
                                    toast({
                                      title: 'Silenciado para sempre',
                                      description: 'A conversa foi silenciada permanentemente'
                                    });
                                  }}
                                >
                                  Sempre
                                </DropdownMenuItem>
                              </DropdownMenuSubContent>
                            </DropdownMenuPortal>
                          </DropdownMenuSub>
                          
                          <DropdownMenuSeparator />
                          
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              toast({
                                title: 'Dados do contato',
                                description: 'Exibindo informações do contato'
                              });
                            }}
                          >
                            Dados do contato
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              // Set up conversation to export
                              setConversationToExport(conversation.id);
                              setExportConfirmOpen(true);
                            }}
                          >
                            Exportar conversa
                          </DropdownMenuItem>
                          
                          <DropdownMenuSeparator />
                          
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setConversationToClear(conversation.id);
                              setClearConfirmationOpen(true);
                            }}
                            className="text-amber-500"
                          >
                            Limpar conversa
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              console.log("Setting conversation to delete:", conversation.id);
                              setConversationToDelete(conversation.id);
                              setDeleteConfirmationOpen(true);
                              }}
                            className="text-red-500"
                          >
                            Apagar conversa
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  </div>
                ))
              )}
            </ScrollArea>
          </div>
        </div>


        {/* Visualização da conversa */}
        <div className="flex-1 bg-background flex flex-col h-full overflow-hidden">
          {!showSidebar && (
            <Button 
              variant="ghost"
              size="icon"
              className="absolute top-20 left-4 z-10 md:hidden"
              onClick={() => setShowSidebar(true)}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
          
          {selectedConversationId ? (
            <div className="flex-1 overflow-hidden h-full w-full">
              <ChatView
                conversationId={selectedConversationId}
                onMessageUpdate={handleChatViewMessageUpdate}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <MessageSquarePlus className="h-12 w-12 mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-1">Nenhuma conversa selecionada</h2>
              <p className="text-muted-foreground max-w-md mb-4">
                Selecione uma conversa na lista à esquerda ou inicie uma nova conversa para começar a trocar mensagens.
              </p>
              <Button 
                variant="outline" 
                className="mt-2"
                onClick={() => setDialogOpen(true)}
              >
                <MessageSquarePlus className="h-4 w-4 mr-2" />
                Nova conversa
              </Button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Messages;
