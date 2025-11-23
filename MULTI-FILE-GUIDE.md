# Multi-File Monthly Organization Guide

## 🎉 New Feature: Multiple Excel Sheets with Monthly Organization

Your Financial Dashboard now supports uploading **multiple bank statement files** and organizing them by month for comprehensive financial analysis.

---

## ✨ **Key Features**

### 1. **Multiple File Upload**
- Upload multiple Excel/CSV files at once
- Supports drag & drop for multiple files
- Browse and select multiple files simultaneously
- Each file can be up to 10MB

### 2. **Automatic Month Detection**
- Automatically detects all months from your transactions
- Creates filter buttons for each unique month
- Combines data from all uploaded files
- Chronological organization (newest to oldest)

### 3. **Monthly Filtering**
- **"All Months"** - View combined data from all files
- **Individual Months** - Filter to see specific month data
- Real-time calculations update when filtering
- Charts update dynamically

### 4. **File Management**
- See list of selected files before processing
- Remove individual files from the selection
- File name and size display
- Upload new files anytime

---

## 🚀 **How to Use**

### **Step 1: Upload Multiple Files**

#### Option A: Drag & Drop
1. Go to Dashboard (`http://localhost:8000/dashboard.html`)
2. Drag multiple Excel/CSV files onto the upload area
3. Drop all files at once

#### Option B: Browse Files
1. Click "Browse Files" button
2. Hold `Cmd` (Mac) or `Ctrl` (Windows) to select multiple files
3. Click "Open"

### **Step 2: Review Selected Files**
- See all selected files with names and sizes
- Click "Remove" to remove any unwanted files
- Files are listed before processing begins

### **Step 3: View Combined Analysis**
Dashboard automatically shows:
- Combined totals from all files
- All transactions sorted by date
- Overall savings rate across all months

### **Step 4: Filter by Month**
Click any month button to see:
- Income for that month only
- Expenses for that month only
- Net balance for that specific month
- Savings rate for that month
- Only transactions from that month

### **Step 5: Compare Months**
- Switch between months to compare
- See how your spending changes month-to-month
- Track income consistency
- Monitor savings rate trends

---

## 📊 **What Gets Calculated**

### **For Each Month:**
- Total Income
- Total Expenses
- Net Balance (Income - Expenses)
- Savings Rate (Net Balance / Income × 100)
- Transaction counts

### **For All Months Combined:**
- Grand total income
- Grand total expenses
- Overall net balance
- Average savings rate
- Total transaction count

---

## 📁 **Sample Files Included**

Three sample files are provided for testing:

### **1. `sample-january-2024.csv`**
- 18 transactions
- Income: ~$6,700
- January 2024 data

### **2. `sample-february-2024.csv`**
- 16 transactions
- Income: ~$6,500
- February 2024 data

### **3. `sample-march-2024.csv`**
- 16 transactions
- Income: ~$6,300
- March 2024 data

**Test the feature**: Upload all 3 files together to see the multi-month analysis!

---

## 🎯 **Example Use Cases**

### **Use Case 1: Quarterly Review**
1. Upload January, February, March statements
2. View "All Months" to see Q1 totals
3. Filter by each month to compare performance
4. Identify spending trends

### **Use Case 2: Year-End Analysis**
1. Upload all 12 months of statements
2. See annual totals and savings rate
3. Filter by month to find highest expenses
4. Compare seasonal spending patterns

### **Use Case 3: Budget Planning**
1. Upload last 3-6 months
2. See average monthly expenses
3. Identify categories to reduce
4. Set realistic budget goals

### **Use Case 4: Multi-Account Tracking**
1. Upload statements from multiple bank accounts
2. See consolidated financial picture
3. Track all income sources
4. Monitor total expenses across accounts

---

## 📈 **Monthly Trend Chart**

The new **Monthly Trend** line chart shows:
- **Green line**: Income trend across months
- **Red line**: Expense trend across months
- **Blue line**: Net balance trend across months

Benefits:
- Visualize spending patterns over time
- See if income is stable or growing
- Identify months with unusual expenses
- Track savings progress

---

## 💡 **Pro Tips**

### **File Naming**
Name your files clearly:
- `bank-january-2024.xlsx`
- `checking-feb-2024.csv`
- `savings-march-2024.xlsx`

### **Consistent Format**
Ensure all files have the same column structure:
- Date, Description, Amount, Balance
- Or: Date, Description, Credit, Debit, Balance

### **Date Ranges**
- Each file should contain one month's data
- Or upload files with any date range
- Dashboard auto-detects and organizes by month

### **Multiple Accounts**
- Upload files from different accounts
- Dashboard combines all transactions
- View total financial picture

---

## 🔒 **Security Reminder**

**All processing is client-side:**
- ✅ Files are processed in your browser
- ✅ No data uploaded to servers
- ✅ No PDFs stored
- ✅ Files are cleared when you close the page
- ✅ Complete privacy guaranteed

Even with multiple files, **nothing leaves your device**.

---

## 📊 **How Month Organization Works**

### **Behind the Scenes:**
1. **Upload**: Multiple files selected
2. **Parse**: Each file processed individually
3. **Combine**: All transactions merged into one dataset
4. **Sort**: Transactions sorted by date (newest first)
5. **Detect**: Unique months extracted
6. **Filter Buttons**: Month buttons created automatically
7. **Display**: Combined or filtered data shown

### **Month Detection:**
- Reads transaction dates from all files
- Identifies unique year-month combinations
- Creates filter button for each month
- Handles any date range (not limited to 3 months)

### **Data Aggregation:**
- Transactions from same month across files are combined
- Duplicate transactions are NOT removed (each file is treated independently)
- All metrics recalculated when filtering

---

## 🎨 **UI Features**

### **Month Filter Buttons**
- **Green button**: Currently active filter
- **White buttons**: Available months
- **Hover effect**: Visual feedback
- **Click**: Instant filter update

### **File List Display**
- Shows before processing
- File name and size for each
- Remove button for each file
- Clean, organized layout

### **Dynamic Updates**
- All cards update when filtering
- Charts redraw for selected month
- Transaction table filters automatically
- Smooth transitions

---

## 📝 **Example Workflow**

### **Scenario: Analyzing Q1 2024**

1. **Upload Files**:
   - Select `sample-january-2024.csv`
   - Select `sample-february-2024.csv`
   - Select `sample-march-2024.csv`
   - Click "Open" or drag all 3 files

2. **Review Combined Data**:
   - Dashboard shows: "Analysis of 3 files (Jan, Feb, Mar 2024)"
   - See Q1 totals: $19,500 income, $6,887 expenses
   - Overall savings rate: 64.7%

3. **Filter by Month**:
   - Click "March 2024": See $6,300 income, 61.8% savings
   - Click "February 2024": See $6,500 income, 65.4% savings
   - Click "January 2024": See $6,700 income, 66.8% savings

4. **Insights**:
   - Income slightly decreased over Q1
   - Savings rate remained healthy (>60%)
   - Consistent expense patterns

---

## 🔗 **Demo URLs**

### **Multi-Month Demo (Pre-loaded)**
```
http://localhost:8000/dashboard-demo-multi.html
```
Shows 3 months of data with working month filters

### **Upload Your Files**
```
http://localhost:8000/dashboard.html
```
Upload your own multiple files for analysis

---

## 🆘 **Troubleshooting**

### **"No transactions found"**
- Ensure all files have transaction data
- Check column headers match expected format
- Verify dates are in recognizable format

### **Month not showing in filter**
- Check if transactions exist for that month
- Verify date format is correct
- Ensure dates are valid

### **Files not combining properly**
- Use consistent column headers across files
- Ensure all files are valid Excel/CSV
- Check for corrupted files

### **Charts not updating**
- Refresh the page
- Re-upload files
- Check browser console for errors

---

## 🎯 **Best Practices**

1. **Organize by Month**: One file per month works best
2. **Consistent Format**: Use same column structure
3. **Clear Names**: Name files descriptively
4. **Check Data**: Review sample files for format reference
5. **Test First**: Try with sample files before using real data

---

## 🚀 **What's Next**

Future enhancements could include:
- Year-over-year comparison
- Custom date range filtering
- Export filtered data
- Save analysis as PDF
- Budget goals and alerts
- Spending predictions

---

**The multi-file monthly organization feature is now fully functional!** 

Upload multiple bank statement files and get instant, organized analysis with the ability to filter and compare by month. All processing happens securely in your browser - no data ever leaves your device.

---

## 📞 **Quick Reference**

| Action | How To |
|--------|--------|
| **Upload multiple files** | Select multiple files or drag & drop |
| **Filter by month** | Click month button at top of dashboard |
| **View all data** | Click "All Months" button |
| **Remove a file** | Click "Remove" next to file name before processing |
| **Upload new files** | Click "Upload New Files" button |
| **Switch months** | Click any month button to filter |

---

**Enjoy your enhanced Financial Dashboard with multi-file support!** 📊

