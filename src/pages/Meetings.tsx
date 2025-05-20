
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Layout from '@/components/layout/Layout';
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

interface Meeting {
  id: string;
  title: string;
  date: Date;
  participants: number;
  isActive: boolean;
}

const Meetings = () => {
  const [meetings, setMeetings] = useState<Meeting[]>([
    { id: '1', title: 'Reunião de Alinhamento', date: new Date(), participants: 5, isActive: true },
    { id: '2', title: 'Apresentação de Resultados', date: new Date(Date.now() + 86400000), participants: 12, isActive: false },
    { id: '3', title: 'Entrevista com Cliente', date: new Date(Date.now() + 172800000), participants: 3, isActive: false },
    { id: '4', title: 'Planejamento Estratégico', date: new Date(Date.now() + 259200000), participants: 7, isActive: false },
  ]);
  const [activeCall, setActiveCall] = useState<Meeting | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [activeIndex, setActiveIndex] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(true);
  const { toast } = useToast();

  // Create a ref array to store references to each meeting card for focus management
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Define the onSelect callback with useCallback to ensure stable reference
  const onSelect = useCallback(() => {
    if (!carouselApi) return;
    
    const currentIndex = carouselApi.selectedScrollSnap();
    setActiveIndex(currentIndex);
    setCanScrollPrev(carouselApi.canScrollPrev());
    setCanScrollNext(carouselApi.canScrollNext());
    
    // Focus the currently active card for better accessibility
    if (cardRefs.current[currentIndex]) {
      cardRefs.current[currentIndex]?.focus();
    }
    
    console.log('Selected index:', currentIndex);
  }, [carouselApi]);
  
  // Setup carousel event listeners
  useEffect(() => {
    if (!carouselApi) return;
    
    // Initial setup to ensure states are correctly initialized
    onSelect();
    
    // Event registration
    carouselApi.on("select", onSelect);
    carouselApi.on("reInit", onSelect);
    
    return () => {
      carouselApi.off("select", onSelect);
      carouselApi.off("reInit", onSelect);
    };
  }, [carouselApi, onSelect]);

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

  // Define navigation functions with useCallback
  const scrollPrev = useCallback(() => {
    if (carouselApi && canScrollPrev) {
      carouselApi.scrollPrev();
    }
  }, [carouselApi, canScrollPrev]);
  
  const scrollNext = useCallback(() => {
    if (carouselApi && canScrollNext) {
      carouselApi.scrollNext();
    }
  }, [carouselApi, canScrollNext]);
  
  // Function to scroll to a specific slide
  const scrollToIndex = useCallback((index: number) => {
    if (carouselApi) {
      carouselApi.scrollTo(index);
      
      // No need to explicitly update active index here as the onSelect handler will do that
      // But we can provide immediate feedback via toast
      toast({
        title: `Reunião ${index + 1} selecionada`,
        description: meetings[index].title,
      });
      
      console.log('Scrolled to index:', index);
    }
  }, [carouselApi, meetings, toast]);

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

  return (
    <Layout>
      <div className="p-6">
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
            
            <div className="relative px-4 py-10">
              <Carousel
                setApi={setCarouselApi}
                className="w-full overflow-hidden"
                opts={{
                  align: "start",
                  containScroll: "trimSnaps",
                  loop: false,
                  dragFree: false, // Ensures snap behavior
                }}
              >
                <CarouselContent className="py-4 overflow-visible">
                  {meetings.map((meeting, index) => (
                    <CarouselItem key={meeting.id} className="sm:basis-2/3 md:basis-1/2 lg:basis-1/3 xl:basis-1/4 pl-6 py-2">
                      <div className="relative h-full transform transition-all duration-500 ease-in-out">
                        <Card 
                          ref={(el) => cardRefs.current[index] = el}
                          onClick={() => scrollToIndex(index)}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              scrollToIndex(index);
                            } else if (e.key === 'ArrowLeft') {
                              scrollPrev();
                            } else if (e.key === 'ArrowRight') {
                              scrollNext();
                            }
                          }}
                          className={`bg-app-black h-full cursor-pointer transition-all duration-500 ease-in-out ${
                            activeIndex === index 
                              ? 'scale-105 opacity-100 z-10 shadow-[0_8px_16px_rgba(0,0,0,0.6)] border-app-yellow border-2 ring ring-app-yellow/30 ring-offset-1 ring-offset-black' 
                              : 'scale-90 opacity-60 z-0 shadow-[0_2px_4px_rgba(0,0,0,0.3)] border-app-border border hover:scale-95 hover:opacity-80'
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
                    <Button 
                      onClick={scrollPrev}
                      disabled={!canScrollPrev}
                      className="relative left-0 right-auto translate-y-0 h-10 w-10 rounded-full transition-all duration-300 ease-in-out hover:bg-app-yellow/20"
                      variant="outline"
                      aria-label="Ver reunião anterior"
                    >
                      <span className="sr-only">Anterior</span>
                      <CarouselPrevious className="h-8 w-8" />
                    </Button>
                    <Button
                      onClick={scrollNext}
                      disabled={!canScrollNext}
                      className="relative right-0 left-auto translate-y-0 h-10 w-10 rounded-full transition-all duration-300 ease-in-out hover:bg-app-yellow/20"
                      variant="outline"
                      aria-label="Ver próxima reunião"
                    >
                      <span className="sr-only">Próxima</span>
                      <CarouselNext className="h-8 w-8" />
                    </Button>
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
                            ? 'bg-app-yellow scale-125' 
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
          <div className="flex flex-col h-[calc(100vh-200px)]">
            <div className="bg-app-black/50 rounded-lg p-4 mb-4 flex justify-between items-center">
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
                <div className="bg-black rounded-lg h-full p-4 flex items-center justify-center">
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
                <div className="w-1/4 bg-app-black/50 rounded-lg p-4 flex flex-col">
                  <h3 className="font-medium mb-2">Chat da Reunião</h3>
                  <div className="flex-1 overflow-y-auto mb-2 space-y-2">
                    <div className="bg-app-black/30 rounded p-2">
                      <p className="text-xs text-app-yellow">João Silva</p>
                      <p className="text-sm">Olá a todos!</p>
                    </div>
                    <div className="bg-app-black/30 rounded p-2">
                      <p className="text-xs text-app-yellow">Maria Oliveira</p>
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
            
            <div className="bg-app-black/50 rounded-lg p-4 mt-4 flex justify-center items-center space-x-4">
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
                className={`rounded-full w-12 h-12 ${isChatOpen ? 'bg-app-yellow/20 border-app-yellow/50' : ''}`}
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
      </div>
    </Layout>
  );
};

export default Meetings;
