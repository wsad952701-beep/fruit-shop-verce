// Cart API (Node.js Runtime)
import { queryOne, queryAll, execute } from '../../lib/db.js';
import { verifyToken } from '../../lib/auth.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const user = verifyToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: '請先登入' });

    const { id } = req.query;

    // GET - 取得購物車
    if (req.method === 'GET') {
        try {
            const items = await queryAll(`
                SELECT c.id, c.quantity, p.id as product_id, p.name, p.price, p.image_url, p.stock
                FROM cart_items c JOIN products p ON c.product_id = p.id WHERE c.user_id = ?
            `, [user.id]);
            const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            return res.status(200).json({ items, total });
        } catch (error) {
            return res.status(500).json({ error: '取得購物車失敗' });
        }
    }

    // POST - 加入購物車
    if (req.method === 'POST') {
        try {
            const { product_id, quantity = 1 } = req.body;
            if (!product_id) return res.status(400).json({ error: '請指定產品' });

            const product = await queryOne('SELECT * FROM products WHERE id = ?', [product_id]);
            if (!product) return res.status(404).json({ error: '產品不存在' });
            if (product.stock < quantity) return res.status(400).json({ error: '庫存不足' });

            const existing = await queryOne('SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?', [user.id, product_id]);

            if (existing) {
                await execute('UPDATE cart_items SET quantity = ? WHERE id = ?', [existing.quantity + quantity, existing.id]);
            } else {
                await execute('INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)', [user.id, product_id, quantity]);
            }

            const items = await queryAll('SELECT c.id, c.quantity, p.id as product_id, p.name, p.price, p.image_url FROM cart_items c JOIN products p ON c.product_id = p.id WHERE c.user_id = ?', [user.id]);
            return res.status(200).json({ message: '已加入購物車', items });
        } catch (error) {
            return res.status(500).json({ error: '加入購物車失敗' });
        }
    }

    // PUT - 更新數量
    if (req.method === 'PUT' && id) {
        try {
            const { quantity } = req.body;
            if (!quantity || quantity < 1) return res.status(400).json({ error: '數量必須大於 0' });

            await execute('UPDATE cart_items SET quantity = ? WHERE id = ? AND user_id = ?', [quantity, id, user.id]);
            return res.status(200).json({ message: '更新成功' });
        } catch (error) {
            return res.status(500).json({ error: '更新購物車失敗' });
        }
    }

    // DELETE - 移除項目
    if (req.method === 'DELETE') {
        try {
            if (id) {
                await execute('DELETE FROM cart_items WHERE id = ? AND user_id = ?', [id, user.id]);
                return res.status(200).json({ message: '已從購物車移除' });
            } else {
                await execute('DELETE FROM cart_items WHERE user_id = ?', [user.id]);
                return res.status(200).json({ message: '購物車已清空' });
            }
        } catch (error) {
            return res.status(500).json({ error: '移除失敗' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
