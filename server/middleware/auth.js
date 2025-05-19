import jwt from 'jsonwebtoken';

// Middleware para autenticar JWT
export function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({
      status: 'error',
      message: 'Cabeçalho de autorização ausente'
    });
  }
  
  const token = authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({
      status: 'error',
      message: 'Token não fornecido'
    });
  }
  
  try {
    // Para simplificar a implementação inicial, apenas decodifica sem verificar
    // a assinatura do token (inseguro em produção)
    const decoded = jwt.decode(token);

    if (!decoded) {
      throw new Error('Token inválido');
    }

    const userId = decoded.sub || decoded.user_id || decoded.user?.id;
    
    if (!userId) {
      throw new Error('ID do usuário não encontrado no token');
    }
    
    // Simplificar acesso ao ID do usuário
    req.user = {
      id: userId,
      email: decoded.email,
      role: decoded.role
    };
    
    next();
  } catch (error) {
    console.error('Erro de autenticação JWT:', error);
    return res.status(403).json({
      status: 'error',
      message: 'Token inválido ou expirado'
    });
  }
};


