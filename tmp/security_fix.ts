// Substitua a função generateDeviceFingerprint por esta versão com polyfill para crypto.randomUUID

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
