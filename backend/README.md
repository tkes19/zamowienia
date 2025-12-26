# Backend - System Zamówień Rezon

## Struktura Projektu (Po Refaktoryzacji)

```
backend/
├── config/
│   └── env.js                    # Konfiguracja środowiskowa
├── modules/
│   ├── auth/
│   │   └── index.js             # Autentykacja i autoryzacja
│   └── sse/
│       └── index.js             # Server-Sent Events
├── services/
│   ├── orderService.js          # Logika biznesowa zamówień
│   ├── productionService.js     # Logika biznesowa produkcji
│   └── pdfService.js            # Generowanie dokumentów PDF
├── tests/
│   ├── setup.js                 # Konfiguracja testów
│   ├── auth.test.js            # Testy autentykacji
│   ├── orders.test.js          # Testy zamówień
│   └── production.test.js      # Testy produkcji
├── server.js                    # Główny plik serwera (legacy)
├── pdfGenerator.js              # Generator PDF (legacy)
├── package.json
├── vitest.config.js
└── .env
```

## Moduły

### Config (`config/env.js`)
Centralna konfiguracja zmiennych środowiskowych:
- PORT, NODE_ENV
- Supabase (URL, klucze)
- Galeria (GALLERY_BASE)
- Auth (cookies, rate limiting)
- Kiosk (ograniczenia sieciowe)
- CORS

**Użycie:**
```javascript
const config = require('./config/env');
console.log(config.PORT); // 3001
console.log(config.isProduction()); // false/true
```

### Auth (`modules/auth/`)
Moduł autentykacji i autoryzacji:
- `parseCookies()` - parsowanie cookies
- `getAuthContext()` - pobieranie userId i role
- `requireRole()` - middleware kontroli dostępu
- `checkLoginAttempts()` - rate limiting
- `setAuthCookies()` / `clearAuthCookies()` - zarządzanie sesją

**Użycie:**
```javascript
const { requireRole, getAuthContext } = require('./modules/auth');

// Middleware
app.get('/api/admin/users', requireRole(['ADMIN']), async (req, res) => {
  const { userId } = await getAuthContext(req);
  // ...
});

// W handlerze
const { userId, role } = await getAuthContext(req);
```

### SSE (`modules/sse/`)
Moduł Server-Sent Events dla real-time:
- `broadcastEvent()` - wysyłanie zdarzeń
- `createSSEHandler()` - middleware dla endpoint
- `getClientCount()` - monitoring połączeń

**Użycie:**
```javascript
const { broadcastEvent, createSSEHandler } = require('./modules/sse');

// Endpoint SSE
app.get('/api/events', requireRole([...]), createSSEHandler());

// Broadcast zdarzenia
broadcastEvent({ type: 'orderStatusChanged', orderId: '123' });
```

### Services

#### Order Service (`services/orderService.js`)
Logika biznesowa zamówień:
- `generateOrderNumber()` - generowanie numerów zamówień
- `validateOrderData()` - walidacja danych
- `calculateOrderTotal()` - obliczanie sum
- `canEditOrder()` / `canViewOrder()` - kontrola dostępu
- `validateStatusTransition()` - walidacja przejść statusów

#### Production Service (`services/productionService.js`)
Logika biznesowa produkcji:
- `computeProductionStatusForOrder()` - status produkcji
- `parseProductionPathExpression()` - parsowanie ścieżek
- `normalizeProjectViewUrl()` - normalizacja URL-i

#### PDF Service (`services/pdfService.js`)
Generowanie dokumentów PDF:
- `generateWorkOrderPDF()` - zlecenia produkcyjne
- `generateGraphicsTaskPDF()` - zadania graficzne
- `generatePackingListPDF()` - listy kompletacyjne
- `logPrintAudit()` - audyt druku

## Testy

### Uruchamianie testów

```bash
# Wszystkie testy
npm test

# Tryb watch
npm run test:watch

# Z pokryciem kodu
npm run test:coverage
```

### Struktura testów

- `tests/setup.js` - konfiguracja środowiska testowego
- `tests/auth.test.js` - testy endpointów autentykacji
- `tests/orders.test.js` - testy endpointów zamówień
- `tests/production.test.js` - testy endpointów produkcji

### Pisanie testów

```javascript
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

describe('My Feature', () => {
  let app;

  beforeAll(() => {
    app = require('../server.js');
  });

  it('should return 401 when unauthorized', async () => {
    const response = await request(app)
      .get('/api/my-endpoint');

    expect(response.status).toBe(401);
  });
});
```

## CI/CD

GitHub Actions automatycznie uruchamia testy przy każdym push/PR:
- `.github/workflows/test.yml`
- Testy na Node 18.x i 20.x
- Raport pokrycia kodu (Codecov)

## Migracja z Legacy

### Przed refaktoryzacją
```javascript
// server.js (13k linii)
const PORT = process.env.PORT || 3001;
// ... 13k linii kodu ...
```

### Po refaktoryzacji
```javascript
// config/env.js
const config = { PORT: process.env.PORT || 3001, ... };

// server.js
const config = require('./config/env');
const { requireRole } = require('./modules/auth');
const orderService = require('./services/orderService');
```

## Najlepsze Praktyki

1. **Importuj moduły, nie kopiuj kodu**
   ```javascript
   // ✅ Dobrze
   const { requireRole } = require('./modules/auth');
   
   // ❌ Źle
   function requireRole(...) { /* kopiowanie kodu */ }
   ```

2. **Używaj serwisów dla logiki biznesowej**
   ```javascript
   // ✅ Dobrze
   const orderNumber = await orderService.generateOrderNumber(supabase, userId);
   
   // ❌ Źle
   const orderNumber = /* inline logika generowania */
   ```

3. **Testuj każdą nową funkcję**
   ```javascript
   // Dodaj test do odpowiedniego pliku w tests/
   it('should generate unique order number', async () => {
     // ...
   });
   ```

4. **Dokumentuj publiczne API**
   ```javascript
   /**
    * Generuje numer zamówienia w formacie YYYY/N/SHORTCODE
    * @param {Object} supabase - Klient Supabase
    * @param {string} userId - ID użytkownika
    * @returns {Promise<string>} Numer zamówienia
    */
   async function generateOrderNumber(supabase, userId) {
     // ...
   }
   ```

## Troubleshooting

### Testy nie działają
```bash
# Sprawdź czy zainstalowano zależności
npm install

# Sprawdź zmienne środowiskowe
cat .env
```

### Import errors
```bash
# Upewnij się że używasz CommonJS (require), nie ES modules
# server.js używa module.exports, nie export default
```

### SSE nie łączy się
```bash
# Sprawdź czy endpoint /api/events jest dostępny
curl http://localhost:3001/api/events

# Sprawdź logi serwera
```

## Roadmap

- [ ] Dokończenie migracji wszystkich endpointów do routes/
- [ ] Utworzenie app.js jako głównej aplikacji Express
- [ ] Refaktoryzacja frontendu produkcji
- [ ] Testy E2E (Playwright)
- [ ] Dokumentacja API (Swagger/OpenAPI)

## Kontakt

W razie pytań sprawdź:
- `docs/REFACTORING_LOG.md` - szczegółowy log zmian
- `docs/SPEC.md` - specyfikacja techniczna
- `docs/roadmap.md` - plan rozwoju
