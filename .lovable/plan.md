

## Entfernung des Übergabe-Moduls

Da die App alle Vermögensarten **ausser Immobilien** verwaltet, wird das Wohnungsübergabe-Modul komplett entfernt.

### Betroffene Bereiche

**1. Sidebar-Navigation** (`src/components/layout/AppSidebar.tsx`)
- Zeile 93 entfernen: `{ title: 'Übergaben', url: '/uebergabe', icon: ClipboardCheck }`
- Den nicht mehr benötigten Import `ClipboardCheck` aus den Lucide-Icons entfernen

**2. Mobile Navigation** (`src/components/layout/MobileBottomNav.tsx`)
- Zeile 35 entfernen: `{ title: 'Übergaben', url: '/uebergabe' }`

**3. Breadcrumb-Navigation** (`src/components/layout/HeaderBreadcrumb.tsx`)
- Zeile 56 entfernen: `'/uebergabe': { label: 'Übergabe', icon: FolderOutput }`
- Den nicht mehr benötigten Import `FolderOutput` entfernen

**4. Routing** (`src/App.tsx`)
- Zeile 100 entfernen: Route `/uebergabe` mit der Handover-Komponente
- Zeile 25 entfernen: Import von `Handover`

### Nicht entfernt (vorerst)

Die Datei `src/pages/Handover.tsx` und zugehoerige Komponenten bleiben im Projekt bestehen, sind aber nicht mehr erreichbar. Sie koennen bei Bedarf spaeter manuell geloescht werden.

