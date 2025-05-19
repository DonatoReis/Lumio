import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader, ArrowLeft } from 'lucide-react';
import { ItemType } from '@/components/marketplace/MarketplaceCard';

interface Product {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number;
  image_url: string | null;
  seller_id: string;
}

const EditProduct: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [notAuthorized, setNotAuthorized] = useState(false);
  
  // Product state
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productImageUrl, setProductImageUrl] = useState('');
  const [productType, setProductType] = useState<ItemType>('product');
  const [uploading, setUploading] = useState(false);
  
  // Load product data
  useEffect(() => {
    const fetchProduct = async () => {
      if (!user || !id) {
        navigate('/marketplace');
        return;
      }
      
      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('id', id)
          .single();
          
        if (error) {
          throw error;
        }
        
        if (!data) {
          setNotFound(true);
          return;
        }
        
        // Check if current user is the seller
        if (data.seller_id !== user.id) {
          setNotAuthorized(true);
          return;
        }
        
        // Set form values
        setProductName(data.name || '');
        setProductDescription(data.description || '');
        setProductCategory(data.category || '');
        setProductPrice(data.price.toString() || '');
        setProductImageUrl(data.image_url || '');
        
        // Determine product type based on category
        setProductType(determineProductType(data.category));
        
      } catch (error: any) {
        console.error('Error fetching product:', error);
        toast({
          variant: "destructive",
          title: "Erro ao carregar produto",
          description: error.message || "Não foi possível carregar os dados do produto",
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchProduct();
  }, [id, user, navigate, toast]);
  
  // Determine type based on category
  const determineProductType = (category: string | null): ItemType => {
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
  
  const handleUpdateProduct = async () => {
    if (!user || !id) return;
    
    if (!productName || !productDescription || !productPrice) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Nome, descrição e preço são obrigatórios",
      });
      return;
    }
    
    try {
      setUpdating(true);
      
      const price = parseFloat(productPrice);
      if (isNaN(price) || price <= 0) {
        throw new Error('Preço inválido');
      }
      
      const { error } = await supabase
        .from('products')
        .update({
          name: productName,
          description: productDescription,
          category: productCategory || null,
          price: price,
          image_url: productImageUrl || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('seller_id', user.id); // Make sure only the owner can update
        
      if (error) throw error;
      
      toast({
        title: "Produto atualizado",
        description: "As alterações foram salvas com sucesso",
      });
      
      // Navigate back to marketplace
      navigate('/marketplace');
      
    } catch (error: any) {
      console.error('Erro ao atualizar produto:', error);
      toast({
        variant: "destructive",
        title: "Erro ao atualizar produto",
        description: error.message || "Não foi possível atualizar o produto",
      });
    } finally {
      setUpdating(false);
    }
  };
  
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    try {
      setUploading(true);
      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${id}_${Date.now()}.${fileExt}`;
      const filePath = `product-images/${fileName}`;
      
      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(filePath, file);
        
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('products')
        .getPublicUrl(filePath);
        
      // Update image URL state
      setProductImageUrl(publicUrl);
      
      toast({
        title: "Upload concluído",
        description: "Sua imagem foi carregada com sucesso",
      });
    } catch (error: any) {
      console.error('Erro no upload:', error);
      toast({
        variant: "destructive",
        title: "Erro no upload",
        description: error.message || "Não foi possível fazer o upload da imagem",
      });
    } finally {
      setUploading(false);
    }
  };
  
  // Show appropriate messages for different states
  if (notFound) {
    return (
      <Layout>
        <div className="container mx-auto py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Produto não encontrado</h1>
            <p className="mb-6">O produto que você está procurando não existe ou foi removido.</p>
            <Button onClick={() => navigate('/marketplace')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar para o Marketplace
            </Button>
          </div>
        </div>
      </Layout>
    );
  }
  
  if (notAuthorized) {
    return (
      <Layout>
        <div className="container mx-auto py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Acesso não autorizado</h1>
            <p className="mb-6">Você não tem permissão para editar este produto.</p>
            <Button onClick={() => navigate('/marketplace')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar para o Marketplace
            </Button>
          </div>
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout>
      <div className="container mx-auto py-6">
        <div className="mb-6 flex items-center">
          <Button variant="ghost" onClick={() => navigate('/marketplace')} className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <h1 className="text-2xl font-bold">Editar Produto</h1>
        </div>
        
        {loading ? (
          <div className="flex justify-center my-12">
            <Loader className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="max-w-2xl mx-auto bg-card p-6 rounded-lg border">
            <div className="grid gap-6">
              <div className="grid gap-2">
                <Label htmlFor="productName">Nome do produto *</Label>
                <Input
                  id="productName"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Nome do produto"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="productDescription">Descrição *</Label>
                <Textarea
                  id="productDescription"
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  placeholder="Descreva o produto"
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="productCategory">Categoria</Label>
                  <Input
                    id="productCategory"
                    value={productCategory}
                    onChange={(e) => setProductCategory(e.target.value)}
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
                    value={productPrice}
                    onChange={(e) => setProductPrice(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="grid gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="productImageUpload">Upload de imagem</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      id="productImageUpload"
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploading}
                      className="cursor-pointer"
                    />
                    {uploading && <Loader className="h-4 w-4 animate-spin" />}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Faça upload de uma nova imagem para o produto, ou use uma URL abaixo
                  </p>
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="productImage">URL da imagem</Label>
                  <Input
                    id="productImage"
                    value={productImageUrl}
                    onChange={(e) => setProductImageUrl(e.target.value)}
                    placeholder="URL da imagem do produto"
                  />
                </div>
                
                {productImageUrl && (
                  <div className="mt-2 aspect-video w-full max-w-md mx-auto overflow-hidden bg-muted rounded-md border">
                    <img 
                      src={productImageUrl} 
                      alt={productName} 
                      className="h-full w-full object-cover"
                      onError={(e) => e.currentTarget.src = 'https://placehold.co/600x400?text=Imagem+não+disponível'}
                    />
                  </div>
                )}
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => navigate('/marketplace')}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleUpdateProduct}
                  disabled={updating}
                  className="bg-app-purple hover:bg-app-purple/90"
                >
                  {updating ? <Loader className="h-4 w-4 animate-spin mr-2" /> : null}
                  Salvar alterações
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default EditProduct;

