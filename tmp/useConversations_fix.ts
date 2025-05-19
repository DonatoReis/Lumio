import { isCompleteEmail, isTokenExpired } from '@/utils/validation';

// Substituir a implementação existente da função findUserByEmail por esta:
const findUserByEmail = async (email: string): Promise<{id: string, email: string} | null> => {
  if (!email || !isCompleteEmail(email)) {
    toast({
      variant: "destructive",
      title: "Email inválido",
      description: "Por favor, forneça um email válido e completo",
    });
    return null;
  }
  
  try {
    console.log("Searching for user with email:", email);
    
    // Verify user is authenticated before proceeding
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.error("Erro ao obter sessão:", sessionError);
      toast({
        variant: "destructive",
        title: "Erro de autenticação",
        description: "Sua sessão expirou ou é inválida. Por favor, faça login novamente.",
      });
      return null;
    }
    
    // Verificar e renovar token se necessário
    let currentToken = session.access_token;
    
    if (!currentToken || isTokenExpired(currentToken)) {
      console.log("Token expirado ou inválido, tentando renovar...");
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError || !refreshData.session) {
        console.error("Falha ao renovar token:", refreshError);
        toast({
          variant: "destructive",
          title: "Erro de autenticação",
          description: "Não foi possível renovar sua sessão. Por favor, faça login novamente.",
        });
        return null;
      }
      
      currentToken = refreshData.session.access_token;
      console.log("Token renovado com sucesso");
    }
    
    // Use the refreshed token for the API call
    console.log("Enviando requisição com token atualizado");
    const response = await fetch(
      "https://cdsiyppfnffuksddfqhd.supabase.co/functions/v1/find-user", 
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentToken}`,
          "apikey": supabase.supabaseKey // Adicionar a chave anônima como fallback
        },
        body: JSON.stringify({ email: email.trim() }),
        credentials: 'include' // Garantir que cookies sejam enviados
      }
    );
    
    // Handle common error cases with more specific messages
    if (!response.ok) {
      console.log(`Resposta da API: ${response.status} ${response.statusText}`);
      
      if (response.status === 404) {
        console.log("No user found with email:", email);
        toast({
          variant: "destructive",
          title: "Usuário não encontrado",
          description: "Este email não está registrado no sistema",
        });
        return null;
      }
      
      if (response.status === 401) {
        console.error("Erro de autenticação 401 mesmo após verificação de token");
        // Try token refresh and retry
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !refreshData.session) {
          toast({
            variant: "destructive", 
            title: "Sessão expirada",
            description: "Sua sessão expirou. Por favor, faça login novamente.",
          });
          return null;
        }
        
        console.log("Tentando novamente com token renovado após erro 401");
        // Retry with new token
        const retryResponse = await fetch(
          "https://cdsiyppfnffuksddfqhd.supabase.co/functions/v1/find-user", 
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${refreshData.session.access_token}`,
              "apikey": supabase.supabaseKey
            },
            body: JSON.stringify({ email: email.trim() }),
            credentials: 'include'
          }
        );
        
        if (!retryResponse.ok) {
          console.error(`Falha na segunda tentativa: ${retryResponse.status}`);
          throw new Error(`HTTP error! status: ${retryResponse.status}`);
        }
        
        const retryData = await retryResponse.json();
        return retryData.user ? { id: retryData.user.id, email: retryData.user.email } : null;
      }
      
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const { user } = await response.json();
    
    if (user) {
      console.log("User found:", user);
      return {
        id: user.id,
        email: user.email
      };
    }
    
    console.log("No user found with email:", email);
    toast({
      variant: "destructive",
      title: "Usuário não encontrado",
      description: "Não foi possível encontrar um usuário com esse email",
    });
    return null;
    
  } catch (err) {
    console.error('Exception searching for user by email:', err);
    toast({
      variant: "destructive",
      title: "Erro na busca",
      description: "Ocorreu um erro ao buscar o usuário",
    });
    return null;
  }
};
