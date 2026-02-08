import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfBase64, filename } = await req.json();

    if (!pdfBase64) {
      return new Response(
        JSON.stringify({ error: "No PDF data provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "AI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = `Du bist ein Experte für das Auslesen von Bankauszügen und Kontoauszügen im PDF-Format. Analysiere das folgende PDF-Dokument und extrahiere ALLE Transaktionen.

Für jede Transaktion extrahiere:
- date: Buchungsdatum im Format YYYY-MM-DD
- valueDate: Valutadatum im Format YYYY-MM-DD (falls vorhanden, sonst gleich wie date)
- amount: Betrag als Zahl (negativ für Ausgaben/Belastungen, positiv für Einnahmen/Gutschriften)
- description: Beschreibung/Verwendungszweck
- reference: Referenznummer falls vorhanden
- counterpartName: Name des Zahlungsempfängers/Auftraggebers
- counterpartIban: IBAN des Gegenkontos falls vorhanden
- category: Kategorie falls erkennbar (z.B. "Miete", "Gehalt", "Einkauf", etc.)

WICHTIG:
- Beträge mit Minus-Vorzeichen oder "S" (Soll) sind Ausgaben (negativ)
- Beträge mit Plus-Vorzeichen oder "H" (Haben) sind Einnahmen (positiv)
- Deutsches Zahlenformat beachten: 1.234,56 = 1234.56
- Datumsformat konvertieren: DD.MM.YYYY -> YYYY-MM-DD

Antworte NUR mit einem JSON-Array von Transaktionen. Keine weiteren Erklärungen.
Beispiel: [{"date":"2025-01-15","valueDate":"2025-01-15","amount":-50.00,"description":"REWE Einkauf","reference":"","counterpartName":"REWE","counterpartIban":"","category":"Einkauf"}]

Falls keine Transaktionen erkannt werden können, antworte mit einem leeren Array: []`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:application/pdf;base64,${pdfBase64}`,
                },
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 16000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", errorText);
      return new Response(
        JSON.stringify({ error: "AI analysis failed", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "[]";

    // Extract JSON from response (might be wrapped in markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    let transactions;
    try {
      transactions = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response as JSON:", content);
      transactions = [];
    }

    // Validate and clean transactions
    const cleanedTransactions = (Array.isArray(transactions) ? transactions : []).map((tx: any) => ({
      date: tx.date || "",
      valueDate: tx.valueDate || tx.date || "",
      amount: typeof tx.amount === "number" ? tx.amount : parseFloat(tx.amount) || 0,
      description: tx.description || "",
      reference: tx.reference || "",
      counterpartName: tx.counterpartName || "",
      counterpartIban: tx.counterpartIban || "",
      category: tx.category || "",
    })).filter((tx: any) => tx.date && tx.amount !== 0);

    return new Response(
      JSON.stringify({ transactions: cleanedTransactions, filename }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in parse-bank-pdf:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
