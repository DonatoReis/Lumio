
import React from 'react';
import { MessageCircle, Users, ShoppingBag, Calendar, BriefcaseBusiness, TrendingUp } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import Layout from '@/components/layout/Layout';
import WelcomeCard from '@/components/dashboard/WelcomeCard';
import StatsCard from '@/components/dashboard/StatsCard';

const Index: React.FC = () => {
  const isMobile = useIsMobile();

  return (
    <Layout>
      <div className="p-4 md:p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Welcome card */}
          <WelcomeCard />
          
          {/* Stats grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard 
              title="Empresas Compatíveis" 
              value="24" 
              description="Matches de alta compatibilidade"
              icon={<BriefcaseBusiness size={18} />}
              trend={{ value: 12, positive: true }}
            />
            <StatsCard 
              title="Conversas Ativas" 
              value="7" 
              description="2 aguardando resposta"
              icon={<MessageCircle size={18} />}
            />
            <StatsCard 
              title="Oportunidades" 
              value="R$ 48.350" 
              description="Valor estimado no pipeline"
              icon={<TrendingUp size={18} />}
              trend={{ value: 8, positive: true }}
            />
            <StatsCard 
              title="Reuniões Agendadas" 
              value="3" 
              description="Próxima: Hoje às 14:30"
              icon={<Calendar size={18} />}
            />
          </div>
          
          {/* Marketplace section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  <div className="lg:col-span-2 bg-app-black rounded-lg border border-sidebar-border p-5 shadow-[0_4px_6px_rgba(0,0,0,0.4)]">
              <h2 className="text-lg font-semibold mb-4">Empresas Recomendadas</h2>
              <div className="space-y-4">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="flex items-center space-x-4 p-3 bg-app-background rounded-lg hover:bg-app-purple/5 transition cursor-pointer">
                    <div className="w-10 h-10 bg-app-purple/20 rounded-md flex items-center justify-center">
                      <BriefcaseBusiness className="text-app-purple" size={20} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium">Tech Solutions SA</h3>
                      <p className="text-xs text-muted-foreground">Compatibilidade: 92% • Setor: Tecnologia</p>
                    </div>
                    <button className="px-3 py-1 bg-app-purple text-app-textoBotoes text-xs rounded-full">
                      Conectar
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Activity card */}
  <div className="bg-app-black rounded-lg border border-sidebar-border p-5 shadow-[0_4px_6px_rgba(0,0,0,0.4)]">
              <h2 className="text-lg font-semibold mb-4">Atividade Recente</h2>
              <div className="space-y-4">
                <div className="flex space-x-3">
                  <div className="w-8 h-8 rounded-full bg-app-blue/20 flex-shrink-0 flex items-center justify-center">
                    <MessageCircle size={14} className="text-app-blue" />
                  </div>
                  <div>
                    <p className="text-sm">Nova mensagem de <span className="font-medium">Global Logistics</span></p>
                    <p className="text-xs text-muted-foreground">Hoje às 10:23</p>
                  </div>
                </div>
                <div className="flex space-x-3">
                  <div className="w-8 h-8 rounded-full bg-app-green/20 flex-shrink-0 flex items-center justify-center">
                    <Users size={14} className="text-app-green" />
                  </div>
                  <div>
                    <p className="text-sm">Reunião agendada com <span className="font-medium">Tech Innovations</span></p>
                    <p className="text-xs text-muted-foreground">Hoje às 09:17</p>
                  </div>
                </div>
                <div className="flex space-x-3">
                  <div className="w-8 h-8 rounded-full bg-app-purple/20 flex-shrink-0 flex items-center justify-center">
                    <ShoppingBag size={14} className="text-app-purple" />
                  </div>
                  <div>
                    <p className="text-sm">Novo produto no marketplace: <span className="font-medium">Sistema ERP</span></p>
                    <p className="text-xs text-muted-foreground">Ontem às 16:45</p>
                  </div>
                </div>
              </div>
              <button className="mt-4 w-full py-2 text-sm text-app-purple hover:text-app-blue transition-colors">
                Ver todas as atividades
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Index;
