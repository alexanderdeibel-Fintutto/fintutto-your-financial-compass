# Roadmap: Financial Compass vs. sevdesk

**Stand:** 25. März 2026
**Ziel:** Den `fintutto-your-financial-compass` so ausbauen, dass er sevdesk für deine eigenen Firmen (und später für andere) vollständig ersetzen kann.

---

## 1. Der Benchmark: Was sevdesk hat und wir (noch) nicht

Ich habe die aktuelle Feature-Liste von sevdesk analysiert und mit dem Code im Repository abgeglichen.

| Feature | sevdesk | Financial Compass (Aktuell) | Was wir tun müssen |
|---------|---------|-----------------------------|--------------------|
| **Multi-Company** | ❌ Nein (1 Account = 1 Firma) | ✅ Ja (Voll integriert) | *Unser größter USP. Nichts zu tun.* |
| **Vermögensverwaltung** | ❌ Nein | ✅ Ja (Immobilien, Assets) | *Zweiter USP. Nichts zu tun.* |
| **KI-Belegerfassung** | ✅ Ja | ⚠️ Ja, aber mit Fallback | Die `analyze-receipt` Edge Function muss robuster werden. |
| **E-Mail Beleg-Inbox** | ✅ Ja | ✅ Ja (`process-email-receipt`) | Funktioniert bereits via Webhook. |
| **Bankanbindung** | ✅ Ja | ⚠️ UI da, Logik fehlt | FinAPI-Integration (`finapi` Edge Function) muss mit dem UI in `BankConnect.tsx` verknüpft werden. |
| **Auto-Matching** | ✅ Ja | ❌ Nein | Logik schreiben: Transaktion (Bank) ↔ Beleg (Receipt) automatisch matchen. |
| **Rechnungen als PDF** | ✅ Ja | ❌ Nein | **Blocker!** Wir müssen eine PDF-Generierung (z.B. mit `jspdf` oder `react-pdf`) in `Invoices.tsx` einbauen. |
| **E-Rechnung (ZUGFeRD)** | ✅ Ja | ❌ Nein | Späteres ToDo (Pflicht ab 2025/2026). |
| **UStVA (Elster)** | ✅ Ja | ⚠️ UI da, API fehlt | Die `Elster.tsx` Seite muss echte XML-Daten an die Elster-Schnittstelle senden. |

---

## 2. Die konkrete Roadmap (Nächste Schritte)

Um deine Abos (Lexoffice/sevdesk) schnellstmöglich kündigen zu können, müssen wir genau **drei Dinge** priorisieren. Alles andere (Elster, ZUGFeRD) kann warten.

### Phase 1: Rechnungen schreiben (Woche 1)
*Ziel: Du kannst rechtsgültige Rechnungen an deine Kunden schicken.*
1. **PDF-Engine einbauen:** Integration von `@react-pdf/renderer` oder `jspdf`.
2. **Rechnungs-Template:** Ein sauberes, professionelles Layout für die PDF-Rechnung erstellen (mit Logo, Bankverbindung, Steuernummer aus den Firmeneinstellungen).
3. **Download & Mail:** Button "Als PDF herunterladen" und "Per E-Mail senden" in `Invoices.tsx` aktivieren.

### Phase 2: Banking & Matching (Woche 2)
*Ziel: Du siehst, wer bezahlt hat und welche Ausgaben abgebucht wurden.*
1. **FinAPI scharfschalten:** Die Mock-Daten in `BankConnect.tsx` entfernen und die echte `finapi` Edge Function anbinden.
2. **Matching-Engine:** Eine Funktion schreiben, die beim Abruf neuer Transaktionen prüft: Stimmt der Betrag (+/- 1%) und das Datum (+/- 5 Tage) mit einer offenen Rechnung oder einem Beleg überein? Wenn ja -> Status auf "Bezahlt" setzen.

### Phase 3: Belege & OCR stabilisieren (Woche 3)
*Ziel: Du wirfst alle Quittungen ins System und musst nichts mehr tippen.*
1. **Bulk-Upload:** Drag & Drop für 10 PDFs gleichzeitig in `Receipts.tsx` ermöglichen.
2. **OCR-Verbesserung:** Sicherstellen, dass die Lovable-API-Anbindung in der Edge Function zuverlässig funktioniert und nicht in den Demo-Fallback rutscht.

---

## 3. Fazit

Dein Repository `fintutto-your-financial-compass` ist **massiv weiter** als ich anfangs dachte. Du hast bereits eine komplette Multi-Company-Architektur, ein E-Mail-Postfach für Belege und eine Vermögensverwaltung, die sevdesk völlig fehlt.

Sobald wir die **PDF-Generierung** und das **Bank-Matching** eingebaut haben, ist die App für deinen Eigenbedarf (Freelancer + GmbHs) absolut produktionsreif.
