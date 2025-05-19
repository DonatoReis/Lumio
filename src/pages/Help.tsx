
import React, { useState } from 'react';
import Layout from '@/components/layout/Layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, HelpCircle, FileText, MessageCircle, Video, Book } from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
  category: string;
}

const Help = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  
  const faqItems: FaqItem[] = [
    {
      question: "Como criar uma nova reunião?",
      answer: "Para criar uma nova reunião, acesse a página 'Reuniões' e clique no botão 'Nova Reunião'. Você pode convidar participantes compartilhando o link ou código da reunião.",
      category: "meetings"
    },
    {
      question: "Como ativar a autenticação em dois fatores?",
      answer: "Acesse a página 'Configurações' e depois clique em 'Segurança'. Na seção de 'Verificação em duas etapas', você pode habilitar a autenticação por SMS ou aplicativo autenticador.",
      category: "security"
    },
    {
      question: "Como compartilhar arquivos com criptografia?",
      answer: "Para compartilhar arquivos com criptografia, utilize o recurso 'Compartilhamento Seguro' na página de Arquivos. Os arquivos serão criptografados automaticamente e apenas os destinatários autorizados poderão acessá-los.",
      category: "files"
    },
    {
      question: "Como utilizar o Match por IA?",
      answer: "O recurso de Match por IA está disponível na página 'Match IA'. Basta preencher o perfil de sua empresa e definir os critérios de matching. O sistema irá sugerir parceiros de negócios compatíveis com base nos dados fornecidos.",
      category: "ai"
    },
    {
      question: "Como criar uma equipe e adicionar usuários?",
      answer: "Para criar uma equipe, acesse a página 'Equipes' e clique em 'Nova Equipe'. Após criar a equipe, você pode adicionar membros através do botão 'Adicionar Membro' e inserir os e-mails dos usuários que deseja convidar.",
      category: "teams"
    },
    {
      question: "Como configurar a criptografia end-to-end nas mensagens?",
      answer: "A criptografia end-to-end já está habilitada por padrão para todas as mensagens na seção 'Mensagens Seguras'. Para verificar as chaves de criptografia, acesse 'Configurações' > 'Segurança' > 'Chaves de Criptografia'.",
      category: "security"
    }
  ];

  const categories = [
    { id: 'all', name: 'Todas as categorias', icon: HelpCircle },
    { id: 'security', name: 'Segurança', icon: FileText },
    { id: 'meetings', name: 'Reuniões', icon: Video },
    { id: 'files', name: 'Arquivos', icon: FileText },
    { id: 'teams', name: 'Equipes', icon: MessageCircle },
    { id: 'ai', name: 'Inteligência Artificial', icon: Book },
  ];

  const filteredFaqs = faqItems.filter(faq => 
    (activeCategory === 'all' || faq.category === activeCategory) &&
    (faq.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
     faq.answer.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <Layout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-2">Central de Ajuda</h1>
        <p className="text-muted-foreground mb-6">
          Encontre respostas para suas dúvidas e aprenda a utilizar todos os recursos do sistema
        </p>
        
        <div className="mb-8 relative max-w-2xl">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por dúvidas ou palavras-chave..."
            className="pl-10 bg-app-black/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-64 space-y-2">
            <h3 className="font-medium text-lg mb-4">Categorias</h3>
            {categories.map(category => (
              <button
                key={category.id}
                className={`w-full flex items-center p-2 rounded-md transition-colors ${
                  activeCategory === category.id 
                    ? 'bg-app-purple/20 text-app-purple' 
                    : 'hover:bg-app-black/50'
                }`}
                onClick={() => setActiveCategory(category.id)}
              >
                <category.icon className="mr-2 h-5 w-5" />
                <span>{category.name}</span>
              </button>
            ))}
            
            <div className="border-t border-app-border my-4 pt-4">
              <h3 className="font-medium mb-2">Precisa de mais ajuda?</h3>
              <Button variant="outline" className="w-full justify-start mb-2">
                <MessageCircle className="mr-2 h-4 w-4" /> Falar com suporte
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Video className="mr-2 h-4 w-4" /> Agendar demonstração
              </Button>
            </div>
          </div>
          
          <div className="flex-1">
            <h2 className="font-semibold text-xl mb-4">
              {activeCategory === 'all' 
                ? 'Perguntas Frequentes' 
                : `Perguntas sobre ${categories.find(c => c.id === activeCategory)?.name}`}
            </h2>
            
            {filteredFaqs.length > 0 ? (
              <div className="space-y-4">
                {filteredFaqs.map((faq, index) => (
                  <Card key={index} className="bg-app-black border-app-border hover:border-app-purple/50 transition-all duration-300">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-medium">{faq.question}</CardTitle>
                      <CardDescription>Categoria: {categories.find(c => c.id === faq.category)?.name}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground">{faq.answer}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="bg-app-black/50 rounded-lg p-8 text-center">
                <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium text-lg mb-2">Nenhum resultado encontrado</h3>
                <p className="text-muted-foreground">
                  Não encontramos resultados para sua pesquisa. 
                  Tente usar termos diferentes ou entre em contato com nosso suporte.
                </p>
                <Button className="mt-4">Contactar Suporte</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Help;
