/**
 * Utilitário centralizado para validação e normalização de emails
 * Implementa funções para garantir consistência em todas as operações de email
 */

// Expressão regular robusta para validação de email
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

// Lista de domínios comuns e suas normalizações
const DOMAIN_CORRECTIONS: Record<string, string> = {
  '.comm': '.com',
  '.co': '.com',
  '.ne': '.net',
  '.or': '.org',
  '.c0m': '.com',
  '.cm': '.com',
  '.con': '.com',
  '.cmo': '.com',
};

/**
 * Normaliza um endereço de email para garantir consistência
 * - Aplica trim e toLowerCase
 * - Corrige domínios comuns (.comm -> .com, etc)
 * - Garante simetria na normalização
 * 
 * @param email Email a ser normalizado
 * @returns Email normalizado ou null se inválido
 */
export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  
  // Trim e toLowerCase para consistência básica
  const normalized = email.trim().toLowerCase();
  
  // Se não parece um email, retorna null
  if (!normalized.includes('@')) return null;
  
  // Identificar o domínio (parte após @)
  const [localPart, domainPart] = normalized.split('@', 2);
  if (!localPart || !domainPart) return null;
  
  // Aplicar correções de domínios comuns
  let correctedDomain = domainPart;
  
  // Verificar se o domínio termina com algum dos padrões conhecidos que precisam correção
  for (const [incorrect, correct] of Object.entries(DOMAIN_CORRECTIONS)) {
    if (domainPart.endsWith(incorrect) && !domainPart.endsWith(correct)) {
      // Substitui apenas o sufixo incorreto pelo sufixo correto
      const prefix = domainPart.substring(0, domainPart.length - incorrect.length);
      correctedDomain = prefix + correct;
      break;
    }
  }
  
  // Reconstruir o email com a parte local e o domínio corrigido
  return `${localPart}@${correctedDomain}`;
}

/**
 * Verifica se um email é válido segundo critérios estritos
 * - Formato geral de email válido
 * - TLD com pelo menos 2 caracteres
 * - Sem caracteres inválidos
 * 
 * @param email Email a ser validado
 * @returns true se o email é válido, false caso contrário
 */
export function isValidEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  
  // Normaliza primeiro
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  
  // Aplica regex para validação estrita
  return EMAIL_REGEX.test(normalized);
}

/**
 * Valida um email e retorna o email normalizado ou lança exceção
 * Use esta função quando precisar garantir que o email é válido 
 * antes de continuar a execução
 * 
 * @param email Email a ser validado e normalizado
 * @returns Email normalizado
 * @throws Error se o email for inválido
 */
export function validateAndNormalizeEmail(email: string | null | undefined): string {
  const normalized = normalizeEmail(email);
  
  if (!normalized || !isValidEmail(normalized)) {
    throw new Error(`Email inválido: ${email}`);
  }
  
  return normalized;
}

/**
 * Compara dois emails para verificar se são equivalentes 
 * depois de normalizados
 * 
 * @param email1 Primeiro email
 * @param email2 Segundo email
 * @returns true se os emails são equivalentes, false caso contrário
 */
export function areEmailsEquivalent(email1: string | null | undefined, email2: string | null | undefined): boolean {
  const normalized1 = normalizeEmail(email1);
  const normalized2 = normalizeEmail(email2);
  
  if (!normalized1 || !normalized2) return false;
  
  return normalized1 === normalized2;
}

