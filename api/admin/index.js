// Admin API - Dashboard, Orders, Products, Members, Categories
import { queryOne, queryAll, execute } from '../../lib/db.js';
import { authenticateRequest, requireAdmin, jsonResponse, errorResponse, handleOptions } from '../../lib/auth.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
    if (req.method === 'OPTIONS') return handleOptions();

    // 驗證管理員
    const auth = authenticateRequest(req);
    if (auth.error) return auth.response;

    const adminCheck = requireAdmin(auth.user);
    if (adminCheck.error) return adminCheck.response;

    const url = new URL(req.url);
    const pathname = url.pathname;

    // 路由分發
    if (pathname.includes('/dashboard')) return handleDashboard();
    if (pathname.includes('/categories')) return handleCategories();

    // Members 路由
    if (pathname.includes('/members')) {
        const creditMatch = pathname.match(/\/members\/(\d+)\/credit$/);
        if (creditMatch) return handleMemberCredit(req, creditMatch[1]);

        const statusMatch = pathname.match(/\/members\/(\d+)\/status$/);
        if (statusMatch) return handleMemberStatus(req, statusMatch[1]);

        const memberIdMatch = pathname.match(/\/members\/(\d+)$/);
        if (memberIdMatch) return handleDeleteMember(req, memberIdMatch[1]);

        return handleMembers(req);
    }

    // Products 路由
    if (pathname.includes('/products')) {
        const productIdMatch = pathname.match(/\/products\/(\d+)$/);
        if (productIdMatch) return handleProduct(req, productIdMatch[1]);
        return handleProducts(req);
    }

    // Orders 路由
    if (pathname.includes('/orders')) {
        const statusMatch = pathname.match(/\/orders\/(\d+)\/status$/);
        if (statusMatch) return handleOrderStatus(req, statusMatch[1]);

        const orderIdMatch = pathname.match(/\/orders\/(\d+)$/);
        if (orderIdMatch) return handleOrderDetail(orderIdMatch[1]);

        return handleOrders(req);
    }

    return errorResponse('Not found', 404);
}

// 儀表板
async function handleDashboard() {
    try {
        const today = new Date().toISOString().split('T')[0];

        const todayStats = await queryOne(`
            SELECT COUNT(*) as order_count, COALESCE(SUM(total_amount), 0) as total_revenue
            FROM orders WHERE DATE(created_at) = DATE(?)
        `, [today]);

        const totalStats = await queryOne(`
            SELECT COUNT(*) as order_count, COALESCE(SUM(total_amount), 0) as total_revenue FROM orders
        `);

        const memberCount = await queryOne('SELECT COUNT(*) as count FROM users WHERE is_admin = 0');
        const productCount = await queryOne('SELECT COUNT(*) as count FROM products');
        const pendingOrders = await queryOne("SELECT COUNT(*) as count FROM orders WHERE status = 'pending'");

        const salesTrend = await queryAll(`
            SELECT DATE(created_at) as date, COUNT(*) as order_count, SUM(total_amount) as revenue
            FROM orders WHERE created_at >= DATE('now', '-7 days')
            GROUP BY DATE(created_at) ORDER BY date DESC
        `);

        const recentOrders = await queryAll(`
            SELECT o.*, u.name as customer_name, u.email as customer_email
            FROM orders o LEFT JOIN users u ON o.user_id = u.id
            ORDER BY o.created_at DESC LIMIT 10
        `);

        const topProducts = await queryAll(`
            SELECT p.id, p.name, p.price, p.image_url, SUM(oi.quantity) as total_sold
            FROM order_items oi JOIN products p ON oi.product_id = p.id
            GROUP BY p.id ORDER BY total_sold DESC LIMIT 5
        `);

        return jsonResponse({
            today: { orders: todayStats?.order_count || 0, revenue: todayStats?.total_revenue || 0 },
            total: {
                members: memberCount?.count || 0,
                products: productCount?.count || 0,
                pending_orders: pendingOrders?.count || 0,
                orders: totalStats?.order_count || 0,
                revenue: totalStats?.total_revenue || 0
            },
            salesTrend, recentOrders, topProducts
        });
    } catch (error) {
        console.error('取得儀表板數據錯誤:', error);
        return errorResponse('取得數據失敗', 500);
    }
}

// 訂單列表
async function handleOrders(req) {
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search');
    const limit = parseInt(url.searchParams.get('limit')) || 50;
    const offset = parseInt(url.searchParams.get('offset')) || 0;

    try {
        let sql = `SELECT o.*, u.name as customer_name, u.email as customer_email FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE 1=1`;
        const params = [];

        if (status) { sql += ' AND o.status = ?'; params.push(status); }
        if (search) {
            sql += ' AND (o.order_number LIKE ? OR u.name LIKE ? OR u.email LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        sql += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const orders = await queryAll(sql, params);

        let countSql = 'SELECT COUNT(*) as total FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE 1=1';
        const countParams = [];
        if (status) { countSql += ' AND o.status = ?'; countParams.push(status); }
        if (search) {
            countSql += ' AND (o.order_number LIKE ? OR u.name LIKE ? OR u.email LIKE ?)';
            countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        const total = await queryOne(countSql, countParams);

        return jsonResponse({ orders, total: total?.total || 0 });
    } catch (error) {
        console.error('取得訂單錯誤:', error);
        return errorResponse('取得訂單失敗', 500);
    }
}

// 訂單詳情
async function handleOrderDetail(orderId) {
    try {
        const order = await queryOne(`
            SELECT o.*, u.name as customer_name, u.email as customer_email, u.phone as customer_phone
            FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE o.id = ?
        `, [orderId]);

        if (!order) return errorResponse('訂單不存在', 404);

        const items = await queryAll(`
            SELECT oi.*, p.image_url FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?
        `, [order.id]);

        return jsonResponse({ order, items });
    } catch (error) {
        console.error('取得訂單詳情錯誤:', error);
        return errorResponse('取得訂單詳情失敗', 500);
    }
}

// 更新訂單狀態
async function handleOrderStatus(req, orderId) {
    if (req.method !== 'PUT') return errorResponse('Method not allowed', 405);

    try {
        const { status, cancel_reason, admin_note } = await req.json();
        const validStatuses = ['pending', 'processing', 'shipped', 'completed', 'cancelled'];

        if (!validStatuses.includes(status)) return errorResponse('無效的訂單狀態', 400);

        const order = await queryOne('SELECT * FROM orders WHERE id = ?', [orderId]);
        if (!order) return errorResponse('訂單不存在', 404);

        if (status === 'cancelled' && order.status !== 'cancelled') {
            const orderItems = await queryAll('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
            for (const item of orderItems) {
                await execute('UPDATE products SET stock = stock + ? WHERE id = ?', [item.quantity, item.product_id]);
            }
            await execute('UPDATE users SET credit = credit + ? WHERE id = ?', [order.total_amount, order.user_id]);
        }

        if (status === 'cancelled') {
            await execute('UPDATE orders SET status = ?, cancel_reason = ?, admin_note = ? WHERE id = ?',
                [status, cancel_reason || null, admin_note || null, orderId]);
        } else {
            await execute('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);
        }

        return jsonResponse({ message: '訂單狀態已更新' });
    } catch (error) {
        console.error('更新訂單狀態錯誤:', error);
        return errorResponse('更新失敗', 500);
    }
}

// 產品管理
async function handleProducts(req) {
    if (req.method === 'GET') {
        try {
            const products = await queryAll(`
                SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.id DESC
            `);
            return jsonResponse({ products });
        } catch (error) {
            console.error('取得產品錯誤:', error);
            return errorResponse('取得產品失敗', 500);
        }
    }

    if (req.method === 'POST') {
        try {
            const { category_id, name, description, price, original_price, image_url, stock, is_featured, is_seasonal } = await req.json();

            if (!name || !price) return errorResponse('請填寫產品名稱和價格', 400);

            await execute(`
                INSERT INTO products (category_id, name, description, price, original_price, image_url, stock, is_featured, is_seasonal)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [category_id || null, name, description || null, price, original_price || null, image_url || null, stock || 0, is_featured ? 1 : 0, is_seasonal ? 1 : 0]);

            const product = await queryOne('SELECT * FROM products WHERE name = ? ORDER BY id DESC LIMIT 1', [name]);
            return jsonResponse({ message: '產品已新增', product }, 201);
        } catch (error) {
            console.error('新增產品錯誤:', error);
            return errorResponse('新增產品失敗', 500);
        }
    }

    return errorResponse('Method not allowed', 405);
}

async function handleProduct(req, productId) {
    if (req.method === 'PUT') {
        try {
            const { category_id, name, description, price, original_price, image_url, stock, is_featured, is_seasonal } = await req.json();

            const existing = await queryOne('SELECT id FROM products WHERE id = ?', [productId]);
            if (!existing) return errorResponse('產品不存在', 404);

            await execute(`
                UPDATE products SET category_id = ?, name = ?, description = ?, price = ?, original_price = ?, 
                image_url = ?, stock = ?, is_featured = ?, is_seasonal = ? WHERE id = ?
            `, [category_id || null, name, description || null, price, original_price || null, image_url || null, stock || 0, is_featured ? 1 : 0, is_seasonal ? 1 : 0, productId]);

            const product = await queryOne('SELECT * FROM products WHERE id = ?', [productId]);
            return jsonResponse({ message: '產品已更新', product });
        } catch (error) {
            console.error('更新產品錯誤:', error);
            return errorResponse('更新產品失敗', 500);
        }
    }

    if (req.method === 'DELETE') {
        try {
            const existing = await queryOne('SELECT id FROM products WHERE id = ?', [productId]);
            if (!existing) return errorResponse('產品不存在', 404);

            await execute('DELETE FROM products WHERE id = ?', [productId]);
            return jsonResponse({ message: '產品已刪除' });
        } catch (error) {
            console.error('刪除產品錯誤:', error);
            return errorResponse('刪除產品失敗', 500);
        }
    }

    return errorResponse('Method not allowed', 405);
}

// 會員管理
async function handleMembers(req) {
    const url = new URL(req.url);
    const search = url.searchParams.get('search');
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit')) || 50;
    const offset = parseInt(url.searchParams.get('offset')) || 0;

    try {
        let sql = `
            SELECT id, email, name, phone, address, IFNULL(status, 'active') as status, IFNULL(credit, 0) as credit, created_at,
                   (SELECT COUNT(*) FROM orders WHERE user_id = users.id) as order_count,
                   (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE user_id = users.id) as total_spent
            FROM users WHERE is_admin = 0
        `;
        const params = [];

        if (search) {
            sql += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (status && status !== 'all') {
            sql += " AND IFNULL(status, 'active') = ?";
            params.push(status);
        }

        sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const members = await queryAll(sql, params);

        let countSql = 'SELECT COUNT(*) as total FROM users WHERE is_admin = 0';
        const countParams = [];
        if (search) {
            countSql += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)';
            countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (status && status !== 'all') {
            countSql += " AND IFNULL(status, 'active') = ?";
            countParams.push(status);
        }
        const total = await queryOne(countSql, countParams);

        return jsonResponse({ members, total: total?.total || 0 });
    } catch (error) {
        console.error('取得會員錯誤:', error);
        return errorResponse('取得會員失敗', 500);
    }
}

async function handleMemberCredit(req, memberId) {
    if (req.method !== 'PUT') return errorResponse('Method not allowed', 405);

    try {
        const { credit, adjustment } = await req.json();
        const existing = await queryOne('SELECT id, IFNULL(credit, 0) as credit FROM users WHERE id = ? AND is_admin = 0', [memberId]);
        if (!existing) return errorResponse('會員不存在', 404);

        let newCredit;
        if (typeof adjustment === 'number') {
            newCredit = existing.credit + adjustment;
        } else if (typeof credit === 'number') {
            newCredit = credit;
        } else {
            return errorResponse('請提供有效的額度', 400);
        }

        if (newCredit < 0) return errorResponse('額度不能為負數', 400);

        await execute('UPDATE users SET credit = ? WHERE id = ?', [newCredit, memberId]);
        return jsonResponse({ message: '會員額度已更新', credit: newCredit });
    } catch (error) {
        console.error('更新會員額度錯誤:', error);
        return errorResponse('更新會員額度失敗', 500);
    }
}

async function handleMemberStatus(req, memberId) {
    if (req.method !== 'PUT') return errorResponse('Method not allowed', 405);

    try {
        const { status } = await req.json();
        if (!['active', 'suspended'].includes(status)) return errorResponse('無效的狀態', 400);

        const existing = await queryOne('SELECT id FROM users WHERE id = ? AND is_admin = 0', [memberId]);
        if (!existing) return errorResponse('會員不存在', 404);

        await execute('UPDATE users SET status = ? WHERE id = ?', [status, memberId]);
        return jsonResponse({ message: '會員狀態已更新', status });
    } catch (error) {
        console.error('更新會員狀態錯誤:', error);
        return errorResponse('更新會員狀態失敗', 500);
    }
}

async function handleDeleteMember(req, memberId) {
    if (req.method !== 'DELETE') return errorResponse('Method not allowed', 405);

    try {
        const existing = await queryOne('SELECT id FROM users WHERE id = ? AND is_admin = 0', [memberId]);
        if (!existing) return errorResponse('會員不存在', 404);

        await execute('DELETE FROM cart_items WHERE user_id = ?', [memberId]);
        await execute('DELETE FROM users WHERE id = ?', [memberId]);
        return jsonResponse({ message: '會員已刪除' });
    } catch (error) {
        console.error('刪除會員錯誤:', error);
        return errorResponse('刪除會員失敗', 500);
    }
}

// 分類
async function handleCategories() {
    try {
        const categories = await queryAll('SELECT * FROM categories ORDER BY sort_order');
        return jsonResponse({ categories });
    } catch (error) {
        console.error('取得分類錯誤:', error);
        return errorResponse('取得分類失敗', 500);
    }
}
