
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { messageContent, conversationHistory, analysisType } = await req.json();
    
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (!messageContent || !analysisType) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let prompt = "";
    let systemPrompt = "";
    
    switch (analysisType) {
      case "summarize":
        systemPrompt = "Você é um assistente especializado em resumir conversas de negócios com precisão e concisão.";
        prompt = `Por favor, crie um resumo executivo da seguinte conversa. Destaque os principais pontos, decisões tomadas e próximos passos:\n\n${messageContent}`;
        break;
        
      case "sentiment":
        systemPrompt = "Você é um analista especializado em análise de sentimento de comunicações empresariais.";
        prompt = `Analise o tom e sentimento da seguinte mensagem de negócios. Forneça uma classificação (positivo, negativo, neutro) e explique brevemente sua análise:\n\n${messageContent}`;
        break;
        
      case "suggest":
        systemPrompt = "Você é um assistente executivo especializado em comunicação empresarial eficaz.";
        prompt = `Com base na conversa anterior e na última mensagem, sugira uma resposta profissional e estratégica:\n\nHistórico da conversa:\n${conversationHistory || "Sem histórico disponível."}\n\nÚltima mensagem:\n${messageContent}`;
        break;
        
      case "keypoints":
        systemPrompt = "Você é um assistente especializado em extrair informações essenciais de conversas de negócios.";
        prompt = `Extraia os pontos-chave e informações importantes da seguinte conversa. Organize por tópicos relevantes:\n\n${messageContent}`;
        break;
        
      default:
        return new Response(
          JSON.stringify({ error: "Invalid analysis type" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    // Call GPT-4o-mini
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
      }),
    });

    const data = await response.json();

    if (!data.choices || data.choices.length === 0) {
      throw new Error("Unexpected response from OpenAI API");
    }

    const result = data.choices[0].message.content;

    // Edge function logging
    console.log(`Analysis type: ${analysisType}, Characters analyzed: ${messageContent.length}`);

    return new Response(
      JSON.stringify({ result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Error in GPT analysis function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
