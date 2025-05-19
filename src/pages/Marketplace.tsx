import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePayment } from '@/hooks/usePayment';
import { useToast } from '@/hooks/use-toast';
import { XCircle as XMarkIcon } from 'lucide-react';
import { Database } from '@/types/supabase';

type Product = Database['public']['Tables']['products']['Row'];
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ShoppingCart, Loader, Search as SearchIcon, Filter } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import Layout from '@/components/layout/Layout';
import MarketplaceCards from '@/components/marketplace/MarketplaceCards';
import { MarketplaceItem, ItemType } from '@/components/marketplace/MarketplaceCard';

const Marketplace: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [marketplaceItems, setMarketplaceItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const { user } = useAuth();
  const { toast } = useToast();
  const { loading: paymentLoading, initiateCheckout } = usePayment();
  
  // Estado para novo produto
  const [newProductName, setNewProductName] = useState('');
  const [newProductDescription, setNewProductDescription] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductImageUrl, setNewProductImageUrl] = useState('');
  const [newProductType, setNewProductType] = useState<ItemType>('product');
  const [addProductDialogOpen, setAddProductDialogOpen] = useState(false);
  const [creatingProduct, setCreatingProduct] = useState(false);

  // Convert Product objects to MarketplaceItem objects
  const convertProductsToMarketplaceItems = (products: Product[]): MarketplaceItem[] => {
    return products.map(product => ({
      id: product.id,
      name: product.name,
      description: product.description || '',
      price: product.price,
      image_url: product.image_url,
      seller_id: product.seller_id,
      seller_name: "Vendedor", // Could be enhanced with a profile lookup
      category: product.category,
      type: determineProductType(product.category),
      currency: product.currency || 'R$',
      created_at: product.created_at,
      updated_at: product.updated_at,
      status: 'active',
      tags: product.category ? [product.category] : []
    }));
  };

  // Determine type based on category
  const determineProductType = (category: string | undefined): ItemType => {
    if (!category) return 'product';
    
    const lowerCategory = category.toLowerCase();
    
    if (lowerCategory.includes('serviço') || lowerCategory.includes('servico') || lowerCategory === 'service') {
      return 'service';
    }
    
    if (lowerCategory.includes('software') || lowerCategory.includes('programa') || lowerCategory.includes('app')) {
      return 'software';
    }
    
    if (lowerCategory.includes('hardware') || lowerCategory.includes('equipamento')) {
      return 'hardware';
    }
    
    return 'product';
  };

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        
        let query = supabase
          .from('products')
          .select('*')
          .order('created_at', { ascending: false });
          
        if (selectedCategory) {
          query = query.eq('category', selectedCategory);
        }
        
        if (searchQuery.trim() !== '') {
          query = query.ilike('name', `%${searchQuery}%`);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        if (data) {
          setProducts(data);
          setMarketplaceItems(convertProductsToMarketplaceItems(data));
          
          // Extrair categorias únicas
          const uniqueCategories = [...new Set(data.map(p => p.category))].filter(Boolean);
          setCategories(uniqueCategories as string[]);
        }
      } catch (error: any) {
        console.error('Erro ao carregar produtos:', error);
        toast({
          variant: "destructive",
          title: "Erro ao carregar produtos",
          description: error.message || "Não foi possível carregar a lista de produtos",
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchProducts();
    
    // Configurar subscription em tempo real
    const subscription = supabase
      .channel('products_changes')
      .on('postgres_changes', 
        {
          event: '*', 
          schema: 'public', 
          table: 'products',
        }, 
        () => {
          fetchProducts();
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(subscription);
    };
  }, [selectedCategory, searchQuery, toast]);
  
  const handleBuyProduct = async (productId: string) => {
    if (!user) {
      toast({
        title: "Faça login",
        description: "Você precisa estar logado para comprar produtos",
      });
      return;
    }
    
    try {
      await initiateCheckout(productId, { mode: 'payment' });
    } catch (error) {
      console.error('Erro ao processar compra:', error);
    }
  };
  
  const handleAddProduct = async () => {
    if (!user) return;
    
    if (!newProductName || !newProductDescription || !newProductPrice) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Nome, descrição e preço são obrigatórios",
      });
      return;
    }
    
    try {
      setCreatingProduct(true);
      
      const price = parseFloat(newProductPrice);
      if (isNaN(price) || price <= 0) {
        throw new Error('Preço inválido');
      }
      
      const { error } = await supabase
        .from('products')
        .insert({
          name: newProductName,
          description: newProductDescription,
          category: newProductCategory || null,
          price: price,
          image_url: newProductImageUrl || null,
          seller_id: user.id,
          currency: 'R$'
        });
        
      if (error) throw error;
      
      toast({
        title: "Produto adicionado",
        description: "Seu produto foi adicionado ao marketplace",
      });
      
      // Resetar campos
      setNewProductName('');
      setNewProductDescription('');
      setNewProductCategory('');
      setNewProductPrice('');
      setNewProductImageUrl('');
      setNewProductType('product');
      setAddProductDialogOpen(false);
      
    } catch (error: any) {
      console.error('Erro ao adicionar produto:', error);
      toast({
        variant: "destructive",
        title: "Erro ao adicionar produto",
        description: error.message || "Não foi possível adicionar o produto",
      });
    } finally {
      setCreatingProduct(false);
    }
  };
  
  return (
    <Layout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Marketplace B2B</h1>
          
          {user && (
            <Dialog open={addProductDialogOpen} onOpenChange={setAddProductDialogOpen}>
              <DialogTrigger asChild>
                <Button className="app-button-primary">
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Vender produto
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar novo produto</DialogTitle>
                  <DialogDescription>
                    Cadastre seu produto para vender no marketplace B2B.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="productName">Nome do produto *</Label>
                    <Input
                      id="productName"
                      value={newProductName}
                      onChange={(e) => setNewProductName(e.target.value)}
                      placeholder="Nome do produto"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="productDescription">Descrição *</Label>
                    <Textarea
                      id="productDescription"
                      value={newProductDescription}
                      onChange={(e) => setNewProductDescription(e.target.value)}
                      placeholder="Descreva o produto"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="productCategory">Categoria</Label>
                      <Input
                        id="productCategory"
                        value={newProductCategory}
                        onChange={(e) => setNewProductCategory(e.target.value)}
                        placeholder="Categoria do produto"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="productPrice">Preço (R$) *</Label>
                      <Input
                        id="productPrice"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={newProductPrice}
                        onChange={(e) => setNewProductPrice(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="productImage">URL da imagem</Label>
                    <Input
                      id="productImage"
                      value={newProductImageUrl}
                      onChange={(e) => setNewProductImageUrl(e.target.value)}
                      placeholder="URL da imagem do produto"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleAddProduct}
                    disabled={creatingProduct}
                  >
                    {creatingProduct ? <Loader className="h-4 w-4 animate-spin mr-2" /> : null}
                    Adicionar produto
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
        
        {/* Search input */}
        <div className="flex mb-6">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar produtos e serviços..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 h-6 w-6 -translate-y-1/2"
                onClick={() => setSearchQuery('')}
              >
                <XMarkIcon className="h-3 w-3" />
              </Button>
            )}
          </div>
          <Button 
            variant="outline" 
            className="ml-2"
            onClick={() => setSelectedCategory(null)}
            disabled={!selectedCategory}
          >
            <Filter className="h-4 w-4 mr-2" />
            Limpar filtros
          </Button>
        </div>
        
        <Tabs defaultValue="all">
          <TabsList className="mb-6">
            <TabsTrigger value="all">Todos os produtos</TabsTrigger>
            <TabsTrigger value="service">Serviços</TabsTrigger>
            <TabsTrigger value="software">Software</TabsTrigger>
            <TabsTrigger value="hardware">Hardware</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="space-y-4">
            <MarketplaceCards 
              items={marketplaceItems}
              onBuy={handleBuyProduct}
              loading={loading}
              initialFilters={{
                searchQuery,
                category: selectedCategory,
                type: 'all',
                priceRange: [0, 1000000],
                sortBy: 'newest',
              }}
              categories={categories}
            />
          </TabsContent>

          <TabsContent value="service" className="space-y-4">
            <MarketplaceCards 
              items={marketplaceItems.filter(item => item.type === 'service')}
              onBuy={handleBuyProduct}
              loading={loading}
              initialFilters={{
                searchQuery,
                category: selectedCategory,
                type: 'service',
                priceRange: [0, 1000000],
                sortBy: 'newest',
              }}
              categories={categories}
            />
          </TabsContent>

          <TabsContent value="software" className="space-y-4">
            <MarketplaceCards 
              items={marketplaceItems.filter(item => item.type === 'software')}
              onBuy={handleBuyProduct}
              loading={loading}
              initialFilters={{
                searchQuery,
                category: selectedCategory,
                type: 'software',
                priceRange: [0, 1000000],
                sortBy: 'newest',
              }}
              categories={categories}
            />
          </TabsContent>

          <TabsContent value="hardware" className="space-y-4">
            <MarketplaceCards 
              items={marketplaceItems.filter(item => item.type === 'hardware')}
              onBuy={handleBuyProduct}
              loading={loading}
              initialFilters={{
                searchQuery,
                category: selectedCategory,
                type: 'hardware',
                priceRange: [0, 1000000],
                sortBy: 'newest',
              }}
              categories={categories}
            />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Marketplace;
