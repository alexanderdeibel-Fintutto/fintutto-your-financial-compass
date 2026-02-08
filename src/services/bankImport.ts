export interface BankTransaction {
   date: string;
   valueDate: string;
   amount: number;
   description: string;
   reference: string;
   counterpartName?: string;
   counterpartIban?: string;
   category?: string;
 }
 
export type BankFormat = 'sparkasse' | 'deutschebank' | 'commerzbank' | 'n26' | 'revolut' | 'c24' | 'outbank' | 'general';

export const BANK_FORMATS: { value: BankFormat; label: string }[] = [
  { value: 'outbank', label: 'Outbank' },
  { value: 'c24', label: 'C24 Bank' },
  { value: 'sparkasse', label: 'Sparkasse' },
  { value: 'deutschebank', label: 'Deutsche Bank' },
  { value: 'commerzbank', label: 'Commerzbank' },
  { value: 'n26', label: 'N26' },
  { value: 'revolut', label: 'Revolut' },
  { value: 'general', label: 'Allgemein CSV' },
];
 
 // Auto-detect Outbank format from header line
 export function detectBankFormat(content: string): BankFormat | null {
   const cleanContent = content.replace(/^\uFEFF/, '');
   const firstLine = cleanContent.split('\n')[0]?.trim() || '';
   // Outbank header: #;Konto;Datum;Valuta;Betrag;Währung;Name;...
   if (firstLine.startsWith('#;Konto;Datum') || firstLine.includes(';Valuta;Betrag;Währung;Name;')) {
     return 'outbank';
   }
   return null;
 }

 // CSV Parser für verschiedene Banken
 export function parseCSV(content: string, format: BankFormat): BankTransaction[] {
   // Remove BOM character if present
   const cleanContent = content.replace(/^\uFEFF/, '');
   
   // Auto-detect Outbank format regardless of user selection
   const detectedFormat = detectBankFormat(cleanContent);
   const effectiveFormat = detectedFormat || format;
   
   const lines = cleanContent.split('\n');
   const transactions: BankTransaction[] = [];

   // Skip header (usually first line)
   for (let i = 1; i < lines.length; i++) {
     const line = lines[i].trim();
     if (!line) continue;

     try {
        // Handle comma-separated formats FIRST (C24, Revolut)
        // These use commas as delimiters, so semicolon-split would fail
        if (effectiveFormat === 'revolut') {
          const revCols = parseCSVLine(line);
          if (revCols.length < 6) continue;
          transactions.push({
            date: revCols[2]?.split(' ')[0] || '',
            valueDate: revCols[3]?.split(' ')[0] || revCols[2]?.split(' ')[0] || '',
            description: revCols[4],
            reference: '',
            amount: parseFloat(revCols[5]) || 0,
          });
          continue;
        }

        if (effectiveFormat === 'c24') {
          const c24Cols = parseCSVLine(line);
          if (c24Cols.length < 5) continue;
          const amountStr = c24Cols[3]?.replace('€', '').trim() || '0';
          transactions.push({
            date: parseGermanDate(c24Cols[1]),
            valueDate: parseGermanDate(c24Cols[1]),
            description: c24Cols[8] || c24Cols[7] || c24Cols[0],
            reference: c24Cols[7] || '',
            counterpartName: c24Cols[4] || '',
            counterpartIban: c24Cols[5] || '',
            amount: parseGermanNumber(amountStr),
            category: c24Cols[11] || undefined,
          });
          continue;
        }

        // Semicolon-separated formats (Sparkasse, Deutsche Bank, Outbank, etc.)
        const cols = line.split(';').map((c) => c.replace(/"/g, '').trim());
        if (cols.length < 3) continue;

        if (effectiveFormat === 'outbank') {
          // Outbank: #;Konto;Datum;Valuta;Betrag;Währung;Name;Nummer;Bank;Zweck;Hauptkategorie;Kategorie;Kategoriepfad;Tags;Notiz;Buchungstext
          if (cols.length < 5) continue;
          const valueDateStr = cols[3]?.trim();
          transactions.push({
            date: parseGermanDate(cols[2]),
            valueDate: valueDateStr ? parseGermanDate(valueDateStr) : parseGermanDate(cols[2]),
            amount: parseGermanNumber(cols[4]),
            description: cols[15] || cols[9] || cols[6] || '',
            reference: cols[9] || '',
            counterpartName: cols[6] || '',
            counterpartIban: cols[7] || '',
            category: cols[12] || cols[11] || undefined,
          });
        } else if (effectiveFormat === 'sparkasse') {
          transactions.push({
            date: parseGermanDate(cols[1]),
            valueDate: parseGermanDate(cols[2]),
            description: cols[4] || cols[3],
            reference: cols[4] || '',
            counterpartName: cols[5],
            amount: parseGermanNumber(cols[8]),
          });
        } else if (effectiveFormat === 'deutschebank') {
          transactions.push({
            date: parseGermanDate(cols[0]),
            valueDate: parseGermanDate(cols[1]),
            description: cols[4],
            reference: cols[7] || '',
            counterpartName: cols[3],
            counterpartIban: cols[5],
            amount: parseGermanNumber(cols[15] || cols[16]) || parseGermanNumber(cols[11]),
          });
        } else if (effectiveFormat === 'commerzbank') {
          transactions.push({
            date: parseGermanDate(cols[0]),
            valueDate: parseGermanDate(cols[1]),
            description: cols[3] || cols[2],
            reference: '',
            amount: parseGermanNumber(cols[4]),
          });
        } else if (effectiveFormat === 'n26') {
          transactions.push({
            date: cols[0],
            valueDate: cols[0],
            description: cols[4] || cols[3],
            reference: '',
            counterpartName: cols[1],
            counterpartIban: cols[2],
            amount: parseGermanNumber(cols[5]),
          });
        } else {
          // Allgemein: Datum;Beschreibung;Betrag
          transactions.push({
            date: cols[0],
            valueDate: cols[0],
            description: cols[1],
            reference: '',
            amount: parseGermanNumber(cols[2]),
          });
       }
     } catch (e) {
       console.warn(`Failed to parse line ${i}:`, line, e);
     }
   }
   return transactions;
 }
 
 // MT940 Parser (SWIFT Format)
 export function parseMT940(content: string): BankTransaction[] {
   const transactions: BankTransaction[] = [];
   
   // Match :61: transaction lines followed by :86: description
   const regex = /:61:(\d{6})(\d{4})?(C|D|RC|RD)([A-Z]?)(\d+,\d{2})[^\n]*\n:86:([\s\S]*?)(?=:6[012]:|$)/g;
   let match;
 
   while ((match = regex.exec(content)) !== null) {
     const dateStr = match[1];
     const creditDebit = match[3];
     const amount = parseFloat(match[5].replace(',', '.'));
     const description = match[6].replace(/\?../g, ' ').replace(/\n/g, ' ').trim();
     
     // Parse date: YYMMDD -> YYYY-MM-DD
     const year = parseInt(dateStr.slice(0, 2));
     const fullYear = year > 50 ? 1900 + year : 2000 + year;
     const formattedDate = `${fullYear}-${dateStr.slice(2, 4)}-${dateStr.slice(4, 6)}`;
 
     transactions.push({
       date: formattedDate,
       valueDate: formattedDate,
       amount: creditDebit === 'D' || creditDebit === 'RD' ? -amount : amount,
       description,
       reference: '',
     });
   }
   return transactions;
 }
 
 // CAMT.053 Parser (XML Format)
 export function parseCAMT053(content: string): BankTransaction[] {
   const transactions: BankTransaction[] = [];
   const parser = new DOMParser();
   const doc = parser.parseFromString(content, 'text/xml');
 
   // Find all Ntry (entry) elements
   const entries = doc.querySelectorAll('Ntry');
 
   entries.forEach((entry) => {
     try {
       const bookingDate = entry.querySelector('BookgDt Dt')?.textContent || '';
       const valueDate = entry.querySelector('ValDt Dt')?.textContent || bookingDate;
       const amountEl = entry.querySelector('Amt');
       const amount = parseFloat(amountEl?.textContent || '0');
       const creditDebit = entry.querySelector('CdtDbtInd')?.textContent;
       const description = entry.querySelector('NtryDtls TxDtls RmtInf Ustrd')?.textContent || 
                          entry.querySelector('AddtlNtryInf')?.textContent || '';
       const counterpartName = entry.querySelector('NtryDtls TxDtls RltdPties Cdtr Nm')?.textContent ||
                               entry.querySelector('NtryDtls TxDtls RltdPties Dbtr Nm')?.textContent || '';
       const counterpartIban = entry.querySelector('NtryDtls TxDtls RltdPties CdtrAcct Id IBAN')?.textContent ||
                               entry.querySelector('NtryDtls TxDtls RltdPties DbtrAcct Id IBAN')?.textContent || '';
 
       transactions.push({
         date: bookingDate,
         valueDate,
         amount: creditDebit === 'DBIT' ? -amount : amount,
         description,
         reference: '',
         counterpartName,
         counterpartIban,
       });
     } catch (e) {
       console.warn('Failed to parse CAMT entry:', e);
     }
   });
 
   return transactions;
 }
 
 // Detect file format
 export function detectFileFormat(content: string, filename: string): 'csv' | 'mt940' | 'camt053' {
   const lowerName = filename.toLowerCase();
   
   if (lowerName.endsWith('.xml') || content.trim().startsWith('<?xml') || content.includes('<Document')) {
     return 'camt053';
   }
   
   if (lowerName.includes('mt940') || lowerName.endsWith('.sta') || content.includes(':20:') && content.includes(':61:')) {
     return 'mt940';
   }
   
   return 'csv';
 }
 
 // Parse German date format DD.MM.YYYY to YYYY-MM-DD
 function parseGermanDate(dateStr: string): string {
   if (!dateStr) return '';
   
   // Already in ISO format
   if (dateStr.includes('-')) return dateStr;
   
   // German format: DD.MM.YYYY or DD.MM.YY
   const parts = dateStr.split('.');
   if (parts.length === 3) {
     let year = parts[2];
     if (year.length === 2) {
       year = parseInt(year) > 50 ? '19' + year : '20' + year;
     }
     return `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
   }
   
   return dateStr;
 }
 
// Parse German number format (1.234,56 -> 1234.56)
function parseGermanNumber(numStr: string): number {
  if (!numStr) return 0;
  // Remove thousand separators and replace comma with dot
  const cleaned = numStr.replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

// Parse a CSV line respecting quoted fields (handles commas inside quotes)
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}