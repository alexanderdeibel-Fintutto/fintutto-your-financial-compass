
# Fehleranalyse: Neue Firma kann nicht erstellt werden

## Das Problem

Beim Erstellen einer neuen Firma erscheint der Fehler "Die Firma konnte nicht erstellt werden" (Datenbankfehler 42501 - RLS-Verletzung).

## Ursache

Der **Datenbank-Trigger fehlt**! Es gibt zwar eine Funktion `handle_new_company()`, die beim Erstellen einer Firma automatisch einen Eintrag in der `company_members`-Tabelle anlegen soll -- aber der Trigger, der diese Funktion aufruft, wurde nie erstellt oder ging verloren.

Das fuehrt zu folgendem Ablauf:

1. Der Code fuegt eine neue Firma in die `companies`-Tabelle ein
2. Gleichzeitig versucht er, die eingefuegte Firma zurueckzulesen (`.select()`)
3. Zum Lesen wird geprueft: "Ist der Nutzer Mitglied dieser Firma?" (`is_company_member`)
4. Da kein Trigger existiert, wurde kein Mitgliedschafts-Eintrag erstellt
5. Die Pruefung schlaegt fehl und die gesamte Operation wird abgelehnt

Die erste Firma "Fintutto" wurde vermutlich erstellt, als die Datenbank noch anders konfiguriert war.

## Loesung

### Schritt 1: Fehlenden Trigger erstellen

Ein `AFTER INSERT`-Trigger wird auf der `companies`-Tabelle erstellt, der die bereits vorhandene `handle_new_company()`-Funktion aufruft. Diese Funktion traegt den Ersteller automatisch als "owner" in die `company_members`-Tabelle ein.

### Schritt 2: Code absichern (Fallback)

Zusaetzlich wird der Code in `NewCompanyDialog.tsx` mit einem Fallback versehen: Falls der Trigger aus irgendeinem Grund nicht greift, erstellt der Code die Mitgliedschaft manuell. Das macht das System robuster.

---

## Technische Details

### Datenbank-Migration (SQL)

```sql
CREATE TRIGGER on_company_created
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_company();
```

### Code-Aenderung in `NewCompanyDialog.tsx`

Nach dem erfolgreichen `INSERT` in `companies` wird geprueft, ob der `company_members`-Eintrag existiert. Falls nicht (z.B. weil der Trigger fehlte), wird er manuell erstellt:

```typescript
// Nach dem INSERT: Pruefen ob Mitgliedschaft existiert
const { data: membership } = await supabase
  .from('company_members')
  .select('id')
  .eq('company_id', company.id)
  .eq('user_id', user.id)
  .maybeSingle();

if (!membership) {
  await supabase.from('company_members').insert({
    company_id: company.id,
    user_id: user.id,
    role: 'owner',
  });
}
```

### Betroffene Dateien

- **Datenbank**: Neuer Trigger `on_company_created`
- **`src/components/company/NewCompanyDialog.tsx`**: Fallback-Logik fuer Mitgliedschaft
