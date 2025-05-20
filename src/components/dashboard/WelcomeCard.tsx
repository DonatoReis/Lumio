import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const DynamicTypingDescription = () => {
  // Parte fixa da frase
  const fixedPart = 'Potencializa conexões comerciais estratégicas com inteligência artificial avançada, garantindo segurança absoluta em cada interação. Conecte seu negócio ao mundo com ';
  
  // Parte variável - diferentes finais
  const variableEndings = ['segurança.', 'zero custos recorrentes.', 'simplicidade.'];
  
  const [variableText, setVariableText] = React.useState('');
  const [cursorVisible, setCursorVisible] = React.useState(true);
  const [currentEndingIndex, setCurrentEndingIndex] = React.useState(0);
  
  // Estados para controlar a digitação
  const [isTyping, setIsTyping] = React.useState(true);
  const [isDeleting, setIsDeleting] = React.useState(false);
  
  // Referência para o contador de caracteres
  const charIndexRef = React.useRef(0);
  
  // Efeito para o cursor piscando
  React.useEffect(() => {
    const cursorInterval = setInterval(() => {
      setCursorVisible(prev => !prev);
    }, 500);
    
    return () => clearInterval(cursorInterval);
  }, []);
  
  // Efeito para inicializar com o primeiro final
  React.useEffect(() => {
    // Iniciar com a digitação do primeiro final
    setVariableText('');
    charIndexRef.current = 0;
    setIsTyping(true);
    setIsDeleting(false);
  }, []);
  
  // Efeito principal para animação da parte variável
  React.useEffect(() => {
    const currentEnding = variableEndings[currentEndingIndex];
    let timeout: NodeJS.Timeout;
    
    const typeCharacter = () => {
      if (charIndexRef.current < currentEnding.length) {
        setVariableText(currentEnding.substring(0, charIndexRef.current + 1));
        charIndexRef.current += 1;
        timeout = setTimeout(typeCharacter, 80);
      } else {
        // Pausa antes de apagar
        timeout = setTimeout(() => setIsDeleting(true), 2000);
      }
    };
    
    const deleteCharacter = () => {
      if (charIndexRef.current > 0) {
        charIndexRef.current -= 1;
        setVariableText(currentEnding.substring(0, charIndexRef.current));
        timeout = setTimeout(deleteCharacter, 50);
      } else {
        // Avançar para o próximo final
        setIsDeleting(false);
        setCurrentEndingIndex((prevIndex) => (prevIndex + 1) % variableEndings.length);
        timeout = setTimeout(() => {
          charIndexRef.current = 0;
          setIsTyping(true);
        }, 700);
      }
    };
    
    if (isTyping) {
      typeCharacter();
    } else if (isDeleting) {
      deleteCharacter();
    }
    
    return () => clearTimeout(timeout);
  }, [isTyping, isDeleting, currentEndingIndex, variableEndings]);
  
  return (
    <p className="mt-2 text-white/80 text-base">
      {fixedPart}{variableText}
      {cursorVisible && <span className="animate-pulse">|</span>}
    </p>
  );
};

const IABadge = () => (
  <div className="absolute top-4 right-4 z-20 px-3 py-1 text-sm font-bold text-white bg-gradient-to-r from-green-400 to-blue-500 rounded-full shadow-md">
    IA
  </div>
);


const WelcomeText: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-[#f1f1f1]">
    {children}
  </span>
);

const BackgroundEffect: React.FC = () => (
  <div className="absolute inset-0 rounded-2xl bg-[rgb(26,26,26)] border border-black/40" />
);

const SweepLight: React.FC = () => (
  <motion.div
    className="absolute inset-0 pointer-events-none"
    initial={{ x: '-150%' }}
    animate={{ x: '150%' }}
    transition={{ duration: 4, ease: 'linear', repeat: Infinity }}
    style={{
      background: 'linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)',
      mixBlendMode: 'overlay',
      filter: 'blur(4px)',
      willChange: 'transform',
    }}
  />
);

const GlowEffectLayer = () => {
  // Cores do gradiente
  const colors = [
    '#BC82F3', '#F5B9EA', '#8D9FFF', '#AA6EEE', 
    '#FF6778', '#FFBA71', '#C686FF'
  ];
  
  // Estado para os pontos de parada do gradiente
  const [gradientStops, setGradientStops] = React.useState<Array<{color: string, location: number}>>([]);
  
  // Estado para a cor atual do ponto luminoso
  const [currentColorIndex, setCurrentColorIndex] = React.useState(0);
  
  // Função para gerar pontos de parada aleatórios
  const generateGradientStops = React.useCallback(() => {
    const stops = colors.map(color => ({
      color,
      location: Math.random()
    }));
    
    return stops.sort((a, b) => a.location - b.location);
  }, []);
  
  // Converter os pontos de parada em uma string de gradiente CSS
  const getGradientString = (stops: Array<{color: string, location: number}>) => {
    if (stops.length === 0) return '';
    
    return `conic-gradient(${
      stops.map(stop => `${stop.color} ${Math.round(stop.location * 360)}deg`).join(', ')
    })`;
  };
  
  // Inicializar e atualizar periodicamente os pontos de parada
  React.useEffect(() => {
    setGradientStops(generateGradientStops());
    
    const timer = setInterval(() => {
      setGradientStops(generateGradientStops());
      // Avançar para a próxima cor do ponto luminoso
      setCurrentColorIndex(prevIndex => (prevIndex + 1) % colors.length);
    }, 1500); // Mais lento para um efeito mais suave
    
    return () => clearInterval(timer);
  }, [generateGradientStops]);
  
  // Calcular posição inicial para o ponto de luz na borda
  const initialPosition = React.useMemo(() => {
    const angle = 0;
    const radius = 48;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    return { x, y };
  }, []);
  
  return (
    <>
      {/* Camada de sombra que muda conforme o gradiente */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          borderRadius: '1rem', // Exatamente igual ao card (rounded-2xl)
          boxShadow: `0 0 15px 2px ${colors[currentColorIndex]}`,
          transition: 'box-shadow 1.5s ease-in-out',
        }}
      />
      
      {/* Camada base com borda fina colorida */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          borderRadius: '1rem', // Exatamente igual ao card
          border: '1.5px solid transparent',
          background: 'transparent',
          backgroundImage: getGradientString(gradientStops),
          backgroundOrigin: 'border-box',
          backgroundClip: 'border-box',
          WebkitMask: 
            'linear-gradient(#fff 0 0) content-box, ' +
            'linear-gradient(#fff 0 0) border-box',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          transition: 'all 1.2s ease-in-out',
        }}
      />
      
      {/* Camada de borda com blur para o efeito de glow */}
      <div
        className="absolute inset-[-2px] pointer-events-none z-10"
        style={{
          borderRadius: '1rem', // Exatamente igual ao card
          border: '2px solid transparent',
          background: 'transparent',
          backgroundImage: getGradientString(gradientStops),
          backgroundOrigin: 'border-box',
          backgroundClip: 'border-box',
          WebkitMask: 
            'linear-gradient(#fff 0 0) content-box, ' +
            'linear-gradient(#fff 0 0) border-box',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          filter: 'blur(5px)',
          opacity: 0.6,
          transition: 'all 1.2s ease-in-out',
        }}
      />
      
      {/* Ponto de luz girando na borda */}
      <motion.div
        className="absolute pointer-events-none z-20"
        style={{
          width: '4px',
          height: '4px',
          background: 'white',
          borderRadius: '50%',
          filter: 'blur(2px)',
          boxShadow: `0 0 8px 4px ${colors[currentColorIndex]}`,
          top: '50%',
          left: '50%',
          // Posicionar já na borda em vez de no centro
          transform: `translate(calc(-50% + ${initialPosition.x}%), calc(-50% + ${initialPosition.y}%))`,
        }}
        initial={{ pathOffset: 0 }}
        animate={{ 
          pathOffset: 1,
          boxShadow: [
            `0 0 8px 4px ${colors[0]}`,
            `0 0 8px 4px ${colors[1]}`,
            `0 0 8px 4px ${colors[2]}`,
            `0 0 8px 4px ${colors[3]}`,
            `0 0 8px 4px ${colors[4]}`,
            `0 0 8px 4px ${colors[5]}`,
            `0 0 8px 4px ${colors[6]}`,
          ],
        }}
        transition={{
          pathOffset: {
            duration: 4,
            repeat: Infinity,
            ease: "linear"
          },
          boxShadow: {
            duration: 10,
            repeat: Infinity,
            ease: "linear"
          }
        }}
        transformTemplate={({ pathOffset }) => {
          const angle = pathOffset * 2 * Math.PI;
          const radius = 48; // Posicionar na borda
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          return `translate(calc(-50% + ${x}%), calc(-50% + ${y}%))`
        }}
      />
    </>
  );
};

const WelcomeCard: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      <div className="relative mt-2">
        <Card className="rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
        {/* Efeito Glow */}

        {/* Camadas visuais existentes */}
        <div className="absolute inset-0 overflow-hidden">
          <BackgroundEffect />
          <SweepLight />
        </div>

        {/* Badge IA estático */}
        <IABadge />

        {/* Conteúdo */}
        <CardContent className="relative z-10 p-6 bg-transparent">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              {/* Título sem a animação de typing */}
              <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2 mb-3">
                <WelcomeText>Bem-vindo ao Mercantia</WelcomeText>
              </h2>
              {/* Texto com efeito de digitação */}
              <DynamicTypingDescription />
              <div className="flex flex-wrap mt-4 gap-3">
                <Link
                  to="/ai-match"
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 bg-[rgb(245,212,150)] text-[rgb(26,26,26)] hover:bg-[rgb(223,142,73)] h-10 px-4 py-2 app-button-primary text-app-textoBotoes px-6"
                  aria-label="Explorar Match IA"
                >
                  Explorar Match IA
                  <ArrowRight size={16} className="ml-2" />
                </Link>
                <Button className="bg-transparent border border-app-yellow text-white hover:bg-app-yellow transition-colors duration-300 font-medium h-10 px-6" aria-label="Tutorial Rápido">
                  Tutorial Rápido
                </Button>
              </div>
            </div>

          </div>
        </CardContent>
        </Card>
        <GlowEffectLayer />
      </div>
    </motion.div>
  );
};

export default WelcomeCard;