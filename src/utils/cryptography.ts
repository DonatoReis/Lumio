/**
 * Módulo de criptografia para implementar E2EE
 * Fornece funções para criptografia/descriptografia e gerenciamento de chaves
 */

// Environment detection
const IS_DEV = process.env.NODE_ENV === 'development' || 
               (typeof window !== 'undefined' && window.location && 
               (window.location.hostname === 'localhost' || 
                window.location.hostname === '127.0.0.1'));

// Check if running in secure context
const isSecureContext = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  // If window.isSecureContext is available, use that
  if (typeof window.isSecureContext === 'boolean') {
    return window.isSecureContext;
  }
  
  // Fallback: check protocol
  return window.location && 
         (window.location.protocol === 'https:' || 
          window.location.hostname === 'localhost' || 
          window.location.hostname === '127.0.0.1');
};

// Check if Web Crypto API is available
const isCryptoAvailable = (): boolean => {
  return typeof window !== 'undefined' && 
         !!window.crypto && 
         !!window.crypto.subtle;
};

// Console style for development mode warnings
const DEV_WARNING_STYLE = 'background: #FFF3CD; color: #856404; padding: 2px 4px; border-radius: 2px;';

// Constantes para configuração de algoritmos criptográficos
const ALGORITHM_AES = 'AES-GCM';
const ALGORITHM_RSA = 'RSA-OAEP';
const KEY_LENGTH = 2048;
const HASH_ALGORITHM = 'SHA-256';

/**
 * Gera um par de chaves criptográficas (pública/privada)
 * @returns Objeto com chaves pública e privada
 */
// Development-only mock implementations
// These mock functions provide deterministic outputs that look like real crypto outputs
// but are NOT secure and should NEVER be used in production

/**
 * Mock RSA key generator for development
 * Generates fake but properly formatted key pairs
 */
const generateMockRsaKeyPair = (): { publicKey: string; privateKey: string } => {
  console.warn('%c⚠️ USANDO CRIPTOGRAFIA SIMULADA (APENAS DESENVOLVIMENTO)', DEV_WARNING_STYLE);
  console.warn('%c⚠️ Esta implementação NÃO é segura e deve ser usada APENAS para desenvolvimento', DEV_WARNING_STYLE);
  
  // Create a mock JWK public key (this is NOT a real key)
  const mockPublicKey = {
    kty: "RSA",
    e: "AQAB",
    use: "enc",
    kid: `dev-${Date.now()}`,
    alg: "RSA-OAEP-256",
    n: "mock_key_" + Math.random().toString(36).substring(2) + "_" + Date.now()
  };

  // Create a mock JWK private key (this is NOT a real key)
  const mockPrivateKey = {
    ...mockPublicKey,
    d: "mock_priv_" + Math.random().toString(36).substring(2),
    p: "mock_p_" + Math.random().toString(36).substring(2),
    q: "mock_q_" + Math.random().toString(36).substring(2),
    dp: "mock_dp_" + Math.random().toString(36).substring(2),
    dq: "mock_dq_" + Math.random().toString(36).substring(2),
    qi: "mock_qi_" + Math.random().toString(36).substring(2)
  };

  return {
    publicKey: JSON.stringify(mockPublicKey),
    privateKey: JSON.stringify(mockPrivateKey)
  };
};

/**
 * Mock AES key generator for development
 */
const generateMockAesKey = (): string => {
  console.warn('%c⚠️ USANDO CRIPTOGRAFIA SIMULADA (APENAS DESENVOLVIMENTO)', DEV_WARNING_STYLE);
  
  const mockKey = {
    kty: "oct",
    k: "mock_aes_" + Math.random().toString(36).substring(2) + "_" + Date.now(),
    kid: `dev-aes-${Date.now()}`,
    alg: "A256GCM"
  };

  return JSON.stringify(mockKey);
};

/**
 * Mock symmetric encryption for development
 */
const mockEncrypt = (data: string): string => {
  // Add a simple prefix to indicate this is mock encrypted data
  return `DEV_ENC:${btoa(data)}`;
};

/**
 * Mock symmetric decryption for development
 */
const mockDecrypt = (data: string): string => {
  // Check if this is mock encrypted data and decode
  if (data.startsWith('DEV_ENC:')) {
    return atob(data.substring(8));
  }
  // If not recognizable as mock data, just return the input
  return data;
};

export const generateKeyPair = async (): Promise<{
  publicKey: string;
  privateKey: string;
}> => {
  try {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      throw new Error('Esta função só pode ser executada no navegador');
    }

    // Use fallback in development if Crypto API not available
    if (IS_DEV && !isCryptoAvailable()) {
      console.warn('%c⚠️ Web Crypto API não disponível - usando implementação de desenvolvimento', DEV_WARNING_STYLE);
      return generateMockRsaKeyPair();
    }
    
    // For production, verify crypto API is available
    if (!window.crypto) {
      throw new Error('Web Crypto API não está disponível neste navegador');
    }

    // Check if the subtle crypto is available
    if (!window.crypto.subtle) {
      throw new Error('Web Crypto API Subtle não está disponível. Verifique se você está em um contexto seguro (HTTPS)');
    }

    // Log for debugging
    console.log('Gerando par de chaves RSA...');

    // Gerar par de chaves usando Web Crypto API
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: ALGORITHM_RSA,
        modulusLength: KEY_LENGTH,
        publicExponent: new Uint8Array([1, 0, 1]), // 65537
        hash: HASH_ALGORITHM,
      },
      true, // extractable
      ['encrypt', 'decrypt'] // usos permitidos
    );

    console.log('Par de chaves gerado com sucesso, exportando chaves...');

    // Exportar chave pública para formato JWK
    const publicKeyJwk = await window.crypto.subtle.exportKey(
      'jwk',
      keyPair.publicKey
    );

    // Exportar chave privada para formato JWK
    const privateKeyJwk = await window.crypto.subtle.exportKey(
      'jwk',
      keyPair.privateKey
    );

    console.log('Chaves exportadas com sucesso');

    // Converter para string para armazenamento
    return {
      publicKey: JSON.stringify(publicKeyJwk),
      privateKey: JSON.stringify(privateKeyJwk),
    };
  } catch (error) {
    console.error('Erro ao gerar par de chaves:', error);
    
    // Check if we're in an insecure context (not HTTPS)
    if (typeof window !== 'undefined' && window.location && 
        window.location.protocol !== 'https:' && 
        window.location.hostname !== 'localhost' && 
        window.location.hostname !== '127.0.0.1') {
      console.error('Web Crypto API precisa de um contexto seguro (HTTPS) para funcionar');
    }
    
    throw new Error('Falha ao gerar par de chaves criptográficas');
  }
};

/**
 * Importa chave pública a partir de string JWK
 * @param publicKeyStr Chave pública em formato string (JWK)
 * @returns Objeto CryptoKey
 */
export const importPublicKey = async (publicKeyStr: string): Promise<CryptoKey> => {
  try {
    // For development environments without crypto API
    if (IS_DEV && !isCryptoAvailable()) {
      console.warn('%c⚠️ Usando chave pública simulada (apenas desenvolvimento)', DEV_WARNING_STYLE);
      // Return a mock CryptoKey object that can be used in development
      return {
        type: 'public',
        extractable: false,
        algorithm: { name: ALGORITHM_RSA },
        usages: ['encrypt']
      } as unknown as CryptoKey;
    }

    const publicKeyJwk = JSON.parse(publicKeyStr);
    return await window.crypto.subtle.importKey(
      'jwk',
      publicKeyJwk,
      {
        name: ALGORITHM_RSA,
        hash: HASH_ALGORITHM,
      },
      false, // extractable
      ['encrypt'] // uso permitido
    );
  } catch (error) {
    console.error('Erro ao importar chave pública:', error);
    throw new Error('Falha ao importar chave pública');
  }
};

/**
 * Importa chave privada a partir de string JWK
 * @param privateKeyStr Chave privada em formato string (JWK)
 * @returns Objeto CryptoKey
 */
export const importPrivateKey = async (privateKeyStr: string): Promise<CryptoKey> => {
  try {
    // For development environments without crypto API
    if (IS_DEV && !isCryptoAvailable()) {
      console.warn('%c⚠️ Usando chave privada simulada (apenas desenvolvimento)', DEV_WARNING_STYLE);
      // Return a mock CryptoKey object that can be used in development
      return {
        type: 'private',
        extractable: false,
        algorithm: { name: ALGORITHM_RSA },
        usages: ['decrypt']
      } as unknown as CryptoKey;
    }

    const privateKeyJwk = JSON.parse(privateKeyStr);
    return await window.crypto.subtle.importKey(
      'jwk',
      privateKeyJwk,
      {
        name: ALGORITHM_RSA,
        hash: HASH_ALGORITHM,
      },
      false, // extractable
      ['decrypt'] // uso permitido
    );
  } catch (error) {
    console.error('Erro ao importar chave privada:', error);
    throw new Error('Falha ao importar chave privada');
  }
};

/**
 * Criptografa dados utilizando chave pública
 * @param data Dados a serem criptografados
 * @param publicKeyStr Chave pública em formato string ou objeto CryptoKey
 * @returns Dados criptografados em base64
 */
export const encryptData = async (
  data: string,
  publicKeyStr: string | CryptoKey
): Promise<string> => {
  try {
    // For development environments without crypto API
    if (IS_DEV && !isCryptoAvailable()) {
      console.warn('%c⚠️ Usando criptografia simulada (apenas desenvolvimento)', DEV_WARNING_STYLE);
      return mockEncrypt(data);
    }

    // Converter dados para ArrayBuffer
    const dataBuffer = new TextEncoder().encode(data);
    
    // Preparar chave pública
    let publicKey: CryptoKey;
    if (typeof publicKeyStr === 'string') {
      publicKey = await importPublicKey(publicKeyStr);
    } else {
      publicKey = publicKeyStr;
    }
    
    // Criptografar dados
    const encryptedBuffer = await window.crypto.subtle.encrypt(
      {
        name: ALGORITHM_RSA,
      },
      publicKey,
      dataBuffer
    );
    
    // Converter para string base64 para armazenamento
    return btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer)));
  } catch (error) {
    console.error('Erro ao criptografar dados:', error);
    throw new Error('Falha ao criptografar dados');
  }
};

/**
 * Descriptografa dados utilizando chave privada
 * @param encryptedData Dados criptografados em base64
 * @param privateKeyStr Chave privada em formato string ou objeto CryptoKey
 * @returns Dados descriptografados
 */
export const decryptData = async (
  encryptedData: string,
  privateKeyStr: string | CryptoKey
): Promise<string> => {
  try {
    // For development environments without crypto API
    if (IS_DEV && !isCryptoAvailable()) {
      console.warn('%c⚠️ Usando descriptografia simulada (apenas desenvolvimento)', DEV_WARNING_STYLE);
      return mockDecrypt(encryptedData);
    }

    // Converter dados criptografados de base64 para ArrayBuffer
    const encryptedBuffer = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    
    // Preparar chave privada
    let privateKey: CryptoKey;
    if (typeof privateKeyStr === 'string') {
      privateKey = await importPrivateKey(privateKeyStr);
    } else {
      privateKey = privateKeyStr;
    }
    
    // Descriptografar dados
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: ALGORITHM_RSA,
      },
      privateKey,
      encryptedBuffer
    );
    
    // Converter para string
    return new TextDecoder().decode(decryptedBuffer);
  } catch (error) {
    console.error('Erro ao descriptografar dados:', error);
    throw new Error('Falha ao descriptografar dados');
  }
};

/**
 * Gera uma chave simétrica AES para criptografia
 * @returns Chave AES em formato JWK string
 */
export const generateSymmetricKey = async (): Promise<string> => {
  try {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      throw new Error('Esta função só pode ser executada no navegador');
    }

    // Use fallback in development if Crypto API not available
    if (IS_DEV && !isCryptoAvailable()) {
      console.warn('%c⚠️ Web Crypto API não disponível - usando implementação de desenvolvimento para chave simétrica', DEV_WARNING_STYLE);
      return generateMockAesKey();
    }
    
    // For production, verify crypto API is available
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error('Web Crypto API não está disponível neste contexto. Verifique se você está em um contexto seguro (HTTPS)');
    }

    // Generate AES-GCM key
    const key = await window.crypto.subtle.generateKey(
      {
        name: ALGORITHM_AES,
        length: 256,
      },
      true, // extractable
      ['encrypt', 'decrypt']
    );
    
    // Exportar para JWK
    const keyJwk = await window.crypto.subtle.exportKey('jwk', key);
    
    return JSON.stringify(keyJwk);
  } catch (error) {
    console.error('Erro ao gerar chave simétrica:', error);
    throw new Error('Falha ao gerar chave de criptografia');
  }
};

/**
 * Encripta dados usando algoritmo simétrico (AES-GCM)
 * Usado para criptografia de grandes volumes de dados
 * @param data Dados a serem criptografados
 * @param keyStr Chave AES em formato string
 * @returns Dados criptografados + IV em base64
 */
export const encryptSymmetric = async (
  data: string,
  keyStr: string
): Promise<string> => {
  try {
    // Importar chave AES
    const keyObj = JSON.parse(keyStr);
    const key = await window.crypto.subtle.importKey(
      'jwk',
      keyObj,
      { name: ALGORITHM_AES },
      false,
      ['encrypt']
    );
    
    // Gerar vetor de inicialização (IV)
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    // Criptografar dados
    const encryptedBuffer = await window.crypto.subtle.encrypt(
      {
        name: ALGORITHM_AES,
        iv,
      },
      key,
      new TextEncoder().encode(data)
    );
    
    // Combinar IV e dados criptografados
    const result = new Uint8Array(iv.length + encryptedBuffer.byteLength);
    result.set(iv);
    result.set(new Uint8Array(encryptedBuffer), iv.length);
    
    // Retornar em formato base64
    return btoa(String.fromCharCode(...result));
  } catch (error) {
    console.error('Erro ao criptografar com AES:', error);
    throw new Error('Falha na criptografia simétrica');
  }
};

/**
 * Descriptografa dados usando algoritmo simétrico (AES-GCM)
 * @param encryptedData Dados + IV criptografados em base64
 * @param keyStr Chave AES em formato string
 * @returns Dados descriptografados
 */
export const decryptSymmetric = async (
  encryptedData: string,
  keyStr: string
): Promise<string> => {
  try {
    // Importar chave AES
    const keyObj = JSON.parse(keyStr);
    const key = await window.crypto.subtle.importKey(
      'jwk',
      keyObj,
      { name: ALGORITHM_AES },
      false,
      ['decrypt']
    );
    
    // Extrair IV e dados criptografados
    const data = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    const iv = data.slice(0, 12);
    const encryptedBuffer = data.slice(12);
    
    // Descriptografar
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: ALGORITHM_AES,
        iv,
      },
      key,
      encryptedBuffer
    );
    
    return new TextDecoder().decode(decryptedBuffer);
  } catch (error) {
    console.error('Erro ao descriptografar com AES:', error);
    throw new Error('Falha na descriptografia simétrica');
  }
};

/**
 * Calcula hash SHA-256 de dados
 * @param data Dados para calcular hash
 * @returns Hash em formato hexadecimal
 */
export const calculateHash = async (data: string): Promise<string> => {
  try {
    const hashBuffer = await window.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(data)
    );
    
    // Converter para formato hexadecimal
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  } catch (error) {
    console.error('Erro ao calcular hash:', error);
    throw new Error('Falha ao gerar hash de dados');
  }
};

/**
 * Tokeniza dados sensíveis para exibição parcial
 * @param data Dados a serem tokenizados
 * @param visibleStart Número de caracteres visíveis no início
 * @param visibleEnd Número de caracteres visíveis no final
 * @returns Dados tokenizados (ex: "1234 **** **** 5678")
 */
export const tokenizeData = (
  data: string,
  visibleStart: number = 4,
  visibleEnd: number = 4
): string => {
  if (!data) return '';
  if (data.length <= visibleStart + visibleEnd) return data;
  
  const start = data.slice(0, visibleStart);
  const end = data.slice(-visibleEnd);
  const masked = '*'.repeat(Math.min(data.length - visibleStart - visibleEnd, 10));
  
  return `${start}${masked}${end}`;
};

export default {
  generateKeyPair,
  importPublicKey,
  importPrivateKey,
  encryptData,
  decryptData,
  generateSymmetricKey,
  encryptSymmetric,
  decryptSymmetric,
  calculateHash,
  tokenizeData
};
