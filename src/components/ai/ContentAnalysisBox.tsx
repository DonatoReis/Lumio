
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, FileText, BarChart, MessageSquare, List } from "lucide-react";
import { useAIAnalysis, AnalysisType } from "@/hooks/useAIAnalysis";

interface ContentAnalysisBoxProps {
  defaultContent?: string;
  showControls?: boolean;
  className?: string;
}

/**
 * Componente para análise de conteúdo utilizando IA
 * Permite resumir, analisar sentimento, sugerir respostas e extrair pontos-chave
 */
export function ContentAnalysisBox({ 
  defaultContent = "", 
  showControls = true,
  className = ""
}: ContentAnalysisBoxProps) {
  const [content, setContent] = useState(defaultContent);
  const [conversationHistory, setConversationHistory] = useState("");
  const [activeTab, setActiveTab] = useState<AnalysisType>("summarize");
  
  const { 
    loading, 
    result, 
    summarize,
    analyzeSentiment,
    suggestResponse,
    extractKeyPoints,
    clearResult 
  } = useAIAnalysis();

  const handleAnalyze = async () => {
    if (!content.trim()) return;
    
    clearResult();
    
    switch (activeTab) {
      case "summarize":
        await summarize(content);
        break;
      case "sentiment":
        await analyzeSentiment(content);
        break;
      case "suggest":
        await suggestResponse(content, conversationHistory);
        break;
      case "keypoints":
        await extractKeyPoints(content);
        break;
    }
  };

  return (
    <Card className={`p-4 ${className}`}>
      <Tabs 
        defaultValue="summarize" 
        value={activeTab} 
        onValueChange={(value) => setActiveTab(value as AnalysisType)}
        className="w-full"
      >
        <TabsList className="grid grid-cols-4 mb-4">
          <TabsTrigger value="summarize" className="flex items-center gap-2">
            <FileText className="h-4 w-4" /> Resumir
          </TabsTrigger>
          <TabsTrigger value="sentiment" className="flex items-center gap-2">
            <BarChart className="h-4 w-4" /> Sentimento
          </TabsTrigger>
          <TabsTrigger value="suggest" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> Sugerir
          </TabsTrigger>
          <TabsTrigger value="keypoints" className="flex items-center gap-2">
            <List className="h-4 w-4" /> Pontos-chave
          </TabsTrigger>
        </TabsList>

        {showControls && (
          <div className="space-y-4">
            <Textarea
              placeholder="Digite ou cole o conteúdo para análise..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[120px] resize-none"
            />
            
            {activeTab === "suggest" && (
              <Textarea
                placeholder="Histórico da conversa (opcional)..."
                value={conversationHistory}
                onChange={(e) => setConversationHistory(e.target.value)}
                className="min-h-[80px] resize-none"
              />
            )}
            
            <Button 
              onClick={handleAnalyze} 
              disabled={loading || !content.trim()} 
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                'Analisar Conteúdo'
              )}
            </Button>
          </div>
        )}

        <div className="mt-4">
          {result && (
            <div className="bg-muted/50 rounded-md p-4 whitespace-pre-wrap">
              {result}
            </div>
          )}
        </div>
      </Tabs>
    </Card>
  );
}
