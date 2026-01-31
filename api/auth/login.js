// Auth API - Login endpoint
import bcrypt from 'bcryptjs';
import { queryOne } from '../../lib/db.js';
import { generateToken, jsonResponse, errorResponse, handleOptions, corsHeaders } from '../../lib/auth.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
    if (req.method === 'OPTIONS') return handleOptions();

    if (req.method !== 'POST') {
        return errorResponse('Method not allowed', 405);
    }

    try {
        const { email, password } = await req.json();

        if (!email || !password) {
            return errorResponse('請輸入 Email 和密碼', 400);
        }

        // 查找用戶
        const user = await queryOne('SELECT * FROM users WHERE email = ?', [email]);
        if (!user) {
            return errorResponse('Email 或密碼錯誤', 401);
        }

        // 驗證密碼
        if (!bcrypt.compareSync(password, user.password_hash)) {
            return errorResponse('Email 或密碼錯誤', 401);
        }

        // 檢查帳號是否被停用
        if (user.status === 'suspended') {
            return errorResponse('您的帳號已被停用，請聯繫客服', 403);
        }

        const token = generateToken(user);

        return jsonResponse({
            message: '登入成功',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                is_admin: user.is_admin
            },
            token
        });
    } catch (error) {
        console.error('登入錯誤:', error);
        return errorResponse('登入失敗，請稍後再試', 500);
    }
}
