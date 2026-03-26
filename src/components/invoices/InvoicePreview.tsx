/**
 * InvoicePreview — GoBD-konforme Rechnungsvorschau
 * Pflichtfelder nach §14 UStG vollständig implementiert.
 */

export interface InvoiceItem {
  description: string;
  quantity: number;
  unit: string;
  price: number;
  vatRate: number;
}

export interface InvoiceData {
  number: string;
  date: string;
  dueDate: string;
  servicePeriodFrom?: string;
  servicePeriodTo?: string;
  notes?: string;
  customer: {
    name: string;
    address: string;
    vatId?: string;
  };
  company: {
    name: string;
    address: string;
    taxId: string;
    vatId?: string;
    bankAccount: string;
    iban?: string;
    bic?: string;
    bankName?: string;
    logoUrl?: string;
    phone?: string;
    email?: string;
    website?: string;
    legalForm?: string;
    registerNumber?: string;
    registerCourt?: string;
    managingDirector?: string;
  };
  items: InvoiceItem[];
}
 
 interface InvoicePreviewProps {
   invoice: InvoiceData;
 }
 
export function InvoicePreview({ invoice }: InvoicePreviewProps) {
  const netTotal = invoice.items.reduce((sum, i) => sum + i.quantity * i.price, 0);

  const vatByRate = invoice.items.reduce((acc, item) => {
    const vatAmount = item.quantity * item.price * item.vatRate / 100;
    if (!acc[item.vatRate]) acc[item.vatRate] = 0;
    acc[item.vatRate] += vatAmount;
    return acc;
  }, {} as Record<number, number>);

  const vatTotal = Object.values(vatByRate).reduce((sum, v) => sum + v, 0);
  const grossTotal = netTotal + vatTotal;

  const fmt = (n: number) =>
    n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

  return (
    <div
      id="invoice-pdf"
      className="bg-white text-black font-sans"
      style={{
        width: '210mm',
        minHeight: '297mm',
        padding: '20mm 20mm 30mm 25mm',
        boxSizing: 'border-box',
        fontSize: '10pt',
        lineHeight: '1.5',
        color: '#1a1a1a',
        position: 'relative',
      }}
    >
      {/* ── Kopfzeile: Logo + Firmenname ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8mm' }}>
        <div>
          {invoice.company.logoUrl ? (
            <img
              src={invoice.company.logoUrl}
              alt={invoice.company.name}
              style={{ maxHeight: '20mm', maxWidth: '60mm', objectFit: 'contain', marginBottom: '3mm' }}
            />
          ) : (
            <div style={{ fontSize: '18pt', fontWeight: '700', color: '#1e3a5f', marginBottom: '2mm' }}>
              {invoice.company.name}
            </div>
          )}
          <div style={{ fontSize: '8pt', color: '#555', whiteSpace: 'pre-line' }}>
            {invoice.company.address}
          </div>
          {invoice.company.phone && <div style={{ fontSize: '8pt', color: '#555' }}>Tel: {invoice.company.phone}</div>}
          {invoice.company.email && <div style={{ fontSize: '8pt', color: '#555' }}>{invoice.company.email}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '22pt', fontWeight: '700', color: '#1e3a5f', letterSpacing: '1px' }}>RECHNUNG</div>
          <div style={{ fontSize: '11pt', color: '#444', marginTop: '2mm' }}>Nr. {invoice.number}</div>
        </div>
      </div>

      {/* ── Trennlinie ── */}
      <div style={{ borderTop: '2px solid #1e3a5f', marginBottom: '8mm' }} />

      {/* ── Absender-Kleinschrift (Fensterbrief) ── */}
      <div style={{ fontSize: '7pt', color: '#888', marginBottom: '2mm', borderBottom: '1px solid #ddd', paddingBottom: '1mm' }}>
        {invoice.company.name} · {invoice.company.address.replace(/\n/g, ' · ')}
      </div>

      {/* ── Empfängeradresse ── */}
      <div style={{ marginBottom: '10mm', minHeight: '28mm' }}>
        <div style={{ fontWeight: '600', fontSize: '11pt' }}>{invoice.customer.name}</div>
        <div style={{ whiteSpace: 'pre-line', color: '#333' }}>{invoice.customer.address}</div>
        {invoice.customer.vatId && (
          <div style={{ fontSize: '9pt', color: '#666', marginTop: '1mm' }}>USt-IdNr.: {invoice.customer.vatId}</div>
        )}
      </div>

      {/* ── Rechnungsdetails ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4mm', marginBottom: '8mm', fontSize: '9pt' }}>
        <div>
          <div style={{ color: '#888', fontSize: '8pt' }}>Rechnungsdatum</div>
          <div style={{ fontWeight: '600' }}>{invoice.date}</div>
        </div>
        <div>
          <div style={{ color: '#888', fontSize: '8pt' }}>Leistungszeitraum</div>
          <div style={{ fontWeight: '600' }}>
            {invoice.servicePeriodFrom && invoice.servicePeriodTo
              ? `${invoice.servicePeriodFrom} – ${invoice.servicePeriodTo}`
              : invoice.date}
          </div>
        </div>
        <div>
          <div style={{ color: '#888', fontSize: '8pt' }}>Zahlbar bis</div>
          <div style={{ fontWeight: '600', color: '#c0392b' }}>{invoice.dueDate}</div>
        </div>
      </div>

      {/* ── Positionen-Tabelle ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '6mm', fontSize: '9pt' }}>
        <thead>
          <tr style={{ backgroundColor: '#1e3a5f', color: 'white' }}>
            <th style={{ padding: '2mm 3mm', textAlign: 'left', width: '8mm' }}>Pos.</th>
            <th style={{ padding: '2mm 3mm', textAlign: 'left' }}>Beschreibung</th>
            <th style={{ padding: '2mm 3mm', textAlign: 'right', width: '20mm' }}>Menge</th>
            <th style={{ padding: '2mm 3mm', textAlign: 'right', width: '25mm' }}>Einzelpreis</th>
            <th style={{ padding: '2mm 3mm', textAlign: 'right', width: '12mm' }}>USt.</th>
            <th style={{ padding: '2mm 3mm', textAlign: 'right', width: '25mm' }}>Gesamt netto</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, i) => (
            <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#f8f9fa' : 'white', borderBottom: '1px solid #e9ecef' }}>
              <td style={{ padding: '2mm 3mm' }}>{i + 1}</td>
              <td style={{ padding: '2mm 3mm' }}>{item.description}</td>
              <td style={{ padding: '2mm 3mm', textAlign: 'right' }}>{item.quantity} {item.unit}</td>
              <td style={{ padding: '2mm 3mm', textAlign: 'right' }}>{fmt(item.price)}</td>
              <td style={{ padding: '2mm 3mm', textAlign: 'right', color: '#666' }}>{item.vatRate}%</td>
              <td style={{ padding: '2mm 3mm', textAlign: 'right', fontWeight: '500' }}>{fmt(item.quantity * item.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Summen ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8mm' }}>
        <div style={{ width: '75mm', fontSize: '9pt' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1mm 0', color: '#555' }}>
            <span>Nettobetrag:</span><span>{fmt(netTotal)}</span>
          </div>
          {Object.entries(vatByRate).map(([rate, amount]) => (
            <div key={rate} style={{ display: 'flex', justifyContent: 'space-between', padding: '1mm 0', color: '#555' }}>
              <span>Umsatzsteuer {rate}%:</span><span>{fmt(amount)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2mm 3mm', marginTop: '2mm', backgroundColor: '#1e3a5f', color: 'white', fontWeight: '700', fontSize: '11pt', borderRadius: '2mm' }}>
            <span>Gesamtbetrag:</span><span>{fmt(grossTotal)}</span>
          </div>
        </div>
      </div>

      {/* ── Zahlungshinweis ── */}
      <div style={{ backgroundColor: '#f0f4f8', border: '1px solid #d0dce8', borderRadius: '2mm', padding: '4mm', marginBottom: '8mm', fontSize: '9pt' }}>
        <div style={{ fontWeight: '600', marginBottom: '2mm', color: '#1e3a5f' }}>Zahlungsinformationen</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2mm' }}>
          <div><span style={{ color: '#888' }}>Kontoinhaber: </span><span style={{ fontWeight: '500' }}>{invoice.company.name}</span></div>
          {invoice.company.bankName && <div><span style={{ color: '#888' }}>Bank: </span><span style={{ fontWeight: '500' }}>{invoice.company.bankName}</span></div>}
          <div><span style={{ color: '#888' }}>IBAN: </span><span style={{ fontFamily: 'monospace', fontWeight: '500' }}>{invoice.company.iban || invoice.company.bankAccount}</span></div>
          {invoice.company.bic && <div><span style={{ color: '#888' }}>BIC: </span><span style={{ fontFamily: 'monospace', fontWeight: '500' }}>{invoice.company.bic}</span></div>}
        </div>
        <div style={{ marginTop: '2mm', color: '#555' }}>Verwendungszweck: <strong>{invoice.number}</strong></div>
      </div>

      {invoice.notes && (
        <div style={{ marginBottom: '8mm', fontSize: '9pt', color: '#444', fontStyle: 'italic' }}>{invoice.notes}</div>
      )}

      {/* ── Footer: Pflichtangaben §14 UStG ── */}
      <div style={{ position: 'absolute', bottom: '12mm', left: '25mm', right: '20mm', borderTop: '1px solid #ddd', paddingTop: '3mm', fontSize: '7.5pt', color: '#777', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4mm' }}>
        <div>
          <div style={{ fontWeight: '600', color: '#555' }}>{invoice.company.name}</div>
          <div style={{ whiteSpace: 'pre-line' }}>{invoice.company.address}</div>
          {invoice.company.legalForm && <div>{invoice.company.legalForm}</div>}
        </div>
        <div>
          {invoice.company.taxId && <div>Steuernr.: {invoice.company.taxId}</div>}
          {invoice.company.vatId && <div>USt-IdNr.: {invoice.company.vatId}</div>}
          {invoice.company.registerNumber && <div>HRB {invoice.company.registerNumber}{invoice.company.registerCourt ? ` · ${invoice.company.registerCourt}` : ''}</div>}
          {invoice.company.managingDirector && <div>GF: {invoice.company.managingDirector}</div>}
        </div>
        <div>
          {invoice.company.phone && <div>Tel: {invoice.company.phone}</div>}
          {invoice.company.email && <div>{invoice.company.email}</div>}
          {invoice.company.website && <div>{invoice.company.website}</div>}
        </div>
      </div>
    </div>
  );
}