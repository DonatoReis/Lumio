
import React, { useState } from 'react';
import { useAIMatch } from '@/hooks/useAIMatch';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Sparkles, Share2, BarChart3 } from 'lucide-react';

const industriesOptions = [
  "Tecnologia", "Saúde", "Financeiro", "Varejo", 
  "Manufatura", "Educação", "Alimentos", "Logística",
  "Construção", "Agrícola", "Energia", "Consultoria"
];

const sizeOptions = [
  "Startup", "Pequena", "Média", "Grande", "Enterprise"
];

const relationshipOptions = [
  "Fornecedor", "Cliente", "Parceiro", "Investidor", "Distribuidor"
];

const AIMatch = () => {
  const { loading, results, generateMatch, clearResults } = useAIMatch();
  const [activeTab, setActiveTab] = useState("profile");
  
  const [companyProfile, setCompanyProfile] = useState({
    name: "",
    industry: "",
    size: "",
    about: ""
  });

  const [preferences, setPreferences] = useState({
    industries: [] as string[],
    size: "",
    relationshipType: ""
  });

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setCompanyProfile({
      ...companyProfile,
      [e.target.name]: e.target.value
    });
  };

  const handleIndustrySelect = (industry: string) => {
    if (preferences.industries.includes(industry)) {
      setPreferences({
        ...preferences,
        industries: preferences.industries.filter(i => i !== industry)
      });
    } else {
      setPreferences({
        ...preferences,
        industries: [...preferences.industries, industry]
      });
    }
  };

  const handleSubmit = async () => {
    if (!companyProfile.name) {
      alert("Por favor, informe o nome da empresa");
      return;
    }
    
    await generateMatch(companyProfile, preferences);
    setActiveTab("results");
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          <Sparkles className="h-6 w-6 text-app-yellow" />
          <h1 className="text-3xl font-bold">Match por IA</h1>
        </div>
        
        <p className="text-gray-500 dark:text-gray-400 mb-8">
          Nosso algoritmo de IA analisa perfis empresariais e encontra os melhores matches para parcerias, 
          fornecedores ou clientes potenciais com base nas suas necessidades específicas.
        </p>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2">
            <Card className="bg-sidebar border-sidebar-border shadow-lg">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Encontrar Matches</CardTitle>
                    <TabsList className="grid grid-cols-2">
                      <TabsTrigger value="profile">Perfil</TabsTrigger>
                      <TabsTrigger value="results">Resultados</TabsTrigger>
                    </TabsList>
                  </div>
                  <CardDescription>
                    Deixe nossa IA encontrar as melhores empresas para você conectar
                  </CardDescription>
                </CardHeader>
                
                <CardContent>
                  <TabsContent value="profile">
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <h2 className="text-xl font-semibold">Informações da Empresa</h2>
                        <div className="space-y-4">
                          <div>
                            <label htmlFor="name" className="text-sm font-medium mb-1 block">
                              Nome da Empresa *
                            </label>
                            <Input
                              id="name"
                              name="name"
                              placeholder="Nome da sua empresa"
                              value={companyProfile.name}
                              onChange={handleProfileChange}
                              className="bg-muted/50"
                            />
                          </div>
                          
                          <div>
                            <label htmlFor="industry" className="text-sm font-medium mb-1 block">
                              Indústria
                            </label>
                            <Select
                              value={companyProfile.industry}
                              onValueChange={(value) => 
                                setCompanyProfile({...companyProfile, industry: value})
                              }
                            >
                              <SelectTrigger className="bg-muted/50">
                                <SelectValue placeholder="Selecione a indústria" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  {industriesOptions.map(industry => (
                                    <SelectItem key={industry} value={industry}>
                                      {industry}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div>
                            <label htmlFor="size" className="text-sm font-medium mb-1 block">
                              Tamanho da Empresa
                            </label>
                            <Select
                              value={companyProfile.size}
                              onValueChange={(value) => 
                                setCompanyProfile({...companyProfile, size: value})
                              }
                            >
                              <SelectTrigger className="bg-muted/50">
                                <SelectValue placeholder="Selecione o tamanho" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  {sizeOptions.map(size => (
                                    <SelectItem key={size} value={size}>
                                      {size}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div>
                            <label htmlFor="about" className="text-sm font-medium mb-1 block">
                              Sobre a Empresa
                            </label>
                            <Textarea
                              id="about"
                              name="about"
                              placeholder="Descreva brevemente o que sua empresa faz, produtos/serviços, mercados atendidos..."
                              value={companyProfile.about}
                              onChange={handleProfileChange}
                              className="bg-muted/50 min-h-[120px]"
                            />
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <h2 className="text-xl font-semibold">Preferências para Matches</h2>
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium mb-1 block">
                              Indústrias Desejadas 
                              <span className="text-xs text-muted-foreground"> (opcional)</span>
                            </label>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {industriesOptions.map(industry => (
                                <Button
                                  key={industry}
                                  type="button"
                                  variant={preferences.industries.includes(industry) 
                                    ? "default" 
                                    : "outline"}
                                  size="sm"
                                  onClick={() => handleIndustrySelect(industry)}
                                  className={preferences.industries.includes(industry) 
                                    ? "bg-app-yellow hover:bg-app-yellow/90" 
                                    : ""}
                                >
                                  {industry}
                                </Button>
                              ))}
                            </div>
                          </div>
                          
                          <div>
                            <label className="text-sm font-medium mb-1 block">
                              Tamanho Desejado
                              <span className="text-xs text-muted-foreground"> (opcional)</span>
                            </label>
                            <Select
                              value={preferences.size}
                              onValueChange={(value) => 
                                setPreferences({...preferences, size: value})
                              }
                            >
                              <SelectTrigger className="bg-muted/50">
                                <SelectValue placeholder="Qualquer tamanho" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  {sizeOptions.map(size => (
                                    <SelectItem key={size} value={size}>
                                      {size}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div>
                            <label className="text-sm font-medium mb-1 block">
                              Tipo de Relacionamento
                              <span className="text-xs text-muted-foreground"> (opcional)</span>
                            </label>
                            <Select
                              value={preferences.relationshipType}
                              onValueChange={(value) => 
                                setPreferences({...preferences, relationshipType: value})
                              }
                            >
                              <SelectTrigger className="bg-muted/50">
                                <SelectValue placeholder="Selecione o tipo" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  {relationshipOptions.map(option => (
                                    <SelectItem key={option} value={option}>
                                      {option}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="results">
                    <div className="space-y-4">
                      {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                          <Loader2 className="h-12 w-12 animate-spin text-app-yellow mb-4" />
                          <p className="text-lg text-center">Nossa IA está analisando perfis e encontrando os melhores matches...</p>
                          <p className="text-sm text-muted-foreground text-center mt-2">
                            Isso pode levar alguns segundos
                          </p>
                        </div>
                      ) : results ? (
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold flex items-center">
                              <Sparkles className="mr-2 h-5 w-5 text-app-yellow" />
                              Resultados da IA
                            </h2>
                            <div className="flex space-x-2">
                              <Button variant="outline" size="sm" className="flex items-center">
                                <Share2 className="mr-1 h-4 w-4" />
                                Compartilhar
                              </Button>
                              <Button variant="outline" size="sm" className="flex items-center">
                                <BarChart3 className="mr-1 h-4 w-4" />
                                Métricas
                              </Button>
                            </div>
                          </div>
                          
                          <div className="bg-muted/30 rounded-md p-4 whitespace-pre-line">
                            {results.suggestions}
                          </div>
                          
                          <div className="text-xs text-muted-foreground mt-3">
                            Gerado em: {new Date(results.timestamp).toLocaleString()}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                          <h3 className="text-xl font-medium mb-2">Nenhum resultado ainda</h3>
                          <p className="text-muted-foreground mb-4">
                            Preencha seu perfil e preferências, então clique em "Gerar Matches" para obter resultados da IA.
                          </p>
                          <Button onClick={() => setActiveTab("profile")}>
                            Voltar para o perfil
                          </Button>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </CardContent>
                
                <CardFooter>
                  {activeTab === "profile" ? (
                    <Button 
                      onClick={handleSubmit} 
                      className="w-full bg-app-yellow hover:bg-app-yellow/90"
                      disabled={loading || !companyProfile.name}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Gerar Matches
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      onClick={clearResults}
                      variant="outline"
                      className="w-full"
                      disabled={loading}
                    >
                      Nova Consulta
                    </Button>
                  )}
                </CardFooter>
              </Tabs>
            </Card>
          </div>
          
          <div className="md:col-span-1">
            <Card className="bg-sidebar border-sidebar-border shadow-lg">
              <CardHeader>
                <CardTitle>Como Funciona</CardTitle>
                <CardDescription>
                  O processo de match por IA
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="bg-app-yellow/20 text-app-yellow rounded-full p-2 mt-1">
                      <span className="font-semibold text-sm">1</span>
                    </div>
                    <div>
                      <h4 className="font-medium">Forneça suas informações</h4>
                      <p className="text-sm text-muted-foreground">
                        Preencha os dados da sua empresa e preferências para matches
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="bg-app-yellow/20 text-app-yellow rounded-full p-2 mt-1">
                      <span className="font-semibold text-sm">2</span>
                    </div>
                    <div>
                      <h4 className="font-medium">Análise com GPT-4o-mini</h4>
                      <p className="text-sm text-muted-foreground">
                        Nossa IA analisa seu perfil e identifica oportunidades de negócio compatíveis
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="bg-app-yellow/20 text-app-yellow rounded-full p-2 mt-1">
                      <span className="font-semibold text-sm">3</span>
                    </div>
                    <div>
                      <h4 className="font-medium">Receba sugestões personalizadas</h4>
                      <p className="text-sm text-muted-foreground">
                        Veja os melhores matches com detalhes sobre compatibilidade e oportunidades
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="bg-app-yellow/20 text-app-yellow rounded-full p-2 mt-1">
                      <span className="font-semibold text-sm">4</span>
                    </div>
                    <div>
                      <h4 className="font-medium">Entre em contato</h4>
                      <p className="text-sm text-muted-foreground">
                        Inicie conversas com potenciais parceiros através da nossa plataforma
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AIMatch;
