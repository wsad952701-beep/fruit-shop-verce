// Settings API
import { queryOne, queryAll, execute } from '../../lib/db.js';
import { authenticateRequest, requireAdmin, jsonResponse, errorResponse, handleOptions } from '../../lib/auth.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
    if (req.method === 'OPTIONS') return handleOptions();

    const url = new URL(req.url);
    const pathname = url.pathname;

    // 處理特定路由
    if (pathname.includes('/themes')) {
        return handleThemesList();
    }
    if (pathname.includes('/theme')) {
        return handleTheme(req);
    }
    if (pathname.includes('/marquee')) {
        return handleMarquee(req);
    }

    // 預設：取得所有設定
    if (req.method === 'GET') {
        try {
            const settings = await queryAll('SELECT * FROM settings');
            const settingsObj = {};
            settings.forEach(s => {
                settingsObj[s.key] = s.value;
            });
            return jsonResponse({ settings: settingsObj });
        } catch (error) {
            console.error('取得設定錯誤:', error);
            return errorResponse('取得設定失敗', 500);
        }
    }

    return errorResponse('Method not allowed', 405);
}

function handleThemesList() {
    const themes = [
        { id: 'default', name: '預設主題', description: '經典深色主題', colors: ['#0d1117', '#f4a261', '#e9c46a'] },
        { id: 'spring', name: '🌸 春天主題', description: '粉嫩櫻花風格', colors: ['#1a1a2e', '#ffb3c1', '#ff758f'] },
        { id: 'summer', name: '🌞 夏日主題', description: '清新海洋風格', colors: ['#1a3d5c', '#00d4ff', '#48cae4'] },
        { id: 'autumn', name: '🍂 秋天主題', description: '溫暖楓葉風格', colors: ['#2d1b00', '#ff9f1c', '#ffbf69'] },
        { id: 'winter', name: '❄️ 冬季主題', description: '冰雪純淨風格', colors: ['#0a1628', '#a8dadc', '#457b9d'] },
        { id: 'newyear', name: '🧧 新年主題', description: '喜氣洋洋紅金風格', colors: ['#1a0a0a', '#dc2626', '#fbbf24'] }
    ];
    return jsonResponse({ themes });
}

async function handleTheme(req) {
    if (req.method === 'GET') {
        try {
            const theme = await queryOne('SELECT value FROM settings WHERE key = ?', ['current_theme']);
            return jsonResponse({ theme: theme ? theme.value : 'default' });
        } catch (error) {
            console.error('取得主題錯誤:', error);
            return errorResponse('取得主題失敗', 500);
        }
    }

    if (req.method === 'PUT') {
        const auth = authenticateRequest(req);
        if (auth.error) return auth.response;

        const adminCheck = requireAdmin(auth.user);
        if (adminCheck.error) return adminCheck.response;

        try {
            const { theme } = await req.json();
            const validThemes = ['default', 'spring', 'summer', 'autumn', 'winter', 'newyear'];

            if (!theme || !validThemes.includes(theme)) {
                return errorResponse('無效的主題', 400);
            }

            const existing = await queryOne('SELECT id FROM settings WHERE key = ?', ['current_theme']);

            if (existing) {
                await execute('UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?', [theme, 'current_theme']);
            } else {
                await execute('INSERT INTO settings (key, value) VALUES (?, ?)', ['current_theme', theme]);
            }

            return jsonResponse({ message: '主題更新成功', theme });
        } catch (error) {
            console.error('更新主題錯誤:', error);
            return errorResponse('更新主題失敗', 500);
        }
    }

    return errorResponse('Method not allowed', 405);
}

async function handleMarquee(req) {
    if (req.method === 'GET') {
        try {
            const marquee = await queryOne('SELECT value FROM settings WHERE key = ?', ['marquee_text']);
            return jsonResponse({
                marquee: marquee ? marquee.value : '🎉 歡迎光臨果實搬運工！新年特惠活動進行中 🧧 滿$799免運費 🍇 每日新鮮直送'
            });
        } catch (error) {
            console.error('取得跑馬燈錯誤:', error);
            return errorResponse('取得跑馬燈失敗', 500);
        }
    }

    if (req.method === 'PUT') {
        const auth = authenticateRequest(req);
        if (auth.error) return auth.response;

        const adminCheck = requireAdmin(auth.user);
        if (adminCheck.error) return adminCheck.response;

        try {
            const { marquee } = await req.json();

            if (typeof marquee !== 'string') {
                return errorResponse('跑馬燈內容無效', 400);
            }

            const existing = await queryOne('SELECT id FROM settings WHERE key = ?', ['marquee_text']);

            if (existing) {
                await execute('UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?', [marquee, 'marquee_text']);
            } else {
                await execute('INSERT INTO settings (key, value) VALUES (?, ?)', ['marquee_text', marquee]);
            }

            return jsonResponse({ message: '跑馬燈更新成功', marquee });
        } catch (error) {
            console.error('更新跑馬燈錯誤:', error);
            return errorResponse('更新跑馬燈失敗', 500);
        }
    }

    return errorResponse('Method not allowed', 405);
}
