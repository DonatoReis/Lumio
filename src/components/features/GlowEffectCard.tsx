import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';

// Background elements
export const BackgroundEffect: React.FC = () => (
  <div className="absolute inset-0 rounded-xl bg-[rgb(26,26,26)] border border-black/40" />
);

export const SweepLight: React.FC = () => (
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

export const GlowEffectLayer: React.FC = () => {
  // Cores do gradiente
  const colors = [
    '#BC82F3', '#F5B9EA', '#8D9FFF', '#AA6EEE', 
    '#FF6778', '#FFBA71', '#C686FF'
  ];
  
  // Estado para os pontos de parada do gradiente
  const [gradientStops, setGradientStops] = useState<Array<{color: string, location: number}>>([]);
  
  // Estado para a cor atual do ponto luminoso
  const [currentColorIndex, setCurrentColorIndex] = useState(0);
  
  // Função para gerar pontos de parada aleatórios
  const generateGradientStops = useCallback(() => {
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
  useEffect(() => {
    setGradientStops(generateGradientStops());
    
    const timer = setInterval(() => {
      setGradientStops(generateGradientStops());
      // Avançar para a próxima cor do ponto luminoso
      setCurrentColorIndex(prevIndex => (prevIndex + 1) % colors.length);
    }, 1500); // Mais lento para um efeito mais suave
    
    return () => clearInterval(timer);
  }, [generateGradientStops]);
  
  // Calcular posição inicial para o ponto de luz na borda
  const initialPosition = useMemo(() => {
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
          borderRadius: '0.75rem', 
          boxShadow: `0 0 15px 2px ${colors[currentColorIndex]}`,
          transition: 'box-shadow 1.5s ease-in-out',
        }}
      />
      
      {/* Camada base com borda fina colorida */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          borderRadius: '0.75rem',
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
          borderRadius: '0.75rem',
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
          transform: `translate(calc(-50% + ${initialPosition.x}%), calc(-50% + ${initialPosition.y}%))`,
        }}
        initial={{ pathOffset: 0 }}
        animate={{ 
          pathOffset: 1,
          boxShadow: colors.map(color => `0 0 8px 4px ${color}`)
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
          const radius = 48;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          return `translate(calc(-50% + ${x}%), calc(-50% + ${y}%))`
        }}
      />
    </>
  );
};

interface GlowEffectCardProps {
  children: React.ReactNode;
}

export const GlowEffectCard: React.FC<GlowEffectCardProps> = ({ children }) => {
  return (
    <div className="relative">
      <div className="relative">
        {/* Background and light effects */}
        <div className="absolute inset-0 overflow-hidden rounded-xl">
          <BackgroundEffect />
          <SweepLight />
        </div>
        {children}
      </div>
      <GlowEffectLayer />
    </div>
  );
};

export default GlowEffectCard;
