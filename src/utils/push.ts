import { supabase } from "@/integrations/supabase/client";

// Check if we're in development mode
const isDevelopment = import.meta.env.DEV === true;

// Check if push notifications are enabled via environment variable
const isPushEnabled = !!import.meta.env.VITE_VAPID_PUBLIC_KEY;

// Registra o Service Worker
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  // Skip registration in development mode if desired
  if (isDevelopment) {
    console.log('Desenvolvimento local: Service Worker registro opcional');
  }
  
  // Check if VAPID key is available
  if (!isPushEnabled) {
    console.log('Notificações push desativadas: VITE_VAPID_PUBLIC_KEY não configurada');
    return null;
  }
  
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registrado com sucesso:', registration);
      return registration;
    } catch (error) {
      console.warn('Aviso: Erro ao registrar Service Worker:', error);
      // Don't throw in development mode
      if (isDevelopment) {
        console.log('Continuando sem Service Worker em ambiente de desenvolvimento');
        return null;
      }
      throw error;
    }
  }
  
  // Don't throw in development mode
  if (isDevelopment) {
    console.warn('Aviso: Service Workers não são suportados neste navegador');
    return null;
  }
  
  throw new Error('Service Workers não são suportados neste navegador');
}

// Solicita permissão para notificações push
export async function requestPushPermission(): Promise<boolean> {
  // Skip if notification API is not available
  if (!('Notification' in window)) {
    console.warn('API de Notificações não disponível neste navegador');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Permissão para notificações não concedida pelo usuário');
      return false;
    }
    return true;
  } catch (error) {
    console.warn('Aviso: Erro ao solicitar permissão para notificações:', error);
    // Don't throw in development mode
    if (isDevelopment) {
      return false;
    }
    throw error;
  }
}

// Inscreve o usuário para receber notificações push
export async function subscribeUserToPush(userId: string): Promise<PushSubscription | null> {
  // Skip if push notifications are not enabled
  if (!isPushEnabled) {
    console.log('Ignorando subscrição push: VITE_VAPID_PUBLIC_KEY não configurada');
    return null;
  }
  
  // Skip if Service Worker API is not available
  if (!('serviceWorker' in navigator)) {
    console.warn('API Service Worker não disponível, ignorando subscrição push');
    return null;
  }
  
  try {
    // Check if Service Worker is ready
    if (navigator.serviceWorker.controller === null) {
      console.log('Service Worker não está ativo, aguardando...');
      // Give up in development mode rather than waiting
      if (isDevelopment) {
        console.log('Ambiente de desenvolvimento: ignorando subscrição push');
        return null;
      }
    }
    
    const registration = await navigator.serviceWorker.ready;
    
    // Check if VAPID key is available
    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      console.warn('VITE_VAPID_PUBLIC_KEY não configurada, ignorando subscrição push');
      return null;
    }
    
    // Converte VAPID key de base64 para Uint8Array
    const applicationServerKey = urlBase64ToUint8Array(vapidKey);
    
    // Inscreve para push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey
    });
    
    // Extrai os dados da subscription
    const subscriptionJSON = subscription.toJSON();
    
    // Check if the backend URL is configured
    const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
    if (!functionsUrl) {
      console.warn('VITE_SUPABASE_FUNCTIONS_URL não configurada, ignorando registro da subscrição');
      return subscription; // Return the subscription even if we don't register it
    }
    
    // Registra no backend
    const response = await fetch(
      `${functionsUrl}/register-push-subscription`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: userId,
          endpoint: subscriptionJSON.endpoint,
          keys: subscriptionJSON.keys
        })
      }
    );
    
    if (!response.ok) {
      console.warn('Aviso: Falha ao registrar subscription no servidor');
      // Don't throw in development mode
      if (isDevelopment) {
        return subscription;
      }
      throw new Error('Falha ao registrar subscription no servidor');
    }
    
    return subscription;
  } catch (error) {
    console.warn('Aviso: Erro ao inscrever para notificações push:', error);
    // Don't throw in development mode
    if (isDevelopment) {
      return null;
    }
    throw error;
  }
}

// Helper para converter base64 para Uint8Array (necessário para applicationServerKey)
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  
  return outputArray;
}
