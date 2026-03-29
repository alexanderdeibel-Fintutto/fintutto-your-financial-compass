/**
 * reportPdf.ts – PDF-Export für alle Berichtstypen
 *
 * Nutzt jsPDF (bereits installiert) für die clientseitige PDF-Generierung.
 * Unterstützt: BWA, GuV, Bilanz, UStVA, Journal, SuSa
 */

import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// jsPDF-autotable type extension
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: Record<string, unknown>) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

export interface ReportPdfData {
  income: number;
  expenses: number;
  profit: number;
  expensesByCategory: Record<string, number>;
  incomeByCategory: Record<string, number>;
  prevMonthIncome: number;
  prevMonthExpenses: number;
  prevMonthProfit: number;
}

export interface PdfTransaction {
  id: string;
  date: string;
  description: string | null;
  amount: number;
  type: string;
  category: string | null;
}

interface PdfOptions {
  companyName: string;
  period: string;
  reportType: string;
}

const BRAND_COLOR: [number, number, number] = [99, 102, 241]; // Indigo-500
const HEADER_BG: [number, number, number] = [30, 30, 46];
const TEXT_DARK: [number, number, number] = [15, 15, 25];
const TEXT_MUTED: [number, number, number] = [100, 100, 120];
const GREEN: [number, number, number] = [34, 197, 94];
const RED: [number, number, number] = [239, 68, 68];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('de-DE');
}

function addHeader(doc: jsPDF, title: string, opts: PdfOptions) {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header background
  doc.setFillColor(...HEADER_BG);
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Logo/Brand text
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Financial Compass', 14, 12);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 180, 200);
  doc.text(opts.companyName, 14, 20);

  // Title on right
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pageWidth - 14, 12, { align: 'right' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 180, 200);
  doc.text(`Zeitraum: ${opts.period}`, pageWidth - 14, 20, { align: 'right' });

  // Accent line
  doc.setFillColor(...BRAND_COLOR);
  doc.rect(0, 28, pageWidth, 1.5, 'F');
}

function addFooter(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageCount = doc.getNumberOfPages();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(220, 220, 230);
    doc.setLineWidth(0.3);
    doc.line(14, pageHeight - 14, pageWidth - 14, pageHeight - 14);
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(
      `Erstellt am ${new Date().toLocaleDateString('de-DE')} um ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`,
      14,
      pageHeight - 8
    );
    doc.text(`Seite ${i} von ${pageCount}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BWA PDF
// ─────────────────────────────────────────────────────────────────────────────
export function exportBWApdf(data: ReportPdfData, opts: PdfOptions): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  addHeader(doc, 'Betriebswirtschaftliche Auswertung (BWA)', opts);

  const profitChange =
    data.prevMonthProfit !== 0
      ? ((data.profit - data.prevMonthProfit) / Math.abs(data.prevMonthProfit)) * 100
      : 0;

  // KPI Summary boxes
  const kpis = [
    { label: 'Gesamterlöse', value: formatCurrency(data.income), color: GREEN },
    { label: 'Gesamtaufwand', value: formatCurrency(data.expenses), color: RED },
    { label: 'Betriebsergebnis', value: formatCurrency(data.profit), color: data.profit >= 0 ? GREEN : RED },
    {
      label: 'vs. Vormonat',
      value: `${profitChange >= 0 ? '+' : ''}${profitChange.toFixed(1)} %`,
      color: profitChange >= 0 ? GREEN : RED,
    },
  ];

  const boxW = (doc.internal.pageSize.getWidth() - 28) / 4;
  kpis.forEach((kpi, i) => {
    const x = 14 + i * (boxW + 2);
    doc.setFillColor(245, 245, 250);
    doc.roundedRect(x, 34, boxW, 18, 2, 2, 'F');
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(kpi.label, x + boxW / 2, 40, { align: 'center' });
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...kpi.color);
    doc.text(kpi.value, x + boxW / 2, 48, { align: 'center' });
    doc.setFont('helvetica', 'normal');
  });

  // BWA Table
  const categories = [
    'Materialaufwand', 'Personalaufwand', 'Miete', 'Versicherungen',
    'Telefon/Internet', 'Bürobedarf', 'Beratungskosten', 'IT-Kosten', 'Sonstiges',
  ];

  const tableBody: (string | { content: string; styles: Record<string, unknown> })[][] = [
    // Erlöse header
    [{ content: 'BETRIEBSERLÖSE', styles: { fillColor: [220, 252, 231], textColor: [22, 101, 52], fontStyle: 'bold', colSpan: 4 } }],
    ['Umsatzerlöse', formatCurrency(data.income), formatCurrency(data.prevMonthIncome), '—'],
    [{ content: 'Summe Erlöse', styles: { fontStyle: 'bold' } }, { content: formatCurrency(data.income), styles: { fontStyle: 'bold', textColor: [22, 101, 52] } }, formatCurrency(data.prevMonthIncome), '—'],
    // Aufwand header
    [{ content: 'BETRIEBSAUFWAND', styles: { fillColor: [254, 226, 226], textColor: [153, 27, 27], fontStyle: 'bold', colSpan: 4 } }],
    ...categories.map((cat) => [cat, formatCurrency(data.expensesByCategory[cat] || 0), '—', '—']),
    [{ content: 'Summe Aufwand', styles: { fontStyle: 'bold' } }, { content: formatCurrency(data.expenses), styles: { fontStyle: 'bold', textColor: [153, 27, 27] } }, formatCurrency(data.prevMonthExpenses), '—'],
    // Ergebnis
    [
      { content: 'BETRIEBSERGEBNIS', styles: { fontStyle: 'bold', fontSize: 10 } },
      { content: formatCurrency(data.profit), styles: { fontStyle: 'bold', fontSize: 10, textColor: data.profit >= 0 ? [22, 101, 52] : [153, 27, 27] } },
      formatCurrency(data.prevMonthProfit),
      `${profitChange >= 0 ? '+' : ''}${profitChange.toFixed(1)} %`,
    ],
  ];

  doc.autoTable({
    startY: 56,
    head: [['Position', 'Aktuell', 'Vormonat', 'Abweichung']],
    body: tableBody,
    theme: 'striped',
    headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { halign: 'right' },
      2: { halign: 'right', textColor: TEXT_MUTED },
      3: { halign: 'right' },
    },
  });

  addFooter(doc);
  doc.save(`BWA_${opts.period.replace(/\s/g, '_')}.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────────
// GuV PDF
// ─────────────────────────────────────────────────────────────────────────────
export function exportGuVpdf(data: ReportPdfData, opts: PdfOptions): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  addHeader(doc, 'Gewinn- und Verlustrechnung (GuV)', opts);

  const materialCosts = data.expensesByCategory['Materialaufwand'] || 0;
  const personalCosts = data.expensesByCategory['Personalaufwand'] || 0;
  const otherExpenses = data.expenses - materialCosts - personalCosts;
  const rohertrag = data.income - materialCosts;
  const betriebsergebnis = rohertrag - personalCosts - otherExpenses;
  const steuern = betriebsergebnis > 0 ? betriebsergebnis * 0.15 : 0;
  const jahresueberschuss = betriebsergebnis - steuern;

  const tableBody = [
    ['1.', 'Umsatzerlöse', formatCurrency(data.income), '—'],
    ['2.', 'Materialaufwand', `-${formatCurrency(materialCosts)}`, '—'],
    [{ content: '=', styles: { fontStyle: 'bold' } }, { content: 'Rohertrag', styles: { fontStyle: 'bold' } }, { content: formatCurrency(rohertrag), styles: { fontStyle: 'bold' } }, '—'],
    ['3.', 'Personalaufwand', `-${formatCurrency(personalCosts)}`, '—'],
    ['4.', 'Sonstige betriebliche Aufwendungen', `-${formatCurrency(otherExpenses)}`, '—'],
    [{ content: '=', styles: { fontStyle: 'bold' } }, { content: 'Betriebsergebnis (EBIT)', styles: { fontStyle: 'bold' } }, { content: formatCurrency(betriebsergebnis), styles: { fontStyle: 'bold', textColor: betriebsergebnis >= 0 ? GREEN : RED } }, '—'],
    ['5.', 'Finanzergebnis', formatCurrency(0), '—'],
    ['6.', 'Steuern vom Einkommen (15 %)', `-${formatCurrency(steuern)}`, '—'],
    [
      { content: '=', styles: { fontStyle: 'bold', fontSize: 10 } },
      { content: 'Jahresüberschuss/-fehlbetrag', styles: { fontStyle: 'bold', fontSize: 10 } },
      { content: formatCurrency(jahresueberschuss), styles: { fontStyle: 'bold', fontSize: 10, textColor: jahresueberschuss >= 0 ? GREEN : RED } },
      '—',
    ],
  ];

  doc.autoTable({
    startY: 34,
    head: [['Pos.', 'Bezeichnung', 'Betrag', 'Vorjahr']],
    body: tableBody,
    theme: 'striped',
    headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 110 },
      2: { halign: 'right' },
      3: { halign: 'right', textColor: TEXT_MUTED },
    },
  });

  addFooter(doc);
  doc.save(`GuV_${opts.period.replace(/\s/g, '_')}.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Journal PDF
// ─────────────────────────────────────────────────────────────────────────────
export function exportJournalPdf(transactions: PdfTransaction[], opts: PdfOptions): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  addHeader(doc, 'Buchungsjournal', opts);

  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  let runningBalance = 0;

  const tableBody = sorted.map((t) => {
    const delta = t.type === 'income' ? t.amount : -t.amount;
    runningBalance += delta;
    return [
      formatDate(t.date),
      t.description || '—',
      t.category || '—',
      t.type === 'expense' ? formatCurrency(t.amount) : '—',
      t.type === 'income' ? formatCurrency(t.amount) : '—',
      formatCurrency(runningBalance),
    ];
  });

  doc.autoTable({
    startY: 34,
    head: [['Datum', 'Buchungstext', 'Kategorie', 'Soll', 'Haben', 'Saldo']],
    body: tableBody,
    theme: 'striped',
    headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 80 },
      2: { cellWidth: 40 },
      3: { halign: 'right', textColor: [180, 50, 50] },
      4: { halign: 'right', textColor: [50, 150, 80] },
      5: { halign: 'right', fontStyle: 'bold' },
    },
  });

  addFooter(doc);
  doc.save(`Journal_${opts.period.replace(/\s/g, '_')}.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SuSa PDF
// ─────────────────────────────────────────────────────────────────────────────
export function exportSuSaPdf(data: ReportPdfData, transactions: PdfTransaction[], opts: PdfOptions): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  addHeader(doc, 'Summen- und Saldenliste (SKR03)', opts);

  const SKR03: Record<string, { konto: string; bezeichnung: string }> = {
    'Umsatzerlöse': { konto: '8400', bezeichnung: 'Erlöse 19 % USt' },
    'Sonstige Einnahmen': { konto: '8910', bezeichnung: 'Sonstige Erträge' },
    'Miete': { konto: '4210', bezeichnung: 'Miete' },
    'Personalaufwand': { konto: '4100', bezeichnung: 'Löhne und Gehälter' },
    'Materialaufwand': { konto: '3200', bezeichnung: 'Wareneinkauf' },
    'Bürobedarf': { konto: '4930', bezeichnung: 'Bürobedarf' },
    'IT-Kosten': { konto: '4970', bezeichnung: 'EDV-Kosten' },
    'Telefon/Internet': { konto: '4920', bezeichnung: 'Telefon' },
    'Versicherungen': { konto: '4360', bezeichnung: 'Versicherungen' },
    'Beratungskosten': { konto: '4980', bezeichnung: 'Beratungskosten' },
    'Fahrtkosten': { konto: '4670', bezeichnung: 'Reisekosten' },
    'Sonstiges': { konto: '4990', bezeichnung: 'Sonstige Aufwendungen' },
  };

  const allCategories = new Set<string>();
  transactions.forEach((t) => allCategories.add(t.category || (t.type === 'income' ? 'Umsatzerlöse' : 'Sonstiges')));

  let totalSoll = 0;
  let totalHaben = 0;

  const tableBody = Array.from(allCategories)
    .map((cat) => {
      const catTx = transactions.filter(
        (t) => (t.category || (t.type === 'income' ? 'Umsatzerlöse' : 'Sonstiges')) === cat
      );
      const soll = catTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const haben = catTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const saldo = haben - soll;
      totalSoll += soll;
      totalHaben += haben;
      const info = SKR03[cat] || { konto: '9999', bezeichnung: cat };
      return [
        info.konto,
        info.bezeichnung,
        catTx.length.toString(),
        soll > 0 ? formatCurrency(soll) : '—',
        haben > 0 ? formatCurrency(haben) : '—',
        `${formatCurrency(Math.abs(saldo))} ${saldo >= 0 ? 'H' : 'S'}`,
      ];
    })
    .sort((a, b) => a[0].localeCompare(b[0]));

  const totalSaldo = totalHaben - totalSoll;
  tableBody.push([
    { content: 'SUMME', styles: { fontStyle: 'bold' } } as unknown as string,
    '',
    '',
    { content: formatCurrency(totalSoll), styles: { fontStyle: 'bold', textColor: RED } } as unknown as string,
    { content: formatCurrency(totalHaben), styles: { fontStyle: 'bold', textColor: GREEN } } as unknown as string,
    { content: `${formatCurrency(Math.abs(totalSaldo))} ${totalSaldo >= 0 ? 'H' : 'S'}`, styles: { fontStyle: 'bold' } } as unknown as string,
  ]);

  doc.autoTable({
    startY: 34,
    head: [['Konto', 'Bezeichnung', 'Buchungen', 'Soll', 'Haben', 'Saldo']],
    body: tableBody,
    theme: 'striped',
    headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 75 },
      2: { cellWidth: 22, halign: 'center' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right', fontStyle: 'bold' },
    },
  });

  addFooter(doc);
  doc.save(`SuSa_${opts.period.replace(/\s/g, '_')}.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────────
// UStVA PDF
// ─────────────────────────────────────────────────────────────────────────────
export function exportUStVApdf(data: ReportPdfData, opts: PdfOptions): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  addHeader(doc, 'Umsatzsteuer-Voranmeldung (UStVA)', opts);

  const netto19 = data.income / 1.19;
  const ust19 = netto19 * 0.19;
  const vorsteuer = (data.expenses / 1.19) * 0.19;
  const vorauszahlung = ust19 - vorsteuer;

  const tableBody = [
    ['81', 'Steuerpflichtige Umsätze 19 %', formatCurrency(netto19)],
    ['86', 'Steuerpflichtige Umsätze 7 %', formatCurrency(0)],
    ['83', 'Steuer auf KZ 81 (19 %)', formatCurrency(ust19)],
    ['93', 'Steuer auf KZ 86 (7 %)', formatCurrency(0)],
    ['66', 'Abziehbare Vorsteuerbeträge', formatCurrency(vorsteuer)],
    [
      { content: '69', styles: { fontStyle: 'bold' } },
      { content: 'Verbleibende USt-Vorauszahlung', styles: { fontStyle: 'bold' } },
      { content: formatCurrency(vorauszahlung), styles: { fontStyle: 'bold', textColor: vorauszahlung >= 0 ? RED : GREEN } },
    ],
  ];

  doc.autoTable({
    startY: 34,
    head: [['KZ', 'Bezeichnung', 'Betrag']],
    body: tableBody,
    theme: 'striped',
    headStyles: { fillColor: [234, 88, 12], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: {
      0: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 120 },
      2: { halign: 'right' },
    },
  });

  const finalY = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(
    'Hinweis: Diese Berechnung basiert auf den erfassten Transaktionen (19 % MwSt pauschal).\nFür die rechtssichere Übermittlung nutzen Sie bitte die ELSTER-Seite.',
    14,
    finalY
  );

  addFooter(doc);
  doc.save(`UStVA_${opts.period.replace(/\s/g, '_')}.pdf`);
}
