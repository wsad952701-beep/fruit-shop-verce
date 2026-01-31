// Auth helpers for Vercel Serverless Functions (Node.js Runtime)
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fruit-porter-secret-key-2024';

export function verifyToken(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.split(' ')[1];

    try {
        const user = jwt.verify(token, JWT_SECRET);
        return user;
    } catch (error) {
        return null;
    }
}

export function generateToken(user) {
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            name: user.name,
            is_admin: user.is_admin
        },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

export default { verifyToken, generateToken };
