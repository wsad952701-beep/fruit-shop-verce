// Auth helper for Vercel Serverless
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fruit-porter-secret-key-2024';

// 驗證 JWT Token
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

// 產生 JWT Token
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

// 驗證請求 - 返回 user 或 response
export function authenticateRequest(req) {
    const authHeader = req.headers.get('authorization') || req.headers['authorization'];
    const user = verifyToken(authHeader);

    if (!user) {
        return { error: true, response: Response.json({ error: '請先登入' }, { status: 401 }) };
    }

    return { error: false, user };
}

// 驗證管理員權限
export function requireAdmin(user) {
    if (!user || !user.is_admin) {
        return { error: true, response: Response.json({ error: '需要管理員權限' }, { status: 403 }) };
    }
    return { error: false };
}

// CORS headers
export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// 處理 OPTIONS 請求
export function handleOptions() {
    return new Response(null, { status: 204, headers: corsHeaders });
}

// JSON 響應
export function jsonResponse(data, status = 200) {
    return Response.json(data, {
        status,
        headers: corsHeaders
    });
}

// 錯誤響應
export function errorResponse(message, status = 500) {
    return Response.json({ error: message }, {
        status,
        headers: corsHeaders
    });
}

export default {
    verifyToken,
    generateToken,
    authenticateRequest,
    requireAdmin,
    corsHeaders,
    handleOptions,
    jsonResponse,
    errorResponse
};
