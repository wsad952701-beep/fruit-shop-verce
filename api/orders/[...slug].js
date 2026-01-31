// Orders API (Node.js Runtime)
import { queryOne, queryAll, execute } from '../../lib/db.js';
import { verifyToken } from '../../lib/auth.js';

function generateOrderNumber() {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `FP${year}${month}${day}${random}`;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const user = verifyToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: '請先登入' });

    const { slug } = req.query;
    const path = slug ? (Array.isArray(slug) ? slug.join('/') : slug) : '';

    // GET - 訂單列表或詳情
    if (req.method === 'GET') {
        try {
            if (path.match(/^\d+$/)) {
                const order = await queryOne('SELECT * FROM orders WHERE id = ? AND user_id = ?', [path, user.id]);
                if (!order) return res.status(404).json({ error: '訂單不存在' });
                const items = await queryAll('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
                return res.status(200).json({ order, items });
            }
            const orders = await queryAll('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [user.id]);
            return res.status(200).json({ orders });
        } catch (error) {
            return res.status(500).json({ error: '取得訂單失敗' });
        }
    }

    // POST - 建立訂單
    if (req.method === 'POST') {
        try {
            const { shipping_name, shipping_phone, shipping_address, notes } = req.body;

            if (!shipping_name || !shipping_phone || !shipping_address) {
                return res.status(400).json({ error: '請填寫完整的收件資訊' });
            }

            const cartItems = await queryAll('SELECT c.*, p.price, p.stock, p.name FROM cart_items c JOIN products p ON c.product_id = p.id WHERE c.user_id = ?', [user.id]);
            if (cartItems.length === 0) return res.status(400).json({ error: '購物車是空的' });

            const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const shipping = subtotal >= 799 ? 0 : 100;
            const totalAmount = subtotal + shipping;

            const userData = await queryOne('SELECT credit FROM users WHERE id = ?', [user.id]);
            if ((userData?.credit || 0) < totalAmount) {
                return res.status(400).json({ error: '額度不足' });
            }

            const orderNumber = generateOrderNumber();
            await execute('INSERT INTO orders (user_id, order_number, total_amount, shipping_name, shipping_phone, shipping_address, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [user.id, orderNumber, totalAmount, shipping_name, shipping_phone, shipping_address, notes || null, 'pending']);

            const newOrder = await queryOne('SELECT * FROM orders WHERE order_number = ?', [orderNumber]);

            for (const item of cartItems) {
                await execute('INSERT INTO order_items (order_id, product_id, name, quantity, unit_price) VALUES (?, ?, ?, ?, ?)',
                    [newOrder.id, item.product_id, item.name, item.quantity, item.price]);
            }

            await execute('UPDATE users SET credit = credit - ? WHERE id = ?', [totalAmount, user.id]);
            await execute('DELETE FROM cart_items WHERE user_id = ?', [user.id]);

            return res.status(201).json({ message: '訂單建立成功', order: { id: newOrder.id, order_number: orderNumber, total_amount: totalAmount } });
        } catch (error) {
            console.error('建立訂單錯誤:', error);
            return res.status(500).json({ error: '建立訂單失敗' });
        }
    }

    // PUT - 取消訂單
    if (req.method === 'PUT' && path.includes('cancel')) {
        try {
            const orderId = path.replace('/cancel', '');
            const { cancel_reason } = req.body;

            const order = await queryOne('SELECT * FROM orders WHERE id = ? AND user_id = ?', [orderId, user.id]);
            if (!order) return res.status(404).json({ error: '訂單不存在' });
            if (order.status !== 'pending') return res.status(400).json({ error: '只有待處理的訂單可以取消' });

            await execute('UPDATE users SET credit = credit + ? WHERE id = ?', [order.total_amount, user.id]);
            await execute('UPDATE orders SET status = ?, cancel_reason = ? WHERE id = ?', ['cancelled', cancel_reason || '', orderId]);

            return res.status(200).json({ message: '訂單已取消，額度已退還' });
        } catch (error) {
            return res.status(500).json({ error: '取消訂單失敗' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
