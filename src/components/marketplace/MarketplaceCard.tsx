import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ShoppingCart, Tag, Package, Cpu, Code, Briefcase, MoreVertical } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';

export type ItemType = 'product' | 'service' | 'software' | 'hardware';

export interface MarketplaceItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  seller_id?: string;
  seller_name?: string;
  category?: string;
  type: ItemType;
  currency: string;
  created_at: string;
  updated_at: string;
  tags?: string[];
  status: 'active' | 'inactive';
}

interface MarketplaceCardProps {
  item: MarketplaceItem;
  onBuy: (id: string) => void;
  loading?: boolean;
}

const TypeIcon = ({ type }: { type: ItemType }) => {
  switch (type) {
    case 'service':
      return <Briefcase className="h-5 w-5 text-yellow-500" />;
    case 'software':
      return <Code className="h-5 w-5 text-yellow-500" />;
    case 'hardware':
      return <Cpu className="h-5 w-5 text-orange-500" />;
    default:
      return <Package className="h-5 w-5 text-green-500" />;
  }
};

export const MarketplaceCard: React.FC<MarketplaceCardProps> = ({ item, onBuy, loading = false }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      whileHover={{ 
        y: -5,
        transition: { duration: 0.2 }
      }}
      className="h-full"
    >
      <Card className="overflow-hidden h-full transition-all duration-300 shadow-[0_4px_6px_rgba(0,0,0,0.4)] hover:shadow-lg hover:border-app-yellow/30 flex flex-col p-4 gap-4">
        <div className="aspect-video w-full overflow-hidden bg-muted relative">
          {item.image_url ? (
            <motion.img 
              src={item.image_url} 
              alt={item.name} 
              className="h-full w-full object-cover"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.3 }}
              loading="lazy"
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-muted">
              <ShoppingCart className="h-12 w-12 text-muted-foreground/40" />
            </div>
          )}
          <div className="absolute top-2 left-2">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              <Badge className="bg-background/80 backdrop-blur-sm text-foreground flex items-center gap-1.5 px-2.5 py-1">
                <TypeIcon type={item.type} />
                <span className="capitalize">{item.type}</span>
              </Badge>
            </motion.div>
          </div>
          
          <div className="absolute top-2 right-2">
            {user?.id === item.seller_id && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1 rounded-full bg-background/80 backdrop-blur-sm hover:bg-muted/90 transition-colors">
                    <MoreVertical size={16} className="text-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-32">
                  <DropdownMenuItem 
                    onClick={() => navigate(`/marketplace/${item.id}/edit`)}
                    className="cursor-pointer"
                  >
                    Editar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg line-clamp-1">{item.name}</CardTitle>
              <CardDescription className="line-clamp-2 mt-1">
                {item.description}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pb-2 flex-grow">
          <div className="flex flex-wrap gap-1.5 mb-3">
            {item.tags?.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {item.category && !item.tags?.includes(item.category) && (
              <Badge variant="outline" className="text-xs">
                {item.category}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center">
            <Avatar className="h-8 w-8 mr-2">
              <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${item.seller_name || 'Vendor'}`} />
              <AvatarFallback>{item.seller_name?.[0] || 'V'}</AvatarFallback>
            </Avatar>
            <div className="text-sm text-muted-foreground">
              {item.seller_name || 'Vendor'}
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="flex items-center justify-end border-t p-4 mt-auto">
          <div className="flex items-center">
            <Tag className="h-4 w-4 mr-2 text-app-yellow" />
            <motion.span 
              className="text-lg font-bold"
              whileHover={{ scale: 1.05 }}
            >
              {item.currency || 'R$'} {item.price.toFixed(2)}
            </motion.span>
          </div>
          <motion.div className="flex items-center space-x-2"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button 
              onClick={() => onBuy(item.id)} 
              disabled={loading}
              className="bg-app-yellow hover:bg-app-yellow/90"
            >
              {loading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="h-4 w-4 mr-2"
                >
                  ◌
                </motion.div>
              ) : (
                <ShoppingCart className="h-4 w-4 mr-2" />
              )}
              Comprar
            </Button>
          </motion.div>
        </CardFooter>
      </Card>
    </motion.div>
  );
};

export default MarketplaceCard;

