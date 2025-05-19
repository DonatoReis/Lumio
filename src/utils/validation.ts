/**
 * Verifica se um email está em formato completo e válido
 * Implementação aprimorada para evitar domínios incompletos como .co quando deveria ser .com
 */
export const isCompleteEmail = (email: string): boolean => {
  if (!email || email.length < 5) return false;
  
  // Verificação básica de formato de email
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
  if (!tld || tld.length < 2) return false;
  
  // Rejeitar domínios potencialmente incompletos
  if (domain.endsWith('.co') && !domain.endsWith('.com') && 
      !domain.endsWith('.co.uk') && !domain.endsWith('.co.jp') && 
      !domain.endsWith('.co.nz') && !domain.endsWith('.co.za') && 
      !domain.endsWith('.co.kr') && !domain.endsWith('.co.in')) {
    return false;
  }
  
  if (domain.endsWith('.ne') && !domain.endsWith('.net')) return false;
  if (domain.endsWith('.or') && !domain.endsWith('.org')) return false;
  if (domain.endsWith('.go') && !domain.endsWith('.gov')) return false;
  if (domain.endsWith('.in') && domain.length <= 4 && !domain.endsWith('.info')) return false;
  
  return true;
};

/**
 * Verifica se um token JWT está expirado
 */
export const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return (payload.exp * 1000) < Date.now();
  } catch {
    return true;
  }
};

