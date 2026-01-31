// Demo Mode Database - In-Memory SQLite with auto-seeding
// No external database service required!
// Data persists during function execution but resets on cold start

import bcryptjs from 'bcryptjs';

// In-memory storage (shared across requests during function lifetime)
let db = {
    users: [],
    categories: [],
    products: [],
    cart_items: [],
    orders: [],
    order_items: [],
    favorites: [],
    settings: []
};

let isInitialized = false;
let lastInsertId = { users: 0, categories: 0, products: 0, cart_items: 0, orders: 0, order_items: 0, favorites: 0, settings: 0 };

// Initialize with seed data
export function initDatabase() {
    if (isInitialized) return;

    console.log('🍇 初始化 Demo 資料庫...');

    // Seed categories
    db.categories = [
        { id: 1, name: '春節禮盒', icon: '🎁', sort_order: 1 },
        { id: 2, name: '季節限定', icon: '✨', sort_order: 2 },
        { id: 3, name: '進口水果', icon: '🌍', sort_order: 3 },
        { id: 4, name: '日本嚴選', icon: '🇯🇵', sort_order: 4 },
        { id: 5, name: '台灣在地', icon: '🇹🇼', sort_order: 5 },
        { id: 6, name: '優惠專區', icon: '💰', sort_order: 6 }
    ];
    lastInsertId.categories = 6;

    // Seed products
    db.products = [
        { id: 1, category_id: 1, name: '新年豪華禮盒', description: '精選日本蘋果、韓國水梨、進口柑橘組合', price: 2880, original_price: 3200, stock: 50, image_url: '/frontend/images/gift_box_premium_1769721412356.png', is_featured: 1, is_seasonal: 0, created_at: new Date().toISOString() },
        { id: 2, category_id: 1, name: '經典水果禮盒', description: '台灣精緻水果組合，送禮自用兩相宜', price: 1680, original_price: 1880, stock: 100, image_url: '/frontend/images/hero_banner_fruits_1769721071654.png', is_featured: 1, is_seasonal: 0, created_at: new Date().toISOString() },
        { id: 3, category_id: 2, name: '日本草莓 - 博多甘王', description: '熊本縣產，甜度超高的頂級草莓', price: 980, original_price: null, stock: 30, image_url: '/frontend/images/strawberry_seasonal_1769721085772.png', is_featured: 1, is_seasonal: 1, created_at: new Date().toISOString() },
        { id: 4, category_id: 2, name: '台灣茂谷柑', description: '季節限定，外皮薄、果肉多汁', price: 450, original_price: null, stock: 80, image_url: '/frontend/images/apple_aomori_1769721134815.png', is_featured: 0, is_seasonal: 1, created_at: new Date().toISOString() },
        { id: 5, category_id: 3, name: '智利櫻桃 Jumbo', description: '大顆飽滿，外銷等級櫻桃', price: 1280, original_price: 1500, stock: 20, image_url: '/frontend/images/cherry_box_1769721098855.png', is_featured: 1, is_seasonal: 0, created_at: new Date().toISOString() },
        { id: 6, category_id: 3, name: '美國無籽綠葡萄', description: '清甜脆口，無籽品種', price: 380, original_price: null, stock: 60, image_url: '/frontend/images/grape_muscat_1769721121816.png', is_featured: 0, is_seasonal: 0, created_at: new Date().toISOString() },
        { id: 7, category_id: 4, name: '日本青森蘋果', description: '知名青森縣產，紅潤飽滿', price: 720, original_price: null, stock: 40, image_url: '/frontend/images/apple_aomori_1769721134815.png', is_featured: 1, is_seasonal: 0, created_at: new Date().toISOString() },
        { id: 8, category_id: 4, name: '日本晴王麝香葡萄', description: '頂級麝香葡萄，皮薄肉甜', price: 1980, original_price: 2200, stock: 15, image_url: '/frontend/images/grape_muscat_1769721121816.png', is_featured: 1, is_seasonal: 1, created_at: new Date().toISOString() },
        { id: 9, category_id: 5, name: '大樹鳳梨', description: '高雄大樹產，鳳梨酸甜適中', price: 280, original_price: null, stock: 100, image_url: '/frontend/images/hero_banner_fruits_1769721071654.png', is_featured: 0, is_seasonal: 1, created_at: new Date().toISOString() },
        { id: 10, category_id: 5, name: '愛文芒果', description: '屏東枋山產愛文，香甜可口', price: 580, original_price: null, stock: 50, image_url: '/frontend/images/strawberry_seasonal_1769721085772.png', is_featured: 1, is_seasonal: 1, created_at: new Date().toISOString() },
        { id: 11, category_id: 6, name: '綜合季節水果 5斤裝', description: '當季水果隨機組合', price: 599, original_price: 780, stock: 200, image_url: '/frontend/images/hero_banner_fruits_1769721071654.png', is_featured: 0, is_seasonal: 0, created_at: new Date().toISOString() },
        { id: 12, category_id: 6, name: '香蕉一串', description: '台灣本土香蕉，營養滿分', price: 69, original_price: 89, stock: 300, image_url: '/frontend/images/apple_aomori_1769721134815.png', is_featured: 0, is_seasonal: 0, created_at: new Date().toISOString() }
    ];
    lastInsertId.products = 12;

    // Seed admin user
    const hashedPassword = bcryptjs.hashSync('admin123', 10);
    db.users = [
        { id: 1, email: 'admin@fruitporter.com', password_hash: hashedPassword, name: '系統管理員', phone: null, address: null, is_admin: 1, status: 'active', credit: 999999, created_at: new Date().toISOString() },
        { id: 2, email: 'demo@example.com', password_hash: bcryptjs.hashSync('demo123', 10), name: '測試會員', phone: '0912345678', address: '台北市信義區信義路五段7號', is_admin: 0, status: 'active', credit: 10000, created_at: new Date().toISOString() }
    ];
    lastInsertId.users = 2;

    // Default settings
    db.settings = [
        { id: 1, key: 'current_theme', value: 'default', updated_at: new Date().toISOString() },
        { id: 2, key: 'marquee_text', value: '🎉 歡迎光臨果實搬運工！Demo 模式運行中 🧧 滿$799免運費 🍇', updated_at: new Date().toISOString() }
    ];
    lastInsertId.settings = 2;

    isInitialized = true;
    console.log('✅ Demo 資料庫初始化完成');
}

// Query helper - get one row
export async function queryOne(sql, params = []) {
    initDatabase();
    return executeQuery(sql, params, 'one');
}

// Query helper - get all rows
export async function queryAll(sql, params = []) {
    initDatabase();
    return executeQuery(sql, params, 'all');
}

// Execute SQL (INSERT, UPDATE, DELETE)
export async function execute(sql, params = []) {
    initDatabase();
    return executeQuery(sql, params, 'execute');
}

// Simple SQL parser and executor for in-memory data
function executeQuery(sql, params, mode) {
    const sqlLower = sql.toLowerCase().trim();

    // Parse and execute different SQL types
    if (sqlLower.startsWith('select')) {
        return handleSelect(sql, params, mode);
    } else if (sqlLower.startsWith('insert')) {
        return handleInsert(sql, params);
    } else if (sqlLower.startsWith('update')) {
        return handleUpdate(sql, params);
    } else if (sqlLower.startsWith('delete')) {
        return handleDelete(sql, params);
    }

    return mode === 'all' ? [] : null;
}

function handleSelect(sql, params, mode) {
    const sqlLower = sql.toLowerCase();
    let results = [];

    // Determine which table(s) to query
    if (sqlLower.includes('from users')) {
        results = filterData(db.users, sql, params);
    } else if (sqlLower.includes('from categories')) {
        results = filterData(db.categories, sql, params);
    } else if (sqlLower.includes('from products')) {
        results = handleProductsQuery(sql, params);
    } else if (sqlLower.includes('from cart_items')) {
        results = handleCartQuery(sql, params);
    } else if (sqlLower.includes('from orders')) {
        results = handleOrdersQuery(sql, params);
    } else if (sqlLower.includes('from order_items')) {
        results = filterData(db.order_items, sql, params);
    } else if (sqlLower.includes('from favorites')) {
        results = handleFavoritesQuery(sql, params);
    } else if (sqlLower.includes('from settings')) {
        results = filterData(db.settings, sql, params);
    }

    // Apply sorting
    if (sqlLower.includes('order by')) {
        const descMatch = sqlLower.match(/order by\s+\w+\s+desc/);
        if (descMatch) {
            results = [...results].reverse();
        }
    }

    // Apply limit
    const limitMatch = sqlLower.match(/limit\s+(\d+)/);
    if (limitMatch) {
        const limit = parseInt(limitMatch[1]);
        results = results.slice(0, limit);
    }

    if (mode === 'one') {
        return results[0] || null;
    }
    return results;
}

function filterData(data, sql, params) {
    const sqlLower = sql.toLowerCase();
    let results = [...data];

    // Simple WHERE clause parsing
    if (sqlLower.includes('where')) {
        let paramIndex = 0;

        // ID filter
        if (sqlLower.includes('id = ?')) {
            const id = params[paramIndex++];
            results = results.filter(r => r.id == id);
        }

        // Email filter
        if (sqlLower.includes('email = ?')) {
            const email = params[paramIndex++];
            results = results.filter(r => r.email === email);
        }

        // User ID filter
        if (sqlLower.includes('user_id = ?')) {
            const userId = params[paramIndex++];
            results = results.filter(r => r.user_id == userId);
        }

        // Key filter (for settings)
        if (sqlLower.includes('key = ?')) {
            const key = params[paramIndex++];
            results = results.filter(r => r.key === key);
        }

        // is_admin filter
        if (sqlLower.includes('is_admin = 0')) {
            results = results.filter(r => r.is_admin === 0);
        }
        if (sqlLower.includes('is_admin = 1')) {
            results = results.filter(r => r.is_admin === 1);
        }

        // is_featured filter
        if (sqlLower.includes('is_featured = 1')) {
            results = results.filter(r => r.is_featured === 1);
        }

        // is_seasonal filter
        if (sqlLower.includes('is_seasonal = 1')) {
            results = results.filter(r => r.is_seasonal === 1);
        }

        // Status filter
        if (sqlLower.includes("status = 'pending'")) {
            results = results.filter(r => r.status === 'pending');
        }
        if (sqlLower.includes("status = 'completed'")) {
            results = results.filter(r => r.status === 'completed');
        }

        // Category filter
        if (sqlLower.includes('category_id = ?')) {
            const catId = params[paramIndex++];
            results = results.filter(r => r.category_id == catId);
        }

        // Product ID filter
        if (sqlLower.includes('product_id = ?')) {
            const prodId = params[paramIndex++];
            results = results.filter(r => r.product_id == prodId);
        }

        // Order ID filter
        if (sqlLower.includes('order_id = ?')) {
            const orderId = params[paramIndex++];
            results = results.filter(r => r.order_id == orderId);
        }

        // Order number filter
        if (sqlLower.includes('order_number = ?')) {
            const orderNum = params[paramIndex++];
            results = results.filter(r => r.order_number === orderNum);
        }
    }

    return results;
}

function handleProductsQuery(sql, params) {
    let results = db.products.map(p => ({
        ...p,
        category_name: db.categories.find(c => c.id === p.category_id)?.name || null
    }));

    return filterData(results, sql, params);
}

function handleCartQuery(sql, params) {
    let results = db.cart_items.map(c => {
        const product = db.products.find(p => p.id === c.product_id);
        return {
            ...c,
            product_id: c.product_id,
            name: product?.name,
            price: product?.price,
            image_url: product?.image_url,
            stock: product?.stock
        };
    });

    return filterData(results, sql, params);
}

function handleOrdersQuery(sql, params) {
    let results = db.orders.map(o => {
        const user = db.users.find(u => u.id === o.user_id);
        return {
            ...o,
            customer_name: user?.name,
            customer_email: user?.email,
            customer_phone: user?.phone
        };
    });

    return filterData(results, sql, params);
}

function handleFavoritesQuery(sql, params) {
    let results = db.favorites.map(f => {
        const product = db.products.find(p => p.id === f.product_id);
        const category = product ? db.categories.find(c => c.id === product.category_id) : null;
        return {
            ...f,
            name: product?.name,
            price: product?.price,
            original_price: product?.original_price,
            image_url: product?.image_url,
            stock: product?.stock,
            is_featured: product?.is_featured,
            is_seasonal: product?.is_seasonal,
            category_name: category?.name
        };
    });

    return filterData(results, sql, params);
}

function handleInsert(sql, params) {
    const sqlLower = sql.toLowerCase();
    let tableName = '';

    if (sqlLower.includes('into users')) tableName = 'users';
    else if (sqlLower.includes('into categories')) tableName = 'categories';
    else if (sqlLower.includes('into products')) tableName = 'products';
    else if (sqlLower.includes('into cart_items')) tableName = 'cart_items';
    else if (sqlLower.includes('into orders')) tableName = 'orders';
    else if (sqlLower.includes('into order_items')) tableName = 'order_items';
    else if (sqlLower.includes('into favorites')) tableName = 'favorites';
    else if (sqlLower.includes('into settings')) tableName = 'settings';

    if (!tableName) return { rowsAffected: 0 };

    // Parse column names
    const colMatch = sql.match(/\(([^)]+)\)\s*values/i);
    const columns = colMatch ? colMatch[1].split(',').map(c => c.trim()) : [];

    // Create new row
    const newId = ++lastInsertId[tableName];
    const newRow = { id: newId, created_at: new Date().toISOString() };

    columns.forEach((col, i) => {
        newRow[col] = params[i];
    });

    db[tableName].push(newRow);

    return { rowsAffected: 1, lastInsertRowid: newId };
}

function handleUpdate(sql, params) {
    const sqlLower = sql.toLowerCase();
    let tableName = '';

    if (sqlLower.includes('update users')) tableName = 'users';
    else if (sqlLower.includes('update products')) tableName = 'products';
    else if (sqlLower.includes('update cart_items')) tableName = 'cart_items';
    else if (sqlLower.includes('update orders')) tableName = 'orders';
    else if (sqlLower.includes('update settings')) tableName = 'settings';

    if (!tableName) return { rowsAffected: 0 };

    // Simple update: find by ID (last param) and update
    const id = params[params.length - 1];
    const row = db[tableName].find(r => r.id == id);

    if (row) {
        // Parse SET clause
        const setMatch = sql.match(/set\s+(.+?)\s+where/i);
        if (setMatch) {
            const setParts = setMatch[1].split(',');
            let paramIndex = 0;
            setParts.forEach(part => {
                const colMatch = part.trim().match(/(\w+)\s*=/);
                if (colMatch) {
                    const col = colMatch[1];
                    if (part.includes('?')) {
                        row[col] = params[paramIndex++];
                    } else if (part.includes('credit + ?') || part.includes('credit - ?') || part.includes('stock + ?') || part.includes('stock - ?')) {
                        const val = params[paramIndex++];
                        if (part.includes('+')) {
                            row[col] = (row[col] || 0) + val;
                        } else {
                            row[col] = (row[col] || 0) - val;
                        }
                    }
                }
            });
        }
        return { rowsAffected: 1 };
    }

    return { rowsAffected: 0 };
}

function handleDelete(sql, params) {
    const sqlLower = sql.toLowerCase();
    let tableName = '';

    if (sqlLower.includes('from users')) tableName = 'users';
    else if (sqlLower.includes('from cart_items')) tableName = 'cart_items';
    else if (sqlLower.includes('from orders')) tableName = 'orders';
    else if (sqlLower.includes('from order_items')) tableName = 'order_items';
    else if (sqlLower.includes('from favorites')) tableName = 'favorites';

    if (!tableName) return { rowsAffected: 0 };

    const beforeCount = db[tableName].length;

    // Filter based on WHERE clause
    if (sqlLower.includes('id = ?')) {
        const id = params[0];
        db[tableName] = db[tableName].filter(r => r.id != id);
    } else if (sqlLower.includes('user_id = ?')) {
        const userId = params[0];
        if (sqlLower.includes('product_id = ?')) {
            const productId = params[1];
            db[tableName] = db[tableName].filter(r => !(r.user_id == userId && r.product_id == productId));
        } else {
            db[tableName] = db[tableName].filter(r => r.user_id != userId);
        }
    } else if (sqlLower.includes('order_id = ?')) {
        const orderId = params[0];
        db[tableName] = db[tableName].filter(r => r.order_id != orderId);
    }

    return { rowsAffected: beforeCount - db[tableName].length };
}

export default { initDatabase, queryOne, queryAll, execute };
