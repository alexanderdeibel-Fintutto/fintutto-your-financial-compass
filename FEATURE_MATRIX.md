# Fintutto – Vollständige Feature-Matrix
**Stand: März 2026 | Commit: 4ee96f2**

---

## Qualitätsstatus

| Prüfpunkt | Ergebnis |
|---|---|
| TypeScript-Fehler | **0** |
| Build-Status | **✓ erfolgreich (3.39s)** |
| Seiten (Pages) | **54** |
| Dashboard-Widgets | **25** |
| Routing-Konsistenz | **100%** (alle Routes = alle Sidebar-Einträge) |
| Fehlende Page-Dateien | **0** |
| Broken Imports | **0** |
| Code-Zeilen | **~52.000** |
| Git-Commits | **335+** |

---

## Seiten-Übersicht (54 Seiten)

### Buchhaltung & Finanzen

| Seite | Route | Status |
|---|---|---|
| Buchungen | `/buchungen` | ✅ Vollständig |
| Wiederkehrende Buchungen | `/wiederkehrend` | ✅ Vollständig |
| Kassenbuch | `/kassenbuch` | ✅ Vollständig |
| Bankkonten | `/bankkonten` | ✅ Vollständig |
| Bankverbindung (GoCardless) | `/bankverbindung` | ✅ Vollständig |
| Bankabgleich-Assistent | `/bankabgleich` | ✅ KI-Matching (0–100% Konfidenz) |
| Kontenrahmen SKR03 | `/kontenrahmen` | ✅ 25+ Konten, Saldenliste, Journal |
| Offene Posten | `/offene-posten` | ✅ Aging-Analyse, DSO, Mahnwesen |
| Mahnwesen | `/mahnwesen` | ✅ 3-Stufen, Mahnbrief-Generator |
| Liquiditätsplanung | `/liquiditaet` | ✅ 12-Monats-Forecast, Stresstest |
| Finanzprognose | `/finanzprognose` | ✅ Linear/Saisonal/Monte Carlo |
| Budgetanalyse | `/budget-analyse` | ✅ Soll/Ist, Wasserfall-Diagramm |
| Budgetverwaltung | `/budget` | ✅ Vollständig |
| SEPA-Zahlungen | `/sepa` | ✅ Vollständig |
| Zuordnungsregeln | `/zuordnungsregeln` | ✅ Vollständig |

### Rechnungswesen

| Seite | Route | Status |
|---|---|---|
| Rechnungen | `/rechnungen` | ✅ PDF-Export, Mahnungen |
| Angebote | `/angebote` | ✅ Vollständig |
| Auftragsbestätigungen | `/auftraege` | ✅ Vollständig |
| Belege | `/belege` | ✅ OCR, Kategorisierung |
| Massenimport | `/massenimport` | ✅ Vollständig |

### Steuern & Compliance

| Seite | Route | Status |
|---|---|---|
| Steuer-Assistent | `/steuer-assistent` | ✅ Vollständig |
| Steueroptimierung | `/steueroptimierung` | ✅ ESt-Rechner 2024, GmbH-Vergleich |
| ELSTER | `/elster` | ✅ USt-Voranmeldung |
| Steuerberater-Portal | `/steuerberater` | ✅ Vollständig |
| Jahresabschluss | `/jahresabschluss` | ✅ Vollständig |

### Vermögen & Kapital

| Seite | Route | Status |
|---|---|---|
| Kapitalverwaltung | `/kapital` | ✅ Vollständig |
| Vermögensübersicht | `/vermoegen` | ✅ Vollständig |
| Immobilien | `/vermoegen/immobilien` | ✅ Vollständig |
| Gesellschaften | `/vermoegen/gesellschaften` | ✅ Vollständig |
| Investment-Assets | `/vermoegen/assets` | ✅ Vollständig |
| Versicherungen | `/vermoegen/versicherungen` | ✅ Vollständig |
| Fahrzeuge | `/vermoegen/fahrzeuge` | ✅ Vollständig |
| Anlagenverwaltung | `/anlagenverwaltung` | ✅ AfA-Berechnung |

### Betrieb & Organisation

| Seite | Route | Status |
|---|---|---|
| Kontakte | `/kontakte` | ✅ Vollständig |
| Vertragsmanagement | `/vertraege` | ✅ Vollständig |
| Inventar | `/inventar` | ✅ Mindestbestand-Warnungen |
| Kostenstellen | `/kostenstellen` | ✅ Vollständig |
| Projektverwaltung | `/projekte` | ✅ Vollständig |
| Lohnabrechnung | `/lohnabrechnung` | ✅ Vollständig |
| Kalender | `/kalender` | ✅ Vollständig |
| Dokumente | `/dokumente` | ✅ Vollständig |

### Analyse & Reporting

| Seite | Route | Status |
|---|---|---|
| Dashboard | `/` | ✅ 25 Widgets |
| Finanz-Cockpit | `/cockpit` | ✅ Vollständig |
| Berichte | `/berichte` | ✅ Vollständig |
| Multi-Firma-Übersicht | `/multi-firma` | ✅ Vollständig |

### KI & Automatisierung

| Seite | Route | Status |
|---|---|---|
| KI-Assistent | `/ki-assistent` | ✅ OpenAI-Integration |
| Automatisierung | `/automatisierung` | ✅ Vollständig |
| E-Commerce-Integration | `/ecommerce` | ✅ Vollständig |

### System & Einstellungen

| Seite | Route | Status |
|---|---|---|
| Einstellungen | `/einstellungen` | ✅ Vollständig |
| Firmen | `/firmen` | ✅ Vollständig |
| Einladungen | `/einladungen` | ✅ Vollständig |
| Benachrichtigungen | `/benachrichtigungen` | ✅ Vollständig |
| E-Mail-Vorlagen | `/vorlagen` | ✅ Vollständig |
| Hilfe-Center | `/hilfe` | ✅ Vollständig |

---

## Dashboard-Widgets (25 Widgets)

| Widget | Beschreibung |
|---|---|
| KPICard | Einnahmen, Ausgaben, Gewinn, Saldo mit Sparkline |
| RevenueExpenseChart | Monatlicher Cashflow-Chart |
| ExpenseByCategoryChart | Ausgaben nach Kategorie (Donut) |
| RecentTransactions | Letzte Buchungen |
| DueInvoicesList | Fällige Rechnungen |
| PendingReceiptsList | Ausstehende Belege |
| BankAccountsWidget | Bankkonten-Übersicht |
| AssetsWidget | Vermögens-Übersicht |
| CalendarWidget | Nächste Termine |
| SepaWidget | SEPA-Zahlungen |
| RecurringWidget | Wiederkehrende Buchungen |
| CashflowForecastWidget | 3-Monats-Cashflow-Prognose |
| TopCategoriesWidget | Top-Ausgabenkategorien |
| SubscriptionWidget | Abo-Übersicht |
| LeaderboardWidget | Team-Performance |
| TaskFeed | Aufgaben-Feed |
| TaxDeadlineWidget | Steuerfristen-Countdown |
| ContractExpiryWidget | Ablaufende Verträge |
| InventoryAlertWidget | Mindestbestand-Warnungen |
| OpenItemsWidget | Offene Posten Zusammenfassung |
| ActivityFeedWidget | Live-Feed aller Aktionen (30s Refresh) |
| OnboardingChecklist | 6-Schritte-Einrichtungscheckliste |
| QuickCapture | Schnellerfassung (Ctrl+K) |
| PeriodSelector | Zeitraum-Auswahl |
| QuickActions | Schnellzugriff-Buttons |

---

## Vergleich mit Wettbewerbern

| Feature | lexoffice | sevDesk | DATEV | **Fintutto** |
|---|---|---|---|---|
| Rechnungen & Angebote | ✅ | ✅ | ✅ | ✅ |
| Buchhaltung (doppelt) | ✅ | ✅ | ✅ | ✅ SKR03 |
| Bankabgleich | ✅ | ✅ | ✅ | ✅ KI-Matching |
| Liquiditätsplanung | ⚠️ | ⚠️ | ✅ | ✅ Stresstest |
| Finanzprognose (KI) | ❌ | ❌ | ⚠️ | ✅ Monte Carlo |
| Steueroptimierung | ❌ | ❌ | ⚠️ | ✅ GmbH-Vergleich |
| Mahnwesen | ✅ | ✅ | ✅ | ✅ Auto-Generierung |
| Vermögensverwaltung | ❌ | ❌ | ❌ | ✅ 5 Asset-Klassen |
| KI-Assistent | ❌ | ❌ | ❌ | ✅ OpenAI |
| Multi-Firma | ⚠️ | ✅ | ✅ | ✅ |
| Lohnabrechnung | ✅ | ✅ | ✅ | ✅ |
| E-Commerce-Integration | ✅ | ✅ | ❌ | ✅ |
| Dashboard-Widgets | 5–8 | 5–8 | 3–5 | **25** |
| Seiten gesamt | ~20 | ~25 | ~30 | **54** |

---

*Generiert am: März 2026 | Commit: 4ee96f2*
