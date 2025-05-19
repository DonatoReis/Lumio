
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useKYC } from '@/hooks/useKYC';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, 
  CheckCircle, 
  AlertCircle, 
  Upload, 
  User, 
  MapPin, 
  Calendar,
  Flag,
  CreditCard
} from 'lucide-react';

const KYCVerificationView: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({
    fullName: '',
    birthDate: '',
    nationality: '',
    address: '',
    taxId: '',
  });
  
  const { 
    loading, 
    status, 
    loadKYCStatus, 
    initiateBasicVerification,
    submitDocument
  } = useKYC();
  
  const { toast } = useToast();
  
  // Carregar status inicial de verificação
  useEffect(() => {
    const loadStatus = async () => {
      await loadKYCStatus();
    };
    
    loadStatus();
  }, []);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleBasicVerification = async () => {
    // Validar campos
    const requiredFields = ['fullName', 'birthDate', 'nationality', 'address', 'taxId'];
    const emptyFields = requiredFields.filter(field => !formData[field as keyof typeof formData]);
    
    if (emptyFields.length > 0) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos obrigatórios.",
      });
      return;
    }
    
    const success = await initiateBasicVerification(formData);
    if (success) {
      setActiveStep(1);
    }
  };
  
  const handleDocumentUpload = async (documentType: 'identity' | 'address_proof' | 'selfie', file: File) => {
    const success = await submitDocument(documentType, file);
    if (success) {
      await loadKYCStatus();
      
      // Se todos os documentos foram enviados, avançar para o próximo passo
      if (status.documents.length >= 3) {
        setActiveStep(2);
      }
    }
  };
  
  const renderVerificationStepIcon = (step: 'basic' | 'advanced' | 'complete') => {
    const levelValues = {
      'none': 0,
      'basic': 1,
      'advanced': 2,
      'complete': 3
    };
    
    const currentLevel = levelValues[status.level];
    const stepLevel = levelValues[step];
    
    if (currentLevel >= stepLevel) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    } else if (currentLevel + 1 === stepLevel) {
      return <div className="h-5 w-5 rounded-full border-2 border-app-purple" />;
    } else {
      return <div className="h-5 w-5 rounded-full border-2 border-muted" />;
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <Shield className="h-6 w-6 text-app-purple" />
        <h2 className="text-2xl font-bold">Verificação de Identidade (KYC)</h2>
      </div>
      
      <p className="text-muted-foreground">
        Complete a verificação de identidade para aumentar os limites de transação
        e garantir a segurança do ecossistema.
      </p>
      
      <div className="flex items-center justify-between px-4 py-3 bg-muted/30 rounded-md mb-6">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            {renderVerificationStepIcon('basic')}
            <span className={status.level === 'none' ? 'text-muted-foreground' : ''}>
              Básico
            </span>
          </div>
          
          <div className="h-px w-10 bg-muted" />
          
          <div className="flex items-center space-x-2">
            {renderVerificationStepIcon('advanced')}
            <span className={status.level === 'none' || status.level === 'basic' ? 'text-muted-foreground' : ''}>
              Avançado
            </span>
          </div>
          
          <div className="h-px w-10 bg-muted" />
          
          <div className="flex items-center space-x-2">
            {renderVerificationStepIcon('complete')}
            <span className={status.level !== 'complete' ? 'text-muted-foreground' : ''}>
              Completo
            </span>
          </div>
        </div>
        
        <div>
          <Badge
            variant="outline"
            className={
              status.verified 
                ? "bg-green-500/10 text-green-500 border-green-500/20" 
                : "bg-amber-500/10 text-amber-500 border-amber-500/20"
            }
          >
            {status.verified ? "Verificado" : "Pendente"}
          </Badge>
        </div>
      </div>
      
      {status.level === 'none' && (
        <Card className="p-6 space-y-6">
          <div className="flex items-center space-x-3">
            <User className="h-5 w-5 text-app-purple" />
            <h3 className="text-lg font-medium">Verificação Básica</h3>
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome completo</Label>
                <Input
                  id="fullName"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  placeholder="Seu nome completo"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="birthDate">Data de nascimento</Label>
                <Input
                  id="birthDate"
                  name="birthDate"
                  type="date"
                  value={formData.birthDate}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nationality">Nacionalidade</Label>
                <Input
                  id="nationality"
                  name="nationality"
                  value={formData.nationality}
                  onChange={handleInputChange}
                  placeholder="País de origem"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="taxId">CPF/CNPJ</Label>
                <Input
                  id="taxId"
                  name="taxId"
                  value={formData.taxId}
                  onChange={handleInputChange}
                  placeholder="Seu documento fiscal"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="address">Endereço completo</Label>
              <Input
                id="address"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="Rua, número, complemento, cidade, estado, CEP"
              />
            </div>
            
            <Button 
              onClick={handleBasicVerification}
              disabled={loading}
              className="w-full"
            >
              {loading ? "Processando..." : "Enviar informações básicas"}
            </Button>
          </div>
        </Card>
      )}
      
      {status.level === 'basic' && (
        <Card className="p-6 space-y-6">
          <div className="flex items-center space-x-3">
            <Upload className="h-5 w-5 text-app-purple" />
            <h3 className="text-lg font-medium">Verificação de Documentos</h3>
          </div>
          
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <DocumentUploadCard
                title="Documento de Identidade"
                description="RG, CNH ou Passaporte"
                icon={<CreditCard className="h-10 w-10 text-app-purple opacity-80" />}
                onUpload={(file) => handleDocumentUpload('identity', file)}
                status={status.documents.find(doc => doc.type === 'identity')?.status}
                loading={loading}
              />
              
              <DocumentUploadCard
                title="Comprovante de Residência"
                description="Conta de luz, água ou telefone"
                icon={<MapPin className="h-10 w-10 text-app-purple opacity-80" />}
                onUpload={(file) => handleDocumentUpload('address_proof', file)}
                status={status.documents.find(doc => doc.type === 'address_proof')?.status}
                loading={loading}
              />
              
              <DocumentUploadCard
                title="Selfie com Documento"
                description="Foto sua segurando o documento"
                icon={<User className="h-10 w-10 text-app-purple opacity-80" />}
                onUpload={(file) => handleDocumentUpload('selfie', file)}
                status={status.documents.find(doc => doc.type === 'selfie')?.status}
                loading={loading}
              />
            </div>
            
            <div className="bg-muted/30 p-4 rounded-md">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 mr-2" />
                <div className="text-sm">
                  <p className="font-medium">Importante</p>
                  <p className="text-muted-foreground">
                    Todos os documentos serão criptografados e usados apenas para fins de verificação.
                    O processo de verificação pode levar até 24 horas.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}
      
      {(status.level === 'advanced' || status.level === 'complete') && (
        <Card className="p-6">
          <div className="flex items-center space-x-3 mb-4">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <h3 className="text-lg font-medium">Verificação em Processamento</h3>
          </div>
          
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Sua verificação está sendo processada. Você receberá uma notificação assim que for concluída.
              Enquanto isso, você já pode utilizar os recursos com limites aumentados.
            </p>
            
            <div className="bg-green-500/10 p-4 rounded-md">
              <div className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-2" />
                <div className="text-sm">
                  <p className="font-medium text-green-500">Documentos recebidos</p>
                  <p>
                    Todos os documentos necessários foram recebidos e estão sendo processados.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mt-6">
              <h4 className="font-medium mb-2">Limites de transação atuais:</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-2 bg-muted/20 rounded">
                  <span>Transferências diárias</span>
                  <span className="font-medium">R$ 10.000,00</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-muted/20 rounded">
                  <span>Transações mensais</span>
                  <span className="font-medium">R$ 50.000,00</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

interface DocumentUploadCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onUpload: (file: File) => void;
  status?: 'pending' | 'verified' | 'rejected';
  loading: boolean;
}

const DocumentUploadCard: React.FC<DocumentUploadCardProps> = ({
  title,
  description,
  icon,
  onUpload,
  status,
  loading
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUpload(e.target.files[0]);
    }
  };
  
  return (
    <Card className="p-4 text-center">
      <input 
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleFileChange}
      />
      
      <div className="h-16 flex items-center justify-center mb-3">
        {icon}
      </div>
      
      <h4 className="font-medium mb-1">{title}</h4>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>
      
      {!status && (
        <Button 
          variant="outline" 
          className="w-full"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
        >
          Enviar documento
        </Button>
      )}
      
      {status === 'pending' && (
        <div className="flex items-center justify-center text-amber-500 text-sm font-medium">
          <AlertCircle className="h-4 w-4 mr-1" />
          Verificação pendente
        </div>
      )}
      
      {status === 'verified' && (
        <div className="flex items-center justify-center text-green-500 text-sm font-medium">
          <CheckCircle className="h-4 w-4 mr-1" />
          Documento verificado
        </div>
      )}
      
      {status === 'rejected' && (
        <div className="mt-2">
          <div className="flex items-center justify-center text-red-500 text-sm font-medium mb-2">
            <AlertCircle className="h-4 w-4 mr-1" />
            Documento rejeitado
          </div>
          <Button 
            variant="outline" 
            size="sm"
            className="w-full"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
          >
            Enviar novamente
          </Button>
        </div>
      )}
    </Card>
  );
};

export default KYCVerificationView;
