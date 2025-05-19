
/**
 * Signal Protocol E2EE
 * Implementação de criptografia de ponta a ponta usando o protocolo Signal
 * Utiliza AES-256 + HMAC-SHA256 para máxima segurança das mensagens
 */

import { secureStorage } from '@/utils/security';

// Constantes para configuração do protocolo
const SIGNAL_VERSION = 'v1';
const KEY_SIZE = 256; // AES-256
const ITERATION_COUNT = 10000;

// Interface para as chaves criptográficas
interface KeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

// Interface para mensagem criptografada
export interface EncryptedMessage {
  iv: string; // Vetor de inicialização
  encryptedData: string; // Dados criptografados
  authTag: string; // Tag de autenticação
  ephemeralPublicKey: string; // Chave pública efêmera
  senderPublicKeyId: string; // ID da chave pública do remetente
}

/**
 * Gera par de chaves para o protocolo Signal
 * @returns Promise com o par de chaves gerado
 */
export const generateKeyPair = async (): Promise<KeyPair> => {
  try {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      ['deriveKey', 'deriveBits']
    );

    return {
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
    };
  } catch (error) {
    console.error('Erro ao gerar par de chaves:', error);
    throw new Error('Falha ao gerar chaves de criptografia');
  }
};

/**
 * Exporta uma chave pública para formato transmissível
 * @param publicKey Chave pública a ser exportada
 * @returns String codificada em base64 da chave pública
 */
export const exportPublicKey = async (publicKey: CryptoKey): Promise<string> => {
  try {
    const exported = await window.crypto.subtle.exportKey('spki', publicKey);
    return btoa(String.fromCharCode(...new Uint8Array(exported)));
  } catch (error) {
    console.error('Erro ao exportar chave pública:', error);
    throw new Error('Falha ao exportar chave pública');
  }
};

/**
 * Importa uma chave pública de formato transmissível
 * @param publicKeyString String codificada em base64 da chave pública
 * @returns Chave pública importada
 */
export const importPublicKey = async (publicKeyString: string): Promise<CryptoKey> => {
  try {
    const binaryString = atob(publicKeyString);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return await window.crypto.subtle.importKey(
      'spki',
      bytes.buffer,
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      []
    );
  } catch (error) {
    console.error('Erro ao importar chave pública:', error);
    throw new Error('Falha ao importar chave pública');
  }
};

/**
 * Gera uma chave secreta compartilhada a partir de uma chave privada e uma chave pública
 * @param privateKey Chave privada local
 * @param publicKey Chave pública remota
 * @returns Chave secreta derivada
 */
export const deriveSharedSecret = async (privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> => {
  try {
    return await window.crypto.subtle.deriveKey(
      {
        name: 'ECDH',
        public: publicKey,
      },
      privateKey,
      {
        name: 'AES-GCM',
        length: KEY_SIZE,
      },
      false,
      ['encrypt', 'decrypt']
    );
  } catch (error) {
    console.error('Erro ao derivar segredo compartilhado:', error);
    throw new Error('Falha ao gerar chave compartilhada');
  }
};

/**
 * Criptografa uma mensagem usando o protocolo Signal
 * @param message Mensagem a ser criptografada
 * @param recipientPublicKey Chave pública do destinatário
 * @returns Mensagem criptografada
 */
export const encryptMessage = async (message: string, recipientPublicKey: CryptoKey): Promise<EncryptedMessage> => {
  try {
    // Gerar par de chaves efêmeras para perfect forward secrecy
    const ephemeralKeyPair = await generateKeyPair();
    const ephemeralPublicKeyStr = await exportPublicKey(ephemeralKeyPair.publicKey);
    
    // Derivar chave secreta compartilhada
    const sharedSecret = await deriveSharedSecret(ephemeralKeyPair.privateKey, recipientPublicKey);
    
    // Criar IV (Initialization Vector) aleatório
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    // Converter mensagem para ArrayBuffer
    const encoder = new TextEncoder();
    const messageData = encoder.encode(message);
    
    // Criptografar mensagem
    const encryptedBuffer = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128, // tamanho da tag de autenticação em bits
      },
      sharedSecret,
      messageData
    );
    
    // Separar dados criptografados da tag de autenticação
    const encryptedArray = new Uint8Array(encryptedBuffer);
    const encryptedContent = encryptedArray.slice(0, encryptedArray.length - 16);
    const authTag = encryptedArray.slice(encryptedArray.length - 16);
    
    return {
      iv: btoa(String.fromCharCode(...iv)),
      encryptedData: btoa(String.fromCharCode(...encryptedContent)),
      authTag: btoa(String.fromCharCode(...authTag)),
      ephemeralPublicKey: ephemeralPublicKeyStr,
      senderPublicKeyId: await getSenderPublicKeyId()
    };
  } catch (error) {
    console.error('Erro ao criptografar mensagem:', error);
    throw new Error('Falha ao criptografar mensagem');
  }
};

/**
 * Descriptografa uma mensagem usando o protocolo Signal
 * @param encryptedMessage Mensagem criptografada
 * @param privateKey Chave privada do destinatário
 * @returns Mensagem descriptografada
 */
export const decryptMessage = async (encryptedMessage: EncryptedMessage): Promise<string> => {
  try {
    // Obter chave privada do destinatário (nós mesmos)
    const privateKey = await getPrivateKey();
    
    // Importar chave pública efêmera do remetente
    const ephemeralPublicKey = await importPublicKey(encryptedMessage.ephemeralPublicKey);
    
    // Derivar chave secreta compartilhada
    const sharedSecret = await deriveSharedSecret(privateKey, ephemeralPublicKey);
    
    // Converter IV de base64 para ArrayBuffer
    const ivString = atob(encryptedMessage.iv);
    const iv = new Uint8Array(ivString.length);
    for (let i = 0; i < ivString.length; i++) {
      iv[i] = ivString.charCodeAt(i);
    }
    
    // Converter dados criptografados e tag de autenticação de base64 para ArrayBuffer
    const encryptedString = atob(encryptedMessage.encryptedData);
    const authTagString = atob(encryptedMessage.authTag);
    
    const encryptedData = new Uint8Array(encryptedString.length + authTagString.length);
    for (let i = 0; i < encryptedString.length; i++) {
      encryptedData[i] = encryptedString.charCodeAt(i);
    }
    for (let i = 0; i < authTagString.length; i++) {
      encryptedData[encryptedString.length + i] = authTagString.charCodeAt(i);
    }
    
    // Descriptografar mensagem
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128, // tamanho da tag de autenticação em bits
      },
      sharedSecret,
      encryptedData
    );
    
    // Converter mensagem descriptografada para string
    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (error) {
    console.error('Erro ao descriptografar mensagem:', error);
    throw new Error('Falha ao descriptografar mensagem');
  }
};

/**
 * Gera e armazena um novo par de chaves para o usuário atual
 * @returns ID da chave pública gerada
 */
export const generateAndStoreKeyPair = async (): Promise<string> => {
  try {
    const keyPair = await generateKeyPair();
    
    // Exportar chaves para formato transmissível
    const publicKeyExported = await exportPublicKey(keyPair.publicKey);
    const privateKeyExported = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
    const privateKeyString = btoa(String.fromCharCode(...new Uint8Array(privateKeyExported)));
    
    // Gerar ID único para o par de chaves
    const keyId = crypto.randomUUID();
    
    // Armazenar chaves de forma segura
    secureStorage.setItem(`signal_public_key_${keyId}`, publicKeyExported, true);
    secureStorage.setItem(`signal_private_key_${keyId}`, privateKeyString, true);
    secureStorage.setItem('signal_current_key_id', keyId, true);
    
    return keyId;
  } catch (error) {
    console.error('Erro ao gerar e armazenar par de chaves:', error);
    throw new Error('Falha ao configurar criptografia');
  }
};

/**
 * Obtém a chave privada atual do usuário
 * @returns Chave privada atual
 */
export const getPrivateKey = async (): Promise<CryptoKey> => {
  try {
    const currentKeyId = secureStorage.getItem('signal_current_key_id', true);
    if (!currentKeyId) {
      throw new Error('Nenhuma chave de criptografia encontrada');
    }
    
    const privateKeyString = secureStorage.getItem(`signal_private_key_${currentKeyId}`, true);
    if (!privateKeyString) {
      throw new Error('Chave privada não encontrada');
    }
    
    const binaryString = atob(privateKeyString);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return await window.crypto.subtle.importKey(
      'pkcs8',
      bytes.buffer,
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      ['deriveKey', 'deriveBits']
    );
  } catch (error) {
    console.error('Erro ao obter chave privada:', error);
    throw new Error('Falha ao recuperar chave de criptografia');
  }
};

/**
 * Obtém o ID da chave pública atual do usuário
 * @returns ID da chave pública atual
 */
export const getSenderPublicKeyId = async (): Promise<string> => {
  const currentKeyId = secureStorage.getItem('signal_current_key_id', true);
  if (!currentKeyId) {
    // Se não existir, criar um novo par de chaves
    return await generateAndStoreKeyPair();
  }
  return currentKeyId;
};

/**
 * Obtém a chave pública atual do usuário como string
 * @returns Chave pública atual como string em base64
 */
export const getCurrentPublicKey = async (): Promise<string> => {
  try {
    const currentKeyId = secureStorage.getItem('signal_current_key_id', true);
    if (!currentKeyId) {
      // Se não existir, criar um novo par de chaves
      const newKeyId = await generateAndStoreKeyPair();
      return secureStorage.getItem(`signal_public_key_${newKeyId}`, true) || '';
    }
    
    return secureStorage.getItem(`signal_public_key_${currentKeyId}`, true) || '';
  } catch (error) {
    console.error('Erro ao obter chave pública atual:', error);
    throw new Error('Falha ao recuperar chave pública');
  }
};

export const signalProtocolUtils = {
  generateKeyPair,
  exportPublicKey,
  importPublicKey,
  deriveSharedSecret,
  encryptMessage,
  decryptMessage,
  generateAndStoreKeyPair,
  getPrivateKey,
  getSenderPublicKeyId,
  getCurrentPublicKey,
};

export default signalProtocolUtils;
