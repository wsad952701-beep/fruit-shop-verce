// Auth API - Profile endpoint (Node.js Runtime)
import { queryOne, execute } from '../../lib/db.js';
import { verifyToken } from '../../lib/auth.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const user = verifyToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: '請先登入' });

    if (req.method === 'GET') {
        try {
            const userData = await queryOne(
                'SELECT id, email, name, phone, address, IFNULL(credit, 0) as credit, status, created_at FROM users WHERE id = ?',
                [user.id]
            );
            if (!userData) return res.status(404).json({ error: '用戶不存在' });
            return res.status(200).json({ user: userData });
        } catch (error) {
            console.error('取得資料錯誤:', error);
            return res.status(500).json({ error: '取得資料失敗' });
        }
    }

    if (req.method === 'PUT') {
        try {
            const { name, phone, address } = req.body;
            await execute('UPDATE users SET name = ?, phone = ?, address = ? WHERE id = ?',
                [name || user.name, phone || null, address || null, user.id]);
            const updated = await queryOne('SELECT id, email, name, phone, address, credit FROM users WHERE id = ?', [user.id]);
            return res.status(200).json({ message: '更新成功', user: updated });
        } catch (error) {
            console.error('更新資料錯誤:', error);
            return res.status(500).json({ error: '更新失敗' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
