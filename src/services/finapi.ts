import { supabase } from '@/integrations/supabase/client';

export interface FinAPIStatus {
  configured: boolean;
  connected: boolean;
  sandbox?: boolean;
  error?: string;
}

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
  { code: 'comdirect', name: 'comdirect' },
];

/**
 * Check FinAPI connection status
 */
export async function checkFinAPIStatus(): Promise<FinAPIStatus> {
  try {
    const { data, error } = await supabase.functions.invoke('finapi/status');
    
    if (error) {
      return { configured: false, connected: false, error: error.message };
    }
    
    return data as FinAPIStatus;
  } catch (err) {
    return { 
      configured: false, 
      connected: false, 
      error: err instanceof Error ? err.message : 'Unknown error' 
    };
  }
}

/**
 * Get WebForm URL for bank connection
 */
export async function getBankConnectionUrl(): Promise<string | null> {
  try {
    const callbackUrl = `${window.location.origin}/bank-callback`;
    
    const { data, error } = await supabase.functions.invoke('finapi/webform', {
      body: { callbackUrl },
    });
    
    if (error) {
      console.error('WebForm error:', error);
      return null;
    }
    
    return data?.url || null;
  } catch (err) {
    console.error('getBankConnectionUrl error:', err);
    return null;
  }
}

/**
 * Connect a bank via finAPI WebForm redirect
 * Throws if finAPI is not configured or URL cannot be obtained
 */
export async function connectBank(bankCode: string): Promise<string> {
  const status = await checkFinAPIStatus();

  if (!status.configured) {
    throw new Error('finAPI ist nicht konfiguriert. Bitte API-Schlüssel in den Supabase Edge Function Einstellungen hinterlegen.');
  }

  if (!status.connected) {
    throw new Error('finAPI-Verbindung konnte nicht hergestellt werden. Bitte überprüfen Sie die API-Zugangsdaten.');
  }

  const url = await getBankConnectionUrl();
  if (!url) {
    throw new Error('finAPI WebForm-URL konnte nicht erstellt werden.');
  }
  return url;
}

/**
 * Fetch transactions from finAPI for a given account
 */
export async function fetchTransactions(accountId: string): Promise<FinAPITransaction[]> {
  const { data, error } = await supabase.functions.invoke('finapi/transactions', {
    body: { accountId },
  });

  if (error) {
    throw new Error(`Transaktionen konnten nicht abgerufen werden: ${error.message}`);
  }

  return data?.transactions ?? [];
}

/**
 * Sync a bank account via finAPI
 */
export async function syncAccount(connectionId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('finapi/connections', {
    body: { connectionId },
  });

  if (error) {
    throw new Error(`Konto-Synchronisierung fehlgeschlagen: ${error.message}`);
  }
}

export function getBankByCode(code: string): SupportedBank | undefined {
  return SUPPORTED_BANKS.find(b => b.code === code);
}