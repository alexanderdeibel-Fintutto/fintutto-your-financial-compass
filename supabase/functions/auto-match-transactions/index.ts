import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Transaction {
  id: string;
  amount: number;
  description: string | null;
  date: string;
  type: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  due_date: string | null;
  status: string;
  description: string | null;
}

interface MatchResult {
  transaction_id: string;
  invoice_id: string;
  confidence: number; // 0-100
  reason: string;
}

/**
 * Berechnet die Ähnlichkeit zweier Strings (Levenshtein-basiert, vereinfacht)
 */
function stringSimilarity(a: string, b: string): number {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();
  if (aLower === bLower) return 1.0;
  if (aLower.includes(bLower) || bLower.includes(aLower)) return 0.8;
  // Gemeinsame Wörter
  const aWords = new Set(aLower.split(/\s+/).filter(w => w.length > 3));
  const bWords = new Set(bLower.split(/\s+/).filter(w => w.length > 3));
  const intersection = [...aWords].filter(w => bWords.has(w)).length;
  const union = new Set([...aWords, ...bWords]).size;
  return union > 0 ? intersection / union : 0;
}

/**
 * Hauptmatching-Logik:
 * 1. Exakter Betrag → hohe Konfidenz
 * 2. Rechnungsnummer in Beschreibung → sehr hohe Konfidenz
 * 3. Betrag ±1% Toleranz + Datum nahe Fälligkeit → mittlere Konfidenz
 */
function matchTransactionToInvoice(tx: Transaction, invoice: Invoice): MatchResult | null {
  const reasons: string[] = [];
  let confidence = 0;

  // Betrag-Vergleich (Brutto)
  const amountDiff = Math.abs(tx.amount - invoice.amount);
  const amountTolerance = invoice.amount * 0.01; // 1% Toleranz

  if (amountDiff === 0) {
    confidence += 50;
    reasons.push("Exakter Betrag");
  } else if (amountDiff <= amountTolerance) {
    confidence += 35;
    reasons.push("Betrag ±1%");
  } else if (amountDiff <= invoice.amount * 0.05) {
    confidence += 15;
    reasons.push("Betrag ±5%");
  } else {
    // Betrag passt gar nicht → kein Match
    return null;
  }

  // Rechnungsnummer in Beschreibung
  if (tx.description && invoice.invoice_number) {
    const invoiceNumClean = invoice.invoice_number.replace(/[-_\s]/g, '').toLowerCase();
    const descClean = (tx.description || '').replace(/[-_\s]/g, '').toLowerCase();
    if (descClean.includes(invoiceNumClean)) {
      confidence += 40;
      reasons.push("Rechnungsnummer gefunden");
    }
  }

  // Beschreibungs-Ähnlichkeit
  if (tx.description && invoice.description) {
    const similarity = stringSimilarity(tx.description, invoice.description);
    if (similarity > 0.6) {
      confidence += Math.round(similarity * 15);
      reasons.push("Beschreibung ähnlich");
    }
  }

  // Datum-Nähe zur Fälligkeit
  if (invoice.due_date) {
    const txDate = new Date(tx.date).getTime();
    const dueDate = new Date(invoice.due_date).getTime();
    const daysDiff = Math.abs((txDate - dueDate) / (1000 * 60 * 60 * 24));
    if (daysDiff <= 3) {
      confidence += 10;
      reasons.push("Datum nahe Fälligkeit");
    } else if (daysDiff <= 14) {
      confidence += 5;
      reasons.push("Datum innerhalb 2 Wochen");
    }
  }

  // Mindest-Konfidenz 40%
  if (confidence < 40) return null;

  return {
    transaction_id: tx.id,
    invoice_id: invoice.id,
    confidence: Math.min(confidence, 100),
    reason: reasons.join(", "),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const body = await req.json();
    const { company_id, apply = false } = body;

    if (!company_id) {
      return new Response(JSON.stringify({ error: "company_id erforderlich" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Nicht zugeordnete Einnahmen-Transaktionen laden
    const { data: transactions, error: txError } = await supabase
      .from("transactions")
      .select("id, amount, description, date, type")
      .eq("company_id", company_id)
      .eq("type", "income")
      .is("category", null) // Noch nicht kategorisiert
      .order("date", { ascending: false })
      .limit(200);

    if (txError) throw txError;

    // Offene ausgehende Rechnungen laden (status: sent oder overdue)
    const { data: invoices, error: invError } = await supabase
      .from("invoices")
      .select("id, invoice_number, amount, due_date, status, description")
      .eq("company_id", company_id)
      .eq("type", "outgoing")
      .in("status", ["sent", "overdue"])
      .order("due_date", { ascending: true });

    if (invError) throw invError;

    if (!transactions?.length || !invoices?.length) {
      return new Response(
        JSON.stringify({ matches: [], message: "Keine offenen Rechnungen oder Transaktionen gefunden" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Matching durchführen
    const matches: MatchResult[] = [];
    const usedInvoices = new Set<string>();
    const usedTransactions = new Set<string>();

    // Sortiere Matches nach Konfidenz (beste zuerst)
    const allCandidates: MatchResult[] = [];
    for (const tx of transactions) {
      for (const invoice of invoices) {
        const match = matchTransactionToInvoice(tx as Transaction, invoice as Invoice);
        if (match) allCandidates.push(match);
      }
    }

    allCandidates.sort((a, b) => b.confidence - a.confidence);

    for (const candidate of allCandidates) {
      if (usedTransactions.has(candidate.transaction_id)) continue;
      if (usedInvoices.has(candidate.invoice_id)) continue;
      matches.push(candidate);
      usedTransactions.add(candidate.transaction_id);
      usedInvoices.add(candidate.invoice_id);
    }

    // Wenn apply=true: Matches direkt anwenden
    if (apply && matches.length > 0) {
      const highConfidenceMatches = matches.filter(m => m.confidence >= 70);
      
      for (const match of highConfidenceMatches) {
        // Rechnung als bezahlt markieren
        await supabase
          .from("invoices")
          .update({ status: "paid", updated_at: new Date().toISOString() })
          .eq("id", match.invoice_id);

        // Transaktion mit Rechnung verknüpfen und kategorisieren
        await supabase
          .from("transactions")
          .update({
            category: "Einnahmen",
            updated_at: new Date().toISOString(),
          })
          .eq("id", match.transaction_id);

        // Beleg-Verknüpfung in receipts (falls vorhanden)
        await supabase
          .from("receipts")
          .update({ transaction_id: match.transaction_id })
          .eq("invoice_id", match.invoice_id)
          .is("transaction_id", null);
      }

      return new Response(
        JSON.stringify({
          matches,
          applied: highConfidenceMatches.length,
          message: `${highConfidenceMatches.length} Matches automatisch angewendet (Konfidenz ≥70%)`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ matches, applied: 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Auto-match error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unbekannter Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
