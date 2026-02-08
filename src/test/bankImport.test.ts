import { describe, it, expect } from 'vitest';
import { parseCSV, detectBankFormat } from '@/services/bankImport';

const OUTBANK_CSV = `#;Konto;Datum;Valuta;Betrag;Währung;Name;Nummer;Bank;Zweck;Hauptkategorie;Kategorie;Kategoriepfad;Tags;Notiz;Buchungstext
1;DE58500240245625741701;04.02.2026;;-9,99;EUR;"Apple";;;;"Familie";"Cloud/Netz Abos";"Familie / Cloud/Netz Abos";;;"Apple.Com/Bill"
2;DE58500240245625741701;03.02.2026;;-300,00;EUR;"Lovable";;;;"Fintutto";"Fintutto";"Fintutto";;;
3;DE58500240245625741701;03.02.2026;;-63,00;EUR;"DB Vertrieb GmbH";"DE02100100100152517108";"PBNKDEFFXXX";"Abo 992886480 zum 01.02.2026";"Familie";"Fahrkarten/Monatskarten";"Familie / Kinder / Fahrkarten/Monatskarten";;;
9;DE58500240245625741701;02.02.2026;;-3.000,00;EUR;"Coinbase UK";"DE78202208000027105416";"SXPYDEHHXXX";"alexander deibel";"Anlage";"Coins";"Anlage / Coins";;;"Coinbase Ireland Limited"
10;DE58500240245625741701;01.02.2026;;4.200,00;EUR;"Gehalt";"DE12345678901234567890";"COBADEFF";"Gehalt Februar 2026";"Einnahmen";"Gehalt";"Einnahmen / Gehalt";;;`;

describe('Bank Import - Outbank CSV', () => {
  it('should detect Outbank format', () => {
    const format = detectBankFormat(OUTBANK_CSV);
    expect(format).toBe('outbank');
  });

  it('should parse Outbank CSV correctly', () => {
    const transactions = parseCSV(OUTBANK_CSV, 'general'); // auto-detect should override
    expect(transactions.length).toBe(5);
  });

  it('should parse amounts correctly (no million-euro bugs)', () => {
    const transactions = parseCSV(OUTBANK_CSV, 'outbank');
    
    // -9,99
    expect(transactions[0].amount).toBeCloseTo(-9.99, 2);
    
    // -300,00
    expect(transactions[1].amount).toBeCloseTo(-300, 2);
    
    // -63,00
    expect(transactions[2].amount).toBeCloseTo(-63, 2);
    
    // -3.000,00 (critical: thousand separator must not create millions)
    expect(transactions[3].amount).toBeCloseTo(-3000, 2);
    
    // 4.200,00 positive amount
    expect(transactions[4].amount).toBeCloseTo(4200, 2);
  });

  it('should parse dates correctly', () => {
    const transactions = parseCSV(OUTBANK_CSV, 'outbank');
    
    expect(transactions[0].date).toBe('2026-02-04');
    expect(transactions[1].date).toBe('2026-02-03');
  });

  it('should extract descriptions from Buchungstext (col 15) or Zweck (col 9)', () => {
    const transactions = parseCSV(OUTBANK_CSV, 'outbank');
    
    // Row 1: has Buchungstext "Apple.Com/Bill"
    expect(transactions[0].description).toBe('Apple.Com/Bill');
    
    // Row 3: has Zweck "Abo 992886480 zum 01.02.2026", no Buchungstext
    expect(transactions[2].description).toContain('Abo');
    
    // Row 4: Coinbase - has Buchungstext "Coinbase Ireland Limited"
    expect(transactions[3].description).toBe('Coinbase Ireland Limited');
  });

  it('should extract counterpart names', () => {
    const transactions = parseCSV(OUTBANK_CSV, 'outbank');
    
    expect(transactions[0].counterpartName).toBe('Apple');
    expect(transactions[2].counterpartName).toBe('DB Vertrieb GmbH');
  });

  it('should extract categories', () => {
    const transactions = parseCSV(OUTBANK_CSV, 'outbank');
    
    // Category from Kategoriepfad (col 12) or Kategorie (col 11)
    expect(transactions[0].category).toContain('Cloud/Netz Abos');
  });
});
