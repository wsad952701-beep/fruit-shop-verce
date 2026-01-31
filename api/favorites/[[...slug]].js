// Favorites API (Node.js Runtime)
import { queryOne, queryAll, execute } from '../../lib/db.js';
import { verifyToken } from '../../lib/auth.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const user = verifyToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: '請先登入' });

    const { slug } = req.query;
    const path = slug ? (Array.isArray(slug) ? slug.join('/') : slug) : '';

    // GET - 收藏列表
    if (req.method === 'GET') {
        try {
            // Check specific product
            if (path.startsWith('check/')) {
                const productId = path.replace('check/', '');
                const fav = await queryOne('SELECT id FROM favorites WHERE user_id = ? AND product_id = ?', [user.id, productId]);
                return res.status(200).json({ isFavorite: !!fav });
            }

            const favorites = await queryAll(`
                SELECT f.id, f.product_id, p.name, p.price, p.image_url, p.stock
                FROM favorites f JOIN products p ON f.product_id = p.id WHERE f.user_id = ?
            `, [user.id]);
            return res.status(200).json({ favorites });
        } catch (error) {
            return res.status(500).json({ error: '取得收藏失敗' });
        }
    }

    // POST - 新增或切換收藏
    if (req.method === 'POST') {
        try {
            const { product_id } = req.body;
            if (!product_id) return res.status(400).json({ error: '請指定商品' });

            const existing = await queryOne('SELECT id FROM favorites WHERE user_id = ? AND product_id = ?', [user.id, product_id]);

            if (path === 'toggle') {
                if (existing) {
                    await execute('DELETE FROM favorites WHERE id = ?', [existing.id]);
                    return res.status(200).json({ message: '已移除收藏', isFavorite: false });
                } else {
                    await execute('INSERT INTO favorites (user_id, product_id) VALUES (?, ?)', [user.id, product_id]);
                    return res.status(200).json({ message: '已加入收藏', isFavorite: true });
                }
            }

            if (existing) return res.status(400).json({ error: '商品已在收藏中' });
            await execute('INSERT INTO favorites (user_id, product_id) VALUES (?, ?)', [user.id, product_id]);
            return res.status(201).json({ message: '已加入收藏' });
        } catch (error) {
            return res.status(500).json({ error: '操作失敗' });
        }
    }

    // DELETE - 移除收藏
    if (req.method === 'DELETE' && path) {
        try {
            await execute('DELETE FROM favorites WHERE user_id = ? AND product_id = ?', [user.id, path]);
            return res.status(200).json({ message: '已移除收藏' });
        } catch (error) {
            return res.status(500).json({ error: '移除失敗' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
