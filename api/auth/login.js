// Auth API - Login endpoint (Node.js Runtime)
import bcrypt from 'bcryptjs';
import { queryOne } from '../../lib/db.js';
import { generateToken } from '../../lib/auth.js';

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: '請輸入 Email 和密碼' });
        }

        const user = await queryOne('SELECT * FROM users WHERE email = ?', [email]);
        if (!user) {
            return res.status(401).json({ error: 'Email 或密碼錯誤' });
        }

        if (!bcrypt.compareSync(password, user.password_hash)) {
            return res.status(401).json({ error: 'Email 或密碼錯誤' });
        }

        if (user.status === 'suspended') {
            return res.status(403).json({ error: '您的帳號已被停用，請聯繫客服' });
        }

        const token = generateToken(user);

        return res.status(200).json({
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
        return res.status(500).json({ error: '登入失敗，請稍後再試' });
    }
}
