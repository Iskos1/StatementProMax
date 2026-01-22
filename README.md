# FlashConverter 📊

> Secure bank statement conversion and financial analysis platform

## ⚡ Quick Start

```bash

https://iskos1.github.io/FlashConverter/
# Start local server (Python 3)
python3 -m http.server 8080

# Access at http://localhost:8080
```

That's it! No installation needed.

## ✨ Features

- **📄 PDF to Excel Conversion** - Convert bank statements using [ConvertAPI.com](https://www.convertapi.com/a/api/pdf-to-xlsx)
- **📊 Financial Dashboard** - Analyze transactions, track spending, detect recurring payments
- **🎓 Smart Categorization Learning** - System learns from your categorization choices and automatically applies them to future statements
- **📈 Excel Export with Charts** - Export financial data with chart-ready sheets (Income, Expenses, Net Balance, Savings Rate)
- **📅 Multi-Month Filtering** - Filter by individual months or use quick presets (Q1-Q4, H1-H2, YTD)
- **🔁 Recurring Payment Detection** - Automatically identify subscription and recurring charges
- **💰 Savings Optimizer** - Get AI-powered recommendations to reach 50% savings rate
- **🔐 Secure Processing** - Files processed securely via API
- **⚡ No Registration Required** - Use the converter without signing up
- **✨ Beautiful UI/UX** - Smooth animations, tooltips, keyboard shortcuts, and seamless experience

## 🎨 UI/UX Enhancements

- ✨ **Tooltips** - Hover over elements for helpful information
- ⌨️ **Keyboard Shortcuts** - `Ctrl+O` to open files, `Ctrl+E` to export, `?` for help
- 🎯 **Progress Indicators** - Visual step-by-step guides
- 📱 **Mobile Optimized** - Touch-friendly interface with responsive design
- 🎭 **Smooth Animations** - Stagger effects, transitions, and visual feedback
- 💡 **Quick Start Guide** - First-time user onboarding
- 🔝 **Back to Top Button** - Easy navigation on long pages
- 📊 **Scroll Progress** - See how far you've scrolled

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6 modules)
- **PDF Conversion**: [ConvertAPI.com](https://www.convertapi.com) - PDF to XLSX
- **Authentication**: InstantDB
- **Charts**: Chart.js
- **Excel Processing**: SheetJS (XLSX) - Reformatting & Analysis
- **Storage**: Browser LocalStorage & IndexedDB

## Excel Export Feature 📊

The dashboard includes a comprehensive Excel export that creates a multi-sheet workbook with:

### Sheet 1: Summary
- Total Income, Total Expenses, Net Balance, Savings Rate
- Complete category breakdown
- Transaction counts and key metrics

### Sheet 2: Transactions
- Complete transaction history with all details
- Properly formatted currency and percentages

### Sheet 3: Chart Data (✨ Ready for Visualization)
- **Income vs Expenses**: Pre-structured for column/bar charts
- **Monthly Breakdown**: Track trends over time with line charts
- **Category Breakdown**: Create pie charts instantly (top 10 categories)
- **KPIs**: Savings rate and expense ratio with target comparisons

### Sheet 4: Instructions
- Step-by-step guide to create charts in Excel
- Recommended chart types for each data section

**Result**: One-click export that gives you professional financial reports with easy-to-create visualizations!

## Smart Categorization Learning 🎓

The dashboard now includes an **intelligent learning system** that remembers your categorization preferences:

### How It Works:
1. **Upload** your bank statement (Excel/CSV)
2. **Review** auto-categorized transactions in the review modal
3. **Approve or Modify** categories to train the system
4. **Future uploads** automatically use your learned patterns

### Key Features:
- **Similarity Matching**: Recognizes similar transactions (e.g., "STARBUCKS #1234" → "STARBUCKS #5678")
- **Confidence Scores**: Shows how confident the system is about each categorization
- **Visual Indicators**: 🎓 badge marks learned categorizations in the transactions table
- **Pattern Management**: View, search, and delete learned patterns anytime
- **Local Storage**: All learning data stays on your device (privacy-first)

### Benefits:
- ⏱️ **Save Time**: Less manual categorization with each upload
- 🎯 **Improve Accuracy**: System learns YOUR spending patterns
- 📈 **Get Smarter**: Categorization improves automatically over time
- 🔒 **Stay Private**: All data remains on your device

## ✅ API Fully Configured

The converter is integrated with [ConvertAPI.com](https://www.convertapi.com/a/api/pdf-to-xlsx) and ready to use!

**Features:**
- ✅ Direct PDF to XLSX conversion
- ✅ Automatic reformatting to 6-column bank statement format
- ✅ Supports all PDF types (text-based & scanned)
- ✅ Multi-page statements
- ✅ Fast synchronous processing

**Tokens:**
- Sandbox: `ELgjnLbeO8Q8XQjcC6cT8zA4lJEoqRDI` (currently active)
- Production: `yGOcVvne4JAfBzzLxd45iUzrCCr25kBB`

See `CONVERTAPI_INTEGRATION.md` for complete documentation.

## Local Development

```bash
# Start local server
python3 -m http.server 8080

# Visit in browser
open http://localhost:8080
```

## File Structure

```
BankstatementConverter/
├── index.html              # Converter page
├── dashboard.html          # Financial dashboard
├── styles.css              # Main styles
├── dashboard-styles.css    # Dashboard-specific styles
├── ui-enhancements.css     # UI/UX improvements
├── converter.js            # PDF conversion via API
├── dashboard.js            # Dashboard functionality
├── script.js               # Authentication & core
├── utils.js                # Helper functions
├── transaction-db.js       # Transaction database (IndexedDB)
├── file-history.js         # File history management
├── year-modal.js           # Year selection modal
├── ui-interactions.js      # Keyboard shortcuts & interactions
└── quick-start-guide.js    # User onboarding
```

## Privacy & Security

- **100% Local Processing** - Your files never leave your browser
- **No Server Upload** - All conversions happen client-side using ConvertAPI
- **Secure Storage** - Data stored in browser's IndexedDB
- **No Tracking** - Your financial data stays private

## Browser Support

- Chrome/Edge (recommended)
- Firefox
- Safari
- Any modern browser with ES6 module support

## Deployment

### Static Hosting (Recommended):
- **Netlify**: Deploy with `netlify deploy`
- **Vercel**: `vercel deploy`
- **GitHub Pages**: Push to `gh-pages` branch
- **Cloudflare Pages**: Connect repository

All these platforms offer free hosting for static sites!

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

## License

MIT License - See LICENSE file

## Support

For issues or questions, please open an issue on GitHub.

---

**Built with ❤️ using modern web technologies**

**100% Client-Side • Privacy-First • Lightning Fast** ⚡
