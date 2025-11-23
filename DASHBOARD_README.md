# Financial Dashboard - StatementPro

## Overview

The Financial Dashboard is a secure, client-side tool that analyzes bank statements without storing any data on servers. All processing happens in your browser for maximum security.

## Features

### 📊 **Real-Time Analysis**
- **Total Income**: Sum of all credit transactions
- **Total Expenses**: Sum of all debit transactions  
- **Net Balance**: Income minus expenses
- **Savings Rate**: Percentage of income saved (Net Balance / Income × 100)

### 📈 **Visual Charts**
- **Income vs Expenses Bar Chart**: Compare your income, expenses, and net balance
- **Category Breakdown Pie Chart**: See where your money goes by category

### 📋 **Transaction Table**
- View all transactions with details (date, description, category, amount, balance)
- Filter by: All, Income, or Expenses
- Automatic categorization of transactions

### 🔒 **Security Features**
- **Client-Side Processing**: Files are processed entirely in your browser
- **No Data Storage**: Files are never uploaded to any server
- **No PDF Storage**: Only Excel/CSV files are processed, PDFs are never stored
- **Privacy First**: Your financial data never leaves your device

## Supported File Formats

- `.xlsx` (Excel 2007+)
- `.xls` (Excel 97-2003)
- `.csv` (Comma-Separated Values)

**Maximum file size**: 10MB

## How to Use

### 1. **Prepare Your Bank Statement**

Your Excel/CSV file should have columns with these headers (flexible matching):
- **Date**: Transaction date (e.g., "Date", "Transaction Date", "Posting Date")
- **Description**: Transaction description (e.g., "Description", "Memo", "Details")
- **Amount**: Transaction amount (e.g., "Amount", "Debit", "Credit")
- **Balance**: Running balance (optional, e.g., "Balance", "Available Balance")

**Alternative format with separate columns**:
- **Credit**: Deposits/income amounts
- **Debit**: Withdrawals/expense amounts

### 2. **Upload Your File**

#### Option A: Drag and Drop
1. Go to the Dashboard page
2. Drag your Excel/CSV file onto the upload area
3. Drop the file

#### Option B: Browse Files
1. Click the "Browse Files" button
2. Select your bank statement file
3. Click "Open"

### 3. **View Your Dashboard**

Once processed, you'll see:
- **Summary Cards**: Income, Expenses, Net Balance, Savings Rate
- **Charts**: Visual representation of your finances
- **Transaction Table**: Detailed list of all transactions

### 4. **Filter Transactions**

Use the filter buttons above the transaction table:
- **All**: Show all transactions
- **Income**: Show only income/credit transactions
- **Expenses**: Show only expense/debit transactions

## Transaction Categories

Transactions are automatically categorized into:

- 💰 **Salary**: Payroll, wages, income
- 🍔 **Food**: Restaurants, groceries, food delivery
- 🚗 **Transport**: Uber, gas, parking, public transit
- 🛍️ **Shopping**: Retail purchases, Amazon, stores
- 💡 **Bills**: Utilities, internet, phone, insurance
- 🎬 **Entertainment**: Streaming services, movies, games
- 🏥 **Healthcare**: Medical, pharmacy, doctor visits
- 🔄 **Transfer**: ATM withdrawals, transfers
- 📦 **Other**: Uncategorized transactions

## Sample File

A sample bank statement CSV file (`sample-bank-statement.csv`) is included for testing. It contains:
- 3 months of transactions (January - March 2024)
- Mix of income and expenses
- Various transaction categories
- Realistic banking data

## Technical Details

### Libraries Used

- **SheetJS (xlsx)**: Excel file parsing
- **Chart.js**: Data visualization
- **InstantDB**: Authentication (optional)

### File Processing

1. **File Validation**: Checks file type and size
2. **Parsing**: Reads Excel/CSV using SheetJS
3. **Data Extraction**: Identifies columns and extracts transactions
4. **Categorization**: Auto-categorizes based on description keywords
5. **Calculations**: Computes income, expenses, balance, and savings rate
6. **Visualization**: Generates charts and populates tables

### Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Privacy & Security

### What We DON'T Do
- ❌ Upload files to any server
- ❌ Store your financial data
- ❌ Track your transactions
- ❌ Share data with third parties
- ❌ Save PDFs (only processes Excel/CSV)

### What We DO
- ✅ Process files entirely in your browser
- ✅ Delete file data when you leave the page
- ✅ Use secure, client-side processing
- ✅ Open-source libraries for transparency

## Troubleshooting

### "No transactions found in the file"
- Ensure your file has transaction data
- Check that column headers match expected formats
- Verify the file isn't password-protected

### "Please upload a valid Excel or CSV file"
- Only `.xlsx`, `.xls`, and `.csv` files are supported
- Check the file extension
- Ensure the file isn't corrupted

### "File size exceeds 10MB"
- Large files may fail to process
- Try splitting your statement into smaller date ranges
- Remove unnecessary columns or sheets

### Charts not displaying
- Ensure you have transactions in your file
- Try refreshing the page
- Check browser console for errors

## Tips for Best Results

1. **Clean Data**: Remove empty rows and ensure consistent formatting
2. **Date Format**: Use standard date formats (YYYY-MM-DD, MM/DD/YYYY, etc.)
3. **Amount Format**: Use numeric values (decimals are fine)
4. **Headers**: Include clear column headers in the first row
5. **Single Sheet**: Use only one sheet with transaction data

## Future Enhancements

- 📅 Date range filtering
- 💾 Save analysis as PDF report
- 📊 More chart types (line charts, trends)
- 🎯 Budget tracking and goals
- 📱 Mobile optimization
- 🔔 Spending alerts and insights

## Support

For issues or questions:
1. Check this README
2. Review the sample file for format reference
3. Ensure your file meets the requirements
4. Try a different file format

---

**Remember**: Your privacy is our priority. All processing happens in your browser, and we never store your financial data.

