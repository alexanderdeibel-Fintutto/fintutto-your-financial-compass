 export interface BankConnection {
   id: string;
   bankName: string;
   bankLogo?: string;
   iban: string;
   lastSync: string;
   status: 'active' | 'expired' | 'error';
 }
 
 export interface FinAPITransaction {
   id: string;
   amount: number;
   purpose: string;
   counterpartName: string;
   counterpartIban?: string;
   bookingDate: string;
   valueDate: string;
 }
 
 export interface SupportedBank {
   code: string;
   name: string;
   logo?: string;
 }
 
 export const SUPPORTED_BANKS: SupportedBank[] = [
   { code: 'sparkasse', name: 'Sparkasse' },
   { code: 'volksbank', name: 'Volksbank' },
   { code: 'deutsche_bank', name: 'Deutsche Bank' },
   { code: 'commerzbank', name: 'Commerzbank' },
   { code: 'n26', name: 'N26' },
   { code: 'ing', name: 'ING' },
   { code: 'dkb', name: 'DKB' },
 ];
 
 // Simulierte FinAPI-Integration (später echte API)
 export async function connectBank(bankCode: string): Promise<string> {
   // Gibt Redirect-URL zurück
   return `https://finapi.io/connect?bank=${bankCode}&redirect=${window.location.origin}/bank-callback`;
 }
 
 export async function fetchTransactions(connectionId: string): Promise<FinAPITransaction[]> {
   // Simulierte Transaktionen
   await new Promise(r => setTimeout(r, 1500));
   return [
     { id: '1', amount: -89.99, purpose: 'Amazon Bestellung', counterpartName: 'Amazon EU', bookingDate: '2026-02-04', valueDate: '2026-02-04' },
     { id: '2', amount: 2500, purpose: 'Gehalt Februar', counterpartName: 'Arbeitgeber GmbH', bookingDate: '2026-02-01', valueDate: '2026-02-01' },
     { id: '3', amount: -750, purpose: 'Miete Februar', counterpartName: 'Vermieter', bookingDate: '2026-02-01', valueDate: '2026-02-01' },
   ];
 }
 
 export async function syncAccount(connectionId: string): Promise<void> {
   // Sync starten
   await new Promise(r => setTimeout(r, 2000));
 }
 
 export function getBankByCode(code: string): SupportedBank | undefined {
   return SUPPORTED_BANKS.find(b => b.code === code);
 }