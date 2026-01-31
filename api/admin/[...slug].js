// Admin API (Node.js Runtime)
import { queryOne, queryAll, execute } from '../../lib/db.js';
import { verifyToken } from '../../lib/auth.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const user = verifyToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: '請先登入' });
    if (!user.is_admin) return res.status(403).json({ error: '需要管理員權限' });

    const { slug } = req.query;
    const path = slug ? (Array.isArray(slug) ? slug.join('/') : slug) : '';

    try {
        // Dashboard
        if (path === 'dashboard') {
            const memberCount = await queryOne('SELECT COUNT(*) as count FROM users WHERE is_admin = 0');
            const productCount = await queryOne('SELECT COUNT(*) as count FROM products');
            const orderCount = await queryOne('SELECT COUNT(*) as count FROM orders');
            const revenue = await queryOne('SELECT COALESCE(SUM(total_amount), 0) as total FROM orders');
            const pendingOrders = await queryOne("SELECT COUNT(*) as count FROM orders WHERE status = 'pending'");
            const recentOrders = await queryAll('SELECT o.*, u.name as customer_name FROM orders o LEFT JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC LIMIT 10');

            return res.status(200).json({
                total: {
                    members: memberCount?.count || 0,
                    products: productCount?.count || 0,
                    orders: orderCount?.count || 0,
                    revenue: revenue?.total || 0,
                    pending_orders: pendingOrders?.count || 0
                },
                recentOrders
            });
        }

        // Orders
        if (path === 'orders' || path.startsWith('orders/')) {
            const orderId = path.replace('orders/', '').replace('/status', '');

            if (path.includes('/status') && req.method === 'PUT') {
                const { status } = req.body;
                await execute('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);
                return res.status(200).json({ message: '訂單狀態已更新' });
            }

            if (orderId && orderId !== 'orders') {
                const order = await queryOne('SELECT o.*, u.name as customer_name, u.email as customer_email FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE o.id = ?', [orderId]);
                const items = await queryAll('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
                return res.status(200).json({ order, items });
            }

            const orders = await queryAll('SELECT o.*, u.name as customer_name FROM orders o LEFT JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC');
            return res.status(200).json({ orders });
        }

        // Products
        if (path === 'products' || path.startsWith('products/')) {
            const productId = path.replace('products/', '');

            if (req.method === 'GET') {
                const products = await queryAll('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.id DESC');
                return res.status(200).json({ products });
            }

            if (req.method === 'POST') {
                const { category_id, name, description, price, original_price, image_url, stock, is_featured, is_seasonal } = req.body;
                await execute('INSERT INTO products (category_id, name, description, price, original_price, image_url, stock, is_featured, is_seasonal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [category_id || null, name, description || null, price, original_price || null, image_url || null, stock || 0, is_featured ? 1 : 0, is_seasonal ? 1 : 0]);
                return res.status(201).json({ message: '產品已新增' });
            }

            if (req.method === 'PUT' && productId) {
                const { category_id, name, description, price, original_price, image_url, stock, is_featured, is_seasonal } = req.body;
                await execute('UPDATE products SET category_id = ?, name = ?, description = ?, price = ?, original_price = ?, image_url = ?, stock = ?, is_featured = ?, is_seasonal = ? WHERE id = ?',
                    [category_id || null, name, description || null, price, original_price || null, image_url || null, stock || 0, is_featured ? 1 : 0, is_seasonal ? 1 : 0, productId]);
                return res.status(200).json({ message: '產品已更新' });
            }

            if (req.method === 'DELETE' && productId) {
                await execute('DELETE FROM products WHERE id = ?', [productId]);
                return res.status(200).json({ message: '產品已刪除' });
            }
        }

        // Members
        if (path === 'members' || path.startsWith('members/')) {
            const memberId = path.replace('members/', '').replace('/credit', '').replace('/status', '');

            if (req.method === 'GET') {
                const members = await queryAll('SELECT id, email, name, phone, IFNULL(credit, 0) as credit, IFNULL(status, \'active\') as status, created_at FROM users WHERE is_admin = 0 ORDER BY created_at DESC');
                return res.status(200).json({ members });
            }

            if (path.includes('/credit') && req.method === 'PUT') {
                const { credit, adjustment } = req.body;
                if (typeof adjustment === 'number') {
                    await execute('UPDATE users SET credit = IFNULL(credit, 0) + ? WHERE id = ?', [adjustment, memberId]);
                } else if (typeof credit === 'number') {
                    await execute('UPDATE users SET credit = ? WHERE id = ?', [credit, memberId]);
                }
                return res.status(200).json({ message: '會員額度已更新' });
            }

            if (path.includes('/status') && req.method === 'PUT') {
                const { status } = req.body;
                await execute('UPDATE users SET status = ? WHERE id = ?', [status, memberId]);
                return res.status(200).json({ message: '會員狀態已更新' });
            }

            if (req.method === 'DELETE' && memberId) {
                await execute('DELETE FROM cart_items WHERE user_id = ?', [memberId]);
                await execute('DELETE FROM users WHERE id = ?', [memberId]);
                return res.status(200).json({ message: '會員已刪除' });
            }
        }

        // Categories
        if (path === 'categories') {
            const categories = await queryAll('SELECT * FROM categories ORDER BY sort_order');
            return res.status(200).json({ categories });
        }

        return res.status(404).json({ error: 'Not found' });
    } catch (error) {
        console.error('Admin API error:', error);
        return res.status(500).json({ error: '操作失敗' });
    }
}
