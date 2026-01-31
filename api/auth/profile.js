// Auth API - Profile endpoint (GET and PUT)
import { queryOne, execute } from '../../lib/db.js';
import { authenticateRequest, jsonResponse, errorResponse, handleOptions } from '../../lib/auth.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
    if (req.method === 'OPTIONS') return handleOptions();

    // 驗證用戶
    const auth = authenticateRequest(req);
    if (auth.error) return auth.response;
    const user = auth.user;

    if (req.method === 'GET') {
        try {
            const userData = await queryOne(
                'SELECT id, email, name, phone, address, is_admin, IFNULL(credit, 0) as credit, created_at FROM users WHERE id = ?',
                [user.id]
            );

            if (!userData) {
                return errorResponse('用戶不存在', 404);
            }

            return jsonResponse({ user: userData });
        } catch (error) {
            console.error('取得資料錯誤:', error);
            return errorResponse('取得資料失敗', 500);
        }
    }

    if (req.method === 'PUT') {
        try {
            const { name, phone, address } = await req.json();

            await execute(
                'UPDATE users SET name = ?, phone = ?, address = ? WHERE id = ?',
                [name, phone, address, user.id]
            );

            const updatedUser = await queryOne(
                'SELECT id, email, name, phone, address FROM users WHERE id = ?',
                [user.id]
            );

            return jsonResponse({ message: '更新成功', user: updatedUser });
        } catch (error) {
            console.error('更新資料錯誤:', error);
            return errorResponse('更新資料失敗', 500);
        }
    }

    return errorResponse('Method not allowed', 405);
}
