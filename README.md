# StatementProMax 📊

> Secure bank statement conversion and financial analysis platform

## Features

- **PDF to Excel Conversion** - Convert bank statements instantly using ConvertAPI
- **Financial Dashboard** - Analyze transactions, track spending, detect recurring payments
- **Multi-Month Filtering** - Filter by individual months or use quick presets (Q1-Q4, H1-H2, YTD)
- **Recurring Payment Detection** - Automatically identify subscription and recurring charges
- **Secure & Private** - All processing happens locally in your browser
- **No Registration Required** - Use the converter without signing up

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6 modules)
- **Authentication**: InstantDB
- **Charts**: Chart.js
- **Excel Processing**: SheetJS (XLSX)
- **PDF Conversion**: ConvertAPI

## Local Development

```bash
# Start local server
python3 -m http.server 8080

# Visit in browser
open http://localhost:8080
```

## File Structure

```
/
├── index.html              # Main landing page with converter
├── dashboard.html          # Financial dashboard
├── converter.js            # PDF conversion logic
├── dashboard.js            # Dashboard functionality
├── script.js              # Authentication & global scripts
├── utils.js               # Shared utility functions
├── year-modal.js          # Year selection modal
├── styles.css             # Main stylesheet
├── dashboard-styles.css   # Dashboard-specific styles
├── about.html             # About page
├── contact.html           # Contact page
├── blog.html              # Blog page
├── privacy.html           # Privacy policy
├── terms.html             # Terms of service
├── security.html          # Security information
└── robots.txt             # SEO configuration
```

## Deployment

This site is optimized for deployment on:
- Netlify (recommended)
- Vercel
- GitHub Pages
- Cloudflare Pages

## Performance Optimizations

- ✅ Zero memory leaks (all event listeners managed)
- ✅ Efficient DOM updates (no redundant re-renders)
- ✅ Cached DOM element references
- ✅ Debounced search inputs
- ✅ Optimized chart updates
- ✅ Modern JavaScript APIs

## Security Features

- 🔒 Local file processing (files never uploaded to servers)
- 🔒 Input validation and XSS protection
- 🔒 Secure authentication with InstantDB
- 🔒 HTTPS enforced in production

## License

© 2025 StatementProMax • All rights reserved

---

**Built with ❤️ for better financial management**

