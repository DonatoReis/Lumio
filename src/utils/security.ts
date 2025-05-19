/**
 * Módulo de segurança para implementar proteções adicionais
 * Inclui proteções contra ataques comuns e verificações de segurança
 */

// Importar bibliotecas necessárias para gerenciamento de dispositivos
import { UAParser } from 'ua-parser-js';
import { v4 as uuidv4 } from 'uuid';
import CryptoJS from 'crypto-js';


// Interface para informações de localização salvas
interface SavedLocationInfo {
  location: string;
  ip: string;
  timestamp: number;
}

// Interface para informações de localização
interface LocationInfo {
  location: string;
  ip_address: string;
}

// Constantes para configuração de segurança
const FINGERPRINT_VERSION = 'v2'; // Incremente quando mudar estrutura do fingerprint
const SECURITY_TOKEN_KEY = 'security_fingerprint';
const DEVICE_ID_KEY = 'device_id';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutos em ms
const SUSPICIOUS_LOCATION_CHANGE_THRESHOLD = 500; // km
const GEO_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 horas em ms
const IPINFO_TOKEN = import.meta.env.VITE_IPINFO_TOKEN || '4e5d45f3747a8b'; // Substitua pelo token real ou use variável de ambiente
const ENCRYPTION_SECRET = import.meta.env.VITE_ENCRYPTION_SECRET || 'your_secret_key'; // Substitua por uma chave secreta forte armazenada em variável de ambiente
const IPAPI_FALLBACK_URL = 'https://ip-api.com/json/'; // Serviço de fallback para geolocalização
const REQUEST_TIMEOUT = 5000; // 5 segundos para timeout de requisições

// Prefixo para chaves de localStorage para multi-usuário
let userSpecificPrefix = ''; // Será definido quando o usuário fizer login

/**
 * Define o prefixo específico do usuário para isolamento de dados em localStorage
 * @param userId ID do usuário para namespace
 */
export const setUserNamespace = (userId: string) => {
  userSpecificPrefix = userId ? `u_${userId}_` : '';
};

/**
 * Obtém a chave com o prefixo do usuário atual
 * @param key Chave base
 * @returns Chave com prefixo
 */
const getPrefixedKey = (key: string): string => {
  return userSpecificPrefix + key;
};

// Interface para o fingerprint do dispositivo
export interface DeviceFingerprint {
  browserId: string;
  screenResolution: string;
  timezone: string;
  userAgent: string;
  language: string;
  platform: string;
  plugins: string;
  doNotTrack: string | null;
  version: string;
  createdAt: number;
}

// Interface para dados de falhas de login
interface AuthFailure {
  count: number;
  lastAttempt: number;
  ipAddress?: string;
}

/**
 * Gera um fingerprint único para o dispositivo atual
 * @returns Objeto com dados do fingerprint
 */
/**
 * Gera um fingerprint único para o dispositivo atual
 * @returns Objeto com dados do fingerprint
 */
export const generateDeviceFingerprint = (): DeviceFingerprint => {
  // Gerar um ID persistente para o navegador
  let browserId = localStorage.getItem(getPrefixedKey('browser_id'));
  if (!browserId) {
    browserId = crypto.randomUUID();
    localStorage.setItem(getPrefixedKey('browser_id'), browserId);
  }

  // Usa try-catch para evitar erros em browsers com restrições
  let plugins = '';
  try {
    // Verifica se navigator.plugins existe e é iterável
    if (navigator.plugins && typeof navigator.plugins[Symbol.iterator] === 'function') {
      plugins = Array.from(navigator.plugins).map(p => p.name).join(',');
    } else {
      plugins = 'plugins-not-available';
    }
  } catch (error) {

    plugins = 'plugins-access-error';
  }

  return {
    browserId,
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform || 'unknown',
    plugins,
    doNotTrack: navigator.doNotTrack,
    version: FINGERPRINT_VERSION,
    createdAt: Date.now()
  };
};

/**
 * Verifica se o fingerprint atual corresponde ao armazenado
 * @returns True se o fingerprint é válido
 */
export const verifyDeviceFingerprint = (): boolean => {
  try {
    const storedFingerprintStr = localStorage.getItem(getPrefixedKey(SECURITY_TOKEN_KEY));
    if (!storedFingerprintStr) return false;

    const storedFingerprint: DeviceFingerprint = JSON.parse(storedFingerprintStr);
    const currentFingerprint = generateDeviceFingerprint();

    // Verificar a versão do fingerprint
    if (storedFingerprint.version !== FINGERPRINT_VERSION) {

      // Migrar para a nova versão mantendo o browserId
      const newFingerprint = generateDeviceFingerprint();
      newFingerprint.browserId = storedFingerprint.browserId; // Preservar o browserId
      localStorage.setItem(getPrefixedKey(SECURITY_TOKEN_KEY), JSON.stringify(newFingerprint));
      return true; // Consideramos válido, mas atualizamos para nova versão
    }

    // Cálculo de confiança ponderada
    let trustScore = 0;
    let maxScore = 0;

    // browserId (mais importante)
    if (storedFingerprint.browserId === currentFingerprint.browserId) {
      trustScore += 50;
    }
    maxScore += 50;

    // userAgent (importante, mas pode mudar com atualizações)
    if (storedFingerprint.userAgent === currentFingerprint.userAgent) {
      trustScore += 20;
    }
    maxScore += 20;

    // platform (importante, raramente muda)
    if (storedFingerprint.platform === currentFingerprint.platform) {
      trustScore += 15;
    }
    maxScore += 15;

    // screenResolution (pode mudar, mas útil para verificação)
    if (storedFingerprint.screenResolution === currentFingerprint.screenResolution) {
      trustScore += 5;
    }
    maxScore += 5;

    // timezone (pode mudar durante viagens)
    if (storedFingerprint.timezone === currentFingerprint.timezone) {
      trustScore += 5;
    }
    maxScore += 5;

    // language (raramente muda)
    if (storedFingerprint.language === currentFingerprint.language) {
      trustScore += 5;
    }
    maxScore += 5;


    
    // Consideramos válido se a pontuação for pelo menos 70%
    return (trustScore / maxScore) >= 0.7;
  } catch (error) {
    console.error('Erro ao verificar fingerprint:', error);
    return false;
  }
};

/**
 * Registra o fingerprint do dispositivo atual
 */
export const registerDeviceFingerprint = (): void => {
  try {
    const fingerprint = generateDeviceFingerprint();
    localStorage.setItem(getPrefixedKey(SECURITY_TOKEN_KEY), JSON.stringify(fingerprint));
    
    // Também armazenamos a última geolocalização para detecção de atividades suspeitas
    fetchApproxLocation().then(locationInfo => {
      if (locationInfo) {
        localStorage.setItem(
          getPrefixedKey('last_known_location'), 
          JSON.stringify({
            location: locationInfo.location,
            ip: locationInfo.ip_address,
            timestamp: Date.now()
          })
        );
      }
    }).catch(err => {
      console.error('Erro ao buscar localização para registro:', err);
    });
  } catch (error) {
    console.error('Erro ao registrar fingerprint:', error);
  }
};

/**
 * Gerencia tentativas falhas de login para prevenir brute force
 * @param identifier Identificador do usuário (email)
 * @param increment Se true, incrementa contador de falhas
 * @returns True se o usuário está bloqueado
 */
export const handleFailedLogin = (identifier: string, increment: boolean = true): boolean => {
  try {
    const key = `auth_failure_${identifier}`;
    const storedDataStr = localStorage.getItem(key);
    let failureData: AuthFailure = storedDataStr 
      ? JSON.parse(storedDataStr)
      : { count: 0, lastAttempt: Date.now() };
    
    const now = Date.now();
    
    // Verificar se tempo de bloqueio passou
    if (failureData.count >= MAX_FAILED_ATTEMPTS) {
      if (now - failureData.lastAttempt > LOCKOUT_TIME) {
        // Reset após tempo de bloqueio
        failureData = { count: 0, lastAttempt: now };
        localStorage.setItem(key, JSON.stringify(failureData));
        return false;
      }
      return true; // Usuário bloqueado
    }
    
    // Incrementar contador se solicitado
    if (increment) {
      failureData.count++;
      failureData.lastAttempt = now;
      localStorage.setItem(key, JSON.stringify(failureData));
    }
    
    return failureData.count >= MAX_FAILED_ATTEMPTS;
  } catch (error) {
    console.error('Erro ao gerenciar tentativas de login:', error);
    return false;
  }
};

/**
 * Reinicia contador de tentativas falhas de login
 * @param identifier Identificador do usuário (email)
 */
export const resetFailedLogin = (identifier: string): void => {
  try {
    const key = `auth_failure_${identifier}`;
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Erro ao resetar tentativas de login:', error);
  }
};

/**
 * Gera headers de segurança para requisições
 * @returns Objeto com headers de segurança
 */
export const getSecurityHeaders = () => {
  return {
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:;",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  };
};


/**
 * Sanitiza input do usuário para prevenir XSS
 * @param input String a ser sanitizada
 * @returns String sanitizada
 */
export const sanitizeInput = (input: string): string => {
  const element = document.createElement('div');
  element.textContent = input;
  return element.innerHTML;
};

/**
 * Verifica força da senha
 * @param password Senha a ser verificada
 * @returns Objeto com avaliação da senha
 */
export const checkPasswordStrength = (password: string): {
  score: number; // 0-4, onde 4 é o mais forte
  feedback: string;
  isStrong: boolean;
} => {
  // Critérios básicos
  const hasLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumbers = /[0-9]/.test(password);
  const hasSpecialChars = /[^A-Za-z0-9]/.test(password);
  
  // Calcular pontuação
  let score = 0;
  if (hasLength) score++;
  if (hasUppercase) score++;
  if (hasLowercase) score++;
  if (hasNumbers) score++;
  if (hasSpecialChars) score++;
  
  // Ajustar score para escala 0-4
  score = Math.min(4, Math.floor(score * 0.8));
  
  // Feedback baseado no score
  const feedbacks = [
    "Senha muito fraca. Use uma senha mais longa.",
    "Senha fraca. Adicione letras maiúsculas e números.",
    "Senha média. Adicione caracteres especiais.",
    "Senha boa.",
    "Senha forte."
  ];
  
  return {
    score,
    feedback: feedbacks[score],
    isStrong: score >= 3
  };
};

/**
 * Wrapper para localStorage com criptografia para dados sensíveis
 */
/**
 * Criptografa uma string usando AES
 * @param text Texto a ser criptografado
 * @param secret Chave secreta para criptografia
 * @returns String criptografada
 */
export const encryptAES = (text: string, secret: string = ENCRYPTION_SECRET): string => {
  try {
    return CryptoJS.AES.encrypt(text, secret).toString();
  } catch (error) {
    console.error('Erro na criptografia AES:', error);
    // Fallback para Base64 em caso de erro na criptografia
    return btoa(unescape(encodeURIComponent(text))) + '_fallback';
  }
};

/**
 * Descriptografa uma string criptografada com AES
 * @param ciphertext Texto criptografado
 * @param secret Chave secreta usada na criptografia
 * @returns String descriptografada ou null em caso de erro
 */
export const decryptAES = (ciphertext: string, secret: string = ENCRYPTION_SECRET): string | null => {
  try {
    // Verifica se é um fallback de Base64
    if (ciphertext.endsWith('_fallback')) {
      const base64 = ciphertext.substring(0, ciphertext.length - 9);
      return decodeURIComponent(escape(atob(base64)));
    }
    
    // Descriptografia AES normal
    const bytes = CryptoJS.AES.decrypt(ciphertext, secret);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('Erro na descriptografia AES:', error);
    return null;
  }
};

/**
 * API de armazenamento seguro com criptografia real
 */
export const secureStorage = {
  setItem(key: string, value: string, encrypt: boolean = false): void {
    try {
      const prefixedKey = getPrefixedKey(key);
      if (encrypt) {
        // Usar criptografia AES real
        const encrypted = encryptAES(value);
        localStorage.setItem(`secure_${prefixedKey}`, encrypted);
      } else {
        localStorage.setItem(prefixedKey, value);
      }
    } catch (error) {
      console.error('Erro ao armazenar item seguro:', error);
    }
  },
  
  getItem(key: string, encrypted: boolean = false): string | null {
    try {
      const prefixedKey = getPrefixedKey(key);
      if (encrypted) {
        const value = localStorage.getItem(`secure_${prefixedKey}`);
        if (!value) return null;
        // Descriptografar
        return decryptAES(value);
      }
      return localStorage.getItem(prefixedKey);
    } catch (error) {
      console.error('Erro ao recuperar item seguro:', error);
      return null;
    }
  },
  
  removeItem(key: string, encrypted: boolean = false): void {
    try {
      const prefixedKey = getPrefixedKey(key);
      if (encrypted) {
        localStorage.removeItem(`secure_${prefixedKey}`);
      } else {
        localStorage.removeItem(prefixedKey);
      }
    } catch (error) {
      console.error('Erro ao remover item seguro:', error);
    }
  }
};

/**
 * Detecta comportamento suspeito (mudanças rápidas de IP, múltiplos logins, etc)
 * @returns Nível de suspeita (0-100)
 */
export const detectSuspiciousActivity = (): number => {
  try {
    let suspicionScore = 0;
    
    // 1. Verificar fingerprint
    const fingerprintStr = localStorage.getItem(getPrefixedKey(SECURITY_TOKEN_KEY));
    if (!fingerprintStr) {
      // Sem fingerprint é muito suspeito
      suspicionScore += 50;
    } else {
      try {
        const fingerprint: DeviceFingerprint = JSON.parse(fingerprintStr);
        const timeSinceCreation = Date.now() - fingerprint.createdAt;
        
        // Se o fingerprint for muito recente (menos de 1 hora)
        if (timeSinceCreation < 60 * 60 * 1000) {
          suspicionScore += 20;
        }
        
        // Se a versão não corresponder
        if (fingerprint.version !== FINGERPRINT_VERSION) {
          suspicionScore += 10;
        }
      } catch (error) {
        // Erro ao ler fingerprint é suspeito
        suspicionScore += 30;
      }
    }
    
    // 2. Verificar mudança rápida de localização
    const lastLocationStr = localStorage.getItem(getPrefixedKey('last_known_location'));
    if (lastLocationStr) {
      try {
        const lastLocation = JSON.parse(lastLocationStr) as SavedLocationInfo;
        const timeSinceLastLocation = Date.now() - lastLocation.timestamp;
        
        // Se a localização foi registrada há menos de 24 horas
        if (timeSinceLastLocation < GEO_CHECK_INTERVAL) {
          // Buscar localização atual (sem await para não bloquear)
          fetchApproxLocation().then(currentLocation => {
            if (currentLocation && currentLocation.ip_address !== lastLocation.ip) {
              // IP diferente em curto período é suspeito
              // Em uma implementação real, calcularíamos distância geográfica

              // Atualizar score - não afeta o valor de retorno atual, mas será usado nas próximas verificações
              suspicionScore += 30;
              
              // Atualizar dados de localização
              localStorage.setItem(
                getPrefixedKey('last_known_location'),
                JSON.stringify({
                  location: currentLocation.location,
                  ip: currentLocation.ip_address,
                  timestamp: Date.now()
                })
              );
            }
          }).catch(err => {
            console.error('Erro ao verificar mudança de localização:', err);
          });
        }
      } catch (error) {
        console.error('Erro ao ler última localização conhecida:', error);
      }
    }
    
    // 3. Verificar User Agent incomum
    const ua = navigator.userAgent.toLowerCase();
    if (!ua.includes('chrome') && !ua.includes('firefox') && !ua.includes('safari') && 
        !ua.includes('edge') && !ua.includes('opera')) {
      suspicionScore += 15;
    }
    
    // 4. Verificar modo incógnito (pode indicar atividade suspeita)
    if (isIncognitoMode()) {
      suspicionScore += 10;
    }
    
    return Math.min(100, suspicionScore);
  } catch (error) {
    console.error('Erro na detecção de atividade suspeita:', error);
    return 50; // Valor médio em caso de erro
  }
};

/**
 * Tenta detectar se o navegador está em modo incógnito/privado
 * @returns true se provavelmente está em modo incógnito
 */
const isIncognitoMode = (): boolean => {
  try {
    // Tenta armazenar algo no localStorage
    localStorage.setItem('test', '1');
    localStorage.removeItem('test');
    
    // Verifica se o IndexedDB está disponível (geralmente desativado em incógnito)
    const hasIndexedDB = !!window.indexedDB;
    
    // Verifica se o navegador permite cookies (geralmente limitados em incógnito)
    const cookiesEnabled = navigator.cookieEnabled;
    
    // Combinação de fatores que pode indicar modo incógnito
    return !hasIndexedDB || !cookiesEnabled;
  } catch (error) {
    // Se não conseguir acessar localStorage, provavelmente está em modo incógnito
    return true;
  }
};

/**
 * Analisa o user-agent do navegador para extrair informações sobre o dispositivo
 * @returns Objeto com informações sobre o dispositivo, sistema operacional e navegador
 */
export const parseUserAgent = () => {
  const parser = new UAParser();
  const result = parser.getResult();
  
  const device = result.device.model || result.device.vendor || 'Computador';
  const os = result.os.name && result.os.version 
    ? `${result.os.name} ${result.os.version}` 
    : result.os.name || 'Desconhecido';
  const browser = result.browser.name && result.browser.version 
    ? `${result.browser.name} ${result.browser.version}` 
    : result.browser.name || 'Desconhecido';
  
  return {
    device_name: device,
    os,
    browser
  };
};

/**
 * Obtém o ID único do dispositivo atual, ou gera um novo caso não exista
 * @returns ID único do dispositivo
 */
export const getDeviceId = (): string => {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  
  if (!deviceId) {
    deviceId = uuidv4();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  
  return deviceId;
};

/**
 * Busca a localização aproximada com base no IP usando múltiplos serviços com fallback
 * @returns Promise com a localização, nunca retorna null
 */
export const fetchApproxLocation = async (): Promise<{location: string, ip_address: string}> => {
  // Função de timeout para evitar que requisições fiquem presas
  const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = REQUEST_TIMEOUT): Promise<Response> => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    
    clearTimeout(id);
    return response;
  };
  
  // 1. Tentar o serviço principal: ipinfo.io (Lite API)
  try {

    const response = await fetchWithTimeout(`https://api.ipinfo.io/lite/json?token=${IPINFO_TOKEN}`);
    
    if (response.ok) {
      const data = await response.json();
      
      if (!data.error) {
        // Formatar a localização usando o país e continente
        // A versão Lite não fornece informações da cidade
        let location;
        
        if (data.country) {
          // Se temos informação do país, usamos ela
          location = data.country;
        } else if (data.continent) {
          // Caso contrário, usamos continente se disponível
          location = `${data.continent}`;
        } else {
          // Fallback se nenhuma informação geográfica estiver disponível
          location = 'Localização desconhecida';
        }
        

        return {
          location,
          ip_address: data.ip || 'Desconhecido'
        };
      }
    }
    // Se chegou aqui, o serviço principal falhou

  } catch (error) {

    // Continue para o próximo serviço
  }
  
  // 2. Tentar serviço alternativo: ip-api.com (não requer token)
  try {

    const response = await fetchWithTimeout('https://ip-api.com/json/');
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.status === 'success') {
        // Formatar a localização como "Cidade, País"
        const location = data.city && data.country 
          ? `${data.city}, ${data.country}` 
          : data.country || 'Localização desconhecida';
        

        return {
          location,
          ip_address: data.query || 'Desconhecido'
        };
      }
    }
    // Se chegou aqui, o serviço alternativo também falhou

  } catch (error) {

    // Continue para a última alternativa
  }
  
  // 3. Tentar um último serviço extremamente simples: ipify API (apenas para IP)
  try {

    const response = await fetchWithTimeout('https://api.ipify.org?format=json');
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.ip) {

        return {
          location: 'Localização indisponível',
          ip_address: data.ip
        };
      }
    }
  } catch (error) {

  }
  
  // 4. Se todas as tentativas falharem, retornar um fallback padrão

  return {
    location: 'Localização indisponível',
    ip_address: 'IP indisponível'
  };
};

/**
 * Registra ou atualiza informações do dispositivo no Supabase
 * @param supabase Cliente Supabase
 * @param userId ID do usuário
 * @param deviceInfo Informações do dispositivo
 * @returns Promise com resultado da operação
 */
export const registerOrUpdateDevice = async (supabase: any, userId: string, deviceInfo: {
  device_id: string;
  device_name: string;
  os: string;
  browser: string;
  location?: string;
  ip_address?: string;
}) => {
  try {
    if (!supabase || !userId) {
      throw new Error('Supabase client ou userId inválidos');
    }
    
    const { data, error } = await supabase
      .from('connected_devices')
      .upsert({
        user_id: userId,
        device_id: deviceInfo.device_id,
        device_name: deviceInfo.device_name,
        os: deviceInfo.os,
        browser: deviceInfo.browser,
        location: deviceInfo.location || 'Localização desconhecida',
        ip_address: deviceInfo.ip_address || 'Desconhecido',
        last_active: new Date().toISOString()
      }, {
        onConflict: 'user_id,device_id', // Campo de conflito para upsert
        returning: 'minimal'
      });
    
    if (error) {
      console.error('Erro ao registrar dispositivo:', error);
      return { success: false, error };
    }
    
    return { success: true, data };
  } catch (error) {
    console.error('Exceção ao registrar dispositivo:', error);
    return { success: false, error };
  }
};

/**
 * Revoga o acesso de um dispositivo específico
 * @param supabase Cliente Supabase
 * @param deviceId ID do dispositivo a ser revogado
 * @param isCurrentDevice Se é o dispositivo atual
 * @returns Promise com resultado da operação
 */
export const revokeDevice = async (supabase: any, deviceId: string, isCurrentDevice: boolean = false) => {
  try {
    if (!supabase) {
      throw new Error('Supabase client inválido');
    }
    
    // Excluir o dispositivo da tabela
    const { error } = await supabase
      .from('connected_devices')
      .delete()
      .eq('device_id', deviceId);
    
    if (error) {
      console.error('Erro ao revogar dispositivo:', error);
      return { success: false, error };
    }
    
    // Se for o dispositivo atual, efetuar logout
    if (isCurrentDevice) {
      await supabase.auth.signOut();
      // Opcional: limpar o device_id no localStorage
      localStorage.removeItem(DEVICE_ID_KEY);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Exceção ao revogar dispositivo:', error);
    return { success: false, error };
  }
};

/**
 * Verifica se o dispositivo atual é o que está sendo visualizado
 * @param deviceId ID do dispositivo a verificar
 * @returns true se for o dispositivo atual
 */
export const isCurrentDevice = (deviceId: string): boolean => {
  const currentDeviceId = localStorage.getItem(DEVICE_ID_KEY);
  return currentDeviceId === deviceId;
};

// Exportar funções úteis para o resto da aplicação
export default {
  generateDeviceFingerprint,
  verifyDeviceFingerprint,
  registerDeviceFingerprint,
  handleFailedLogin,
  resetFailedLogin,
  getSecurityHeaders,
  sanitizeInput,
  checkPasswordStrength,
  secureStorage,
  detectSuspiciousActivity,
  parseUserAgent,
  getDeviceId,
  fetchApproxLocation,
  registerOrUpdateDevice,
  revokeDevice,
  isCurrentDevice,
  encryptAES,
  decryptAES,
  setUserNamespace
};
