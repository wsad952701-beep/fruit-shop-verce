// Orders API - CRUD endpoints
import { queryOne, queryAll, execute } from '../../lib/db.js';
import { authenticateRequest, jsonResponse, errorResponse, handleOptions } from '../../lib/auth.js';

export const config = { runtime: 'edge' };

function generateOrderNumber() {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `FP${year}${month}${day}${random}`;
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') return handleOptions();

    const auth = authenticateRequest(req);
    if (auth.error) return auth.response;
    const user = auth.user;

    const url = new URL(req.url);
    const pathname = url.pathname;

    // 處理特定路由
    if (pathname.includes('/history/summary')) {
        return handleHistorySummary(user);
    }
    if (pathname.includes('/clear/all')) {
        return handleClearAll(req, user);
    }

    const cancelMatch = pathname.match(/\/api\/orders\/(\d+)\/cancel$/);
    if (cancelMatch) {
        return handleCancel(req, cancelMatch[1], user);
    }

    const idMatch = pathname.match(/\/api\/orders\/(\d+)$/);
    const orderId = idMatch ? idMatch[1] : null;

    // GET - 訂單列表或詳情
    if (req.method === 'GET') {
        if (orderId) {
            return handleOrderDetail(orderId, user);
        }
        return handleOrderList(user);
    }

    // POST - 建立訂單
    if (req.method === 'POST' && !orderId) {
        return handleCreateOrder(req, user);
    }

    // DELETE - 刪除訂單
    if (req.method === 'DELETE' && orderId) {
        return handleDeleteOrder(orderId, user);
    }

    // PUT - 取消訂單
    if (req.method === 'PUT' && orderId) {
        return handleCancel(req, orderId, user);
    }

    return errorResponse('Method not allowed', 405);
}

async function handleOrderList(user) {
    try {
        const orders = await queryAll(`
            SELECT * FROM orders 
            WHERE user_id = ? 
            ORDER BY created_at DESC
        `, [user.id]);
        return jsonResponse({ orders });
    } catch (error) {
        console.error('取得訂單錯誤:', error);
        return errorResponse('取得訂單失敗', 500);
    }
}

async function handleOrderDetail(orderId, user) {
    try {
        const order = await queryOne(`
            SELECT * FROM orders WHERE id = ? AND user_id = ?
        `, [orderId, user.id]);

        if (!order) {
            return errorResponse('訂單不存在', 404);
        }

        const items = await queryAll(`
            SELECT oi.*, p.image_url
            FROM order_items oi
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
        `, [order.id]);

        return jsonResponse({ order, items });
    } catch (error) {
        console.error('取得訂單詳情錯誤:', error);
        return errorResponse('取得訂單詳情失敗', 500);
    }
}

async function handleHistorySummary(user) {
    try {
        const orders = await queryAll(`
            SELECT * FROM orders
            WHERE user_id = ? AND status = 'completed'
            ORDER BY created_at DESC
        `, [user.id]);

        const totalSpent = orders.reduce((sum, order) => sum + order.total_amount, 0);

        const productStats = await queryAll(`
            SELECT oi.name, SUM(oi.quantity) as total_quantity, SUM(oi.unit_price * oi.quantity) as total_spent
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            WHERE o.user_id = ? AND o.status = 'completed'
            GROUP BY oi.product_id, oi.name
            ORDER BY total_quantity DESC
        `, [user.id]);

        return jsonResponse({
            orders,
            totalSpent,
            totalOrders: orders.length,
            productStats
        });
    } catch (error) {
        console.error('取得歷史購買記錄錯誤:', error);
        return errorResponse('取得歷史購買記錄失敗', 500);
    }
}

async function handleCreateOrder(req, user) {
    try {
        const { shipping_name, shipping_phone, shipping_address, notes } = await req.json();

        const userData = await queryOne('SELECT id, status, IFNULL(credit, 0) as credit FROM users WHERE id = ?', [user.id]);
        if (!userData) {
            return errorResponse('用戶不存在', 400);
        }

        if (userData.status === 'inactive' || userData.status === 'suspended') {
            return errorResponse('帳號異常，請聯絡管理員', 403);
        }

        if (!shipping_name || !shipping_phone || !shipping_address) {
            return errorResponse('請填寫完整的收件資訊', 400);
        }

        const cartItems = await queryAll(`
            SELECT c.*, p.price, p.stock, p.name
            FROM cart_items c
            JOIN products p ON c.product_id = p.id
            WHERE c.user_id = ?
        `, [user.id]);

        if (cartItems.length === 0) {
            return errorResponse('購物車是空的', 400);
        }

        for (const item of cartItems) {
            if (item.stock < item.quantity) {
                return errorResponse(`${item.name} 庫存不足`, 400);
            }
        }

        const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const shipping = subtotal >= 799 ? 0 : 100;
        const totalAmount = subtotal + shipping;

        if (userData.credit < totalAmount) {
            return errorResponse('額度不足，請聯絡管理人員', 400);
        }

        const orderNumber = generateOrderNumber();
        await execute(`
            INSERT INTO orders (user_id, order_number, total_amount, shipping_name, shipping_phone, shipping_address, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [user.id, orderNumber, totalAmount, shipping_name, shipping_phone, shipping_address, notes || null]);

        const newOrder = await queryOne('SELECT * FROM orders WHERE order_number = ?', [orderNumber]);

        for (const item of cartItems) {
            await execute(`
                INSERT INTO order_items (order_id, product_id, name, quantity, unit_price)
                VALUES (?, ?, ?, ?, ?)
            `, [newOrder.id, item.product_id, item.name, item.quantity, item.price]);

            await execute('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, item.product_id]);
        }

        await execute('UPDATE users SET credit = credit - ? WHERE id = ?', [totalAmount, user.id]);
        await execute('DELETE FROM cart_items WHERE user_id = ?', [user.id]);

        return jsonResponse({
            message: '訂單建立成功',
            order: {
                id: newOrder.id,
                order_number: orderNumber,
                total_amount: totalAmount
            }
        }, 201);
    } catch (error) {
        console.error('建立訂單錯誤:', error);
        return errorResponse('建立訂單失敗', 500);
    }
}

async function handleCancel(req, orderId, user) {
    if (req.method !== 'PUT') {
        return errorResponse('Method not allowed', 405);
    }

    try {
        const { cancel_reason } = await req.json();

        if (!cancel_reason || cancel_reason.trim() === '') {
            return errorResponse('請填寫取消原因', 400);
        }

        const order = await queryOne(`
            SELECT * FROM orders WHERE id = ? AND user_id = ?
        `, [orderId, user.id]);

        if (!order) {
            return errorResponse('訂單不存在', 404);
        }

        if (order.status !== 'pending') {
            return errorResponse('只有待處理的訂單可以取消', 400);
        }

        const orderItems = await queryAll('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
        for (const item of orderItems) {
            await execute('UPDATE products SET stock = stock + ? WHERE id = ?', [item.quantity, item.product_id]);
        }

        await execute('UPDATE users SET credit = credit + ? WHERE id = ?', [order.total_amount, user.id]);
        await execute('UPDATE orders SET status = ?, cancel_reason = ? WHERE id = ?', ['cancelled', cancel_reason.trim(), orderId]);

        return jsonResponse({ message: '訂單已取消，額度已退還' });
    } catch (error) {
        console.error('取消訂單錯誤:', error);
        return errorResponse('取消訂單失敗', 500);
    }
}

async function handleDeleteOrder(orderId, user) {
    try {
        const order = await queryOne(`
            SELECT * FROM orders WHERE id = ? AND user_id = ?
        `, [orderId, user.id]);

        if (!order) {
            return errorResponse('訂單不存在', 404);
        }

        if (!['completed', 'cancelled', 'delivered'].includes(order.status)) {
            return errorResponse('只有已完成或已取消的訂單可以刪除', 400);
        }

        await execute('DELETE FROM order_items WHERE order_id = ?', [orderId]);
        await execute('DELETE FROM orders WHERE id = ?', [orderId]);

        return jsonResponse({ message: '訂單記錄已刪除' });
    } catch (error) {
        console.error('刪除訂單錯誤:', error);
        return errorResponse('刪除訂單失敗', 500);
    }
}

async function handleClearAll(req, user) {
    if (req.method !== 'DELETE') {
        return errorResponse('Method not allowed', 405);
    }

    try {
        const orders = await queryAll(`
            SELECT id FROM orders 
            WHERE user_id = ? AND status IN ('completed', 'cancelled', 'delivered')
        `, [user.id]);

        if (orders.length === 0) {
            return jsonResponse({ message: '沒有可刪除的訂單', deleted: 0 });
        }

        for (const order of orders) {
            await execute('DELETE FROM order_items WHERE order_id = ?', [order.id]);
            await execute('DELETE FROM orders WHERE id = ?', [order.id]);
        }

        return jsonResponse({ message: `已刪除 ${orders.length} 筆訂單記錄`, deleted: orders.length });
    } catch (error) {
        console.error('清除訂單錯誤:', error);
        return errorResponse('清除訂單失敗', 500);
    }
}
