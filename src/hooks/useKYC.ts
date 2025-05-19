
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { calculateHash } from '@/utils/cryptography';
import { Database } from '@/types/supabase';

interface KYCStatus {
  verified: boolean;
  level: 'none' | 'basic' | 'advanced' | 'complete';
  lastVerified?: string;
  documents: Array<{
    type: string;
    status: 'pending' | 'verified' | 'rejected';
    verifiedAt?: string;
  }>;
}

/**
 * Hook para gerenciar verificação KYC (Know Your Customer)
 * Implementa verificação de identidade e prevenção a fraudes
 */
export const useKYC = () => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<KYCStatus>({
    verified: false,
    level: 'none',
    documents: []
  });
  
  const { user } = useAuth();
  const { toast } = useToast();
  
  /**
   * Carrega o status atual de verificação KYC do usuário
   */
  const loadKYCStatus = async (): Promise<KYCStatus> => {
    try {
      setLoading(true);
      
      if (!user) {
        throw new Error("Usuário não autenticado");
      }
      
      // Use type assertion for table that doesn't exist in types
      const { data, error } = await (supabase
        .from('user_kyc') as any)
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = não encontrado
        throw error;
      }
      
      if (!data) {
        // Usuário não iniciou processo KYC
        const defaultStatus = {
          verified: false,
          level: 'none' as const,
          documents: []
        };
        setStatus(defaultStatus);
        return defaultStatus;
      }
      
      const kycData = data as UserKYC;
      
      // Obter documentos verificados
      const { data: docs, error: docsError } = await (supabase
        .from('user_kyc_documents') as any)
        .select('*')
        .eq('user_id', user.id);
      
      if (docsError) throw docsError;
      
      const documents = (docs || []) as UserKYCDocument[];
      
      const kycStatus = {
        verified: kycData.verified || false,
        level: kycData.level || 'none',
        lastVerified: kycData.verified_at,
        documents: documents.map(doc => ({
          type: doc.document_type,
          status: doc.status,
          verifiedAt: doc.verified_at
        }))
      };
      
      setStatus(kycStatus);
      return kycStatus;
    } catch (error) {
      console.error('Erro ao carregar status KYC:', error);
      toast({
        variant: "destructive",
        title: "Erro ao carregar verificação KYC",
        description: error instanceof Error ? error.message : "Ocorreu um erro desconhecido",
      });
      
      return {
        verified: false,
        level: 'none',
        documents: []
      };
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Inicia processo de verificação KYC básica com informações pessoais
   * @param userData Dados pessoais do usuário
   */
  const initiateBasicVerification = async (userData: {
    fullName: string;
    birthDate: string;
    nationality: string;
    address: string;
    taxId: string;
  }): Promise<boolean> => {
    try {
      setLoading(true);
      
      if (!user) {
        throw new Error("Usuário não autenticado");
      }
      
      // Hash de informações sensíveis antes de armazenar
      const taxIdHash = await calculateHash(userData.taxId);
      
      // Verificar se já existe registro
      const { data: existing } = await (supabase
        .from('user_kyc') as any)
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (existing) {
        // Atualizar registro existente
        const { error } = await (supabase
          .from('user_kyc') as any)
          .update({
            full_name: userData.fullName,
            birth_date: userData.birthDate,
            nationality: userData.nationality,
            address: userData.address,
            tax_id_hash: taxIdHash,
            level: 'basic',
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);
        
        if (error) throw error;
      } else {
        // Criar novo registro
        const { error } = await (supabase
          .from('user_kyc') as any)
          .insert({
            user_id: user.id,
            full_name: userData.fullName,
            birth_date: userData.birthDate,
            nationality: userData.nationality,
            address: userData.address,
            tax_id_hash: taxIdHash,
            level: 'basic',
            verified: false
          });
        
        if (error) throw error;
      }
      
      // Atualizar estado local
      setStatus(prev => ({
        ...prev,
        level: 'basic'
      }));
      
      toast({
        title: "Verificação básica iniciada",
        description: "Seus dados pessoais foram registrados para verificação",
      });
      
      return true;
    } catch (error) {
      console.error('Erro ao iniciar verificação básica:', error);
      toast({
        variant: "destructive",
        title: "Erro na verificação",
        description: error instanceof Error ? error.message : "Ocorreu um erro desconhecido",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Envia documento para verificação avançada
   * @param documentType Tipo de documento
   * @param documentData Dados do documento (imagem em base64 ou objeto File)
   */
  const submitDocument = async (
    documentType: 'identity' | 'address_proof' | 'selfie',
    documentData: string | File
  ): Promise<boolean> => {
    try {
      setLoading(true);
      
      if (!user) {
        throw new Error("Usuário não autenticado");
      }
      
      // Verificar se KYC básico foi concluído
      const { data: kycData } = await (supabase
        .from('user_kyc') as any)
        .select('level')
        .eq('user_id', user.id)
        .single();
      
      if (!kycData || kycData.level === 'none') {
        throw new Error("Complete a verificação básica antes de enviar documentos");
      }
      
      // Preparar dados do documento
      let documentContent: string;
      let documentFilename: string;
      
      if (typeof documentData === 'string') {
        // Já está em formato base64
        documentContent = documentData;
        documentFilename = `${documentType}_${Date.now()}.jpg`;
      } else {
        // Converter File para base64
        documentContent = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(documentData);
        });
        documentFilename = documentData.name;
      }
      
      // Upload para Storage
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('kyc_documents')
        .upload(
          `${user.id}/${documentType}/${documentFilename}`, 
          documentContent, 
          { contentType: 'image/jpeg', upsert: true }
        );
      
      if (uploadError) throw uploadError;
      
      // Registrar documento no banco
      const { error: docError } = await (supabase
        .from('user_kyc_documents') as any)
        .insert({
          user_id: user.id,
          document_type: documentType,
          document_path: uploadData?.path,
          status: 'pending',
          submitted_at: new Date().toISOString()
        });
      
      if (docError) throw docError;
      
      // Atualizar nível de verificação se necessário
      if (kycData.level === 'basic') {
        await (supabase
          .from('user_kyc') as any)
          .update({ 
            level: 'advanced',
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id);
        
        setStatus(prev => ({
          ...prev,
          level: 'advanced'
        }));
      }
      
      // Atualizar lista de documentos
      await loadKYCStatus();
      
      toast({
        title: "Documento enviado",
        description: "Seu documento foi enviado para verificação",
      });
      
      return true;
    } catch (error) {
      console.error('Erro ao enviar documento KYC:', error);
      toast({
        variant: "destructive",
        title: "Erro ao enviar documento",
        description: error instanceof Error ? error.message : "Ocorreu um erro desconhecido",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Verifica se uma transação pode prosseguir baseado no nível KYC
   * @param transactionValue Valor da transação
   */
  const canProceedWithTransaction = (transactionValue: number): {
    allowed: boolean;
    reason?: string;
    requiredLevel?: 'basic' | 'advanced' | 'complete';
  } => {
    // Definir limites de transação baseados no nível KYC
    const transactionLimits = {
      none: 100, // Sem verificação - apenas pequenas transações
      basic: 1000, // Verificação básica
      advanced: 10000, // Verificação com documentos
      complete: Number.MAX_SAFE_INTEGER // Verificação completa sem limites
    };
    
    // Definir nível KYC necessário para o valor
    let requiredLevel: 'basic' | 'advanced' | 'complete';
    
    if (transactionValue <= transactionLimits.none) {
      return { allowed: true };
    } else if (transactionValue <= transactionLimits.basic) {
      requiredLevel = 'basic';
    } else if (transactionValue <= transactionLimits.advanced) {
      requiredLevel = 'advanced';
    } else {
      requiredLevel = 'complete';
    }
    
    // Verificar nível atual do usuário
    const currentLevel = status.level;
    const levelValues = {
      'none': 0,
      'basic': 1,
      'advanced': 2,
      'complete': 3
    };
    
    if (levelValues[currentLevel] >= levelValues[requiredLevel]) {
      return { allowed: true };
    }
    
    return {
      allowed: false,
      reason: `Verificação KYC insuficiente para esta transação. Necessário: ${requiredLevel}`,
      requiredLevel
    };
  };
  
  /**
   * Verifica reputação de outro usuário (anti-fraude)
   * @param userId ID do usuário a verificar
   */
  const checkUserReputation = async (userId: string): Promise<{
    score: number; // 0-100, onde 100 é excelente
    riskLevel: 'low' | 'medium' | 'high';
    verified: boolean;
  }> => {
    try {
      if (!user) {
        throw new Error("Usuário não autenticado");
      }
      
      // Buscar reputação do usuário
      const { data, error } = await supabase.rpc('get_user_reputation', {
        p_user_id: userId
      });
      
      if (error) throw error;
      
      // Caso não haja dados, retornar score médio
      if (!data) {
        return {
          score: 50,
          riskLevel: 'medium',
          verified: false
        };
      }
      
      // Handle the result - it returns a single row but in array format
      // so we need to extract the first element
      const reputationData = Array.isArray(data) ? data[0] : data;
      
      // Determinar nível de risco
      let riskLevel: 'low' | 'medium' | 'high';
      if (reputationData.reputation_score >= 70) {
        riskLevel = 'low';
      } else if (reputationData.reputation_score >= 40) {
        riskLevel = 'medium';
      } else {
        riskLevel = 'high';
      }
      
      return {
        score: reputationData.reputation_score,
        riskLevel,
        verified: reputationData.is_verified
      };
    } catch (error) {
      console.error('Erro ao verificar reputação do usuário:', error);
      // Em caso de erro, retornar score neutro
      return {
        score: 50,
        riskLevel: 'medium',
        verified: false
      };
    }
  };

  return {
    loading,
    status,
    loadKYCStatus,
    initiateBasicVerification,
    submitDocument,
    canProceedWithTransaction,
    checkUserReputation
  };
};
