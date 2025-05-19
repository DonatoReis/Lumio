
import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Smile } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Lista simplificada de emojis
const emojis = {
  smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰'],
  gestures: ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤙', '👋', '🤚', '🖐️', '✋', '🖖', '👏', '🙌', '👐', '🤲'],
  symbols: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖'],
  objects: ['🎁', '🎄', '🎉', '🎊', '🎂', '🍕', '🍔', '🍟', '🍿', '🍩', '🍪', '🍫', '🍬', '🍭', '🍯', '🍺']
};

type EmojiPickerProps = {
  onEmojiSelect: (emoji: string) => void;
};

const EmojiPicker: React.FC<EmojiPickerProps> = ({ onEmojiSelect }) => {
  const [open, setOpen] = useState(false);

  const handleEmojiClick = (emoji: string) => {
    onEmojiSelect(emoji);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
          <Smile className="h-5 w-5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0">
        <Tabs defaultValue="smileys">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="smileys">😀</TabsTrigger>
            <TabsTrigger value="gestures">👍</TabsTrigger>
            <TabsTrigger value="symbols">❤️</TabsTrigger>
            <TabsTrigger value="objects">🎁</TabsTrigger>
          </TabsList>
          
          {Object.entries(emojis).map(([category, categoryEmojis]) => (
            <TabsContent key={category} value={category} className="p-3">
              <div className="grid grid-cols-8 gap-1">
                {categoryEmojis.map((emoji, index) => (
                  <Button 
                    key={index}
                    variant="ghost" 
                    className="h-8 w-8 p-0" 
                    onClick={() => handleEmojiClick(emoji)}
                  >
                    {emoji}
                  </Button>
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </PopoverContent>
    </Popover>
  );
};

export default EmojiPicker;
