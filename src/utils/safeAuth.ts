
/**
 * Utility module for secure authentication operations
 * This file handles secure operations that require service role access
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

// Configurações para o cliente com role de serviço
// Esta instância do cliente só deve ser usada em funções Edge ou no servidor
// NUNCA deve ser importada ou usada em código que roda no navegador
const createServiceClient = () => {
  if (typeof window !== 'undefined') {
    console.error("CRITICAL SECURITY ERROR: O cliente de serviço não deve ser usado no navegador");
    return null;
  }
  
  try {
    // Este cliente só funcionará em Edge Functions ou ambiente de servidor
    return createClient<Database>(
      "https://cdsiyppfnffuksddfqhd.supabase.co", 
      // A chave está armazenada como segredo e só é acessível em Edge Functions
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  } catch (error) {
    console.error("Erro ao criar cliente de serviço:", error);
    return null;
  }
};

// Esta função só deve ser usada em Edge Functions
export const findUserByEmailSecure = async (email: string) => {
  const serviceClient = createServiceClient();
  if (!serviceClient) {
    throw new Error("Cliente de serviço não disponível");
  }
  
  try {
    // Usa o cliente service_role para buscar usuário por email
    const { data, error } = await serviceClient
      .from('profiles')
      .select('id, email')
      .ilike('email', email.trim())
      .limit(1);
      
    if (error) throw error;
    
    if (data && data.length > 0) {
      return data[0];
    }
    
    // Se não encontrar na tabela profiles, busca direto no auth.users (apenas em Edge Function)
    // Corrigindo o tipo do parâmetro - remove o filter property que não é suportado
    const { data: authData, error: authError } = await serviceClient.auth.admin.listUsers({
      perPage: 1,
      page: 1,
      // Removendo a propriedade filter que não faz parte do tipo PageParams
      // O método listUsers não aceita filter diretamente
    });
    
    if (authError) throw authError;
    
    // Filtramos manualmente os resultados para encontrar o usuário com o email desejado
    if (authData && authData.users) {
      // Adicionando tipo explícito para corrigir o erro TS2339
      const matchedUser = authData.users.find(
        (user: { id: string; email?: string | null }) => user.email?.toLowerCase() === email.trim().toLowerCase()
      );
      
      if (matchedUser) {
        return {
          id: matchedUser.id,
          email: matchedUser.email || email
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error("Erro na busca segura de usuário:", error);
    throw error;
  }
};

// Exportação apenas para Edge Functions
export default {
  findUserByEmailSecure
};
