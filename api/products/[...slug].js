// Products API (Node.js Runtime)
import { queryOne, queryAll } from '../../lib/db.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { slug } = req.query;
    const path = slug ? (Array.isArray(slug) ? slug.join('/') : slug) : '';

    try {
        // 分類列表
        if (path === 'categories') {
            const categories = await queryAll('SELECT * FROM categories ORDER BY sort_order');
            return res.status(200).json({ categories });
        }

        // 精選商品
        if (path === 'featured') {
            const products = await queryAll('SELECT * FROM products WHERE is_featured = 1 LIMIT 8');
            return res.status(200).json({ products });
        }

        // 季節限定
        if (path === 'seasonal') {
            const products = await queryAll('SELECT * FROM products WHERE is_seasonal = 1');
            return res.status(200).json({ products });
        }

        // 單一商品
        const idMatch = path.match(/^(\d+)$/);
        if (idMatch) {
            const product = await queryOne('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?', [idMatch[1]]);
            if (!product) return res.status(404).json({ error: '商品不存在' });
            return res.status(200).json({ product });
        }

        // 商品列表
        const { category, search, limit = 20, offset = 0 } = req.query;
        let products = await queryAll('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id');

        if (category) products = products.filter(p => p.category_id == category);
        if (search) products = products.filter(p => p.name.includes(search) || (p.description && p.description.includes(search)));

        const total = products.length;
        products = products.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

        return res.status(200).json({ products, total });
    } catch (error) {
        console.error('商品 API 錯誤:', error);
        return res.status(500).json({ error: '取得商品失敗' });
    }
}
