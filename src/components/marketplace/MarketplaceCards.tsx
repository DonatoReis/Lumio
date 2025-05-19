import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Search, Filter, X, Package, Briefcase, Cpu, Code } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import MarketplaceCard, { MarketplaceItem, ItemType } from './MarketplaceCard';

interface FilterOptions {
  searchQuery: string;
  category: string | null;
  type: ItemType | 'all';
  priceRange: [number, number];
  sortBy: 'newest' | 'price-low' | 'price-high' | 'alphabetical';
}

interface MarketplaceCardsProps {
  items: MarketplaceItem[];
  onBuy: (id: string) => void;
  loading?: boolean;
  initialFilters?: Partial<FilterOptions>;
  categories: string[];
}

const defaultFilterOptions: FilterOptions = {
  searchQuery: '',
  category: null,
  type: 'all',
  priceRange: [0, 1000000],
  sortBy: 'newest',
};

const MarketplaceCards: React.FC<MarketplaceCardsProps> = ({ 
  items, 
  onBuy, 
  loading = false, 
  initialFilters = {}, 
  categories = []
}) => {
  const [filters, setFilters] = useState<FilterOptions>({
    ...defaultFilterOptions,
    ...initialFilters,
  });
  
  const [showFilters, setShowFilters] = useState(false);
  const [visibleItems, setVisibleItems] = useState<MarketplaceItem[]>([]);
  const [itemsToShow, setItemsToShow] = useState(12);
  
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0.1,
    triggerOnce: false,
  });

  // Apply filters to the items
  const filteredItems = useCallback(() => {
    return items.filter(item => {
      // Search query filter
      const matchesSearch = 
        filters.searchQuery === '' || 
        item.name.toLowerCase().includes(filters.searchQuery.toLowerCase()) || 
        (item.description && item.description.toLowerCase().includes(filters.searchQuery.toLowerCase())) ||
        (item.tags && item.tags.some(tag => tag.toLowerCase().includes(filters.searchQuery.toLowerCase())));
      
      // Category filter
      const matchesCategory = 
        !filters.category || 
        item.category === filters.category;
      
      // Type filter
      const matchesType = 
        filters.type === 'all' || 
        item.type === filters.type;
      
      // Price range filter
      const matchesPriceRange = 
        item.price >= filters.priceRange[0] && 
        item.price <= filters.priceRange[1];
      
      return matchesSearch && matchesCategory && matchesType && matchesPriceRange;
    }).sort((a, b) => {
      // Sort items based on sortBy filter
      switch (filters.sortBy) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'price-low':
          return a.price - b.price;
        case 'price-high':
          return b.price - a.price;
        case 'alphabetical':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });
  }, [items, filters]);

  // Update visible items when filters change or load more items
  useEffect(() => {
    const filtered = filteredItems();
    setVisibleItems(filtered.slice(0, itemsToShow));
  }, [filteredItems, itemsToShow]);

  // Load more items when scrolling to the bottom
  useEffect(() => {
    if (inView && visibleItems.length < filteredItems().length) {
      setItemsToShow(prev => prev + 8);
    }
  }, [inView, filteredItems, visibleItems.length]);

  const resetFilters = () => {
    setFilters(defaultFilterOptions);
  };

  const updateFilter = (key: keyof FilterOptions, value: FilterValueType) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Search and filter bar */}
      <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar produtos, serviços, software..."
              className="pl-10"
              value={filters.searchQuery}
              onChange={(e) => updateFilter('searchQuery', e.target.value)}
            />
            {filters.searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 h-6 w-6 -translate-y-1/2"
                onClick={() => updateFilter('searchQuery', '')}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        
        <div className="flex space-x-2">
          <Button 
            variant={showFilters ? "default" : "outline"} 
            className="flex items-center whitespace-nowrap"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            {showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
          </Button>
          
          <Select
            value={filters.category || 'all'}
            onValueChange={(value) => updateFilter('category', value === 'all' ? null : value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todas as categorias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {categories.map(category => (
                <SelectItem key={category} value={category}>{category}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Advanced filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden bg-card rounded-lg p-4 border"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h3 className="font-medium mb-3">Tipo de item</h3>
                <RadioGroup
                  value={filters.type}
                  onValueChange={(value) => updateFilter('type', value)}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="all" />
                    <Label htmlFor="all" className="flex items-center">
                      <Package className="h-4 w-4 mr-2 text-gray-500" />
                      Todos os tipos
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="product" id="product" />
                    <Label htmlFor="product" className="flex items-center">
                      <Package className="h-4 w-4 mr-2 text-green-500" />
                      Produtos
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="service" id="service" />
                    <Label htmlFor="service" className="flex items-center">
                      <Briefcase className="h-4 w-4 mr-2 text-blue-500" />
                      Serviços
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="software" id="software" />
                    <Label htmlFor="software" className="flex items-center">
                      <Code className="h-4 w-4 mr-2 text-purple-500" />
                      Software
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="hardware" id="hardware" />
                    <Label htmlFor="hardware" className="flex items-center">
                      <Cpu className="h-4 w-4 mr-2 text-orange-500" />
                      Hardware
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              
              <div>
              <h3 className="font-medium mb-3">Ordenar por</h3>
              <RadioGroup
                value={filters.sortBy}
                onValueChange={(value: 'newest' | 'price-low' | 'price-high' | 'alphabetical') => updateFilter('sortBy', value)}
                className="space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="newest" id="newest" />
                    <Label htmlFor="newest">Mais recentes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="price-low" id="price-low" />
                    <Label htmlFor="price-low">Menor preço</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="price-high" id="price-high" />
                    <Label htmlFor="price-high">Maior preço</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="alphabetical" id="alphabetical" />
                    <Label htmlFor="alphabetical">Ordem alfabética</Label>
                  </div>
                </RadioGroup>
              </div>
              
              <div>
                <h3 className="font-medium mb-3">Filtros ativos</h3>
                <div className="flex flex-wrap gap-2 mb-4">
                  {filters.searchQuery && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      Busca: {filters.searchQuery}
                      <X 
                        className="h-3 w-3 ml-1 cursor-pointer" 
                        onClick={() => updateFilter('searchQuery', '')} 
                      />
                    </Badge>
                  )}
                  {filters.category && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      Categoria: {filters.category}
                      <X 
                        className="h-3 w-3 ml-1 cursor-pointer" 
                        onClick={() => updateFilter('category', null)} 
                      />
                    </Badge>
                  )}
                  {filters.type !== 'all' && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      Tipo: {filters.type}
                      <X 
                        className="h-3 w-3 ml-1 cursor-pointer" 
                        onClick={() => updateFilter('type', 'all')} 
                      />
                    </Badge>
                  )}
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={resetFilters}
                  className="w-full"
                >
                  Limpar todos os filtros
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Summary of results */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {loading ? (
            'Carregando itens...'
          ) : (
            `Mostrando ${visibleItems.length} de ${filteredItems().length} itens`
          )}
        </p>
        {filteredItems().length > 0 && visibleItems.length !== filteredItems().length && (
          <Button 
            variant="link" 
            onClick={() => setItemsToShow(filteredItems().length)}
            className="text-sm font-normal"
          >
            Carregar todos
          </Button>
        )}
      </div>
      
      {/* Grid of cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-40 w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      ) : filteredItems().length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border">
          <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-medium mb-2">Nenhum item encontrado</h3>
          <p className="text-muted-foreground">
            Ajuste os filtros para encontrar os itens que você está procurando.
          </p>
        </div>
      ) : (
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          variants={container}
          initial="hidden"
          animate="show"
        >
          {visibleItems.map((item) => (
            <MarketplaceCard
              key={item.id}
              item={item}
              onBuy={() => onBuy(item.id)}
            />
          ))}
        </motion.div>
      )}
    </div>
  );
};

export default MarketplaceCards;
