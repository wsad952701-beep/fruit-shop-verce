// Cart API - CRUD endpoints
import { queryOne, queryAll, execute } from '../../lib/db.js';
import { authenticateRequest, jsonResponse, errorResponse, handleOptions } from '../../lib/auth.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
    if (req.method === 'OPTIONS') return handleOptions();

    // 驗證用戶
    const auth = authenticateRequest(req);
    if (auth.error) return auth.response;
    const user = auth.user;

    const url = new URL(req.url);
    const idMatch = url.pathname.match(/\/api\/cart\/(\d+)$/);
    const cartItemId = idMatch ? idMatch[1] : null;

    // GET - 取得購物車
    if (req.method === 'GET') {
        try {
            const items = await queryAll(`
                SELECT c.id, c.quantity, p.id as product_id, p.name, p.price, p.image_url, p.stock
                FROM cart_items c
                JOIN products p ON c.product_id = p.id
                WHERE c.user_id = ?
            `, [user.id]);

            const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            return jsonResponse({ items, total });
        } catch (error) {
            console.error('取得購物車錯誤:', error);
            return errorResponse('取得購物車失敗', 500);
        }
    }

    // POST - 加入購物車
    if (req.method === 'POST') {
        try {
            const { product_id, quantity = 1 } = await req.json();

            if (!product_id) {
                return errorResponse('請指定產品', 400);
            }

            const product = await queryOne('SELECT * FROM products WHERE id = ?', [product_id]);
            if (!product) {
                return errorResponse('產品不存在', 404);
            }

            if (product.stock < quantity) {
                return errorResponse('庫存不足', 400);
            }

            const existing = await queryOne(
                'SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?',
                [user.id, product_id]
            );

            if (existing) {
                const newQuantity = existing.quantity + quantity;
                if (product.stock < newQuantity) {
                    return errorResponse('庫存不足', 400);
                }
                await execute('UPDATE cart_items SET quantity = ? WHERE id = ?', [newQuantity, existing.id]);
            } else {
                await execute(
                    'INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)',
                    [user.id, product_id, quantity]
                );
            }

            const items = await queryAll(`
                SELECT c.id, c.quantity, p.id as product_id, p.name, p.price, p.image_url
                FROM cart_items c
                JOIN products p ON c.product_id = p.id
                WHERE c.user_id = ?
            `, [user.id]);

            return jsonResponse({ message: '已加入購物車', items });
        } catch (error) {
            console.error('加入購物車錯誤:', error);
            return errorResponse('加入購物車失敗', 500);
        }
    }

    // PUT - 更新數量
    if (req.method === 'PUT' && cartItemId) {
        try {
            const { quantity } = await req.json();

            if (!quantity || quantity < 1) {
                return errorResponse('數量必須大於 0', 400);
            }

            const cartItem = await queryOne(
                'SELECT c.*, p.stock FROM cart_items c JOIN products p ON c.product_id = p.id WHERE c.id = ? AND c.user_id = ?',
                [cartItemId, user.id]
            );

            if (!cartItem) {
                return errorResponse('購物車項目不存在', 404);
            }

            if (cartItem.stock < quantity) {
                return errorResponse('庫存不足', 400);
            }

            await execute('UPDATE cart_items SET quantity = ? WHERE id = ?', [quantity, cartItemId]);
            return jsonResponse({ message: '更新成功' });
        } catch (error) {
            console.error('更新購物車錯誤:', error);
            return errorResponse('更新購物車失敗', 500);
        }
    }

    // DELETE - 移除項目或清空購物車
    if (req.method === 'DELETE') {
        try {
            if (cartItemId) {
                const item = await queryOne('SELECT id FROM cart_items WHERE id = ? AND user_id = ?', [cartItemId, user.id]);
                if (!item) {
                    return errorResponse('購物車項目不存在', 404);
                }
                await execute('DELETE FROM cart_items WHERE id = ? AND user_id = ?', [cartItemId, user.id]);
                return jsonResponse({ message: '已從購物車移除' });
            } else {
                await execute('DELETE FROM cart_items WHERE user_id = ?', [user.id]);
                return jsonResponse({ message: '購物車已清空' });
            }
        } catch (error) {
            console.error('移除購物車錯誤:', error);
            return errorResponse('移除失敗', 500);
        }
    }

    return errorResponse('Method not allowed', 405);
}
