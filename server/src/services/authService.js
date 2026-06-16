import jwt from 'jsonwebtoken';

const SECRET = process.env.AUTH_SECRET || 'ebkss-classroom-secret-2026';
const TOKEN_EXPIRY = '24h';

/**
 * 生成 JWT token
 */
export function signToken() {
  return jwt.sign({ role: 'teacher', iat: Math.floor(Date.now() / 1000) }, SECRET, {
    expiresIn: TOKEN_EXPIRY
  });
}

/**
 * 验证 JWT token，返回解码后的 payload 或 null
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

/**
 * Express 中间件：要求有效 token
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token || !verifyToken(token)) {
    res.status(401).json({ error: 'Please login first' });
    return;
  }

  next();
}

/**
 * Express 中间件：可选 token（不强制，但附加到 req.user）
 */
export function optionalAuth(req, _res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (token) {
    req.user = verifyToken(token);
  }
  next();
}
