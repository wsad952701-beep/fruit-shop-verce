@echo off
echo ====================================
echo   Fruit Shop Vercel - Deploy Script
echo ====================================
echo.

cd /d "%~dp0"

echo [1/3] Initializing Git repository...
git init
git add .
git commit -m "Initial commit - Fruit Shop Vercel Demo"

echo.
echo [2/3] Ready to push to GitHub
echo.
echo Please create a new repository on GitHub first:
echo   1. Go to https://github.com/new
echo   2. Name it: fruit-shop-vercel
echo   3. Keep it Public
echo   4. Do NOT add README or .gitignore
echo   5. Click "Create repository"
echo.
echo Then copy the repository URL and run:
echo   git remote add origin YOUR_GITHUB_URL
echo   git push -u origin main
echo.
echo [3/3] After pushing to GitHub:
echo   1. Go to https://vercel.com
echo   2. Sign in with GitHub
echo   3. Import your repository
echo   4. Click Deploy (no configuration needed!)
echo.
echo ====================================
echo   Login Credentials
echo ====================================
echo   Admin: admin@fruitporter.com / admin123
echo   Demo:  demo@example.com / demo123
echo ====================================
pause
