
import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (eventData: EventData) => void;
  defaultDate?: Date;
  event?: EventData;
}

interface EventData {
  id?: string;
  title: string;
  description: string;
  start: string;
  end: string;
  color: string;
  isAllDay: boolean;
}

const colorOptions = [
  { value: 'purple', label: 'Roxo' },
  { value: 'blue', label: 'Azul' },
  { value: 'green', label: 'Verde' },
  { value: 'red', label: 'Vermelho' },
  { value: 'yellow', label: 'Amarelo' },
];

const EventModal: React.FC<EventModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  defaultDate,
  event 
}) => {
  const [eventData, setEventData] = useState<EventData>({
    title: '',
    description: '',
    start: format(defaultDate || new Date(), "yyyy-MM-dd'T'HH:mm"),
    end: format(defaultDate || new Date(), "yyyy-MM-dd'T'HH:mm"),
    color: 'yellow',
    isAllDay: false,
  });

  // Atualizar dados quando o evento mudar
  useEffect(() => {
    if (event) {
      setEventData(event);
    } else if (defaultDate) {
      setEventData(prev => ({
        ...prev,
        start: format(defaultDate, "yyyy-MM-dd'T'HH:mm"),
        end: format(defaultDate, "yyyy-MM-dd'T'HH:mm"),
      }));
    }
  }, [event, defaultDate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEventData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setEventData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setEventData(prev => ({
      ...prev,
      [name]: checked,
    }));
  };

  const handleSave = () => {
    onSave(eventData);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-app-black border-app-border">
        <DialogHeader>
          <DialogTitle>{event ? 'Editar Evento' : 'Novo Evento'}</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              name="title"
              value={eventData.title}
              onChange={handleChange}
              placeholder="Título do evento"
              className="bg-app-border/30"
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              name="description"
              value={eventData.description}
              onChange={handleChange}
              placeholder="Descrição do evento"
              className="bg-app-border/30 min-h-[100px]"
            />
          </div>
          
          <div className="flex gap-4">
            <div className="flex-1 grid gap-2">
              <Label htmlFor="start">Início</Label>
              <Input
                id="start"
                name="start"
                type="datetime-local"
                value={eventData.start}
                onChange={handleChange}
                className="bg-app-border/30"
                disabled={eventData.isAllDay}
              />
            </div>
            
            <div className="flex-1 grid gap-2">
              <Label htmlFor="end">Fim</Label>
              <Input
                id="end"
                name="end"
                type="datetime-local"
                value={eventData.end}
                onChange={handleChange}
                className="bg-app-border/30"
                disabled={eventData.isAllDay}
              />
            </div>
          </div>
          
          <div className="flex gap-4 items-center">
            <div className="flex items-center space-x-2">
              <input
                id="isAllDay"
                name="isAllDay"
                type="checkbox"
                checked={eventData.isAllDay}
                onChange={handleCheckboxChange}
                className="h-4 w-4"
              />
              <Label htmlFor="isAllDay">Dia todo</Label>
            </div>
            
            <div className="flex-1">
              <Label htmlFor="color">Cor</Label>
              <Select
                value={eventData.color}
                onValueChange={(value) => handleSelectChange('color', value)}
              >
                <SelectTrigger className="bg-app-border/30">
                  <SelectValue placeholder="Selecione uma cor" />
                </SelectTrigger>
                <SelectContent className="bg-app-black border-app-border">
                  {colorOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center">
                        <div className={`w-3 h-3 rounded-full bg-${option.value}-500 mr-2`}></div>
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EventModal;
