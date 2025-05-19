
import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Paperclip, Image, File, Sticker, Map, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type AttachmentOptionsProps = {
  onAttach: (type: string, file?: File) => void;
};

const AttachmentOptions: React.FC<AttachmentOptionsProps> = ({ onAttach }) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [mapDialogOpen, setMapDialogOpen] = useState(false);
  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false);

  const handleAttachOption = (type: string) => {
    setOpen(false);
    
    if (type === 'image' || type === 'document') {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = type === 'image' ? 'image/*' : '.pdf,.doc,.docx,.txt';
      fileInput.onchange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (target.files && target.files[0]) {
          onAttach(type, target.files[0]);
        }
      };
      fileInput.click();
    } else if (type === 'sticker') {
      toast({
        title: "Stickers",
        description: "Escolha um sticker para enviar",
      });
      // In a real implementation, this would open a sticker picker
      onAttach('sticker');
    } else if (type === 'location') {
      setMapDialogOpen(true);
    } else if (type === 'agenda') {
      setCalendarDialogOpen(true);
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
            <Paperclip className="h-5 w-5 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0">
          <div className="p-1">
            <Button 
              variant="ghost" 
              className="w-full justify-start" 
              onClick={() => handleAttachOption('image')}
            >
              <Image className="h-4 w-4 mr-2" />
              Imagem
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start" 
              onClick={() => handleAttachOption('document')}
            >
              <File className="h-4 w-4 mr-2" />
              Documento
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start" 
              onClick={() => handleAttachOption('sticker')}
            >
              <Sticker className="h-4 w-4 mr-2" />
              Sticker
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start" 
              onClick={() => handleAttachOption('location')}
            >
              <Map className="h-4 w-4 mr-2" />
              Localização
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start" 
              onClick={() => handleAttachOption('agenda')}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Agenda
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={mapDialogOpen} onOpenChange={setMapDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Compartilhar Localização</DialogTitle>
          </DialogHeader>
          <div className="aspect-video bg-muted flex items-center justify-center">
            <Map className="h-12 w-12 opacity-50" />
            <p className="absolute text-sm text-muted-foreground">
              Mapa seria exibido aqui
            </p>
          </div>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setMapDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => {
              onAttach('location');
              setMapDialogOpen(false);
              toast({
                title: "Localização compartilhada",
                description: "Sua localização foi compartilhada com sucesso"
              });
            }}>
              Compartilhar Localização
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={calendarDialogOpen} onOpenChange={setCalendarDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Compartilhar Evento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">Título do Evento</label>
              <input className="w-full border rounded p-2 mt-1" placeholder="Reunião" />
            </div>
            <div>
              <label className="text-sm font-medium">Data e Hora</label>
              <input type="datetime-local" className="w-full border rounded p-2 mt-1" />
            </div>
          </div>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setCalendarDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => {
              onAttach('agenda');
              setCalendarDialogOpen(false);
              toast({
                title: "Evento compartilhado",
                description: "Seu evento foi compartilhado com sucesso"
              });
            }}>
              Compartilhar Evento
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AttachmentOptions;
