
import React, { useState } from 'react';
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  addDays, 
  addWeeks, 
  addMonths, 
  subDays, 
  subWeeks, 
  subMonths,
  isSameDay,
  isSameMonth,
  parseISO 
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type CalendarViewType = 'day' | 'week' | 'month';

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  color?: string;
}

interface CalendarViewProps {
  events?: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onDateClick?: (date: Date) => void;
  onAddEvent?: (date: Date) => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({
  events = [],
  onEventClick,
  onDateClick,
  onAddEvent
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<CalendarViewType>('month');

  const handlePrevious = () => {
    if (viewType === 'day') {
      setCurrentDate(subDays(currentDate, 1));
    } else if (viewType === 'week') {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const handleNext = () => {
    if (viewType === 'day') {
      setCurrentDate(addDays(currentDate, 1));
    } else if (viewType === 'week') {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Renderiza a visualização do dia
  const renderDayView = () => {
    const dayEvents = events.filter(event => 
      isSameDay(parseISO(event.start), currentDate)
    );

    return (
      <div className="calendar-day-view">
        <div className="text-xl font-medium mb-4">
          {format(currentDate, 'EEEE, dd MMMM yyyy', { locale: ptBR })}
        </div>
        
        <div className="h-[600px] overflow-y-auto bg-app-black/50 rounded-lg p-4 shadow-[0_4px_6px_rgba(0,0,0,0.4)]">
          {Array.from({ length: 24 }).map((_, hour) => {
            const hourEvents = dayEvents.filter(event => {
              const startHour = parseISO(event.start).getHours();
              return startHour === hour;
            });

            return (
              <div key={hour} className="flex mb-2">
                <div className="w-16 text-right pr-4 text-muted-foreground">
                  {hour}:00
                </div>
                <div className="flex-1 min-h-[3rem] border-t border-app-border relative">
                  {hourEvents.map(event => (
                    <div
                      key={event.id}
                      onClick={() => onEventClick?.(event)}
                      className={cn(
                        "absolute left-0 right-0 px-2 py-1 rounded-sm mb-1 cursor-pointer",
                        event.color ? `bg-${event.color}-600/20 text-${event.color}-400` : "bg-app-purple/20 text-app-purple-foreground"
                      )}
                      style={{ top: `${(parseISO(event.start).getMinutes() / 60) * 100}%` }}
                    >
                      {event.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Renderiza a visualização da semana
  const renderWeekView = () => {
    const start = startOfWeek(currentDate, { locale: ptBR });
    const end = endOfWeek(currentDate, { locale: ptBR });

    const days = [];
    let day = start;
    
    while (day <= end) {
      days.push(day);
      day = addDays(day, 1);
    }

    return (
      <div className="calendar-week-view">
        <div className="grid grid-cols-7 gap-2 mb-2">
          {days.map(day => (
            <div key={day.toString()} className="text-center font-medium">
              <div className="text-muted-foreground text-sm">
                {format(day, 'EEEE', { locale: ptBR })}
              </div>
              <div className={cn(
                "w-8 h-8 rounded-full mx-auto flex items-center justify-center",
                isSameDay(day, new Date()) && "bg-app-purple text-white"
              )}>
                {format(day, 'd')}
              </div>
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-2 h-[600px]">
          {days.map(day => {
            const dayEvents = events.filter(event => 
              isSameDay(parseISO(event.start), day)
            );

            return (
              <div 
                key={day.toString()} 
                className={cn(
                  "bg-app-black/50 rounded-lg p-2 overflow-y-auto shadow-[0_4px_6px_rgba(0,0,0,0.4)]",
                  isSameDay(day, new Date()) && "border border-app-purple"
                )}
              >
                {dayEvents.map(event => (
                  <div
                    key={event.id}
                    onClick={() => onEventClick?.(event)}
                    className={cn(
                      "px-2 py-1 rounded-sm text-sm mb-1 cursor-pointer",
                      event.color ? `bg-${event.color}-600/20 text-${event.color}-400` : "bg-app-purple/20 text-app-purple-foreground"
                    )}
                  >
                    <div className="text-xs text-muted-foreground">
                      {format(parseISO(event.start), 'HH:mm')}
                    </div>
                    <div className="truncate font-medium">
                      {event.title}
                    </div>
                  </div>
                ))}
                
                <button
                  onClick={() => onAddEvent?.(day)}
                  className="w-full mt-1 flex items-center justify-center p-1 text-xs rounded-sm bg-app-black/30 hover:bg-app-black/50 text-muted-foreground"
                >
                  <Plus size={12} className="mr-1" /> Adicionar
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Renderiza a visualização do mês
  const renderMonthView = () => {
    const start = startOfWeek(startOfMonth(currentDate), { locale: ptBR });
    const end = endOfWeek(endOfMonth(currentDate), { locale: ptBR });

    const days = [];
    let day = start;
    
    while (day <= end) {
      days.push(day);
      day = addDays(day, 1);
    }

    const weekDays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

    return (
      <div className="calendar-month-view">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {weekDays.map(weekDay => (
            <div key={weekDay} className="text-center font-medium text-muted-foreground text-sm">
              {weekDay}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-1">
          {days.map(day => {
            const dayEvents = events.filter(event => 
              isSameDay(parseISO(event.start), day)
            );
            const isCurrentMonth = isSameMonth(day, currentDate);

            return (
              <div 
                key={day.toString()} 
                onClick={() => onDateClick?.(day)}
                className={cn(
                  "min-h-[100px] p-1 rounded border border-app-border bg-app-black/30 cursor-pointer shadow-[0_4px_6px_rgba(0,0,0,0.4)]",
                  !isCurrentMonth && "opacity-50",
                  isSameDay(day, new Date()) && "border-app-purple"
                )}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className={cn(
                    "text-sm font-medium",
                    isSameDay(day, new Date()) && "text-app-purple"
                  )}>
                    {format(day, 'd')}
                  </span>
                  
                  {dayEvents.length > 0 && (
                    <span className="text-xs bg-app-purple text-black rounded-full w-5 h-5 flex items-center justify-center">
                      {dayEvents.length}
                    </span>
                  )}
                </div>
                
                <div className="space-y-1 overflow-hidden max-h-[80px]">
                  {dayEvents.slice(0, 3).map(event => (
                    <div
                      key={event.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick?.(event);
                      }}
                      className={cn(
                        "px-1 py-0.5 rounded-sm text-xs truncate",
                        event.color ? `bg-${event.color}-600/20 text-${event.color}-400` : "bg-app-purple/20 text-app-purple-foreground"
                      )}
                    >
                      {event.title}
                    </div>
                  ))}
                  
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-muted-foreground text-center">
                      +{dayEvents.length - 3} mais
                    </div>
                  )}
                </div>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-app-black/50 flex items-center justify-center hover:bg-app-black/70 text-muted-foreground"
                    >
                      <Plus size={12} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-auto p-0">
                    <button
                      className="w-full p-2 text-sm hover:bg-app-black/50"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddEvent?.(day);
                      }}
                    >
                      Adicionar evento
                    </button>
                  </PopoverContent>
                </Popover>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Renderiza a visualização adequada com base no tipo selecionado
  const renderCalendarView = () => {
    switch (viewType) {
      case 'day':
        return renderDayView();
      case 'week':
        return renderWeekView();
      case 'month':
        return renderMonthView();
      default:
        return renderMonthView();
    }
  };

  return (
    <div className="calendar-container shadow-[0_4px_6px_rgba(0,0,0,0.4)]">
      <div className="calendar-header">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrevious}>
            <ChevronLeft size={16} />
          </Button>
          
          <Button variant="outline" size="sm" onClick={handleToday}>
            Hoje
          </Button>
          
          <Button variant="outline" size="sm" onClick={handleNext}>
            <ChevronRight size={16} />
          </Button>
          
          <h2 className="text-lg font-medium ml-2">
            {viewType === 'day' && format(currentDate, 'd MMMM yyyy', { locale: ptBR })}
            {viewType === 'week' && `${format(startOfWeek(currentDate, { locale: ptBR }), 'd MMM')} - ${format(endOfWeek(currentDate, { locale: ptBR }), 'd MMM')}`}
            {viewType === 'month' && format(currentDate, 'MMMM yyyy', { locale: ptBR })}
          </h2>
        </div>
        
        <div className="calendar-view-selector">
          <Button 
            variant={viewType === 'day' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setViewType('day')}
          >
            Dia
          </Button>
          
          <Button 
            variant={viewType === 'week' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setViewType('week')}
          >
            Semana
          </Button>
          
          <Button 
            variant={viewType === 'month' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setViewType('month')}
          >
            Mês
          </Button>
        </div>
      </div>
      
      {renderCalendarView()}
    </div>
  );
};

export default CalendarView;
