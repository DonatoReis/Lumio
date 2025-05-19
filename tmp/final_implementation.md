# Implementação final para resolver os problemas

## 1. Correção para o erro 401 na função find-user

Abra o arquivo `src/hooks/useConversations.ts` e:

1. Adicione o import de validação no topo do arquivo:
```typescript
import { isCompleteEmail, isTokenExpired } from '@/utils/validation';
```

2. Substitua completamente a implementação da função `findUserByEmail` pela versão abaixo:
```typescript
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
    console.log("Buscando usuário com email:", email);
    
    // Obter a sessão ativa primeiro
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
      console.error("Erro ao obter sessão:", error);
      toast({
        variant: "destructive",
        title: "Erro de autenticação",
        description: "Sua sessão expirou. Por favor, faça login novamente.",
      });
      return null;
    }

    // Usar a função Edge com o token atual
    const token = data.session.access_token;
    console.log("Usando token autenticado:", token ? token.substring(0, 10) + "..." : "token não encontrado");
    
    // Tentar usar o supabase.functions.invoke em vez de fetch manual
    if (supabase.functions && typeof supabase.functions.invoke === 'function') {
      try {
        const { data: userData, error: funcError } = await supabase.functions.invoke('find-user', {
          body: { email: email.trim() }
        });
        
        if (funcError) throw funcError;
        if (userData && userData.user) {
          return {
            id: userData.user.id,
            email: userData.user.email
          };
        }
        return null;
      } catch (fnError) {
        console.error("Erro ao invocar função:", fnError);
        // Fall back to manual fetch
      }
    }

    // Abordagem manual com fetch em fallback
    const anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkc2l5cHBmbmZmdWtzZGRmcWhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwMDU1MDYsImV4cCI6MjA2MjU4MTUwNn0.EidO-C8F1mg7yOVsvtDypJ8HuLCtxke9aUcDGvdtqJM";
    
    const response = await fetch(
      "https://cdsiyppfnffuksddfqhd.supabase.co/functions/v1/find-user",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "apikey": anon_key
        },
        body: JSON.stringify({ email: email.trim() })
      }
    );
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      
      if (response.status === 401) {
        console.log("Tentando renovar o token e repetir a requisição...");
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !refreshData.session) {
          toast({
            variant: "destructive",
            title: "Sessão expirada",
            description: "Sua sessão expirou. Por favor, faça login novamente.",
          });
          return null;
        }
        
        // Repetir com o novo token
        const newToken = refreshData.session.access_token;
        const retryResponse = await fetch(
          "https://cdsiyppfnffuksddfqhd.supabase.co/functions/v1/find-user",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${newToken}`,
              "apikey": anon_key
            },
            body: JSON.stringify({ email: email.trim() })
          }
        );
        
        if (!retryResponse.ok) {
          console.error("Segunda tentativa falhou:", retryResponse.status);
          throw new Error(`Erro HTTP: ${retryResponse.status}`);
        }
        
        const retryData = await retryResponse.json();
        if (retryData && retryData.user) {
          return {
            id: retryData.user.id,
            email: retryData.user.email
          };
        }
        return null;
      }
      
      throw new Error(`Erro HTTP: ${response.status}`);
    }
    
    const responseData = await response.json();
    if (responseData && responseData.user) {
      return {
        id: responseData.user.id,
        email: responseData.user.email
      };
    }
    
    return null;
  } catch (err) {
    console.error("Exceção ao buscar usuário por email:", err);
    toast({
      variant: "destructive",
      title: "Erro ao buscar usuário",
      description: "Ocorreu um erro ao buscar o usuário. Tente novamente."
    });
    return null;
  }
};
```

## 2. Correção para o erro 500 nos meetings

Abra o arquivo `src/components/layout/Navbar.tsx` e localize o trecho:

```typescript
const { data: newMeetings, error: meetingsError } = await supabase
  .from('meetings')
  .select('id')
  .gt('created_at', yesterday.toISOString())
  .neq('created_by', user.id);
```

Substitua por:

```typescript
const { data: newMeetings, error: meetingsError } = await supabase
  .from('meetings')
  .select('id')
  .gt('created_at', yesterday.toISOString())
  .filter('created_by', 'not.eq', user.id);
  
if (meetingsError) {
  console.error('Erro ao consultar reuniões:', meetingsError);
  if (meetingsError.code === '42501') {
    console.error('Erro de permissão RLS detectado');
  }
}
```

## 3. Correção para o erro de crypto.randomUUID

Abra o arquivo `src/utils/security.ts` e localize a função `generateDeviceFingerprint`. 
Substitua-a pela versão abaixo:

```typescript
// Função de polyfill para randomUUID
function polyfillRandomUUID() {
  // Se crypto.randomUUID já existir, use-o diretamente
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Implementação de fallback usando getRandomValues
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c: any) => {
      const num = Number(c);
      return (num ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> num / 4).toString(16);
    });
  }
  
  // Última alternativa: use Math.random() (menos seguro, mas funcional)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export const generateDeviceFingerprint = (): string => {
  try {
    // Use o polyfill em vez de chamar crypto.randomUUID diretamente
    const uuid = polyfillRandomUUID();
    
    // O resto da função permanece igual
    const userAgent = navigator.userAgent;
    const language = navigator.language;
    const platform = navigator.platform;
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    
    // Combine esses valores para criar um fingerprint único
    const fingerprint = `${uuid}-${btoa(userAgent)}-${language}-${platform}-${screenWidth}x${screenHeight}`;
    
    return fingerprint;
  } catch (error) {
    console.error("Erro ao gerar fingerprint:", error);
    return "unknown-device";
  }
};
```

## 4. SQL para a política RLS (executar no SQL Editor do Supabase)

```sql
-- Remover política existente (se necessário)
DROP POLICY IF EXISTS "meetings_access_policy" ON "public"."meetings";

-- Criar nova política mais permissiva
CREATE POLICY "meetings_access_policy"
ON "public"."meetings"
USING (
  -- Permitir acesso a reuniões criadas pelo usuário
  (auth.uid() = created_by)
  OR 
  -- Permitir acesso a reuniões onde o usuário é participante
  EXISTS (
    SELECT 1 FROM meeting_participants 
    WHERE meeting_id = meetings.id AND user_id = auth.uid()
  )
  OR
  -- Permitir acesso a reuniões da equipe do usuário
  EXISTS (
    SELECT 1 FROM team_members 
    WHERE team_id = meetings.team_id AND user_id = auth.uid()
  )
);
```
