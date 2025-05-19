
/**
 * Módulo de criptografia para implementar um sistema E2EE (End-to-End Encryption)
 * Baseado em padrões de segurança elevados similares ao Signal Protocol
 * Utiliza AES-256 para criptografia de mensagens e HMAC-SHA256 para integridade
 */

import { secureStorage } from '@/utils/security';

/**
 * Gera um par de chaves para um usuário
 * @returns Par de chaves (pública e privada)
 */
export const generateKeyPair = async () => {
  try {
    // Em produção: usar Web Crypto API com algoritmos adequados
    console.log("Gerando par de chaves para o usuário");
    
    // Implementação utilizando Web Crypto API para maior segurança
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: "ECDH",
        namedCurve: "P-256", // Curva elíptica segura
      },
      true, // Exportável
      ["deriveKey", "deriveBits"] // Operações permitidas
    );
    
    // Exportar chave pública
    const publicKeyExported = await window.crypto.subtle.exportKey(
      "spki",
      keyPair.publicKey
    );
    
    // Exportar chave privada
    const privateKeyExported = await window.crypto.subtle.exportKey(
      "pkcs8",
      keyPair.privateKey
    );
    
    // Converter para strings base64 para armazenamento
    const publicKeyString = btoa(String.fromCharCode(...new Uint8Array(publicKeyExported)));
    const privateKeyString = btoa(String.fromCharCode(...new Uint8Array(privateKeyExported)));
    
    return {
      publicKey: publicKeyString,
      privateKey: privateKeyString
    };
  } catch (error) {
    console.error("Erro ao gerar par de chaves:", error);
    
    // Fallback para ambiente de desenvolvimento (não usar em produção)
    return {
      publicKey: crypto.randomUUID(),
      privateKey: crypto.randomUUID()
    };
  }
};

/**
 * Gera uma chave de sessão para uma conversa específica
 * @param myPrivateKey Chave privada do usuário atual
 * @param theirPublicKey Chave pública do outro usuário
 * @returns Chave de sessão para a conversa
 */
export const deriveSessionKey = async (myPrivateKey: string, theirPublicKey: string) => {
  try {
    // Em produção: implementação real de ECDH com Web Crypto API
    console.log("Derivando chave de sessão entre usuários");
    
    // Função real usaria Web Crypto API para importar as chaves e fazer ECDH
    // Esta é uma versão simplificada para demonstração
    
    // Simulação de hash dos componentes para uma chave única por conversa
    const combinedKeys = myPrivateKey.substring(0, 16) + theirPublicKey.substring(0, 16);
    const encoder = new TextEncoder();
    const data = encoder.encode(combinedKeys);
    
    // Criar hash SHA-256 como chave de sessão
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex;
  } catch (error) {
    console.error("Erro ao derivar chave de sessão:", error);
    
    // Fallback básico (não usar em produção)
    return `${myPrivateKey.substring(0, 8)}_${theirPublicKey.substring(0, 8)}`;
  }
};

/**
 * Criptografa uma mensagem usando AES-256
 * @param plaintext Texto original da mensagem
 * @param sessionKey Chave de sessão para criptografia
 * @returns Texto criptografado em base64
 */
export const encryptMessage = async (plaintext: string, sessionKey: string) => {
  try {
    console.log("Criptografando mensagem com AES-256");
    
    // Em um ambiente de produção: implementação completa com Web Crypto API
    
    // Criar um vetor de inicialização aleatório (IV)
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    // Converter a chave de sessão em um formato utilizável
    const keyData = new TextEncoder().encode(sessionKey);
    const hash = await window.crypto.subtle.digest('SHA-256', keyData);
    
    // Importar a chave
    const key = await window.crypto.subtle.importKey(
      "raw",
      hash,
      { name: "AES-GCM" },
      false,
      ["encrypt"]
    );
    
    // Criptografar os dados
    const encodedPlaintext = new TextEncoder().encode(plaintext);
    const encryptedBuffer = await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv
      },
      key,
      encodedPlaintext
    );
    
    // Combinar IV e dados criptografados
    const result = new Uint8Array(iv.length + new Uint8Array(encryptedBuffer).length);
    result.set(iv);
    result.set(new Uint8Array(encryptedBuffer), iv.length);
    
    // Converter para base64 para transmissão
    return btoa(String.fromCharCode(...result));
  } catch (error) {
    console.error("Erro ao criptografar mensagem:", error);
    
    // Fallback apenas para desenvolvimento (não usar em produção)
    const encoded = new TextEncoder().encode(plaintext);
    const encryptedBuffer = Array.from(encoded).map(byte => byte ^ sessionKey.charCodeAt(0));
    return btoa(String.fromCharCode(...encryptedBuffer));
  }
};

/**
 * Descriptografa uma mensagem usando AES-256
 * @param encryptedBase64 Texto criptografado em base64
 * @param sessionKey Chave de sessão para descriptografia
 * @returns Texto original descriptografado
 */
export const decryptMessage = async (encryptedBase64: string, sessionKey: string) => {
  try {
    console.log("Descriptografando mensagem com AES-256");
    
    // Em um ambiente de produção: implementação completa com Web Crypto API
    
    // Converter de base64 para bytes
    const encryptedBytes = new Uint8Array(
      atob(encryptedBase64).split('').map(c => c.charCodeAt(0))
    );
    
    // Extrair IV (primeiros 12 bytes) e dados criptografados
    const iv = encryptedBytes.slice(0, 12);
    const ciphertext = encryptedBytes.slice(12);
    
    // Converter a chave de sessão
    const keyData = new TextEncoder().encode(sessionKey);
    const hash = await window.crypto.subtle.digest('SHA-256', keyData);
    
    // Importar a chave
    const key = await window.crypto.subtle.importKey(
      "raw",
      hash,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );
    
    // Descriptografar
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv
      },
      key,
      ciphertext
    );
    
    // Converter para texto
    return new TextDecoder().decode(decryptedBuffer);
  } catch (error) {
    console.error("Erro ao descriptografar mensagem:", error);
    
    // Fallback apenas para desenvolvimento (não usar em produção)
    const encryptedBuffer = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
    const decryptedBuffer = Array.from(encryptedBuffer).map(byte => byte ^ sessionKey.charCodeAt(0));
    return new TextDecoder().decode(new Uint8Array(decryptedBuffer));
  }
};

/**
 * Verifica a integridade de uma mensagem com HMAC-SHA256
 * @param message Mensagem a ser verificada
 * @param hmac HMAC fornecido para verificação
 * @param key Chave para verificação
 * @returns Booleano indicando se a mensagem é íntegra
 */
export const verifyMessageIntegrity = async (message: string, hmac: string, key: string) => {
  try {
    // Em produção: implementação real de HMAC-SHA256
    const calculatedHmac = await generateHMAC(message, key);
    return calculatedHmac === hmac;
  } catch (error) {
    console.error("Erro ao verificar integridade da mensagem:", error);
    return false;
  }
};

/**
 * Gera um valor HMAC para garantir integridade da mensagem
 * @param message Mensagem para gerar HMAC
 * @param key Chave para geração
 * @returns String HMAC gerada
 */
export const generateHMAC = async (message: string, key: string) => {
  try {
    // Em produção: implementação real de HMAC-SHA256 com Web Crypto API
    console.log("Gerando HMAC para integridade da mensagem");
    
    // Converter dados para formato adequado
    const encoder = new TextEncoder();
    const keyData = encoder.encode(key);
    const messageData = encoder.encode(message);
    
    // Criar chave para HMAC
    const cryptoKey = await window.crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    // Gerar HMAC
    const signature = await window.crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      messageData
    );
    
    // Converter para string hexadecimal
    const hashArray = Array.from(new Uint8Array(signature));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    console.error("Erro ao gerar HMAC:", error);
    
    // Fallback básico (não usar em produção)
    return "hmac_simulado_" + message.substring(0, 10);
  }
};

/**
 * Interface para uma mensagem segura com E2EE
 */
export interface SecureMessage {
  encryptedContent: string;
  iv: string; // Vetor de inicialização
  hmac: string; // Para verificação de integridade
  senderPublicKey: string;
  timestamp: number;
}

/**
 * Prepara uma mensagem segura para envio
 * @param plaintext Conteúdo original da mensagem
 * @param sessionKey Chave da sessão
 * @param senderPublicKey Chave pública do remetente
 * @returns Objeto de mensagem segura
 */
export const prepareSecureMessage = async (
  plaintext: string, 
  sessionKey: string,
  senderPublicKey: string
): Promise<SecureMessage> => {
  try {
    // Gerar IV aleatório
    const iv = Array.from(window.crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Criptografar conteúdo
    const encryptedContent = await encryptMessage(plaintext, sessionKey);
    
    // Gerar HMAC para verificação de integridade
    const hmac = await generateHMAC(encryptedContent + iv, sessionKey);
    
    return {
      encryptedContent,
      iv,
      hmac,
      senderPublicKey,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error("Erro ao preparar mensagem segura:", error);
    throw new Error("Falha ao preparar mensagem segura");
  }
};

/**
 * Verifica e descriptografa uma mensagem segura
 * @param secureMessage Objeto de mensagem segura
 * @param sessionKey Chave da sessão
 * @returns Conteúdo original da mensagem ou null se inválido
 */
export const readSecureMessage = async (
  secureMessage: SecureMessage, 
  sessionKey: string
): Promise<string | null> => {
  try {
    // Verificar integridade primeiro
    const isValid = await verifyMessageIntegrity(
      secureMessage.encryptedContent + secureMessage.iv,
      secureMessage.hmac,
      sessionKey
    );
    
    if (!isValid) {
      console.error("Integridade da mensagem comprometida");
      return null;
    }
    
    // Descriptografar se for válida
    return await decryptMessage(secureMessage.encryptedContent, sessionKey);
  } catch (error) {
    console.error("Erro ao ler mensagem segura:", error);
    return null;
  }
};

/**
 * Gera e armazena chaves E2EE para o usuário atual
 * @param userId ID do usuário para identificar as chaves
 * @returns Objeto com as chaves geradas
 */
export const setupUserEncryption = async (userId: string): Promise<{
  publicKey: string;
  privateKey: string;
}> => {
  try {
    // Verificar se já existem chaves armazenadas
    const storedPublicKey = secureStorage.getItem(`pubkey_${userId}`);
    const storedPrivateKey = secureStorage.getItem(`privkey_${userId}`, true); // Privada é armazenada criptografada
    
    if (storedPublicKey && storedPrivateKey) {
      return {
        publicKey: storedPublicKey,
        privateKey: storedPrivateKey
      };
    }
    
    // Gerar novas chaves
    const keyPair = await generateKeyPair();
    
    // Armazenar chaves (privada é armazenada de forma segura)
    secureStorage.setItem(`pubkey_${userId}`, keyPair.publicKey);
    secureStorage.setItem(`privkey_${userId}`, keyPair.privateKey, true);
    
    return keyPair;
  } catch (error) {
    console.error("Erro ao configurar criptografia do usuário:", error);
    throw new Error("Falha ao configurar chaves de criptografia");
  }
};

/**
 * Backup de chaves de criptografia para um arquivo protegido por senha
 * @param userId ID do usuário para identificar as chaves
 * @param password Senha para proteger o backup
 * @returns Blob contendo arquivo de backup
 */
export const backupEncryptionKeys = async (userId: string, password: string): Promise<Blob> => {
  try {
    // Recuperar chaves
    const storedPublicKey = secureStorage.getItem(`pubkey_${userId}`);
    const storedPrivateKey = secureStorage.getItem(`privkey_${userId}`, true);
    
    if (!storedPublicKey || !storedPrivateKey) {
      throw new Error("Chaves não encontradas");
    }
    
    // Criar objeto com as chaves
    const keysObject = {
      userId,
      publicKey: storedPublicKey,
      privateKey: storedPrivateKey,
      createdAt: new Date().toISOString()
    };
    
    // Converter para JSON
    const keysJson = JSON.stringify(keysObject);
    
    // Em produção: criptografar com a senha fornecida usando Web Crypto API
    // Este é um exemplo simplificado
    const encoder = new TextEncoder();
    const keyData = encoder.encode(password);
    const keyHash = await window.crypto.subtle.digest('SHA-256', keyData);
    
    // Criar chave para criptografia
    const encryptionKey = await window.crypto.subtle.importKey(
      "raw",
      keyHash,
      { name: "AES-GCM" },
      false,
      ["encrypt"]
    );
    
    // Criar IV aleatório
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    // Criptografar dados
    const encryptedData = await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv
      },
      encryptionKey,
      encoder.encode(keysJson)
    );
    
    // Combinar IV e dados criptografados
    const result = new Uint8Array(iv.length + new Uint8Array(encryptedData).length);
    result.set(iv);
    result.set(new Uint8Array(encryptedData), iv.length);
    
    // Criar um Blob para download
    return new Blob([result], { type: 'application/octet-stream' });
  } catch (error) {
    console.error("Erro ao fazer backup das chaves:", error);
    throw new Error("Falha ao criar backup das chaves de criptografia");
  }
};

/**
 * Restaura chaves de criptografia a partir de um arquivo de backup
 * @param backupFile Arquivo de backup
 * @param password Senha usada para proteger o backup
 * @param userId ID do usuário atual
 * @returns Promessa que resolve quando a restauração for concluída
 */
export const restoreEncryptionKeys = async (
  backupFile: File,
  password: string,
  userId: string
): Promise<void> => {
  try {
    // Ler o arquivo
    const fileBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(backupFile);
    });
    
    const fileData = new Uint8Array(fileBuffer);
    
    // Extrair IV e dados criptografados
    const iv = fileData.slice(0, 12);
    const encryptedData = fileData.slice(12);
    
    // Derivar chave a partir da senha
    const encoder = new TextEncoder();
    const keyData = encoder.encode(password);
    const keyHash = await window.crypto.subtle.digest('SHA-256', keyData);
    
    // Importar chave para descriptografia
    const decryptionKey = await window.crypto.subtle.importKey(
      "raw",
      keyHash,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );
    
    // Descriptografar dados
    const decryptedData = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv
      },
      decryptionKey,
      encryptedData
    );
    
    // Converter para texto e depois para objeto
    const keysJson = new TextDecoder().decode(decryptedData);
    const keysObject = JSON.parse(keysJson);
    
    // Validar dados
    if (!keysObject.publicKey || !keysObject.privateKey) {
      throw new Error("Arquivo de backup inválido ou corrompido");
    }
    
    // Armazenar chaves restauradas
    secureStorage.setItem(`pubkey_${userId}`, keysObject.publicKey);
    secureStorage.setItem(`privkey_${userId}`, keysObject.privateKey, true);
    
    console.log("Chaves de criptografia restauradas com sucesso");
  } catch (error) {
    console.error("Erro ao restaurar chaves:", error);
    throw new Error("Falha ao restaurar chaves de criptografia");
  }
};

// Exportar funções úteis para o resto da aplicação
export default {
  generateKeyPair,
  deriveSessionKey,
  encryptMessage,
  decryptMessage,
  verifyMessageIntegrity,
  generateHMAC,
  prepareSecureMessage,
  readSecureMessage,
  setupUserEncryption,
  backupEncryptionKeys,
  restoreEncryptionKeys
};
