# Local CSV Export Formatted for Brazilian Portuguese Excel

Standard RFC 4180 CSV files using comma delimiters and UTF-8 without BOM frequently open with scrambled accents and broken columns in Microsoft Excel on systems configured for Portuguese (Brazil). We decided to format local CSV exports with **UTF-8 with BOM (`\uFEFF`)**, semicolon (`;`) as delimiter, and quoted text fields so that exported files open seamlessly out-of-the-box in Excel and local spreadsheet software.
