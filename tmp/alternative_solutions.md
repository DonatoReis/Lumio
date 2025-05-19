# Soluções Alternativas para os Problemas Persistentes

## 1. Solução Alternativa para o Erro 401 na Edge Function

Já que a Edge Function `find-user` continua retornando 401 mesmo após as tentativas de correção, vamos implementar uma alternativa que não dependa dessa função:

```typescript
// Adicionar esta função ao arquivo src/hooks/useConversations.ts
// Esta função busca o usuário diretamente da tabela profiles em vez de usar a Edge Function

const findUserByEmailAlternative = async (email: string): Promise<{id: string, email: string} | null> => {
  if (!email || !isCompleteEmail(email)) {
    toast({
      variant: "destructive",
      title: "Email inválido",
      description: "Por favor, forneça um email válido e completo",
    });
    return null;
  }
  
  try {
    console.log("Buscando usuário com email (modo alternativo):", email);
    
    // Buscar diretamente da tabela profiles
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

// Substituir a chamada antiga para findUserByEmail por esta nova função:
const findUserByEmail = findUserByEmailAlternative;
```

## 2. Solução Alternativa para o Erro 500 na Consulta de Meetings

Precisamos encontrar exatamente onde a consulta com `neq` está sendo chamada, pois parece que a correção não foi aplicada no local correto. Vamos fazer uma busca mais abrangente:

1. Localize **todos** os arquivos que fazem referência a `meetings`:

```bash
grep -r "from('meetings')" --include="*.ts" --include="*.tsx" .
```

2. Para cada arquivo encontrado, verifique se existe alguma consulta usando `neq('created_by'`:

```bash
grep -r "neq('created_by'" --include="*.ts" --include="*.tsx" .
```

3. Modifique **todas** as ocorrências encontradas, substituindo:

```typescript
.neq('created_by', user.id)
```

Por:

```typescript
.filter('created_by', 'not.eq', user.id)
```

4. Se a solução acima não funcionar, uma alternativa mais drástica é usar o RPC:

```sql
-- Criar esta função no SQL Editor do Supabase:
CREATE OR REPLACE FUNCTION get_meetings_not_created_by(user_id UUID, min_date TIMESTAMP)
RETURNS SETOF meetings
LANGUAGE sql
SECURITY definer
AS $$
  SELECT * FROM meetings 
  WHERE created_by != user_id
  AND created_at > min_date;
$$;
```

E então usar esta função RPC no lugar da consulta direta:

```typescript
// Substituir:
const { data: newMeetings, error: meetingsError } = await supabase
  .from('meetings')
  .select('id')
  .gt('created_at', yesterday.toISOString())
  .neq('created_by', user.id);

// Por:
const { data: newMeetings, error: meetingsError } = await supabase
  .rpc('get_meetings_not_created_by', {
    user_id: user.id,
    min_date: yesterday.toISOString()
  });
```

## 3. Solução para a Validação de Email Incompleto

Observe que no log ainda aparece "Iniciando busca por email completo: creisbarreto@icloud.co", o que indica que a validação de email completo não está funcionando corretamente.

Vamos modificar a função `isCompleteEmail` para ser mais rigorosa:

```typescript
export const isCompleteEmail = (email: string): boolean => {
  if (!email || email.length < 5) return false;
  
  // Verificar se tem o formato básico de email
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  
  // Verificar se tem pelo menos um @ e um . depois do @
  const atPos = email.indexOf('@');
  if (atPos < 1) return false;
  
  const domain = email.substring(atPos + 1);
  if (!domain || domain.length < 3) return false;
  
  // Verificar se termina com pelo menos 2 caracteres após o último ponto
  const lastDotPos = domain.lastIndexOf('.');
  if (lastDotPos < 0) return false;
  
  const tld = domain.substring(lastDotPos + 1);
  
  // TLDs válidos devem ter pelo menos 2 caracteres
  // E emails com TLDs de 2 caracteres devem ter pelo menos 3 caracteres
  // ex: .co é incompleto, deveria ser .com, .co.uk, etc.
  if (!tld || tld.length < 2) return false;
  if (tld.length === 2 && domain.length < 6) return false;
  
  // Lista de domínios comuns incompletos
  const commonTlds = ['.co', '.ne', '.or', '.in'];
  const endsWithIncomplete = commonTlds.some(incomplete => 
    domain.toLowerCase().endsWith(incomplete) && 
    domain.toLowerCase() !== incomplete
  );
  
  if (endsWithIncomplete) return false;
  
  return true;
};
```

Essa implementação mais rigorosa vai rejeitar emails com domínios potencialmente incompletos como ".co" quando deveriam ser ".com".

## 4. Opção Nuclear: Desabilitar Temporariamente a Funcionalidade Problemática

Se nenhuma das soluções acima resolver, podemos temporariamente desabilitar as funcionalidades problemáticas:

1. Para a busca de usuários:
```typescript
// Em src/pages/Messages.tsx, substituir o bloco que chama findUserByEmail por:
const user = null; // Desabilita a busca por email temporariamente
toast({
  variant: "destructive",
  title: "Funcionalidade temporariamente indisponível",
  description: "A busca de usuários está em manutenção. Por favor, tente novamente mais tarde."
});
```

2. Para a consulta de meetings:
```typescript
// Em qualquer lugar onde a consulta de meetings é feita, substituir por:
const newMeetings = []; // Array vazio temporário
const meetingsError = null;
console.log("Consulta de reuniões desabilitada temporariamente para manutenção");
```

Esta é uma solução de último recurso, mas permite que o sistema continue funcionando enquanto investigamos mais a fundo os problemas.
