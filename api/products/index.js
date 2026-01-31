// Products API - Main endpoint
import { queryOne, queryAll } from '../../lib/db.js';
import { jsonResponse, errorResponse, handleOptions } from '../../lib/auth.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
    if (req.method === 'OPTIONS') return handleOptions();

    if (req.method !== 'GET') {
        return errorResponse('Method not allowed', 405);
    }

    const url = new URL(req.url);
    const pathname = url.pathname;

    // 處理特定路由
    if (pathname.includes('/categories')) {
        return handleCategories();
    }
    if (pathname.includes('/featured')) {
        return handleFeatured();
    }
    if (pathname.includes('/seasonal')) {
        return handleSeasonal();
    }

    // 處理單一商品 /api/products/[id]
    const idMatch = pathname.match(/\/api\/products\/(\d+)$/);
    if (idMatch) {
        return handleSingleProduct(idMatch[1]);
    }

    // 預設：商品列表
    return handleProductList(url.searchParams);
}

async function handleCategories() {
    try {
        const categories = await queryAll('SELECT * FROM categories ORDER BY sort_order');
        return jsonResponse({ categories });
    } catch (error) {
        console.error('取得分類錯誤:', error);
        return errorResponse('取得分類失敗', 500);
    }
}

async function handleFeatured() {
    try {
        const products = await queryAll(`
            SELECT p.*, c.name as category_name 
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id 
            WHERE p.is_featured = 1
            ORDER BY p.created_at DESC
            LIMIT 8
        `);
        return jsonResponse({ products });
    } catch (error) {
        console.error('取得精選產品錯誤:', error);
        return errorResponse('取得精選產品失敗', 500);
    }
}

async function handleSeasonal() {
    try {
        const products = await queryAll(`
            SELECT p.*, c.name as category_name 
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id 
            WHERE p.is_seasonal = 1
            ORDER BY p.created_at DESC
            LIMIT 8
        `);
        return jsonResponse({ products });
    } catch (error) {
        console.error('取得季節產品錯誤:', error);
        return errorResponse('取得季節產品失敗', 500);
    }
}

async function handleSingleProduct(id) {
    try {
        const product = await queryOne(`
            SELECT p.*, c.name as category_name 
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id 
            WHERE p.id = ?
        `, [id]);

        if (!product) {
            return errorResponse('產品不存在', 404);
        }

        return jsonResponse({ product });
    } catch (error) {
        console.error('取得產品錯誤:', error);
        return errorResponse('取得產品失敗', 500);
    }
}

async function handleProductList(searchParams) {
    try {
        const category_id = searchParams.get('category_id') || searchParams.get('category');
        const featured = searchParams.get('featured');
        const seasonal = searchParams.get('seasonal');
        const search = searchParams.get('search');
        const limit = parseInt(searchParams.get('limit')) || 50;
        const offset = parseInt(searchParams.get('offset')) || 0;

        let sql = `
            SELECT p.*, c.name as category_name 
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id 
            WHERE 1=1
        `;
        const params = [];

        if (category_id) {
            sql += ' AND p.category_id = ?';
            params.push(category_id);
        }

        if (featured === '1') {
            sql += ' AND p.is_featured = 1';
        }

        if (seasonal === '1') {
            sql += ' AND p.is_seasonal = 1';
        }

        if (search) {
            sql += ' AND (p.name LIKE ? OR p.description LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        sql += ' ORDER BY p.is_featured DESC, p.created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const products = await queryAll(sql, params);

        // 取得總數
        let countSql = 'SELECT COUNT(*) as total FROM products p WHERE 1=1';
        const countParams = [];

        if (category_id) {
            countSql += ' AND p.category_id = ?';
            countParams.push(category_id);
        }
        if (featured === '1') {
            countSql += ' AND p.is_featured = 1';
        }
        if (seasonal === '1') {
            countSql += ' AND p.is_seasonal = 1';
        }
        if (search) {
            countSql += ' AND (p.name LIKE ? OR p.description LIKE ?)';
            countParams.push(`%${search}%`, `%${search}%`);
        }

        const total = await queryOne(countSql, countParams);

        return jsonResponse({
            products,
            total: total ? total.total : products.length
        });
    } catch (error) {
        console.error('取得產品錯誤:', error);
        return errorResponse('取得產品失敗', 500);
    }
}
