import { useState } from 'react';

export interface ReceiptAnalysisResult {
  vendor: string;
  date: string;
  grossAmount: number;
  vatRate: number;
  vatAmount: number;
  category: string;
  confidence: number;
  suggestedAccount: string;
}

export function useAIAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeReceipt = async (file: File): Promise<ReceiptAnalysisResult> => {
    setIsAnalyzing(true);
    // Simuliere AI-Analyse (später echte API)
    await new Promise(r => setTimeout(r, 2000));

    // Demo-Ergebnis basierend auf Dateiname
    const fileName = file.name.toLowerCase();
    let vendor = 'Unbekannter Lieferant';
    let category = 'Sonstige Ausgaben';
    let suggestedAccount = '4900 - Sonstige betriebliche Aufwendungen';

    if (fileName.includes('amazon')) {
      vendor = 'Amazon EU S.à r.l.';
      category = 'Bürobedarf';
      suggestedAccount = '4930 - Bürobedarf';
    } else if (fileName.includes('rewe') || fileName.includes('edeka') || fileName.includes('lidl')) {
      vendor = fileName.includes('rewe') ? 'REWE' : fileName.includes('edeka') ? 'EDEKA' : 'Lidl';
      category = 'Bewirtung';
      suggestedAccount = '4650 - Bewirtungskosten';
    } else if (fileName.includes('shell') || fileName.includes('aral') || fileName.includes('tank')) {
      vendor = fileName.includes('shell') ? 'Shell Deutschland' : fileName.includes('aral') ? 'Aral AG' : 'Tankstelle';
      category = 'Fahrzeugkosten';
      suggestedAccount = '4530 - Kfz-Kosten';
    } else if (fileName.includes('telekom') || fileName.includes('vodafone')) {
      vendor = fileName.includes('telekom') ? 'Deutsche Telekom' : 'Vodafone GmbH';
      category = 'Kommunikation';
      suggestedAccount = '4920 - Telefon';
    }

    const grossAmount = Math.round(Math.random() * 500 * 100) / 100;
    const vatRate = category === 'Bewirtung' ? 7 : 19;
    const vatAmount = Math.round(grossAmount * vatRate / (100 + vatRate) * 100) / 100;

    const result: ReceiptAnalysisResult = {
      vendor,
      date: new Date().toISOString().split('T')[0],
      grossAmount,
      vatRate,
      vatAmount,
      category,
      confidence: 0.85 + Math.random() * 0.12,
      suggestedAccount
    };

    setIsAnalyzing(false);
    return result;
  };

  return { analyzeReceipt, isAnalyzing };
}
