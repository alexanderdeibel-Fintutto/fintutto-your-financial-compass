

## Dashboard-Erweiterung: Alles im Blick

Das Dashboard zeigt aktuell 4 KPI-Karten, 2 Charts und 3 Listen. Viele Module der App (SEPA, Kalender, Automatisierung, Bankverbindung, Steuerberater, Belege) sind dort aber nicht reprasentiert. Hier der Plan, um das Dashboard zum echten Cockpit zu machen.

---

### 1. Schnellaktionen modernisieren

Die QuickActions-Komponente am Seitenende ist kaum sichtbar. Stattdessen:

- **Quick Actions in den Header-Bereich verschieben** (neben PeriodSelector), als kompakte Icon-Leiste
- **Weitere Aktionen hinzufuegen**: SEPA-Zahlung erstellen, Bankimport starten, Beleg scannen
- Kontextabhaengig: Im Privatmodus weniger Aktionen zeigen (keine Angebote, Auftraege etc.)

---

### 2. Neue Dashboard-Widgets (dritte Zeile)

Unterhalb der Charts eine neue Widget-Reihe einfuegen mit:

- **Kalender-Widget**: Die naechsten 3-5 anstehenden Termine/Fristen aus `/kalender` anzeigen (faellige Steuern, Zahlungsziele)
- **SEPA-Status-Widget**: Anzahl offener/geplanter SEPA-Zahlungen, naechste Ausfuehrung
- **Wiederkehrende Buchungen-Widget**: Naechste faellige wiederkehrende Buchungen mit Betrag und Datum
- **Offene Belege-Widget erweitern**: Anzahl der unverarbeiteten Belege prominenter darstellen, mit Hinweis "X Belege warten auf Zuordnung"

---

### 3. Bankkonten-Uebersicht als Widget

- Neues Widget das alle Bankkonten mit Name, IBAN (gekuerzt) und aktuellem Saldo auflistet
- Gesamtsaldo ueber alle Konten (ersetzt/ergaenzt die KPI-Karte "Bankguthaben")
- Direktlink zum jeweiligen Konto

---

### 4. Benachrichtigungs-/Aufgaben-Feed

- Kompaktes Widget das die wichtigsten Handlungsbedarfe zusammenfasst:
  - Ueberfaellige Rechnungen (Anzahl + Gesamtbetrag)
  - Unzugeordnete Belege
  - Anstehende SEPA-Zahlungen
  - Faellige wiederkehrende Buchungen
- Jeder Eintrag ist klickbar und fuehrt zur entsprechenden Seite

---

### 5. Layout-Anpassung

Neues Grid-Layout:

```text
+--------------------------------------------------+
| Header + Badge + PeriodSelector + Quick Actions   |
+--------------------------------------------------+
| KPI 1    | KPI 2     | KPI 3      | KPI 4        |
+--------------------------------------------------+
| Einnahmen/Ausgaben Chart | Ausgaben nach Kategorie|
+--------------------------------------------------+
| Bankkonten  | Kalender-    | Aufgaben-/           |
| Uebersicht  | Widget       | Benachrichtigungs-   |
|             |              | Feed                  |
+--------------------------------------------------+
| Letzte       | Faellige     | Offene               |
| Buchungen    | Rechnungen   | Belege               |
+--------------------------------------------------+
```

---

### Technische Details

**Neue Komponenten erstellen:**
- `src/components/dashboard/BankAccountsWidget.tsx` -- liest `bank_accounts`-Tabelle
- `src/components/dashboard/CalendarWidget.tsx` -- liest anstehende Termine
- `src/components/dashboard/SepaWidget.tsx` -- liest SEPA-Zahlungen Status
- `src/components/dashboard/RecurringWidget.tsx` -- liest wiederkehrende Buchungen
- `src/components/dashboard/TaskFeed.tsx` -- aggregiert Handlungsbedarfe aus verschiedenen Tabellen

**Dashboard.tsx anpassen:**
- Quick Actions aus dem Footer in den Header verschieben (compact-Variante)
- Neue Widgets im Grid einbinden
- Daten fuer die neuen Widgets parallel in `fetchDashboardData` laden
- Privatmodus-Filter: Geschaeftsspezifische Widgets (SEPA, Steuerberater) im Privatbereich ausblenden

**Keine Datenbank-Aenderungen noetig** -- alle Widgets lesen aus bestehenden Tabellen (`bank_accounts`, `transactions`, `invoices`, `receipts`, `sepa_payments`).

---

### Reihenfolge der Umsetzung

1. Quick Actions in den Header verschieben
2. Bankkonten-Widget
3. Aufgaben-Feed (aggregierte Handlungsbedarfe)
4. Kalender-Widget
5. Wiederkehrende Buchungen / SEPA-Widget
6. Layout-Feinschliff und Responsive-Anpassung

