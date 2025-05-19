import React, { useState, useEffect } from 'react';
import Layout from '@/components/layout/Layout';
import CalendarView from '@/components/calendar/CalendarView';
import EventModal from '@/components/calendar/EventModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Calendar as CalendarIcon, 
  Video, 
  Users, 
  Share, 
  Settings, 
  Mic, 
  MicOff, 
  VideoOff,
  PhoneOff,
  MessageSquare,
  ScreenShare,
  Link as LinkIcon,
  Copy
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Carousel, 
  CarouselContent, 
  CarouselItem, 
  CarouselNext, 
  CarouselPrevious,
  type CarouselApi
} from '@/components/ui/carousel';

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  start: string;
  end: string;
  color: string;
  isAllDay: boolean;
}

interface Meeting {
  id: string;
  title: string;
  date: Date;
  participants: number;
  isActive: boolean;
}

const Calendar = () => {
  // Estado para a parte de Reuniões
  const [meetings, setMeetings] = useState<Meeting[]>([
    { id: '1', title: 'Reunião de Alinhamento', date: new Date(), participants: 5, isActive: true },
    { id: '2', title: 'Apresentação de Resultados', date: new Date(Date.now() + 86400000), participants: 12, isActive: false },
    { id: '3', title: 'Entrevista com Cliente', date: new Date(Date.now() + 172800000), participants: 3, isActive: false },
  ]);
  const [activeCall, setActiveCall] = useState<Meeting | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [activeIndex, setActiveIndex] = useState(0);
  
  // Estado para o Calendário
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  // Effect hook para o carousel
  useEffect(() => {
    if (!carouselApi) return;
    
    const onSelect = () => {
      setActiveIndex(carouselApi.selectedScrollSnap());
    };
    
    carouselApi.on("select", onSelect);
    carouselApi.on("reInit", onSelect);
    
    return () => {
      carouselApi.off("select", onSelect);
      carouselApi.off("reInit", onSelect);
    };
  }, [carouselApi]);

  // Keyboard navigation for carousel
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!carouselApi) return;
      
      if (event.key === 'ArrowLeft') {
        carouselApi.scrollPrev();
      } else if (event.key === 'ArrowRight') {
        carouselApi.scrollNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [carouselApi]);

  // Function to scroll to a specific slide
  const scrollToIndex = (index: number) => {
    if (carouselApi) {
      carouselApi.scrollTo(index);
    }
  };

  // Funções para Reuniões
  const handleCreateMeeting = () => {
    toast({
      title: "Nova reunião criada",
      description: "O link foi copiado para sua área de transferência"
    });
  };

  const handleJoinMeeting = (meetingId: string) => {
    const meeting = meetings.find(m => m.id === meetingId);
    if (meeting) {
      setActiveCall(meeting);
    }
  };

  const handleCopyLink = () => {
    // Simular cópia de link
    toast({
      title: "Link copiado",
      description: "Link da reunião copiado para a área de transferência"
    });
  };

  const handleEndCall = () => {
    setActiveCall(null);
  };

  // Carregar eventos fictícios para exemplo
  useEffect(() => {
    if (user) {
      const demoEvents: CalendarEvent[] = [
        {
          id: '1',
          title: 'Reunião com equipe de marketing',
          description: 'Discussão sobre a nova campanha',
          start: '2023-06-15T10:00',
          end: '2023-06-15T11:30',
          color: 'purple',
          isAllDay: false
        },
        {
          id: '2',
          title: 'Almoço com cliente',
          description: 'Restaurante no centro',
          start: '2023-06-16T12:30',
          end: '2023-06-16T14:00',
          color: 'blue',
          isAllDay: false
        },
        {
          id: '3',
          title: 'Prazo final do projeto Alpha',
          description: 'Entregar todos os documentos',
          start: '2023-06-20T00:00',
          end: '2023-06-20T23:59',
          color: 'red',
          isAllDay: true
        }
      ];
      
      // Adicionar alguns eventos para o mês atual
      const currentEvents = generateCurrentMonthEvents();
      setEvents([...demoEvents, ...currentEvents]);
    }
  }, [user]);

  // Gerar eventos para o mês atual para demonstração
  const generateCurrentMonthEvents = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    const events: CalendarEvent[] = [];
    
    // Adicionar evento para hoje
    events.push({
      id: uuidv4(),
      title: 'Evento de hoje',
      description: 'Este evento está agendado para hoje',
      start: format(now, "yyyy-MM-dd'T'10:00"),
      end: format(now, "yyyy-MM-dd'T'11:00"),
      color: 'green',
      isAllDay: false
    });
    
    // Adicionar alguns eventos aleatórios para o resto do mês
    for (let i = 1; i <= 5; i++) {
      const day = Math.floor(Math.random() * 28) + 1;
      const hour = Math.floor(Math.random() * 12) + 9; // 9 AM - 8 PM
      const randomDate = new Date(currentYear, currentMonth, day, hour);
      
      events.push({
        id: uuidv4(),
        title: `Evento ${i}`,
        description: `Descrição do evento ${i}`,
        start: format(randomDate, "yyyy-MM-dd'T'HH:00"),
        end: format(new Date(randomDate.getTime() + 60 * 60 * 1000), "yyyy-MM-dd'T'HH:00"),
        color: ['purple', 'blue', 'green', 'yellow', 'red'][Math.floor(Math.random() * 5)],
        isAllDay: Math.random() > 0.8 // 20% chance de ser evento de dia inteiro
      });
    }
    
    return events;
  };

  const handleAddEvent = (date: Date) => {
    setSelectedDate(date);
    setSelectedEvent(null);
    setIsModalOpen(true);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsModalOpen(true);
  };

  const handleSaveEvent = (eventData: CalendarEvent) => {
    if (selectedEvent) {
      // Editar evento existente
      setEvents(prevEvents => prevEvents.map(event => 
        event.id === selectedEvent.id ? { ...eventData, id: event.id } : event
      ));
      
      toast({
        title: "Evento atualizado",
        description: "As alterações foram salvas com sucesso."
      });
    } else {
      // Criar novo evento
      const newEvent = {
        ...eventData,
        id: uuidv4()
      };
      
      setEvents(prevEvents => [...prevEvents, newEvent]);
      
      toast({
        title: "Evento criado",
        description: "O evento foi adicionado ao calendário."
      });
    }
  };

  return (
    <Layout>
      <div className="p-6">
        {/* INÍCIO DO CONTEÚDO DE REUNIÕES */}
        <h1 className="text-2xl font-bold mb-6">Reuniões</h1>
        
        {!activeCall ? (
          <>
            <div className="flex justify-between mb-6">
              <Button onClick={handleCreateMeeting} className="app-button-primary">
                <Video className="mr-2 h-4 w-4" /> Nova Reunião
              </Button>
              
              <div className="flex gap-2">
                <Input placeholder="Código ou link da reunião" className="bg-app-black/50" />
                <Button variant="outline">Entrar</Button>
              </div>
            </div>
            
            <div className="relative px-4 py-10 mb-8">
              <Carousel
                setApi={setCarouselApi}
                className="w-full"
                opts={{
                  align: "center",
                  loop: true,
                }}
              >
                <CarouselContent className="py-4">
                  {meetings.map((meeting, index) => (
                    <CarouselItem key={meeting.id} className="sm:basis-2/3 md:basis-1/2 lg:basis-1/3 xl:basis-1/4 pl-6 py-2">
                      <div className="relative h-full">
                        <Card 
                          onClick={() => scrollToIndex(index)}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              scrollToIndex(index);
                            }
                          }}
                          className={`bg-app-black h-full transition-all duration-300 ease-in-out transform cursor-pointer ${
                            activeIndex === index 
                              ? 'scale-105 opacity-100 z-10 shadow-[0_8px_16px_rgba(0,0,0,0.6)] border-app-purple border-2' 
                              : 'scale-90 opacity-60 z-0 shadow-[0_2px_4px_rgba(0,0,0,0.3)] border-app-border border'
                          }`}
                        >
                          <CardHeader>
                            <CardTitle className="flex justify-between items-center">
                              {meeting.title}
                              {meeting.isActive && (
                                <span className="text-xs bg-green-600/20 text-green-400 px-2 py-1 rounded-full">
                                  Ativa agora
                                </span>
                              )}
                            </CardTitle>
                            <CardDescription>
                              <div className="flex items-center mt-1 text-muted-foreground">
                                <CalendarIcon className="mr-1 h-4 w-4" />
                                {format(meeting.date, 'dd MMMM, HH:mm', { locale: ptBR })}
                              </div>
                              <div className="flex items-center mt-1 text-muted-foreground">
                                <Users className="mr-1 h-4 w-4" />
                                {meeting.participants} participantes
                              </div>
                            </CardDescription>
                          </CardHeader>
                          <CardFooter className="flex justify-between">
                            <Button size="sm" variant="outline" onClick={handleCopyLink}>
                              <LinkIcon className="mr-1 h-4 w-4" /> Copiar Link
                            </Button>
                            <Button size="sm" onClick={() => handleJoinMeeting(meeting.id)} className="app-button-primary">
                              <Video className="mr-1 h-4 w-4" /> Entrar
                            </Button>
                          </CardFooter>
                        </Card>
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>

                <div className="flex flex-col items-center gap-4 mt-4">
                  <div className="flex items-center justify-center gap-4">
                    <CarouselPrevious 
                      className="relative left-0 right-auto translate-y-0 static h-10 w-10"
                      aria-label="Ver reunião anterior"
                    />
                    <CarouselNext 
                      className="relative right-0 left-auto translate-y-0 static h-10 w-10"
                      aria-label="Ver próxima reunião"
                    />
                  </div>
                  
                  {/* Carousel position indicators (dots) */}
                  <div className="flex items-center justify-center gap-2 mt-2">
                    {meetings.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => scrollToIndex(index)}
                        aria-label={`Ir para reunião ${index + 1}`}
                        aria-current={activeIndex === index ? "true" : "false"}
                        className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                          activeIndex === index 
                            ? 'bg-app-purple scale-125' 
                            : 'bg-app-border hover:bg-app-border/80'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </Carousel>
            </div>
          </>
        ) : (
          <div className="flex flex-col h-[calc(100vh-200px)] mb-8">
            <div className="bg-app-black/50 rounded-lg p-4 mb-4 flex justify-between items-center shadow-[0_4px_6px_rgba(0,0,0,0.4)]">
              <h2 className="font-semibold text-lg">{activeCall.title}</h2>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">{activeCall.participants} participantes</span>
                <Button variant="outline" size="sm" onClick={handleCopyLink}>
                  <Copy className="h-4 w-4 mr-1" /> Copiar Link
                </Button>
              </div>
            </div>
            
            <div className="flex flex-1 gap-4">
              <div className={`flex-1 ${isChatOpen ? 'w-3/4' : 'w-full'} transition-all duration-300`}>
                <div className="bg-black rounded-lg h-full p-4 flex items-center justify-center shadow-[0_4px_6px_rgba(0,0,0,0.4)]">
                  <div className="text-center">
                    {isVideoEnabled ? (
                      <Video className="h-24 w-24 mx-auto text-muted-foreground" />
                    ) : (
                      <VideoOff className="h-24 w-24 mx-auto text-muted-foreground" />
                    )}
                    <p className="mt-4 text-muted-foreground">
                      {isVideoEnabled ? 'Câmera ativa' : 'Câmera desativada'}
                    </p>
                  </div>
                </div>
              </div>
              
              {isChatOpen && (
                <div className="w-1/4 bg-app-black/50 rounded-lg p-4 flex flex-col shadow-[0_4px_6px_rgba(0,0,0,0.4)]">
                  <h3 className="font-medium mb-2">Chat da Reunião</h3>
                  <div className="flex-1 overflow-y-auto mb-2 space-y-2">
                    <div className="bg-app-black/30 rounded p-2">
                      <p className="text-xs text-app-purple">João Silva</p>
                      <p className="text-sm">Olá a todos!</p>
                    </div>
                    <div className="bg-app-black/30 rounded p-2">
                      <p className="text-xs text-app-purple">Maria Oliveira</p>
                      <p className="text-sm">Bom dia! Podemos começar?</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Input placeholder="Digite sua mensagem..." className="bg-app-black/30" />
                    <Button size="sm" variant="outline">Enviar</Button>
                  </div>
                </div>
              )}
            </div>
            
            <div className="bg-app-black/50 rounded-lg p-4 mt-4 flex justify-center items-center space-x-4 shadow-[0_4px_6px_rgba(0,0,0,0.4)]">
              <Button 
                variant="outline" 
                size="icon" 
                className={`rounded-full w-12 h-12 ${isAudioEnabled ? '' : 'bg-red-500/20 border-red-500/50'}`}
                onClick={() => setIsAudioEnabled(!isAudioEnabled)}
              >
                {isAudioEnabled ? <Mic /> : <MicOff />}
              </Button>
              
              <Button 
                variant="outline" 
                size="icon" 
                className={`rounded-full w-12 h-12 ${isVideoEnabled ? '' : 'bg-red-500/20 border-red-500/50'}`}
                onClick={() => setIsVideoEnabled(!isVideoEnabled)}
              >
                {isVideoEnabled ? <Video /> : <VideoOff />}
              </Button>
              
              <Button 
                variant="outline" 
                size="icon" 
                className={`rounded-full w-12 h-12 ${isScreenSharing ? 'bg-green-500/20 border-green-500/50' : ''}`}
                onClick={() => setIsScreenSharing(!isScreenSharing)}
              >
                <ScreenShare />
              </Button>
              
              <Button 
                variant="outline" 
                size="icon" 
                className={`rounded-full w-12 h-12 ${isChatOpen ? 'bg-app-purple/20 border-app-purple/50' : ''}`}
                onClick={() => setIsChatOpen(!isChatOpen)}
              >
                <MessageSquare />
              </Button>
              
              <Button 
                variant="destructive" 
                size="icon" 
                className="rounded-full w-12 h-12"
                onClick={handleEndCall}
              >
                <PhoneOff />
              </Button>
            </div>
          </div>
        )}
        {/* FIM DO CONTEÚDO DE REUNIÕES */}
        
        {/* Separador visual */}
        <div className="border-t border-app-border my-8"></div>
        
        {/* INÍCIO DO CONTEÚDO DE CALENDÁRIO */}
        <h1 className="text-2xl font-bold mb-6">Calendário</h1>
        
        <CalendarView 
          events={events} 
          onEventClick={handleEventClick}
          onDateClick={handleAddEvent}
          onAddEvent={handleAddEvent}
        />
        
        <EventModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveEvent}
          defaultDate={selectedDate || undefined}
          event={selectedEvent || undefined}
        />
        {/* FIM DO CONTEÚDO DE CALENDÁRIO */}
      </div>
    </Layout>
  );
};

export default Calendar;
