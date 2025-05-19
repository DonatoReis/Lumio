
import React, { useState } from 'react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText, FileImage, File, Upload, FolderPlus, Search,
  Download, Share2, Trash, MoreVertical, FileCog
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Tipos de arquivo com seus respectivos ícones
const fileTypes = {
  pdf: <FileText className="text-red-500" />,
  doc: <FileText className="text-blue-500" />,
  docx: <FileText className="text-blue-500" />,
  xls: <FileText className="text-green-500" />,
  xlsx: <FileText className="text-green-500" />,
  png: <FileImage className="text-purple-500" />,
  jpg: <FileImage className="text-purple-500" />,
  jpeg: <FileImage className="text-purple-500" />,
  ppt: <FileCog className="text-orange-500" />,
  pptx: <FileCog className="text-orange-500" />,
  txt: <FileText className="text-gray-500" />,
  other: <File className="text-gray-500" />
};

interface FileItem {
  id: string;
  name: string;
  type: string;
  size: string;
  modified: string;
  shared: boolean;
}

// Dados de exemplo para arquivos
const demoFiles: FileItem[] = [
  { id: '1', name: 'Apresentação de Marketing.pptx', type: 'pptx', size: '2.4 MB', modified: '2023-06-10', shared: true },
  { id: '2', name: 'Relatório Financeiro.pdf', type: 'pdf', size: '1.8 MB', modified: '2023-06-09', shared: false },
  { id: '3', name: 'Planejamento Estratégico.docx', type: 'docx', size: '512 KB', modified: '2023-06-08', shared: true },
  { id: '4', name: 'Logotipo Atualizado.png', type: 'png', size: '3.2 MB', modified: '2023-06-07', shared: false },
  { id: '5', name: 'Planilha de Orçamento.xlsx', type: 'xlsx', size: '1.1 MB', modified: '2023-06-06', shared: true },
];

const Files = () => {
  const [files, setFiles] = useState<FileItem[]>(demoFiles);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const { toast } = useToast();

  const filteredFiles = files.filter(file => {
    const matchesSearch = file.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === 'all') return matchesSearch;
    if (activeTab === 'shared') return matchesSearch && file.shared;
    
    // Filtra por tipo de arquivo
    return matchesSearch && file.type.toLowerCase() === activeTab;
  });

  const handleUpload = () => {
    toast({
      title: "Upload iniciado",
      description: "Seu arquivo está sendo carregado..."
    });
  };

  const handleCreateFolder = () => {
    toast({
      title: "Nova pasta",
      description: "Funcionalidade em desenvolvimento."
    });
  };

  const handleFileAction = (action: string, fileId: string) => {
    const file = files.find(f => f.id === fileId);
    
    if (!file) return;
    
    switch (action) {
      case 'download':
        toast({
          title: "Download iniciado",
          description: `Baixando ${file.name}...`
        });
        break;
      case 'share':
        toast({
          title: "Compartilhar arquivo",
          description: `Opções de compartilhamento para ${file.name}`
        });
        break;
      case 'delete':
        setFiles(files.filter(f => f.id !== fileId));
        toast({
          title: "Arquivo excluído",
          description: `${file.name} foi removido`
        });
        break;
      default:
        break;
    }
  };

  const getFileIcon = (type: string) => {
    const fileType = type.toLowerCase();
    return fileTypes[fileType as keyof typeof fileTypes] || fileTypes.other;
  };

  return (
    <Layout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Arquivos</h1>
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
            <Input 
              placeholder="Pesquisar arquivos..." 
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex space-x-2 w-full md:w-auto">
            <Button onClick={handleUpload} className="flex-1 md:flex-none">
              <Upload size={18} className="mr-2" />
              Carregar
            </Button>
            <Button variant="outline" onClick={handleCreateFolder}>
              <FolderPlus size={18} className="mr-2" />
              Nova Pasta
            </Button>
          </div>
        </div>
        
        <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="pdf">PDFs</TabsTrigger>
            <TabsTrigger value="docx">Documentos</TabsTrigger>
            <TabsTrigger value="xlsx">Planilhas</TabsTrigger>
            <TabsTrigger value="png">Imagens</TabsTrigger>
            <TabsTrigger value="shared">Compartilhados</TabsTrigger>
          </TabsList>
          
          <TabsContent value={activeTab} className="mt-0">
            <div className="bg-app-black rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="border-b border-gray-800">
                  <tr>
                    <th className="text-left p-4">Nome</th>
                    <th className="text-left p-4 hidden md:table-cell">Tamanho</th>
                    <th className="text-left p-4 hidden md:table-cell">Modificado</th>
                    <th className="text-right p-4">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFiles.length > 0 ? (
                    filteredFiles.map(file => (
                      <tr key={file.id} className="border-b border-gray-800 hover:bg-app-purple/5">
                        <td className="p-4">
                          <div className="flex items-center">
                            <div className="mr-3">
                              {getFileIcon(file.type)}
                            </div>
                            <span className="text-sm">{file.name}</span>
                            {file.shared && (
                              <span className="ml-2 text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                                Compartilhado
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-sm text-muted-foreground hidden md:table-cell">{file.size}</td>
                        <td className="p-4 text-sm text-muted-foreground hidden md:table-cell">{file.modified}</td>
                        <td className="p-4">
                          <div className="flex items-center justify-end space-x-2">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleFileAction('download', file.id)}
                            >
                              <Download size={18} />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleFileAction('share', file.id)}
                            >
                              <Share2 size={18} />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleFileAction('delete', file.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash size={18} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-muted-foreground">
                        Nenhum arquivo encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Files;
