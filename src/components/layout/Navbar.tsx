
import React, { useState, useEffect } from 'react';
import { Search, HelpCircle, Calendar, Mail, Settings, LogOut, UserCircle, Menu, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';

import { useAuth } from '@/contexts/AuthContext';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { Link } from 'react-router-dom';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { 
  CommandDialog, 
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useConversations } from '@/hooks/useConversations';
import { supabase } from '@/integrations/supabase/client';

interface NavbarProps {
  className?: string;
}

interface Notification {
  type: 'message' | 'calendar' | 'match' | 'security';
  count: number;
}

const Navbar: React.FC<NavbarProps> = ({ className }) => {
  const { user, signOut, profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { conversations } = useConversations();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  // Notifications state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notificationCount = notifications.reduce((acc, curr) => acc + curr.count, 0);
  const hasNotifications = notificationCount > 0;

  // Handle window resize for responsive behavior
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Track notifications via polling every 30 seconds
  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    const checkForNotifications = async () => {
      const tempNotifications: Notification[] = [];
      
      // Check for unread messages
      const { data: unreadMessages, error: messagesError } = await supabase
        .from('messages')
        .select('id')
        .eq('read', false)
        .neq('sender_id', user.id);
        
      if (!messagesError && unreadMessages && unreadMessages.length > 0) {
        tempNotifications.push({
          type: 'message',
          count: unreadMessages.length
        });
      }

      // Check for new calendar events (events added in the last 24 hours)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const { data: newMeetings, error: meetingsError } = await supabase
        .from('meetings')
        .select('id')
        .gt('created_at', yesterday.toISOString())
        .filter('created_by', 'not.eq', user.id);
        
      if (!meetingsError && newMeetings && newMeetings.length > 0) {
        tempNotifications.push({
          type: 'calendar',
          count: newMeetings.length
        });
      }

      if (!isMounted) return;
      setNotifications(tempNotifications);
    };
    
    checkForNotifications();
    const interval = setInterval(checkForNotifications, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [user]);

  // Use command effect when user presses "/"
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === '/' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
      toast({
        title: "Desconectado com sucesso",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao sair",
        description: "Não foi possível fazer logout. Tente novamente."
      });
    }
  };

  const handleGlobalSearch = () => {
    // Implement global search logic here
    setOpen(false);
    toast({
      title: "Pesquisa iniciada",
      description: `Buscando por "${searchQuery}"...`
    });
  };

  const getInitials = () => {
    if (!user) return "?";
    
    if (user.user_metadata?.first_name && user.user_metadata?.last_name) {
      return `${user.user_metadata.first_name[0]}${user.user_metadata.last_name[0]}`.toUpperCase();
    }
    
    return user.email ? user.email[0].toUpperCase() : "?";
  };

  // Function to open search dialog consistently
  const openSearch = () => {
    setOpen(true);
    setCommandOpen(true);
  };

  // Make sure Navbar is absolutely positioned with no z-index conflicts
  return (
    <header className={cn(
      "bg-app-black/50 backdrop-blur-md border-b border-sidebar-border h-16 fixed top-0 right-0 z-30 left-52",
      className
    )}>
      <div className="h-full flex items-center justify-between px-4 md:px-6">
        <div className="flex items-center space-x-2">
          <div className="lg:hidden">
          </div>
        </div>

        {/* Search bar for medium screens and above */}
        <div className="hidden md:flex items-center flex-1 max-w-3xl">
          <div className="relative w-full z-0">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <input
              type="text"
              placeholder="Pesquisar em tudo (usuários, mensagens, canais)..."
              className="w-full bg-muted/50 border-none rounded-full pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-app-yellow/50 placeholder:text-[#f1f1f1]"
              onClick={openSearch}
              readOnly
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground text-xs">
              CTRL + /
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="relative">
            <NotificationCenter />
          </div>
          <Link to="/help" className="p-2 rounded-full hover:bg-muted/50 text-foreground transition-colors">
            <HelpCircle size={20} />
          </Link>
          {/* Search button for mobile */}
          <button 
            className="md:hidden p-2 rounded-full hover:bg-muted/50 text-foreground transition-colors"
            onClick={openSearch}
          >
            <Search size={20} />
          </button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center justify-center h-8 w-8 rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-app-yellow/50">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={profile?.avatar_url || ""} />
                  <AvatarFallback className="bg-app-yellow text-app-textoBotoes">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Link to="/profile" className="flex items-center cursor-pointer w-full">
                  <UserCircle className="mr-2 h-4 w-4" />
                  <span>Meu Perfil</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/calendar')}>
                <Calendar className="mr-2 h-4 w-4" />
                <span>Agenda</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/messages')}>
                <Mail className="mr-2 h-4 w-4" />
                <span>Mensagens</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Configurações</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link to="/settings?tab=billing" className="flex items-center cursor-pointer w-full">
                  <CreditCard className="mr-2 h-4 w-4" />
                  <span>Pagamento</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Global search dialog */}
      <CommandDialog open={open || commandOpen} onOpenChange={(open) => {
        setOpen(open);
        setCommandOpen(open);
      }}>
        <CommandInput 
          placeholder="Pesquisar em tudo..." 
          value={searchQuery}
          onValueChange={setSearchQuery}
          className="placeholder:text-[#f1f1f1]"
        />
        <CommandList>
          <CommandGroup heading="Sugestões">
            <CommandItem>
              <Search className="mr-2 h-4 w-4" />
              <span>Buscar "{searchQuery}" em mensagens</span>
            </CommandItem>
            <CommandItem>
              <UserCircle className="mr-2 h-4 w-4" />
              <span>Buscar "{searchQuery}" em usuários</span>
            </CommandItem>
            <CommandItem>
              <Calendar className="mr-2 h-4 w-4" />
              <span>Buscar "{searchQuery}" em eventos</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Páginas">
            <CommandItem onSelect={() => {
              navigate('/messages');
              setOpen(false);
            }}>
              <Mail className="mr-2 h-4 w-4" />
              <span>Mensagens</span>
            </CommandItem>
            <CommandItem onSelect={() => {
              navigate('/calendar');
              setOpen(false);
            }}>
              <Calendar className="mr-2 h-4 w-4" />
              <span>Calendário</span>
            </CommandItem>
            <CommandItem onSelect={() => {
              navigate('/teams');
              setOpen(false);
            }}>
              <UserCircle className="mr-2 h-4 w-4" />
              <span>Equipes</span>
            </CommandItem>
            <CommandItem onSelect={() => {
              navigate('/ai-match');
              setOpen(false);
            }}>
              <HelpCircle className="mr-2 h-4 w-4" />
              <span>Match IA</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </header>
  );
};

export default Navbar;
