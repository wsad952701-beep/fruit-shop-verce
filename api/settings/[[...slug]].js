// Settings API (Node.js Runtime)
import { queryOne, queryAll, execute } from '../../lib/db.js';
import { verifyToken } from '../../lib/auth.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { slug } = req.query;
    const path = slug ? (Array.isArray(slug) ? slug.join('/') : slug) : '';

    // Themes list
    if (path === 'themes') {
        const themes = [
            { id: 'default', name: '預設主題', colors: ['#0d1117', '#f4a261', '#e9c46a'] },
            { id: 'spring', name: '🌸 春天主題', colors: ['#1a1a2e', '#ffb3c1', '#ff758f'] },
            { id: 'summer', name: '🌞 夏日主題', colors: ['#1a3d5c', '#00d4ff', '#48cae4'] },
            { id: 'autumn', name: '🍂 秋天主題', colors: ['#2d1b00', '#ff9f1c', '#ffbf69'] },
            { id: 'winter', name: '❄️ 冬季主題', colors: ['#0a1628', '#a8dadc', '#457b9d'] },
            { id: 'newyear', name: '🧧 新年主題', colors: ['#1a0a0a', '#dc2626', '#fbbf24'] }
        ];
        return res.status(200).json({ themes });
    }

    // Theme
    if (path === 'theme') {
        if (req.method === 'GET') {
            const theme = await queryOne('SELECT value FROM settings WHERE key = ?', ['current_theme']);
            return res.status(200).json({ theme: theme?.value || 'default' });
        }
        if (req.method === 'PUT') {
            const user = verifyToken(req.headers.authorization);
            if (!user || !user.is_admin) return res.status(403).json({ error: '需要管理員權限' });

            const { theme } = req.body;
            const existing = await queryOne('SELECT id FROM settings WHERE key = ?', ['current_theme']);
            if (existing) {
                await execute('UPDATE settings SET value = ? WHERE key = ?', [theme, 'current_theme']);
            } else {
                await execute('INSERT INTO settings (key, value) VALUES (?, ?)', ['current_theme', theme]);
            }
            return res.status(200).json({ message: '主題更新成功', theme });
        }
    }

    // Marquee
    if (path === 'marquee') {
        if (req.method === 'GET') {
            const marquee = await queryOne('SELECT value FROM settings WHERE key = ?', ['marquee_text']);
            return res.status(200).json({ marquee: marquee?.value || '🎉 歡迎光臨果實搬運工！' });
        }
        if (req.method === 'PUT') {
            const user = verifyToken(req.headers.authorization);
            if (!user || !user.is_admin) return res.status(403).json({ error: '需要管理員權限' });

            const { marquee } = req.body;
            const existing = await queryOne('SELECT id FROM settings WHERE key = ?', ['marquee_text']);
            if (existing) {
                await execute('UPDATE settings SET value = ? WHERE key = ?', [marquee, 'marquee_text']);
            } else {
                await execute('INSERT INTO settings (key, value) VALUES (?, ?)', ['marquee_text', marquee]);
            }
            return res.status(200).json({ message: '跑馬燈更新成功', marquee });
        }
    }

    // All settings
    if (req.method === 'GET') {
        const settings = await queryAll('SELECT * FROM settings');
        const settingsObj = {};
        settings.forEach(s => { settingsObj[s.key] = s.value; });
        return res.status(200).json({ settings: settingsObj });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
