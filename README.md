# 👨‍💼 AutoTeile Admin Dashboard

Administrationsbereich für das AutoTeile WAWI-System mit erweiterten Management-Funktionen.

## 🎯 Features

### **Benutzer-Verwaltung**
- ✅ Benutzer anlegen, bearbeiten, löschen
- ✅ Rollen-Management (Admin, Dealer, Staff)
- ✅ Passwort-Reset
- ✅ Session-Übersicht
- ✅ Aktivitäts-Logs

### **System-Überwachung**
- ✅ Dashboard mit Echtzeit-Statistiken
- ✅ System-Health-Monitoring
- ✅ Performance-Metriken
- ✅ Error-Tracking
- ✅ API-Nutzungsstatistiken

### **Händler-Verwaltung**
- ✅ Händler-Einstellungen konfigurieren
- ✅ Shop-Auswahl verwalten
- ✅ Margen-Konfiguration
- ✅ Sprach-Einstellungen
- ✅ Lieferanten-Management

### **Daten-Management**
- ✅ Bestellungen-Übersicht
- ✅ Angebote-Verwaltung
- ✅ Kunden-Datenbank
- ✅ Nachrichten-Historie
- ✅ Export-Funktionen

### **Einstellungen**
- ✅ System-Konfiguration
- ✅ API-Keys verwalten
- ✅ Webhook-Konfiguration
- ✅ E-Mail-Templates
- ✅ Benachrichtigungen

## 🛠️ Tech Stack

- **React 18.3.1** - UI Framework
- **TypeScript 5.4.5** - Type Safety
- **Material-UI 7.3.5** - Component Library
- **Radix UI** - Accessible Primitives
- **TailwindCSS 4.1.12** - Styling
- **Recharts** - Analytics & Charts
- **React Hook Form** - Form Management
- **Axios** - HTTP Client

## 🚀 Setup

### Voraussetzungen:
- Node.js 18+
- npm oder yarn

### Installation:

```bash
# Repository klonen
git clone https://github.com/nyroxsystems-boop/Autoteile-Admin-Dashboard.git
cd Autoteile-Admin-Dashboard

# Dependencies installieren
npm install

# Development Server starten
npm run dev

# Production Build
npm run build
```

## 📁 Struktur

```
src/
├── app/
│   ├── views/
│   │   ├── AdminDashboardView.tsx    # Haupt-Dashboard
│   │   ├── SettingsView.tsx          # Einstellungen
│   │   ├── StatusView.tsx            # System-Status
│   │   └── ...
│   ├── components/
│   │   ├── UserManagement/           # User-Komponenten
│   │   ├── SystemMonitoring/         # Monitoring
│   │   └── ui/                       # UI-Komponenten
│   ├── hooks/
│   │   ├── useUsers.ts               # User-Hooks
│   │   ├── useSystemStats.ts         # Stats-Hooks
│   │   └── ...
│   └── api/
│       ├── users.ts                  # User-API
│       ├── system.ts                 # System-API
│       └── ...
└── styles/
    ├── index.css
    └── theme.css
```

## 🔐 Authentifizierung

Das Admin-Dashboard verwendet Token-basierte Authentifizierung:

```typescript
// Login
const response = await login({
  email: 'admin@example.com',
  password: 'password'
});

// API-Aufrufe mit Token
const users = await apiFetch('/api/users', {
  headers: {
    'Authorization': `Token ${token}`
  }
});
```

## 📊 Admin-Funktionen

### Benutzer-Management:

```typescript
// Benutzer erstellen
const newUser = await createUser({
  email: 'user@example.com',
  username: 'username',
  password: 'password',
  role: 'staff'
});

// Benutzer aktualisieren
await updateUser(userId, {
  role: 'admin'
});

// Benutzer löschen
await deleteUser(userId);
```

### System-Monitoring:

```typescript
// System-Status abrufen
const status = await getSystemStatus();

// Performance-Metriken
const metrics = await getPerformanceMetrics();

// Error-Logs
const errors = await getErrorLogs();
```

## 🎨 UI-Komponenten

### Dashboard-Karten:

```tsx
<DashboardCard
  title="Benutzer"
  value={userCount}
  trend="+12%"
  icon={<UserIcon />}
/>
```

### Daten-Tabellen:

```tsx
<DataTable
  columns={columns}
  data={users}
  onEdit={handleEdit}
  onDelete={handleDelete}
/>
```

### Formulare:

```tsx
<UserForm
  onSubmit={handleSubmit}
  initialValues={user}
  mode="edit"
/>
```

## 🔧 Konfiguration

### Environment Variables:

```env
VITE_API_BASE_URL=http://localhost:3000
VITE_WAWI_API_TOKEN=your_api_token
VITE_ADMIN_EMAIL=admin@example.com
```

### Theme-Anpassung:

```css
:root {
  --primary-color: #4f8bff;
  --secondary-color: #10b981;
  --background: #f8fbff;
  --foreground: #0f172a;
}
```

## 📈 Analytics

Das Dashboard bietet umfassende Analytics:

- **Benutzer-Aktivität** - Login-Statistiken, Session-Dauer
- **System-Performance** - API-Response-Zeiten, Fehlerquoten
- **Geschäfts-Metriken** - Bestellungen, Umsatz, Margen
- **Trend-Analysen** - Zeitreihen-Diagramme

## 🧪 Testing

```bash
# Unit Tests
npm run test

# E2E Tests
npm run test:e2e

# Coverage
npm run test:coverage
```

## 🔗 API-Integration

Das Admin-Dashboard kommuniziert mit dem Bot-Service:

```
Admin-Dashboard → API Client → Bot-Service → CRM Database
```

Alle API-Endpunkte sind dokumentiert in der [API-Dokumentation](../bot-service/README.md).

## 🚀 Deployment

### Production Build:

```bash
npm run build
```

### Docker:

```bash
docker build -t autoteile-admin .
docker run -p 3000:3000 autoteile-admin
```

## 🔒 Sicherheit

- ✅ Token-basierte Authentifizierung
- ✅ Role-based Access Control (RBAC)
- ✅ Input-Validierung
- ✅ XSS-Schutz
- ✅ CSRF-Schutz
- ✅ Secure Headers

## 📖 Verwandte Repositories

- [Autoteile-bot-service](https://github.com/nyroxsystems-boop/Autoteile-bot-service) - Backend API
- [Autoteile-Dashboard](https://github.com/nyroxsystems-boop/Autoteile-Dashboard) - Händler-Dashboard
- [Autoteile-CRM](https://github.com/nyroxsystems-boop/Autoteile-CRM) - CRM System

## 📄 Lizenz

Proprietary - Alle Rechte vorbehalten

## 👥 Kontakt

Nyrox Systems - https://github.com/nyroxsystems-boop
