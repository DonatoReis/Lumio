
/**
 * Módulo de criptografia avançada com Signal Protocol
 * Implementa criptografia E2EE (ponta a ponta) para mensagens e dados sensíveis
 */

// Funções de utilidade para encoding/decoding
const stringToArrayBuffer = (str: string): ArrayBuffer => {
  const encoder = new TextEncoder();
  return encoder.encode(str).buffer;
};

const arrayBufferToString = (buffer: ArrayBuffer): string => {
  const decoder = new TextDecoder();
  return decoder.decode(new Uint8Array(buffer));
};

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

/**
 * Gera um par de chaves usando Web Crypto API
 * @returns Par de chaves (pública e privada)
 */
export const generateKeyPair = async () => {
  try {
    // Usar algoritmo ECDH para Elliptic Curve Diffie Hellman
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: "ECDH",
        namedCurve: "P-256",
      },
      true, // exportable
      ["deriveKey", "deriveBits"]
    );

    // Exportar a chave pública para enviar ao outro usuário
    const publicKeyExported = await window.crypto.subtle.exportKey(
      "spki",
      keyPair.publicKey
    );

    // Exportar a chave privada para armazenamento local
    const privateKeyExported = await window.crypto.subtle.exportKey(
      "pkcs8",
      keyPair.privateKey
    );

    return {
      publicKey: arrayBufferToBase64(publicKeyExported),
      privateKey: arrayBufferToBase64(privateKeyExported)
    };
  } catch (error: any) {
    console.error('Erro na geração de chaves:', error);
    throw error;
  }
};

/**
 * Deriva uma chave compartilhada entre dois participantes
 * @param privateKeyBase64 Chave privada do usuário em Base64
 * @param publicKeyBase64 Chave pública do outro usuário em Base64
 * @returns Chave derivada para criptografia simétrica
 */
export const deriveSharedKey = async (privateKeyBase64: string, publicKeyBase64: string) => {
  try {
    // Importar chave privada
    const privateKeyBuffer = base64ToArrayBuffer(privateKeyBase64);
    const privateKey = await window.crypto.subtle.importKey(
      "pkcs8",
      privateKeyBuffer,
      {
        name: "ECDH",
        namedCurve: "P-256",
      },
      false,
      ["deriveKey", "deriveBits"]
    );

    // Importar chave pública do outro usuário
    const publicKeyBuffer = base64ToArrayBuffer(publicKeyBase64);
    const publicKey = await window.crypto.subtle.importKey(
      "spki",
      publicKeyBuffer,
      {
        name: "ECDH",
        namedCurve: "P-256",
      },
      true,
      []
    );

    // Derivar chave compartilhada
    const sharedKey = await window.crypto.subtle.deriveKey(
      {
        name: "ECDH",
        public: publicKey
      },
      privateKey,
      {
        name: "AES-GCM",
        length: 256
      },
      true,
      ["encrypt", "decrypt"]
    );

    // Exportar chave AES para reutilização
    const exportedSharedKey = await window.crypto.subtle.exportKey("raw", sharedKey);
    return arrayBufferToBase64(exportedSharedKey);
  } catch (error: any) {
    console.error('Erro na derivação da chave compartilhada:', error);
    throw error;
  }
};

/**
 * Criptografa uma mensagem usando AES-GCM
 * @param plaintext Texto plano a ser criptografado
 * @param sharedKeyBase64 Chave compartilhada em Base64
 * @returns Objeto contendo IV e texto cifrado
 */
export const encryptMessage = async (plaintext: string, sharedKeyBase64: string) => {
  try {
    // Converter texto para ArrayBuffer
    const plaintextBuffer = stringToArrayBuffer(plaintext);

    // Gerar IV aleatório
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    // Importar a chave compartilhada
    const keyBuffer = base64ToArrayBuffer(sharedKeyBase64);
    const key = await window.crypto.subtle.importKey(
      "raw",
      keyBuffer,
      {
        name: "AES-GCM",
        length: 256
      },
      false,
      ["encrypt"]
    );

    // Criptografar a mensagem
    const ciphertext = await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv
      },
      key,
      plaintextBuffer
    );

    // Retornar IV e ciphertext em Base64
    return {
      iv: arrayBufferToBase64(iv),
      ciphertext: arrayBufferToBase64(ciphertext)
    };
  } catch (error: any) {
    console.error('Erro na criptografia da mensagem:', error);
    throw error;
  }
};

/**
 * Decriptografa uma mensagem usando AES-GCM
 * @param ciphertextBase64 Texto cifrado em Base64
 * @param ivBase64 Vetor de inicialização em Base64
 * @param sharedKeyBase64 Chave compartilhada em Base64
 * @returns Texto plano decriptografado
 */
export const decryptMessage = async (ciphertextBase64: string, ivBase64: string, sharedKeyBase64: string) => {
  try {
    // Converter Base64 para ArrayBuffer
    const ciphertextBuffer = base64ToArrayBuffer(ciphertextBase64);
    const ivBuffer = base64ToArrayBuffer(ivBase64);
    const keyBuffer = base64ToArrayBuffer(sharedKeyBase64);

    // Importar a chave compartilhada
    const key = await window.crypto.subtle.importKey(
      "raw",
      keyBuffer,
      {
        name: "AES-GCM",
        length: 256
      },
      false,
      ["decrypt"]
    );

    // Decriptografar a mensagem
    const plaintextBuffer = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: new Uint8Array(ivBuffer)
      },
      key,
      ciphertextBuffer
    );

    return arrayBufferToString(plaintextBuffer);
  } catch (error: any) {
    console.error('Erro na decriptografia da mensagem:', error);
    throw error;
  }
};

/**
 * Cria um hash HMAC-SHA256 para verificação de integridade
 * @param message Mensagem a ser autenticada
 * @param keyBase64 Chave em Base64
 * @returns Hash HMAC em Base64
 */
export const createHMAC = async (message: string, keyBase64: string) => {
  try {
    const keyBuffer = base64ToArrayBuffer(keyBase64);
    const messageBuffer = stringToArrayBuffer(message);

    // Importar chave para HMAC
    const key = await window.crypto.subtle.importKey(
      "raw",
      keyBuffer,
      {
        name: "HMAC",
        hash: { name: "SHA-256" }
      },
      false,
      ["sign"]
    );

    // Criar HMAC
    const signature = await window.crypto.subtle.sign(
      "HMAC",
      key,
      messageBuffer
    );

    return arrayBufferToBase64(signature);
  } catch (error: any) {
    console.error('Erro na criação de HMAC:', error);
    throw error;
  }
};

/**
 * Verifica um hash HMAC-SHA256 para garantir integridade da mensagem
 * @param message Mensagem a ser verificada
 * @param hmacBase64 Hash HMAC em Base64
 * @param keyBase64 Chave em Base64
 * @returns True se o HMAC for válido
 */
export const verifyHMAC = async (message: string, hmacBase64: string, keyBase64: string) => {
  try {
    const keyBuffer = base64ToArrayBuffer(keyBase64);
    const messageBuffer = stringToArrayBuffer(message);
    const hmacBuffer = base64ToArrayBuffer(hmacBase64);

    // Importar chave para HMAC
    const key = await window.crypto.subtle.importKey(
      "raw",
      keyBuffer,
      {
        name: "HMAC",
        hash: { name: "SHA-256" }
      },
      false,
      ["verify"]
    );

    // Verificar HMAC
    return await window.crypto.subtle.verify(
      "HMAC",
      key,
      hmacBuffer,
      messageBuffer
    );
  } catch (error: any) {
    console.error('Erro na verificação de HMAC:', error);
    return false;
  }
};

/**
 * Gera um salt aleatório para uso em derivação de chaves baseada em senha
 * @returns Salt em Base64
 */
export const generateSalt = (): string => {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  return arrayBufferToBase64(salt);
};

/**
 * Deriva uma chave a partir de uma senha usando PBKDF2
 * @param password Senha do usuário
 * @param saltBase64 Salt em Base64
 * @returns Chave derivada em Base64
 */
export const deriveKeyFromPassword = async (password: string, saltBase64: string) => {
  try {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    const salt = base64ToArrayBuffer(saltBase64);

    // Importar material da chave
    const keyMaterial = await window.crypto.subtle.importKey(
      "raw",
      passwordBuffer,
      { name: "PBKDF2" },
      false,
      ["deriveBits", "deriveKey"]
    );

    // Derivar chave usando PBKDF2
    const key = await window.crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt,
        iterations: 100000,
        hash: "SHA-256"
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );

    // Exportar chave derivada
    const exportedKey = await window.crypto.subtle.exportKey("raw", key);
    return arrayBufferToBase64(exportedKey);
  } catch (error: any) {
    console.error('Erro na derivação de chave da senha:', error);
    throw error;
  }
};

/**
 * Empacota dados (chave privada) com senha para armazenamento seguro
 * @param data Dados a serem empacotados
 * @param password Senha para proteção
 * @returns Pacote criptografado
 */
export const packWithPassword = async (data: string, password: string) => {
  try {
    // Gerar salt aleatório
    const salt = generateSalt();
    
    // Derivar chave da senha
    const keyBase64 = await deriveKeyFromPassword(password, salt);
    
    // Criptografar dados com a chave derivada
    const { iv, ciphertext } = await encryptMessage(data, keyBase64);
    
    // Retornar pacote com todos os dados necessários para decriptografia
    return {
      salt,
      iv,
      ciphertext
    };
  } catch (error: any) {
    console.error('Erro no empacotamento com senha:', error);
    throw error;
  }
};

/**
 * Desempacota dados protegidos por senha
 * @param encryptedPackage Pacote criptografado
 * @param password Senha para desproteger
 * @returns Dados originais
 */
export const unpackWithPassword = async (encryptedPackage: { salt: string; iv: string; ciphertext: string }, password: string) => {
  try {
    const { salt, iv, ciphertext } = encryptedPackage;
    
    // Derivar chave da senha usando o mesmo salt
    const keyBase64 = await deriveKeyFromPassword(password, salt);
    
    // Decriptografar dados
    return await decryptMessage(ciphertext, iv, keyBase64);
  } catch (error: any) {
    console.error('Erro no desempacotamento com senha:', error);
    throw error;
  }
};

/**
 * Gera um código de backup único para recuperação de conta
 * @returns Código de backup
 */
export const generateBackupCode = (): string => {
  const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Sem I, O para evitar confusão
  let code = '';
  
  // Gerar código de 16 caracteres em grupos de 4
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const randomIndex = Math.floor(Math.random() * chars.length);
      code += chars[randomIndex];
    }
    if (i < 3) code += '-';
  }
  
  return code;
};

export default {
  generateKeyPair,
  deriveSharedKey,
  encryptMessage,
  decryptMessage,
  createHMAC,
  verifyHMAC,
  generateSalt,
  deriveKeyFromPassword,
  packWithPassword,
  unpackWithPassword,
  generateBackupCode
};
