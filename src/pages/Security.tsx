
import React, { useState, useEffect } from 'react';
import Layout from '@/components/layout/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Loader2, Shield, Eye, UserCheck } from 'lucide-react';
import PrivacySettingsView from '@/components/security/PrivacySettingsView';
import KYCVerificationView from '@/components/security/KYCVerificationView';

const SecurityPage: React.FC = () => {
  const { user, loading, securityScore } = useAuth();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<string>('privacy');
  
  // Handle URL param for tab selection
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['privacy', 'kyc'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);
  
  // Redirect to login if not authenticated
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Shield className="h-7 w-7 text-app-purple mr-3" />
            <h1 className="text-2xl font-bold">Segurança & Privacidade</h1>
          </div>
          
          <div className="flex items-center bg-muted/30 p-2 rounded-md">
            <div className="text-sm mr-3">
              <span className="text-muted-foreground">Pontuação de segurança:</span>
            </div>
            <div className="flex items-center">
              <div className="h-2 w-24 bg-muted rounded-full mr-2 overflow-hidden">
                <div 
                  className="h-full bg-app-purple rounded-full"
                  style={{ width: `${securityScore}%` }}
                ></div>
              </div>
              <span className="font-medium">{securityScore}%</span>
            </div>
          </div>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-1 md:grid-cols-2 h-auto gap-2">
            <TabsTrigger value="privacy" className="flex items-center">
              <Eye className="mr-2 h-4 w-4" /> Privacidade
            </TabsTrigger>
            <TabsTrigger value="kyc" className="flex items-center">
              <UserCheck className="mr-2 h-4 w-4" /> Verificação KYC
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="privacy">
            <PrivacySettingsView />
          </TabsContent>
          
          <TabsContent value="kyc">
            <KYCVerificationView />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default SecurityPage;
