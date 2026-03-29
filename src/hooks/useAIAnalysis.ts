import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ReceiptAnalysisResult {
  vendor: string;
  date: string;
  grossAmount: number;
  netAmount: number;
  vatRate: number;
  vatAmount: number;
  category: string;
  confidence: number;
  suggestedAccount: string;
  suggestedAccountName?: string;
  lineItems?: { description: string; amount: number; vatRate?: number }[];
  rawText?: string;
  paymentMethod?: string;
  invoiceNumber?: string | null;
  currency?: string;
  fallback?: boolean;
  error?: string;
}

const CATEGORY_ACCOUNT_MAP: Record<string, { account: string; name: string }> = {
  'Büromaterial': { account: '4930', name: 'Bürobedarf' },
  'Software & IT': { account: '4970', name: 'EDV-Kosten' },
  'Reisekosten': { account: '4670', name: 'Reisekosten Arbeitnehmer' },
  'Bewirtung': { account: '4650', name: 'Bewirtungskosten' },
  'Telekommunikation': { account: '4920', name: 'Telefon, Fax, Internet' },
  'Miete & Nebenkosten': { account: '4210', name: 'Raumkosten' },
  'Fahrzeugkosten': { account: '4530', name: 'Kfz-Kosten' },
  'Versicherungen': { account: '4360', name: 'Versicherungsbeiträge' },
  'Werbung & Marketing': { account: '4600', name: 'Werbungskosten' },
  'Personalkosten': { account: '4100', name: 'Löhne und Gehälter' },
  'Waren & Material': { account: '3200', name: 'Wareneinkauf' },
  'Dienstleistungen': { account: '3100', name: 'Fremdleistungen' },
  'Sonstige Ausgaben': { account: '4990', name: 'Sonstige Kosten' },
  'Lebensmittel': { account: '3200', name: 'Wareneinkauf' },
  'Elektronik': { account: '4970', name: 'EDV-Kosten' },
  'Post & Versand': { account: '4910', name: 'Porto' },
  'Steuerberatung': { account: '4320', name: 'Steuerberatungskosten' },
  'Bankgebühren': { account: '4970', name: 'Bankgebühren' },
  'Kommunikation': { account: '4920', name: 'Telefon' },
  'Sonstiges': { account: '4990', name: 'Sonstige Kosten' },
};

const ANALYSIS_PROMPT = `Du bist ein präziser Buchhalter. Analysiere diesen Beleg und extrahiere alle relevanten Daten.
Antworte NUR mit einem validen JSON-Objekt (kein Markdown, keine Erklärungen):
{"vendor":"Name","date":"YYYY-MM-DD","grossAmount":0.00,"netAmount":0.00,"vatRate":19,"vatAmount":0.00,"currency":"EUR","category":"Büromaterial|Software & IT|Reisekosten|Bewirtung|Telekommunikation|Miete & Nebenkosten|Fahrzeugkosten|Versicherungen|Werbung & Marketing|Waren & Material|Dienstleistungen|Lebensmittel|Elektronik|Post & Versand|Steuerberatung|Bankgebühren|Sonstige Ausgaben","paymentMethod":"bar|EC-Karte|Kreditkarte|Überweisung|unbekannt","invoiceNumber":null,"confidence":0.95,"lineItems":[{"description":"Artikel","amount":0.00,"vatRate":19}]}
Wichtig: Beträge als Dezimalzahl, Datum YYYY-MM-DD, confidence 0-1.`;

export function useAIAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeReceipt = useCallback(async (file: File): Promise<ReceiptAnalysisResult> => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const base64 = await fileToBase64(file);
      const mediaType = file.type || 'image/jpeg';
      // 1. Supabase Edge Function
      const { data, error: fnError } = await supabase.functions.invoke('analyze-receipt', {
        body: { image: base64, mediaType, prompt: ANALYSIS_PROMPT },
      });
      if (!fnError && data && !data.fallback) return enrichWithAccountData(data as ReceiptAnalysisResult);
      // 2. Direkte OpenAI API
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (apiKey) return await analyzeWithOpenAI(base64, mediaType, apiKey);
      // 3. Demo-Fallback
      setError('KI-Analyse nicht verfügbar – API-Key nicht konfiguriert');
      return getDemoResult(file.name);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
      setError(message);
      return getDemoResult(file.name);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  return { analyzeReceipt, isAnalyzing, error };
}

async function analyzeWithOpenAI(base64: string, mediaType: string, apiKey: string): Promise<ReceiptAnalysisResult> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini', max_tokens: 1000,
      messages: [{ role: 'user', content: [
        { type: 'text', text: ANALYSIS_PROMPT },
        { type: 'image_url', image_url: { url: `data:${mediaType};base64,${base64}`, detail: 'high' } },
      ]}],
    }),
  });
  if (!response.ok) throw new Error(`OpenAI API Fehler: ${response.status}`);
  const json = await response.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('Keine Antwort von OpenAI');
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Ungültiges JSON-Format');
  return enrichWithAccountData(JSON.parse(jsonMatch[0]) as ReceiptAnalysisResult);
}

function enrichWithAccountData(result: ReceiptAnalysisResult): ReceiptAnalysisResult {
  const accountInfo = CATEGORY_ACCOUNT_MAP[result.category] || CATEGORY_ACCOUNT_MAP['Sonstige Ausgaben'];
  return { ...result, suggestedAccount: accountInfo.account, suggestedAccountName: accountInfo.name, currency: result.currency || 'EUR' };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function getDemoResult(filename: string): ReceiptAnalysisResult {
  const fn = filename.toLowerCase();
  let vendor = 'Demo Lieferant GmbH', category = 'Sonstige Ausgaben';
  let grossAmount = Math.round((50 + Math.random() * 200) * 100) / 100;
  if (fn.includes('amazon')) { vendor = 'Amazon EU S.à r.l.'; category = 'Büromaterial'; }
  else if (fn.includes('rewe') || fn.includes('edeka')) { vendor = 'REWE'; category = 'Lebensmittel'; grossAmount = 45.80; }
  else if (fn.includes('shell') || fn.includes('aral')) { vendor = 'Shell Deutschland'; category = 'Fahrzeugkosten'; }
  else if (fn.includes('telekom') || fn.includes('vodafone')) { vendor = 'Deutsche Telekom'; category = 'Telekommunikation'; }
  else if (fn.includes('hotel')) { vendor = 'Hotel'; category = 'Reisekosten'; grossAmount = 189.00; }
  const vatRate = category === 'Lebensmittel' ? 7 : 19;
  const netAmount = Math.round((grossAmount / (1 + vatRate / 100)) * 100) / 100;
  const vatAmount = Math.round((grossAmount - netAmount) * 100) / 100;
  const accountInfo = CATEGORY_ACCOUNT_MAP[category] || CATEGORY_ACCOUNT_MAP['Sonstige Ausgaben'];
  return {
    vendor, date: new Date().toISOString().split('T')[0], grossAmount, netAmount, vatRate, vatAmount,
    currency: 'EUR', category, suggestedAccount: accountInfo.account, suggestedAccountName: accountInfo.name,
    confidence: 0.75, paymentMethod: 'unbekannt', invoiceNumber: null,
    lineItems: [{ description: 'Artikel 1', amount: netAmount * 0.6, vatRate }, { description: 'Artikel 2', amount: netAmount * 0.4, vatRate }],
    fallback: true,
  };
}
