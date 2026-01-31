// Auth API - Register endpoint (Node.js Runtime)
import bcrypt from 'bcryptjs';
import { queryOne, execute } from '../../lib/db.js';
import { generateToken } from '../../lib/auth.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { email, password, name, phone, address } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({ error: '請填寫必要欄位' });
        }

        const existing = await queryOne('SELECT id FROM users WHERE email = ?', [email]);
        if (existing) {
            return res.status(400).json({ error: '此 Email 已被註冊' });
        }

        const hashedPassword = bcrypt.hashSync(password, 10);

        await execute(
            'INSERT INTO users (email, password_hash, name, phone, address, credit, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [email, hashedPassword, name, phone || null, address || null, 5000, 'active']
        );

        const newUser = await queryOne('SELECT * FROM users WHERE email = ?', [email]);
        const token = generateToken(newUser);

        return res.status(201).json({
            message: '註冊成功',
            user: { id: newUser.id, email: newUser.email, name: newUser.name, is_admin: 0 },
            token
        });
    } catch (error) {
        console.error('註冊錯誤:', error);
        return res.status(500).json({ error: '註冊失敗，請稍後再試' });
    }
}
