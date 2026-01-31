// Favorites API - CRUD endpoints
import { queryOne, queryAll, execute } from '../../lib/db.js';
import { authenticateRequest, jsonResponse, errorResponse, handleOptions } from '../../lib/auth.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
    if (req.method === 'OPTIONS') return handleOptions();

    const auth = authenticateRequest(req);
    if (auth.error) return auth.response;
    const user = auth.user;

    const url = new URL(req.url);
    const pathname = url.pathname;

    // 處理 toggle
    if (pathname.includes('/toggle')) {
        return handleToggle(req, user);
    }

    // 處理 check
    const checkMatch = pathname.match(/\/check\/(\d+)$/);
    if (checkMatch) {
        return handleCheck(checkMatch[1], user);
    }

    const idMatch = pathname.match(/\/api\/favorites\/(\d+)$/);
    const productId = idMatch ? idMatch[1] : null;

    // GET - 取得收藏列表
    if (req.method === 'GET') {
        try {
            const favorites = await queryAll(`
                SELECT f.id, f.product_id, f.created_at,
                       p.name, p.price, p.original_price, p.image_url, p.stock,
                       p.is_featured, p.is_seasonal,
                       c.name as category_name
                FROM favorites f
                JOIN products p ON f.product_id = p.id
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE f.user_id = ?
                ORDER BY f.created_at DESC
            `, [user.id]);

            return jsonResponse({ favorites });
        } catch (error) {
            console.error('取得收藏列表錯誤:', error);
            return errorResponse('取得收藏列表失敗', 500);
        }
    }

    // POST - 新增收藏
    if (req.method === 'POST') {
        try {
            const { product_id } = await req.json();

            if (!product_id) {
                return errorResponse('請指定商品', 400);
            }

            const product = await queryOne('SELECT id FROM products WHERE id = ?', [product_id]);
            if (!product) {
                return errorResponse('商品不存在', 404);
            }

            const existing = await queryOne(
                'SELECT id FROM favorites WHERE user_id = ? AND product_id = ?',
                [user.id, product_id]
            );

            if (existing) {
                return errorResponse('商品已在收藏中', 400);
            }

            await execute(
                'INSERT INTO favorites (user_id, product_id) VALUES (?, ?)',
                [user.id, product_id]
            );

            return jsonResponse({ message: '已加入收藏' }, 201);
        } catch (error) {
            console.error('新增收藏錯誤:', error);
            return errorResponse('新增收藏失敗', 500);
        }
    }

    // DELETE - 移除收藏
    if (req.method === 'DELETE' && productId) {
        try {
            const result = await execute(
                'DELETE FROM favorites WHERE user_id = ? AND product_id = ?',
                [user.id, productId]
            );

            if (result.rowsAffected === 0) {
                return errorResponse('收藏不存在', 404);
            }

            return jsonResponse({ message: '已移除收藏' });
        } catch (error) {
            console.error('移除收藏錯誤:', error);
            return errorResponse('移除收藏失敗', 500);
        }
    }

    return errorResponse('Method not allowed', 405);
}

async function handleCheck(productId, user) {
    try {
        const favorite = await queryOne(
            'SELECT id FROM favorites WHERE user_id = ? AND product_id = ?',
            [user.id, productId]
        );
        return jsonResponse({ isFavorite: !!favorite });
    } catch (error) {
        console.error('檢查收藏狀態錯誤:', error);
        return errorResponse('檢查收藏狀態失敗', 500);
    }
}

async function handleToggle(req, user) {
    if (req.method !== 'POST') {
        return errorResponse('Method not allowed', 405);
    }

    try {
        const { product_id } = await req.json();

        if (!product_id) {
            return errorResponse('請指定商品', 400);
        }

        const existing = await queryOne(
            'SELECT id FROM favorites WHERE user_id = ? AND product_id = ?',
            [user.id, product_id]
        );

        if (existing) {
            await execute('DELETE FROM favorites WHERE id = ?', [existing.id]);
            return jsonResponse({ message: '已移除收藏', isFavorite: false });
        } else {
            await execute(
                'INSERT INTO favorites (user_id, product_id) VALUES (?, ?)',
                [user.id, product_id]
            );
            return jsonResponse({ message: '已加入收藏', isFavorite: true });
        }
    } catch (error) {
        console.error('切換收藏狀態錯誤:', error);
        return errorResponse('操作失敗', 500);
    }
}
