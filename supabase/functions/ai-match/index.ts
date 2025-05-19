
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Sem token de autorização' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { companyProfile, preferences = {} } = await req.json();
    
    if (!companyProfile) {
      return new Response(JSON.stringify({ error: 'Perfil da empresa é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Montando o prompt para o GPT-4o-mini
    const systemPrompt = `Você é um assistente especializado em encontrar matches comerciais B2B entre empresas.
    Dados os detalhes de uma empresa e suas preferências, encontre potenciais parceiros de negócios que poderiam
    ser interessantes para ela. Análise indústria, tamanho, necessidades e oportunidades.`;

    const userPrompt = `Perfil da Empresa:
    - Nome: ${companyProfile.name || 'N/A'}
    - Indústria: ${companyProfile.industry || 'N/A'}
    - Tamanho: ${companyProfile.size || 'N/A'}
    - Sobre: ${companyProfile.about || 'N/A'}
    
    Preferências para matches:
    - Indústrias desejadas: ${preferences.industries ? preferences.industries.join(', ') : 'Qualquer indústria'}
    - Tamanho desejado: ${preferences.size || 'Qualquer tamanho'}
    - Tipo de relacionamento: ${preferences.relationshipType || 'Fornecedor/Cliente'}
    
    Por favor, analise e sugira 3-5 tipos de empresas que seriam boas matches para parcerias, fornecedores ou clientes.
    Para cada tipo, forneça:
    1. Indústria/Segmento
    2. Razões para o match ser benéfico
    3. Pontuação de compatibilidade de 0-100
    4. Potenciais áreas de colaboração`;

    // Chamada para o OpenAI GPT-4o-mini
    console.log("Chamando GPT-4o-mini para análise de match");
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Erro na chamada OpenAI:', data);
      return new Response(JSON.stringify({ error: 'Erro ao processar o match com IA', details: data.error }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const matchSuggestions = data.choices[0].message.content;
    
    // Processamos as sugestões para estruturar melhor os resultados
    const processedMatches = {
      suggestions: matchSuggestions,
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(processedMatches), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Erro no processamento:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
