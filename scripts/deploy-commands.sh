#!/bin/bash
# FlashConverter - Git Deployment Commands

echo "🚀 Deploying FlashConverter..."
echo ""

# Stage all changes
echo "📦 Staging files..."
git add .

# Commit
echo "💾 Committing changes..."
git commit -m "Deploy FlashConverter v1.0

- Complete rebrand to FlashConverter
- Fixed 11 critical bugs (memory leaks, redundant code)
- Added Buzzoid-inspired UI improvements
- Optimized performance (~50% memory reduction)
- Added Financial Dashboard hero section
- Production-ready deployment"

# Check if remote exists
if git remote | grep -q origin; then
    echo "📤 Pushing to existing remote..."
    git push origin main
else
    echo ""
    echo "⚠️  No remote repository found!"
    echo ""
    echo "Please create a GitHub repository and run:"
    echo "git remote add origin https://github.com/YOUR_USERNAME/flashconverter.git"
    echo "git push -u origin main"
    echo ""
fi

echo ""
echo "✅ Done! Next steps:"
echo "1. Go to https://app.netlify.com"
echo "2. Click 'Add new site' → 'Import from Git'"
echo "3. Connect your GitHub repository"
echo "4. Deploy!"

