# StatementProMax - Deployment Guide

## Quick Deploy to Netlify (Recommended)

### Option 1: Drag & Drop (Fastest - 2 minutes)

1. **Visit**: https://app.netlify.com/drop
2. **Drag & Drop**: Your entire project folder
3. **Done!**: Site is live at `random-name.netlify.app`
4. **Custom Domain** (optional): Settings → Domain Management → Add custom domain

### Option 2: GitHub + Netlify (Best for Updates)

#### Step 1: Push to GitHub
```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Deploy StatementProMax v1.0 - Production ready"

# Create GitHub repo at github.com/new
# Then link it:
git remote add origin https://github.com/YOUR_USERNAME/statementpromax.git
git branch -M main
git push -u origin main
```

#### Step 2: Connect to Netlify
1. Go to https://app.netlify.com
2. Click "Add new site" → "Import an existing project"
3. Choose "GitHub" and authorize
4. Select your repository
5. Build settings (already configured in netlify.toml):
   - Build command: (leave empty)
   - Publish directory: `.`
6. Click "Deploy site"

**Auto-deployment**: Every git push will auto-deploy! 🎉

---

## Alternative Platforms

### Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow prompts
```

### GitHub Pages
```bash
# Push to GitHub first, then:
# Go to Settings → Pages → Source: main branch
```

### Cloudflare Pages
1. Go to https://pages.cloudflare.com
2. Connect GitHub repository
3. Deploy settings:
   - Build command: (none)
   - Build output: `/`

---

## Environment Variables (if using production API)

If switching to production ConvertAPI token:

### Netlify
1. Site settings → Environment variables
2. Add: `CONVERTAPI_TOKEN` = your production token
3. Update converter.js to use environment variable

---

## Post-Deployment Checklist

- [ ] Test all pages load correctly
- [ ] Test PDF conversion works
- [ ] Test dashboard upload and analysis
- [ ] Test authentication (sign in/out)
- [ ] Test on mobile devices
- [ ] Add custom domain (optional)
- [ ] Set up analytics (Google Analytics, Plausible, etc.)
- [ ] Submit sitemap.xml to Google Search Console

---

## Custom Domain Setup (Netlify)

1. **Buy domain** (Namecheap, Google Domains, etc.)
2. **In Netlify**:
   - Site settings → Domain management
   - Add custom domain → Follow DNS instructions
3. **In your domain registrar**:
   - Add CNAME record: `www` → `your-site.netlify.app`
   - Add A record: `@` → Netlify's IP (they provide this)
4. **Wait** 15-60 minutes for DNS propagation
5. **SSL**: Automatically enabled by Netlify

---

## Support

Questions? Check https://docs.netlify.com or https://vercel.com/docs

