// Auth API - Register endpoint
import bcrypt from 'bcryptjs';
import { queryOne, execute } from '../../lib/db.js';
import { generateToken, jsonResponse, errorResponse, handleOptions } from '../../lib/auth.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
    if (req.method === 'OPTIONS') return handleOptions();

    if (req.method !== 'POST') {
        return errorResponse('Method not allowed', 405);
    }

    try {
        const { email, password, name, phone } = await req.json();

        if (!email || !password || !name) {
            return errorResponse('請填寫必要欄位', 400);
        }

        // 檢查 email 是否已存在
        const existing = await queryOne('SELECT id FROM users WHERE email = ?', [email]);
        if (existing) {
            return errorResponse('此 Email 已被註冊', 400);
        }

        // 加密密碼
        const hashedPassword = bcrypt.hashSync(password, 10);

        // 新增用戶
        await execute(
            'INSERT INTO users (email, password_hash, name, phone) VALUES (?, ?, ?, ?)',
            [email, hashedPassword, name, phone || null]
        );

        // 查詢剛建立的用戶
        const user = await queryOne('SELECT id, email, name, phone, is_admin FROM users WHERE email = ?', [email]);
        const token = generateToken(user);

        return jsonResponse({
            message: '註冊成功',
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            },
            token
        }, 201);
    } catch (error) {
        console.error('註冊錯誤:', error);
        return errorResponse('註冊失敗，請稍後再試', 500);
    }
}
