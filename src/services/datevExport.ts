/**
 * DATEV EXTF Buchungsstapel Export
 * Format: DATEV-ASCII / EXTF Version 510 (Format 7.0)
 * Specification: DATEV Buchungsstapel-Schnittstelle (EXTF)
 */

export interface DatevExportOptions {
  companyName: string;
  taxId?: string;
  consultantNumber?: string;
  clientNumber?: string;
  fiscalYearStart?: string;
  skr?: '03' | '04';
}

export function generateDatevCSV(transactions: any[], companyInfo: DatevExportOptions): string {
  const now = new Date();
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const exportDateTime = `${now.getFullYear()}${pad2(now.getMonth()+1)}${pad2(now.getDate())}${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}000`;

  const beraternummer = companyInfo.consultantNumber || '1001';
  const mandantennummer = companyInfo.clientNumber || '1';
  const currentYear = now.getFullYear();
  const wjBeginn = companyInfo.fiscalYearStart || `${currentYear}0101`;
  const sachkontenrahmen = companyInfo.skr === '04' ? '49' : '48';

  // Header Zeile 1: DATEV EXTF Steuerungsdaten
  const header1 = [
    '"EXTF"',
    '510',
    '21',
    '"Buchungsstapel"',
    '7',
    exportDateTime,
    '',
    '"RE"',
    '"Financial Compass"',
    beraternummer,
    mandantennummer,
    wjBeginn,
    sachkontenrahmen,
    '',
    '',
    '"Financial Compass Export"',
    '',
    '1',
    '0',
    '0',
    '"EUR"',
    '',
    '',
    '',
    '',
    '',
  ].join(';');

  // Header Zeile 2: Feldnamen (nur die relevanten Pflichtfelder)
  const header2 = [
    'Umsatz (ohne Soll/Haben-Kz)',
    'Soll/Haben-Kennzeichen',
    'WKZ Umsatz',
    'Kurs',
    'Basis-Umsatz',
    'WKZ Basis-Umsatz',
    'Konto',
    'Gegenkonto (ohne BU-Schlüssel)',
    'BU-Schlüssel',
    'Belegdatum',
    'Belegfeld 1',
    'Belegfeld 2',
    'Skonto',
    'Buchungstext',
  ].join(';');

  const rows = transactions.map(t => {
    const isIncome = t.type === 'income' || (t.amount && Number(t.amount) > 0);
    const amount = Math.abs(Number(t.amount) || 0);
    const amountStr = amount.toFixed(2).replace('.', ',');

    const konto = isIncome
      ? getIncomeAccount(t.category)
      : getExpenseAccount(t.category);
    const gegenkonto = '1200';

    const date = new Date(t.date || new Date());
    const belegdatum = `${pad2(date.getDate())}${pad2(date.getMonth() + 1)}`;

    const belegfeld1 = sanitizeDatevField(t.invoice_number || t.id || '', 12);
    const buchungstext = sanitizeDatevField(t.description || t.category || 'Buchung', 60);

    return [
      amountStr,
      isIncome ? 'H' : 'S',
      'EUR',
      '',
      '',
      '',
      konto,
      gegenkonto,
      '',
      belegdatum,
      `"${belegfeld1}"`,
      '',
      '',
      `"${buchungstext}"`,
    ].join(';');
  });

  return [header1, header2, ...rows].join('\r\n');
}

function getIncomeAccount(category: string | null): string {
  const mapping: Record<string, string> = {
    'Einnahmen': '8400',
    'Umsatzerlöse': '8400',
    'Erlöse 19%': '8400',
    'Erlöse 7%': '8300',
    'Erlöse steuerfrei': '8120',
    'Sonstige Einnahmen': '8910',
    'Zinserträge': '2650',
    'Mieteinnahmen': '8400',
  };
  return mapping[category || ''] || '8400';
}

function getExpenseAccount(category: string | null): string {
  const mapping: Record<string, string> = {
    'Gehälter': '4100',
    'Löhne': '4120',
    'Miete': '4210',
    'Büromiete': '4210',
    'Büromaterial': '4930',
    'Bürobedarf': '4930',
    'Marketing': '4600',
    'Werbung': '4600',
    'Reisekosten': '4660',
    'Fahrtkosten': '4660',
    'Kfz-Kosten': '4530',
    'Versicherungen': '4360',
    'Telekommunikation': '4920',
    'Telefon': '4920',
    'Internet': '4920',
    'Steuerberatung': '4810',
    'Rechtsberatung': '4820',
    'Buchführung': '4810',
    'Bankgebühren': '4970',
    'Zinsen': '2100',
    'Abschreibungen': '4820',
    'Wareneinkauf': '3400',
    'Fremdleistungen': '4800',
    'Sonstiges': '4900',
    'Sonstige Kosten': '4900',
  };
  return mapping[category || ''] || '4900';
}

function sanitizeDatevField(value: string, maxLength: number): string {
  return value
    .replace(/;/g, ' ')
    .replace(/\r?\n/g, ' ')
    .replace(/"/g, '')
    .slice(0, maxLength);
}

export function downloadDatevFile(content: string, filename: string) {
  const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function getDatevFilename(companyName: string, dateFrom: Date, dateTo: Date): string {
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}${pad2(d.getMonth()+1)}${pad2(d.getDate())}`;
  const sanitized = companyName
    .replace(/[äöüÄÖÜß]/g, (c: string) => ({ ä:'ae',ö:'oe',ü:'ue',Ä:'Ae',Ö:'Oe',Ü:'Ue',ß:'ss' } as Record<string,string>)[c] || c)
    .replace(/[^a-zA-Z0-9]/g, '_')
    .slice(0, 20);
  return `EXTF_${sanitized}_${fmt(dateFrom)}_${fmt(dateTo)}.csv`;
}
