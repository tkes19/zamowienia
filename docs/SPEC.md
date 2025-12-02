# SPEC – Specyfikacja techniczna systemu zamówień

## 1. Wizja i cel

System zamówień "Rezon" to aplikacja B2B do obsługi sprzedaży pamiątek i gadżetów. Łączy strukturę bazy danych Supabase z logiką biznesową, adaptując ją do stacku: **Node.js (Express) + Vanilla JS + Supabase**.

**Kluczowe założenie:** Rezygnacja z ORM (Prisma) na rzecz czystego klienta Supabase oraz przeniesienie ciężaru logiki do bazy danych (PostgreSQL).

---

## 2. Stack technologiczny

| Warstwa | Technologia |
|---------|-------------|
| **Backend** | Node.js, Express.js |
| **Baza danych** | Supabase (PostgreSQL) |
| **Frontend** | HTML5, CSS3, Vanilla JavaScript (ES6+ Modules) |
| **Integracje** | QNAP (Galeria zdjęć) |
| **Auth** | Supabase Auth + cookies (`auth_id`, `auth_role`) |

---

## 3. Struktura projektu

```
ZAMÓWIENIA/
├── backend/
│   ├── server.js              # Główny serwer Express
│   ├── .env                   # Zmienne środowiskowe
│   └── migrations/            # Migracje SQL
├── scripts/
│   ├── app.js                 # Główna logika frontendu
│   └── orders.js              # Moduł zamówień
├── docs/                      # Dokumentacja
│   ├── SPEC.md                 # Ten plik
│   ├── USER_MANUAL.md          # Podręcznik użytkownika
│   ├── SPEC_FOLDER_ACCESS.md   # Specyfikacja folderów KI
│   ├── SPEC_PRODUCTION_PANEL.md # Specyfikacja Panelu Produkcyjnego
│   └── GLOSSARY_PRODUCTION.md   # Słownik terminologii produkcyjnej
├── index.html                 # Formularz zamówień
├── orders.html                # Widok zamówień
├── clients.html               # Panel klientów
└── README.md                  # Szybki start
```

---

## 4. Role użytkowników

| Rola | Opis | Klienci | Zamówienia | Magazyn |
|------|------|---------|------------|---------|
| `ADMIN` | Administrator systemu | Pełny CRUD | Pełny dostęp | Pełny dostęp |
| `SALES_REP` | Handlowiec terenowy | Tylko swoi | Tylko swoje | Podgląd |
| `SALES_DEPT` | Dział sprzedaży | Wszyscy | Wszystkie | Podgląd |
| `WAREHOUSE` | Magazyn | Brak | Podgląd + wysyłka | Pełny dostęp |
| `PRODUCTION` | Produkcja | Brak | Podgląd + status | Podgląd |
| `GRAPHICS` | Grafik | Brak | Podgląd projektów | Brak |
| `MANAGEMENT` | Właściciel (read-only) | Podgląd | Podgląd | Podgląd |
| `CLIENT` | Klient zewnętrzny | Brak | Tylko swoje | Brak |
| `NEW_USER` | Nowe konto | Brak | Brak | Brak |

---

## 5. Model danych (główne tabele)

### 5.1. Użytkownicy i uprawnienia

```sql
-- Użytkownicy
User (id, email, name, shortCode, role, password, createdAt, updatedAt)

-- Przypisania folderów KI
UserFolderAccess (id, userId, folderName, isActive, assignedBy, notes, createdAt)
UserFolderAccessLog (id, accessId, action, changedBy, changedAt, oldValues, newValues)

-- Przypisania miejscowości PM
UserCityAccess (id, userId, cityName, isActive, createdBy, createdAt, updatedAt)
UserCityAccessLog (id, accessId, action, changedBy, changedAt, oldValues, newValues)

-- Ulubione
UserFavorites (id, userId, type, itemId, displayName, metadata, createdAt)
```

### 5.2. Zamówienia

```sql
-- Zamówienia
Order (id, orderNumber, customerId, userId, status, total, notes, createdAt, updatedAt)
OrderItem (id, orderId, productId, quantity, unitPrice, selectedProjects, source, locationName)

-- Historia statusów
OrderStatusHistory (id, orderId, oldStatus, newStatus, changedBy, changedAt, notes)

-- Drafty (koszyk)
order_drafts (id, userId, customerId, createdAt, updatedAt)
order_draft_items (id, draftId, productId, quantity, unitPrice, selectedProjects)

-- Szablony
order_templates (id, ownerId, name, description, visibility, tags, usageCount)
order_template_items (id, templateId, productId, quantity, unitPrice, selectedProjects)
```

### 5.3. Produkty i magazyn

```sql
Product (id, identifier, index, name, category, price, imageUrl)
Inventory (id, productId, stock, stockReserved, stockOrdered, reorderPoint)
Customer (id, name, email, phone, address, city, salesRepId)
```

---

### 5.4. Produkcja i grafika (wysoki poziom)

Szczegółowy model danych Panelu Produkcyjnego opisany jest w
`docs/SPEC_PRODUCTION_PANEL.md` (sekcje 2–3 oraz 9). Dla spójności architektury
warto znać główne tabele:

```sql
-- Zlecenia produkcyjne
ProductionOrder (id, orderNumber, sourceOrderId, productId, quantity, status, ...)

-- Operacje produkcyjne
ProductionOperation (id, productionOrderId, operationNumber, operationType, status, ...)

-- Zadania grafiki
GraphicTask (
  id, orderId, orderItemId, status, priority, dueDate, assignedTo,
  galleryContext, filesLocation, projectNumbers, checklist,
  approvalRequired, approvalStatus, createdBy, createdAt, updatedAt
)
```

Rozszerzenia tabeli `Order` i (opcjonalnie) `OrderItem` pod moduł grafiki
opisane są w `docs/SPEC_PRODUCTION_PANEL.md` (sekcja 9.2) i będą wdrażane w
ramach wersji v2.x systemu.

---

## 6. API Endpoints

### 6.1. Autentykacja

| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/api/auth/login` | POST | Logowanie |
| `/api/auth/logout` | POST | Wylogowanie |
| `/api/auth/me` | GET | Dane zalogowanego użytkownika |
| `/api/auth/sync-role` | POST | Synchronizacja roli z cookies |

### 6.2. Zamówienia

| Endpoint | Metoda | Opis | Role |
|----------|--------|------|------|
| `/api/orders` | GET | Lista zamówień | Wszystkie |
| `/api/orders/:id` | GET | Szczegóły zamówienia | Wszystkie |
| `/api/orders` | POST | Nowe zamówienie | SALES_REP, SALES_DEPT, ADMIN |
| `/api/orders/:id` | PATCH | Edycja notatek | SALES_DEPT, ADMIN |
| `/api/orders/:id/status` | PATCH | Zmiana statusu | Zależne od roli |
| `/api/orders/:id/history` | GET | Historia zmian | Wszystkie |

### 6.3. Galeria (proxy do QNAP)

| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/api/gallery/cities` | GET | Lista miejscowości (z filtrowaniem) |
| `/api/gallery/salespeople` | GET | Lista handlowców KI |
| `/api/gallery/objects/:salesperson` | GET | Obiekty handlowca |
| `/api/gallery/products/:city` | GET | Produkty dla miejscowości |

### 6.4. Przypisania miejscowości (PM)

| Endpoint | Metoda | Opis | Role |
|----------|--------|------|------|
| `/api/admin/user-city-access` | GET | Lista przypisań | ADMIN, SALES_DEPT |
| `/api/admin/user-city-access` | POST | Nowe przypisanie | ADMIN, SALES_DEPT |
| `/api/admin/user-city-access/:id` | PATCH | Aktualizacja | ADMIN, SALES_DEPT |
| `/api/admin/user-city-access/:id` | DELETE | Usunięcie | ADMIN |
| `/api/user-city-access` | GET | Moje przypisania | Zalogowani |

### 6.5. Ulubione

| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/api/favorites` | GET | Lista ulubionych (zwraca `data`) |
| `/api/favorites` | POST | Dodaj (wymaga: type, itemId, displayName) |
| `/api/favorites/:type/:itemId` | DELETE | Usuń z ulubionych |

---

## 7. Workflow zamówień

### 7.1. Statusy

1. **PENDING** – Oczekujące (utworzone przez handlowca)
2. **APPROVED** – Zatwierdzone (przez dział sprzedaży)
3. **IN_PRODUCTION** – W produkcji
4. **READY** – Gotowe do wysyłki
5. **SHIPPED** – Wysłane
6. **DELIVERED** – Dostarczone (status końcowy)
7. **CANCELLED** – Anulowane (status końcowy)

### 7.2. Dozwolone przejścia

| Rola | Dozwolone przejścia |
|------|---------------------|
| SALES_REP | PENDING → CANCELLED |
| SALES_DEPT | PENDING → APPROVED, APPROVED → IN_PRODUCTION, SHIPPED → DELIVERED, * → CANCELLED |
| PRODUCTION | APPROVED → IN_PRODUCTION, IN_PRODUCTION → READY |
| WAREHOUSE | READY → SHIPPED |
| ADMIN | Wszystkie przejścia |

---

## 8. Moduł przypisywania miejscowości (PM)

### 8.1. Logika filtrowania

- **ADMIN/SALES_DEPT:** Widzą wszystkie miejscowości
- **SALES_REP/CLIENT z przypisaniami:** Widzą tylko przypisane + mogą przełączyć na "wszystkie" (podgląd)
- **SALES_REP/CLIENT bez przypisań:** Widzą wszystkie w trybie readOnly

### 8.2. Ulubione miejscowości

- Limit: 12 pozycji na użytkownika
- Typy: `city`, `ki_object`
- UI: Pasek ulubionych + gwiazdka przy dropdownie

### 8.3. Przełącznik widoku

- "pokaż wszystkie" – wszystkie miejscowości (podgląd)
- "tylko moje" – tylko przypisane miejscowości

---

## 9. Moduł przypisywania folderów KI

Szczegóły w `docs/SPEC_FOLDER_ACCESS.md`.

- Tabela `UserFolderAccess` – przypisania folderów do użytkowników
- Panel admina "Foldery KI" z tabelą, filtrami, modalem
- Audyt zmian w `UserFolderAccessLog`

---

## 10. Bezpieczeństwo

### 10.1. Autentykacja
- Supabase Auth z JWT tokens
- Cookies: `auth_id`, `auth_role`
- Middleware `requireRole()` w Express

### 10.2. Autoryzacja
- RLS (Row Level Security) w Supabase
- Sprawdzanie ról na poziomie endpointów
- Weryfikacja ownership danych

### 10.3. Walidacja
- Walidacja inputów po stronie backendu
- Sanitizacja danych
- Ochrona przed SQL injection (parametryzowane zapytania)

---

## 11. Wytyczne implementacyjne

1. **SQL First** – Nie ściągaj całej bazy do Node.js. Rób filtrowanie w SQL.
2. **Bezpieczeństwo** – Nigdy nie zwracaj `User.password`. Używaj `SUPABASE_SERVICE_ROLE_KEY` tylko w backendzie.
3. **Frontend UX** – Zachowaj szybkość interfejsu. Dodawaj funkcje jako warstwy.
4. **Migracja z SOURCE 2** – Patrz do `SOURCE 2/.../lib/types.ts` po definicje statusów.

---

## 12. Zmienne środowiskowe

```env
# Wymagane
PORT=3001
NODE_ENV=development
GALLERY_BASE=http://rezon.myqnapcloud.com:81/home
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx

# Opcjonalne (email)
SMTP_HOST=...
SMTP_PORT=...
SMTP_USER=...
SMTP_PASS=...
```

---

**Wersja dokumentu:** 2.0  
**Data aktualizacji:** 2025-11-30
