# Feature-Inventar: Fintutto Financial Compass

**Stand:** 25. März 2026
**Repository:** `fintutto-your-financial-compass`

Dieses Dokument analysiert den aktuellen Zustand der App, basierend auf dem Code im Repository. Es zeigt, was bereits funktioniert, was nur ein UI-Prototyp ist und was noch fehlt.

---

## 1. Kern-Architektur & Multi-Company

Die App ist von Grund auf für **Multi-Company** (mehrere Firmen/Gewerbe) ausgelegt. Das ist ein massiver Vorteil gegenüber vielen Wettbewerbern.

- **Vorhanden & Funktionierend:**
  - `CompanyContext.tsx`: Lädt alle Firmen des Nutzers, unterscheidet zwischen `is_personal` (Privat) und Business.
  - **Company Switcher:** In der Sidebar integriert. Wechselt den globalen State, sodass alle Dashboards und Listen nur die Daten der aktiven Firma zeigen.
  - **Datenbank:** Alle wichtigen Tabellen (`receipts`, `transactions`, `invoices`) haben eine `company_id`.
  - **RLS (Row Level Security):** Supabase-Policies stellen sicher, dass man nur Daten der eigenen Firmen sieht.

## 2. Belege & OCR (Receipts)

- **Vorhanden & Funktionierend:**
  - `Receipts.tsx`: Übersicht aller Belege.
  - **KI-Analyse:** `useAIAnalysis.ts` ruft die Edge Function `analyze-receipt` auf. Diese nutzt die Lovable API (wahrscheinlich OpenAI Vision), um Lieferant, Datum, Betrag und Steuer auszulesen.
  - **E-Mail-Inbox:** Edge Function `process-email-receipt` existiert. Belege können per E-Mail an eine spezielle Adresse gesendet werden und landen automatisch im System.
- **Was fehlt / unvollständig ist:**
  - Der Fallback in `useAIAnalysis.ts` generiert Demo-Daten, wenn die API fehlschlägt. Das muss für Produktion robuster werden.
  - Bulk-Upload (mehrere Belege gleichzeitig per Drag & Drop) ist im UI noch nicht optimal gelöst.

## 3. Banking & Transaktionen

- **Vorhanden & Funktionierend:**
  - `BankConnect.tsx` & `BankAccounts.tsx`: UI für die Bankanbindung.
  - **FinAPI Integration:** Edge Function `finapi` existiert und kann theoretisch Konten verbinden und Transaktionen abrufen.
  - **PDF-Import:** Edge Function `parse-bank-pdf` existiert. Erlaubt den Import von Kontoauszügen als PDF, falls FinAPI nicht genutzt wird.
  - `Transactions.tsx`: Liste der Buchungen mit Filter- und Suchfunktion.
- **Was fehlt / unvollständig ist:**
  - **Automatisches Matching:** Die Logik, die eine Banktransaktion (z.B. -119€ Telekom) automatisch mit einem Beleg (Telekom Rechnung 119€) verknüpft, ist noch rudimentär.
  - In `BankConnect.tsx` werden aktuell noch Mock-Daten (`mockConnections`) für die UI-Anzeige verwendet. Die echte Datenbank-Anbindung für den Status fehlt hier teilweise.

## 4. Rechnungsstellung (Invoices)

- **Vorhanden & Funktionierend:**
  - `Invoices.tsx`: Liste der Ausgangsrechnungen.
  - `CreateInvoiceDialog.tsx`: UI zum Erstellen einer Rechnung mit Positionen (Line Items).
- **Was fehlt / unvollständig ist:**
  - **PDF-Generierung:** Es gibt noch keine Funktion, die aus den Rechnungsdaten ein echtes, GoBD-konformes PDF erzeugt.
  - **E-Mail-Versand:** Rechnungen direkt aus dem System an den Kunden senden.
  - **ZUGFeRD / XRechnung:** Für B2B ab 2025/2026 Pflicht, aktuell nicht implementiert.

## 5. Steuern & Elster

- **Vorhanden & Funktionierend:**
  - `Elster.tsx`: Sehr umfangreiche Seite (683 Zeilen) für die Steuervoranmeldung.
  - `TaxAdvisorPortal.tsx`: Portal für den Steuerberater.
- **Was fehlt / unvollständig ist:**
  - Die echte Elster-Schnittstelle (ERiC) ist extrem komplex. Aktuell ist dies primär ein UI-Prototyp, der die Zahlen aus den Transaktionen aggregiert, aber nicht direkt an das Finanzamt sendet.

## 6. Vermögensverwaltung (Assets)

- **Vorhanden & Funktionierend:**
  - Eigener Bereich für Immobilien, Gesellschaften, Investment Assets, Versicherungen und Fahrzeuge.
  - Sehr detaillierte UI-Komponenten für die Erfassung.
- **Bewertung:**
  - Dies ist ein starker USP. sevdesk oder Lexoffice haben keine Vermögensverwaltung. Für dich als GF und Immobilienbesitzer ist das extrem wertvoll.

---

## Zusammenfassung

Die App ist **kein** leerer Prototyp. Die Architektur (Multi-Company, Supabase, Edge Functions für OCR und FinAPI) ist solide und zu 80% fertig. 

Die größten Baustellen für einen produktiven Einsatz sind:
1. **PDF-Rechnungsgenerierung** (Blocker für Ausgangsrechnungen).
2. **Echtes Bank-Matching** (Verknüpfung von Transaktion und Beleg).
3. **Entfernen von Mock-Daten** in den Bank- und Dashboard-Ansichten.
