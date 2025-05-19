// Improved findUserByEmail function with direct database query
const findUserByEmail = async (email: string): Promise<{id: string, email: string} | null> => {
  // Use a função de validação centralizada
  if (!email || !isCompleteEmail(email)) {
    toast({
      variant: "destructive",
      title: "Email inválido",
      description: "Por favor, forneça um email válido e completo",
    });
    return null;
  }
  
  try {
    console.log("Buscando usuário com email (busca direta):", email);
    
    // Buscar diretamente da tabela profiles em vez da Edge Function
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, email')
      .ilike('email', email.trim())
      .limit(1);
    
    if (error) {
      console.error("Erro ao buscar perfil:", error);
      throw error;
    }
    
    if (profiles && profiles.length > 0) {
      console.log("Usuário encontrado:", profiles[0]);
      return {
        id: profiles[0].id,
        email: profiles[0].email
      };
    }
    
    console.log("Nenhum usuário encontrado com email:", email);
    toast({
      variant: "destructive",
      title: "Usuário não encontrado",
      description: "Não foi possível encontrar um usuário com esse email",
    });
    return null;
    
  } catch (err) {
    console.error('Exceção ao buscar usuário por email:', err);
    toast({
      variant: "destructive",
      title: "Erro ao buscar usuário",
      description: "Ocorreu um erro ao buscar o usuário. Tente novamente."
    });
    return null;
  }
};
