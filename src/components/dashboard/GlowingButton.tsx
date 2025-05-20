import React from 'react';
import { motion } from 'framer-motion';

interface GlowingButtonProps {
  children: React.ReactNode;
}

const GlowingButton: React.FC<GlowingButtonProps> = ({ children }) => {
  return (
    <motion.button
      className="app-button-primary text-app-textoBotoes h-10 px-6 relative overflow-hidden"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <span className="relative z-10">{children}</span>
      <motion.span
        className="absolute inset-0 bg-gradient-to-r from-green-400 to-yellow-500 opacity-0 hover:opacity-80 transition-opacity duration-300 z-0"
        style={{ borderRadius: '0.375rem' }} // Corresponde ao rounded-md do botão
      />
    </motion.button>
  );
};

export default GlowingButton;

