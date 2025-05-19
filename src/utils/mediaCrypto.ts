/**
 * Media Crypto Utilities
 * Extends Signal Protocol for handling encrypted media file transfer
 * Uses AES-256-GCM for media encryption with unique keys per file
 */

import signalProtocolUtils, { EncryptedMessage } from '@/utils/signalProtocol';

// Constants for media encryption
const MEDIA_KEY_SIZE = 256; // AES-256
const MEDIA_VERSION = 'v1';
const MAX_THUMBNAIL_SIZE = 150 * 1024; // 150KB max thumbnail size
const DEFAULT_TTL_DAYS = 30; // Default time-to-live for media files

// Interface for encrypted media metadata
export interface EncryptedMediaMetadata {
  iv: string;               // Initialization vector (base64)
  encryptedKey: string;     // Encrypted symmetric key (base64)
  mimeType: string;         // Original file MIME type
  fileName: string;         // Original file name
  fileSize: number;         // Original file size in bytes
  thumbnailData?: string;   // Optional thumbnail (base64, for images/videos)
  storagePath: string;      // Path in Storage where encrypted file is stored
  expiresAt: string;        // ISO date when file should be deleted
  version: string;          // Version of the encryption protocol used
}

/**
 * Generates a new symmetric key for media encryption
 * @returns Promise with the generated symmetric key
 */
export const generateSymmetricKey = async (): Promise<CryptoKey> => {
  try {
    return await getCrypto().subtle.generateKey(
      {
        name: 'AES-GCM',
        length: MEDIA_KEY_SIZE,
      },
      true, // extractable
      ['encrypt', 'decrypt']
    );
  } catch (error) {
    console.error('Error generating symmetric key for media:', error);
    throw new Error('Failed to generate encryption key for media');
  }
};

/**
 * Exports a symmetric key to raw format (Uint8Array)
 * @param key The symmetric key to export
 * @returns Promise with the exported key as Uint8Array
 */
export const exportSymmetricKey = async (key: CryptoKey): Promise<Uint8Array> => {
  try {
    const exportedKey = await getCrypto().subtle.exportKey('raw', key);
    return new Uint8Array(exportedKey);
  } catch (error) {
    console.error('Error exporting symmetric key:', error);
    throw new Error('Failed to export media encryption key');
  }
};

/**
 * Imports a symmetric key from raw format
 * @param keyData The raw key data as Uint8Array
 * @returns Promise with the imported CryptoKey
 */
export const importSymmetricKey = async (keyData: Uint8Array): Promise<CryptoKey> => {
  try {
    return await getCrypto().subtle.importKey(
      'raw',
      keyData,
      {
        name: 'AES-GCM',
        length: MEDIA_KEY_SIZE,
      },
      true, // extractable
      ['encrypt', 'decrypt']
    );
  } catch (error) {
    console.error('Error importing symmetric key:', error);
    throw new Error('Failed to import media encryption key');
  }
};

/**
 * Encrypts a media file using AES-GCM
 * @param file The file data as ArrayBuffer
 * @param key The symmetric key for encryption
 * @returns Promise with the encrypted data and IV
 */
export const encryptMedia = async (file: ArrayBuffer, key: CryptoKey): Promise<{ cipher: ArrayBuffer; iv: Uint8Array }> => {
  try {
    // Generate random IV
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt the file
    const cipherBuffer = await getCrypto().subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
        tagLength: 128, // Authentication tag length in bits
      },
      key,
      file
    );
    
    return { cipher: cipherBuffer, iv };
  } catch (error) {
    console.error('Error encrypting media:', error);
    throw new Error('Failed to encrypt media file');
  }
};

/**
 * Decrypts a media file using AES-GCM
 * @param cipher The encrypted file data as ArrayBuffer
 * @param key The symmetric key for decryption
 * @param iv The initialization vector used during encryption
 * @returns Promise with the decrypted file data
 */
export const decryptMedia = async (cipher: ArrayBuffer, key: CryptoKey, iv: Uint8Array): Promise<ArrayBuffer> => {
  try {
    return await getCrypto().subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
        tagLength: 128, // Authentication tag length in bits
      },
      key,
      cipher
    );
  } catch (error) {
    console.error('Error decrypting media:', error);
    throw new Error('Failed to decrypt media file. The file may be corrupted or the key is invalid.');
  }
};

/**
 * Encrypts a symmetric key for a recipient using their public key
 * Uses the Signal Protocol's key exchange mechanism
 * @param symmetricKey The symmetric key to encrypt
 * @param recipientPublicKey The recipient's public key
 * @returns Promise with the encrypted key and metadata
 */
// Constants for development mode fallback
const IS_DEV = process.env.NODE_ENV === 'development' ||
              (typeof window !== 'undefined' && window.location &&
               (window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1'));

// Console style for development mode warnings
const DEV_WARNING_STYLE = 'background: #FFF3CD; color: #856404; padding: 2px 4px; border-radius: 2px;';

/**
 * Simplified function to directly import a public key from JWK format
 * @param jwkString JSON string representing a JWK public key
 * @returns Promise with a CryptoKey
 */
export const importJwkPublicKey = async (jwkString: string): Promise<CryptoKey> => {
  try {
    // Parse the JWK string to get the JWK object
    const jwk = JSON.parse(jwkString);
    
    // Import as RSA key
    return await getCrypto().subtle.importKey(
      'jwk',
      jwk,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256'
      },
      false,  // not extractable
      ['encrypt']
    );
  } catch (error) {
    console.error('Error importing JWK public key:', error);
    
    // Create a development mode mock key if in development
    if (IS_DEV) {
      console.warn('%c⚠️ MOCK KEY BEING USED (DEVELOPMENT MODE ONLY)', DEV_WARNING_STYLE);
      console.warn('%c⚠️ This implementation is NOT secure and should ONLY be used for development', DEV_WARNING_STYLE);
      
      // Return a mock key object that simulates a CryptoKey
      return {
        type: 'public',
        algorithm: { name: 'RSA-OAEP' },
        extractable: false,
        usages: ['encrypt']
      } as unknown as CryptoKey;
    }
    
    throw new Error('Failed to import recipient public key');
  }
};

/**
 * Directly encrypts a symmetric key using RSA-OAEP
 * @param symmetricKey The symmetric key to encrypt
 * @param publicKey The recipient's public key as CryptoKey
 * @returns Promise with the encrypted key data
 */
export const encryptWithRSA = async (keyData: ArrayBuffer, publicKey: CryptoKey): Promise<ArrayBuffer> => {
  try {
    // For development mode, return a mock encrypted value
    if (IS_DEV && (publicKey as any)._isMockKey) {
      console.warn('%c⚠️ MOCK ENCRYPTION BEING USED (DEVELOPMENT MODE ONLY)', DEV_WARNING_STYLE);
      // Return the original data with a prefix to simulate encryption
      const mockEncrypted = new Uint8Array(keyData.byteLength + 8);
      mockEncrypted.set(new TextEncoder().encode('MOCKENC:'), 0);
      mockEncrypted.set(new Uint8Array(keyData), 8);
      return mockEncrypted.buffer;
    }
    
    // Use standard Web Crypto API for RSA-OAEP encryption
    return await getCrypto().subtle.encrypt(
      {
        name: 'RSA-OAEP'
      },
      publicKey,
      keyData
    );
  } catch (error) {
    console.error('Error encrypting with RSA:', error);
    throw new Error('Failed to encrypt data with recipient key');
  }
};

/**
 * Encrypts a symmetric key for a recipient using their public key
 * Uses direct RSA-OAEP encryption instead of the Signal Protocol
 * @param symmetricKey The symmetric key to encrypt
 * @param recipientPublicKey The recipient's public key as a JWK string
 * @returns Promise with the encrypted key data
 */
export const encryptKeyForRecipient = async (
  symmetricKey: CryptoKey,
  recipientPublicKey: string
): Promise<{ encryptedKey: string; ephemeralPublicKey: string }> => {
  try {
    // Export the symmetric key to raw format
    const rawSymmetricKey = await exportSymmetricKey(symmetricKey);
    
    // Import the recipient's public key as RSA key
    const publicKey = await importJwkPublicKey(recipientPublicKey);
    
    // Directly encrypt the symmetric key with RSA
    const encryptedKeyBuffer = await encryptWithRSA(rawSymmetricKey.buffer, publicKey);
    
    // Convert to Base64 for storage
    const encryptedKeyBase64 = btoa(
      String.fromCharCode(...new Uint8Array(encryptedKeyBuffer))
    );
    
    // Generate a random string to use in place of the ephemeral public key
    // (since we're not using the Signal Protocol anymore)
    const randomId = crypto.randomUUID().replace(/-/g, '');
    
    return {
      encryptedKey: encryptedKeyBase64,
      ephemeralPublicKey: randomId
    };
  } catch (error) {
    console.error('Error encrypting key for recipient:', error);
    throw new Error('Failed to secure encryption key for recipient');
  }
};

/**
 * Decrypts a symmetric key using the recipient's private key
 * @param encryptedKeyData The encrypted key data
 * @param ephemeralPublicKey The ephemeral public key used during encryption
 * @returns Promise with the decrypted symmetric key
 */
/**
 * Decrypts a symmetric key using the recipient's private key
 * Uses direct RSA-OAEP decryption instead of the Signal Protocol
 * @param encryptedKeyData The encrypted key data (Base64 string)
 * @param ephemeralPublicKey An identifier (not used in direct RSA decryption)
 * @returns Promise with the decrypted symmetric key
 */
export const decryptKeyFromSender = async (
  encryptedKeyData: string,
  ephemeralPublicKey: string
): Promise<CryptoKey> => {
  try {
    // Check for development mode mock encryption
    if (IS_DEV && encryptedKeyData.startsWith('MOCKENC:')) {
      console.warn('%c⚠️ MOCK DECRYPTION BEING USED (DEVELOPMENT MODE ONLY)', DEV_WARNING_STYLE);
      // Extract the original data from the mock encrypted string
      const mockData = encryptedKeyData.substring(8);
      const bytes = new Uint8Array(mockData.length);
      for (let i = 0; i < mockData.length; i++) {
        bytes[i] = mockData.charCodeAt(i);
      }
      return await importSymmetricKey(bytes);
    }

    // Convert from base64 to ArrayBuffer
    const binaryString = atob(encryptedKeyData);
    const encryptedBytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      encryptedBytes[i] = binaryString.charCodeAt(i);
    }
    
    // Get the user's private key
    // This depends on how your application manages private keys
    // For example, you might retrieve it from localStorage or an API
    const privateKeyJwk = localStorage.getItem('private_key');
    if (!privateKeyJwk) {
      throw new Error('Private key not found for decryption');
    }
    
    // Import the private key
    const privateKey = await getCrypto().subtle.importKey(
      'jwk',
      JSON.parse(privateKeyJwk),
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256'
      },
      false,
      ['decrypt']
    );
    
    // Decrypt the symmetric key
    const decryptedBuffer = await getCrypto().subtle.decrypt(
      {
        name: 'RSA-OAEP'
      },
      privateKey,
      encryptedBytes
    );
    
    // Import as a symmetric key
    return await importSymmetricKey(new Uint8Array(decryptedBuffer));
  } catch (error) {
    console.error('Error decrypting key from sender:', error);
    throw new Error('Failed to decrypt the media encryption key');
  }
};

/**
 * Generates a thumbnail for an image or video
 * @param file The file to generate a thumbnail for
 * @param mimeType The MIME type of the file
 * @returns Promise with the thumbnail as a base64 string
 */
export const generateThumbnail = async (file: File, mimeType: string): Promise<string | null> => {
  // For non-visual files, don't generate a thumbnail
  if (!mimeType.startsWith('image/') && !mimeType.startsWith('video/')) {
    return null;
  }
  
  try {
    if (mimeType.startsWith('image/')) {
      // For images, create a thumbnail using Canvas
      return await createImageThumbnail(file);
    } else if (mimeType.startsWith('video/')) {
      // For videos, create a thumbnail from a frame
      return await createVideoThumbnail(file);
    }
    
    return null;
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    // Return null instead of throwing - thumbnails are optional
    return null;
  }
};

/**
 * Creates a thumbnail for an image file
 * @param file The image file
 * @returns Promise with the thumbnail as a base64 string
 */
const createImageThumbnail = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Calculate thumbnail dimensions (max 200px width/height)
      const MAX_DIMENSION = 200;
      let width = img.width;
      let height = img.height;
      
      if (width > height && width > MAX_DIMENSION) {
        height = Math.round((height * MAX_DIMENSION) / width);
        width = MAX_DIMENSION;
      } else if (height > MAX_DIMENSION) {
        width = Math.round((width * MAX_DIMENSION) / height);
        height = MAX_DIMENSION;
      }
      
      // Create canvas and draw the resized image
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert to base64 with reduced quality
      let thumbnailBase64 = canvas.toDataURL('image/jpeg', 0.7);
      
      // Check if the thumbnail is too large and reduce quality if needed
      if (thumbnailBase64.length > MAX_THUMBNAIL_SIZE) {
        // Try with lower quality
        thumbnailBase64 = canvas.toDataURL('image/jpeg', 0.4);
      }
      
      // Remove the data:image/jpeg;base64, prefix
      resolve(thumbnailBase64.split(',')[1]);
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image for thumbnail generation'));
    };
    
    img.src = URL.createObjectURL(file);
  });
};

/**
 * Creates a thumbnail for a video file
 * @param file The video file
 * @returns Promise with the thumbnail as a base64 string
 */
const createVideoThumbnail = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    
    video.onloadeddata = () => {
      // Seek to 25% of the video
      video.currentTime = video.duration * 0.25;
    };
    
    video.onseeked = () => {
      // Calculate thumbnail dimensions (max 200px width/height)
      const MAX_DIMENSION = 200;
      let width = video.videoWidth;
      let height = video.videoHeight;
      
      if (width > height && width > MAX_DIMENSION) {
        height = Math.round((height * MAX_DIMENSION) / width);
        width = MAX_DIMENSION;
      } else if (height > MAX_DIMENSION) {
        width = Math.round((width * MAX_DIMENSION) / height);
        height = MAX_DIMENSION;
      }
      
      // Create canvas and draw the video frame
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      
      ctx.drawImage(video, 0, 0, width, height);
      
      // Convert to base64 with reduced quality
      let thumbnailBase64 = canvas.toDataURL('image/jpeg', 0.7);
      
      // Check if the thumbnail is too large and reduce quality if needed
      if (thumbnailBase64.length > MAX_THUMBNAIL_SIZE) {
        // Try with lower quality
        thumbnailBase64 = canvas.toDataURL('image/jpeg', 0.4);
      }
      
      // Remove the data:image/jpeg;base64, prefix
      resolve(thumbnailBase64.split(',')[1]);
      
      // Clean up
      URL.revokeObjectURL(video.src);
    };
    
    video.onerror = () => {
      reject(new Error('Failed to load video for thumbnail generation'));
      URL.revokeObjectURL(video.src);
    };
    
    video.src = URL.createObjectURL(file);
    video.load();
  });
};

/**
 * Calculates when the media should expire
 * @param ttlDays Optional time-to-live in days (default: 30 days)
 * @returns ISO date string when the file should expire
 */
export const calculateExpiryDate = (ttlDays: number = DEFAULT_TTL_DAYS): string => {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + ttlDays);
  return expiryDate.toISOString();
};

// Export all functions as a default object
export default {
  generateSymmetricKey,
  exportSymmetricKey,
  importSymmetricKey,
  encryptMedia,
  decryptMedia,
  encryptKeyForRecipient,
  decryptKeyFromSender,
  generateThumbnail,
  calculateExpiryDate
};

// Ensure Web Crypto API is available
const getCrypto = () => {
  // Check if window is defined (browser environment)
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    return window.crypto;
  } 
  // Fallback to Node.js crypto if available
  else if (typeof crypto !== 'undefined' && crypto.subtle) {
    return crypto;
  }
  // Last resort, throw a clear error
  throw new Error('Web Crypto API is not available in this environment');
};



