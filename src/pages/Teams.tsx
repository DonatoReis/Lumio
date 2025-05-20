import React, { useState } from 'react';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useTeams } from '@/hooks/useTeams';
import { useChannels } from '@/hooks/useChannels';
import { 
  Button,
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Input,
  Separator
} from '@/components/ui';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Users, 
  Plus, 
  Hash, 
  Lock, 
  Settings,
  Search,
  File,
  MessageSquare,
} from 'lucide-react';

const TeamsPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { teams, loading: teamsLoading, createTeam } = useTeams();
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<string>('posts');
  const [showNewTeamDialog, setShowNewTeamDialog] = useState(false);
  const [showNewChannelDialog, setShowNewChannelDialog] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDescription, setNewTeamDescription] = useState('');
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDescription, setNewChannelDescription] = useState('');
  const [isPrivateChannel, setIsPrivateChannel] = useState(false);

  const { channels, loading: channelsLoading, createChannel } = useChannels(selectedTeamId);

  const [selectedChannel, setSelectedChannel] = useState<any | null>(null);

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    
    try {
      await createTeam(newTeamName, newTeamDescription);
      setNewTeamName('');
      setNewTeamDescription('');
      setShowNewTeamDialog(false);
      toast({ title: "Equipe criada com sucesso!" });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao criar equipe",
        description: error.message
      });
    }
  };

  const handleCreateChannel = async () => {
    if (!newChannelName.trim() || !selectedTeamId) return;
    
    try {
      await createChannel(newChannelName, newChannelDescription);
      setNewChannelName('');
      setNewChannelDescription('');
      setIsPrivateChannel(false);
      setShowNewChannelDialog(false);
      toast({ title: "Canal criado com sucesso!" });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao criar canal",
        description: error.message
      });
    }
  };

  const selectedTeam = selectedTeamId ? teams.find(team => team.id === selectedTeamId) : null;

  // Função para obter iniciais de um nome
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <Layout>
      <div className="flex h-[calc(100vh-64px)]">
        {/* Painel lateral de equipes */}
        <div className="w-80 bg-app-black border-r border-sidebar-border flex flex-col">
          <div className="p-4 border-b border-sidebar-border">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-lg">Equipes</h2>
              <Dialog open={showNewTeamDialog} onOpenChange={setShowNewTeamDialog}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Nova Equipe</DialogTitle>
                    <DialogDescription>
                      Crie uma nova equipe para colaboração.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <label htmlFor="team-name" className="text-sm font-medium">
                        Nome da Equipe
                      </label>
                      <Input
                        id="team-name"
                        value={newTeamName}
                        onChange={(e) => setNewTeamName(e.target.value)}
                        placeholder="Digite o nome da equipe"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="team-description" className="text-sm font-medium">
                        Descrição (opcional)
                      </label>
                      <Input
                        id="team-description"
                        value={newTeamDescription}
                        onChange={(e) => setNewTeamDescription(e.target.value)}
                        placeholder="Digite uma breve descrição"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowNewTeamDialog(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleCreateTeam} className="bg-app-yellow hover:bg-app-yellow/90">
                      Criar Equipe
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div className="mt-2 relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar equipes..."
                className="pl-8"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto py-2">
            {teamsLoading ? (
              <div className="flex justify-center items-center h-20">
                <p className="text-sm text-muted-foreground">Carregando...</p>
              </div>
            ) : teams.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-muted-foreground mb-4">Você não está em nenhuma equipe ainda.</p>
                <Button 
                  variant="outline" 
                  onClick={() => setShowNewTeamDialog(true)}
                  className="mx-auto"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar uma equipe
                </Button>
              </div>
            ) : (
              <div className="space-y-1 px-2">
                {teams.map((team) => (
                  <div
                    key={team.id}
                    onClick={() => setSelectedTeamId(team.id)}
                    className={`flex items-center p-2 rounded-md cursor-pointer ${
                      selectedTeamId === team.id ? 'bg-accent' : 'hover:bg-accent/50'
                    }`}
                  >
                    <div className="h-8 w-8 rounded-md bg-app-yellow/20 flex items-center justify-center text-app-yellow font-medium mr-3">
                      {getInitials(team.name)}
                    </div>
                    <div className="truncate">{team.name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Área principal */}
        {!selectedTeam ? (
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <Users className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold mb-2">Nenhuma equipe selecionada</h2>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              Selecione uma equipe à esquerda para ver seus canais e conteúdo ou crie uma nova equipe para começar a colaborar.
            </p>
            <Button onClick={() => setShowNewTeamDialog(true)} className="bg-app-yellow hover:bg-app-yellow/90">
              <Plus className="h-4 w-4 mr-2" />
              Criar nova equipe
            </Button>
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            {/* Lista de canais */}
            <div className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
              <div className="p-3 border-b border-sidebar-border">
                <h3 className="font-bold truncate">{selectedTeam.name}</h3>
                <p className="text-xs text-muted-foreground truncate">
                  {selectedTeam.description || 'Sem descrição'}
                </p>
              </div>
              
              <div className="flex-1 overflow-y-auto">
                <div className="p-3">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-sm font-semibold text-muted-foreground">Canais</h4>
                    <Dialog open={showNewChannelDialog} onOpenChange={setShowNewChannelDialog}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-5 w-5">
                          <Plus className="h-3 w-3" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Criar Novo Canal</DialogTitle>
                          <DialogDescription>
                            Adicione um novo canal à equipe {selectedTeam.name}.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <label htmlFor="channel-name" className="text-sm font-medium">
                              Nome do Canal
                            </label>
                            <Input
                              id="channel-name"
                              value={newChannelName}
                              onChange={(e) => setNewChannelName(e.target.value)}
                              placeholder="Digite o nome do canal"
                            />
                          </div>
                          <div className="space-y-2">
                            <label htmlFor="channel-description" className="text-sm font-medium">
                              Descrição (opcional)
                            </label>
                            <Input
                              id="channel-description"
                              value={newChannelDescription}
                              onChange={(e) => setNewChannelDescription(e.target.value)}
                              placeholder="Digite uma breve descrição"
                            />
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="private-channel"
                              checked={isPrivateChannel}
                              onChange={() => setIsPrivateChannel(!isPrivateChannel)}
                              className="rounded border-gray-300 text-app-yellow focus:ring-app-yellow"
                            />
                            <label htmlFor="private-channel" className="text-sm">
                              Canal privado
                            </label>
                          </div>
                          {isPrivateChannel && (
                            <p className="text-xs text-muted-foreground">
                              Os canais privados são visíveis e acessíveis apenas por membros específicos da equipe que você convidar.
                            </p>
                          )}
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setShowNewChannelDialog(false)}>
                            Cancelar
                          </Button>
                          <Button onClick={handleCreateChannel} className="bg-app-yellow hover:bg-app-yellow/90">
                            Criar Canal
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                  
                  {channelsLoading ? (
                    <div className="py-2">
                      <p className="text-sm text-muted-foreground">Carregando canais...</p>
                    </div>
                  ) : channels.length === 0 ? (
                    <div className="py-2">
                      <p className="text-sm text-muted-foreground mb-2">Nenhum canal ainda.</p>
                      <Button 
                        variant="ghost" 
                        onClick={() => setShowNewChannelDialog(true)}
                        className="text-xs w-full justify-start"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Adicionar canal
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {channels.map((channel) => (
                        <div
                          key={channel.id}
                          onClick={() => setSelectedChannel(channel)}
                          className={`flex items-center px-2 py-1 rounded cursor-pointer text-sm ${
                            selectedChannel?.id === channel.id ? 'bg-accent' : 'hover:bg-accent/50'
                          }`}
                        >
                          {channel.is_private ? (
                            <Lock className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                          ) : (
                            <Hash className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                          )}
                          <span className="truncate">{channel.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <Separator className="my-2" />
                
                <div className="p-3">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-sm font-semibold text-muted-foreground">Configurações</h4>
                  </div>
                  <div
                    className="flex items-center px-2 py-1 rounded cursor-pointer text-sm hover:bg-accent/50"
                    onClick={() => {
                      toast({
                        title: "Funcionalidade em desenvolvimento",
                        description: "As configurações da equipe estarão disponíveis em breve."
                      });
                    }}
                  >
                    <Settings className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                    <span>Configurações da equipe</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Conteúdo do canal */}
            {!selectedChannel ? (
              <div className="flex-1 flex flex-col items-center justify-center p-4">
                <Hash className="h-16 w-16 text-muted-foreground mb-4" />
                <h2 className="text-2xl font-bold mb-2">Nenhum canal selecionado</h2>
                <p className="text-muted-foreground text-center max-w-md mb-6">
                  Selecione um canal à esquerda para ver seu conteúdo ou crie um novo canal para começar a compartilhar.
                </p>
                <Button onClick={() => setShowNewChannelDialog(true)} className="bg-app-yellow hover:bg-app-yellow/90">
                  <Plus className="h-4 w-4 mr-2" />
                  Criar novo canal
                </Button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                <div className="border-b border-sidebar-border p-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      {selectedChannel.is_private ? (
                        <Lock className="h-4 w-4 mr-2" />
                      ) : (
                        <Hash className="h-4 w-4 mr-2" />
                      )}
                      <h3 className="font-semibold">{selectedChannel.name}</h3>
                    </div>
                    <Button variant="ghost" size="icon">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                  {selectedChannel.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedChannel.description}
                    </p>
                  )}
                </div>
                
                <Tabs 
                  defaultValue="posts" 
                  value={selectedTab} 
                  onValueChange={setSelectedTab}
                  className="flex-1 flex flex-col"
                >
                  <div className="border-b border-sidebar-border">
                    <TabsList className="bg-transparent">
                      <TabsTrigger value="posts" className="data-[state=active]:bg-accent/70">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Posts
                      </TabsTrigger>
                      <TabsTrigger value="files" className="data-[state=active]:bg-accent/70">
                        <File className="h-4 w-4 mr-2" />
                        Arquivos
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  
                  <TabsContent value="posts" className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div className="text-center py-16">
                      <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-xl font-bold mb-2">Inicie a conversa</h3>
                      <p className="text-muted-foreground max-w-md mx-auto mb-6">
                        Este canal está vazio. Comece compartilhando uma mensagem, um arquivo ou inicie uma conversa.
                      </p>
                      <Button className="bg-app-yellow hover:bg-app-yellow/90">
                        <Plus className="h-4 w-4 mr-2" />
                        Nova mensagem
                      </Button>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="files" className="flex-1 overflow-y-auto p-4">
                    <div className="text-center py-16">
                      <File className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-xl font-bold mb-2">Nenhum arquivo ainda</h3>
                      <p className="text-muted-foreground max-w-md mx-auto mb-6">
                        Compartilhe arquivos como documentos, imagens ou links para colaborar com a equipe.
                      </p>
                      <Button className="bg-app-yellow hover:bg-app-yellow/90">
                        <Plus className="h-4 w-4 mr-2" />
                        Fazer upload de arquivo
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default TeamsPage;
