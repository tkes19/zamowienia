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

### 4.1. Nawigacja globalna i dostęp do widoków

System używa wspólnej belki nawigacyjnej widocznej na wszystkich głównych stronach. Linki są filtrowane na podstawie roli użytkownika.

#### Tabela dostępu do widoków

| Widok | ADMIN | SALES_DEPT | SALES_REP | PRODUCTION/OPERATOR | PRODUCTION_MANAGER | GRAPHICS | WAREHOUSE |
|-------|-------|------------|-----------|---------------------|-------------------|----------|-----------|
| Formularz (`/`) | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Zamówienia (`/orders`) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Klienci (`/clients`) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Produkcja (`/production`) | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ |
| Grafika (`/graphics.html`) | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ |
| Admin (`/admin`) | ✅ | ✅ (częściowo) | ❌ | ❌ | ❌ | ✅ (miejscowości) | ❌ |

#### Redirect po zalogowaniu

- **ADMIN** → `/admin`
- **OPERATOR, PRODUCTION, PRODUCTION_MANAGER** → `/production`
- **GRAPHICS** → `/graphics.html`
- **Pozostali** → `/` (formularz zamówień)

#### Uwagi

- Role produkcyjne nie mają dostępu do formularza zamówień ani listy klientów
- SALES_DEPT ma bezpośredni dostęp do panelu produkcji i grafiki (1 klik)
- Graficy mają dostęp do formularza w trybie tylko do odczytu

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

-- Pozycje zamówienia
OrderItem (
  id uuid PRIMARY KEY,
  orderId uuid NOT NULL REFERENCES "Order"(id) ON DELETE CASCADE,
  productId uuid NOT NULL REFERENCES Product(id),
  quantity integer NOT NULL,            -- ilość używana w rozliczeniu
  unitPrice numeric(10,2) NOT NULL,
  selectedProjects text,                -- oryginalny zapis numerów projektów (np. '1,2,3')
  projectQuantities jsonb,              -- lista obiektów { projectNo, qty }
  quantitySource text NOT NULL DEFAULT 'total',  -- 'total' (suma) lub 'perProject' (ilości na projekt)
  totalQuantity integer,                -- suma ilości po projektach (dla spójności)
  source text,                          -- 'MIEJSCOWOSCI', 'KATALOG_INDYWIDUALNY', itp.
  locationName text,                    -- miejscowość PM lub obiekt KI
  projectViewUrl text,                  -- pełny URL do podglądu projektu (przechowywany tak jak w chwili dodania do koszyka)
  customization jsonb,
  productionNotes text
)

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

#### 5.4.1. Struktura organizacyjno‑produkcyjna: Działy, Pokoje, Role

System rozróżnia trzy poziomy opisu organizacji i produkcji:

- **Działy (Department)** – struktura organizacyjna / HR.
- **Pokoje produkcyjne (ProductionRoom)** – struktura techniczna produkcji (hale / linie).
- **Role (`User.role`)** – uprawnienia w aplikacji (co użytkownik może robić).

To rozdzielenie pozwala jednocześnie modelować:

- *gdzie* użytkownik jest w strukturze firmy (Dział),
- *w jakim miejscu / na jakiej linii* pracuje fizycznie (Pokój),
- *co* może robić w systemie (Rola).

##### Działy (Department)

Reprezentują klasyczne działy firmy: **Sprzedaż**, **Magazyn**, **Produkcja**, **Grafika**, **IT** itp.

- Tabela: `Department (id, name, createdAt, isActive)`.
- Powiązanie z użytkownikami: `User.departmentId`.
- Endpointy admina (panel "Działy") zwracają dodatkowo `userCount` – liczbę aktywnych
  użytkowników w danym dziale.
- Wykorzystanie:
  - filtrowanie użytkowników w panelu admina,
  - proste raporty organizacyjne (ile osób w którym dziale),
  - przyszłe reguły dostępu do danych zależne od działu.

##### Pokoje produkcyjne (ProductionRoom)

Reprezentują fizyczną strukturę produkcji: hale, linie i pokoje technologiczne
np. **Druk UV**, **Laser CO2**, **Laser Fiber**, **Pakowanie**.

- Główna tabela opisana szczegółowo w `SPEC_PRODUCTION_PANEL.md`.
- Powiązanie z użytkownikami: `User.productionroomid` – wskazuje macierzysty pokój
  produkcyjny operatora.
- Wykorzystanie:
  - panel admina "Pokoje" (lista pokoi, gniazd i maszyn),
  - mapowanie zleceń produkcyjnych i operacji na konkretne pokoje / gniazda,
  - raportowanie obciążenia linii produkcyjnych.

##### Role użytkowników (`User.role`)

Role definiują **uprawnienia w panelach**, niezależnie od działu i pokoju.
Przykłady: `ADMIN`, `SALES_DEPT`, `GRAPHICS`, `WAREHOUSE`, `PRODUCTION`, `OPERATOR`.

- Przechowywane w polu `User.role`.
- Wymuszane po stronie backendu przez middleware `requireRole([...])`.
- Po stronie frontendu (np. `admin/admin.js`) funkcja
  `checkUserPermissionsAndAdaptUI()` ukrywa/pokazuje elementy nawigacji i widoki
  w zależności od roli.

##### Relacja między Działem, Pokojem i Rolą

Na poziomie bazy **Dział i Pokój nie są sztywno związane** – łączy je użytkownik:

- użytkownik ma przypisany `departmentId` (struktura organizacyjna),
- użytkownik ma przypisany `productionroomid` (miejsce pracy w produkcji),
- użytkownik ma `role` (uprawnienia w systemie).

Taki model jest elastyczny:

- jeden dział może mieć użytkowników pracujących w wielu pokojach,
- jeden pokój może być obsługiwany przez ludzi z różnych działów,
- zmiana roli (uprawnień) nie wymaga zmiany działu ani pokoju.

Rozszerzenia tabeli `Order` i (opcjonalnie) `OrderItem` pod moduł grafiki
opisane są w `docs/SPEC_PRODUCTION_PANEL.md` (sekcja 9.2) i będą wdrażane w
ramach wersji v2.x systemu.

**Szacowanie czasu operacji (Time Estimation)**

- Czas trwania poszczególnych operacji technologicznych jest **konfigurowalny** w edytorze ścieżki/operacji (moduł admina produkcji) poprzez:
  - czas jednostkowy na sztukę (Tj),
  - czas przygotowawczo‑zakończeniowy (TPZ),
  - ewentualny bufor.
- Wartości te zasilają pola `ProductionPath.estimatedTime`, `ProductionOrder.estimatedTime` oraz `ProductionOperation.plannedTime`.
- Panel operatora **nie edytuje** tych czasów – wyłącznie je odczytuje i pokazuje szacowany czas na kafelkach zleceń / operacji.
- Szczegółowy opis znajduje się w `SPEC_PRODUCTION_PANEL.md`, sekcja **6. System Szacowania Czasów Produkcyjnych**.

### 5.5. Projekty galerii i mapowanie produktów

```sql
GalleryProject (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,         -- techniczna nazwa projektu / pliku z galerii (np. 'KUBEK_GRAWER')
  displayName text NOT NULL,        -- nazwa czytelna (np. 'KUBEK GRAWER')
  createdAt timestamptz NOT NULL,
  createdBy uuid REFERENCES "User"(id)
)
GalleryProjectProduct (
  id uuid PRIMARY KEY,
  projectId uuid NOT NULL REFERENCES GalleryProject(id) ON DELETE CASCADE,
  productId uuid NOT NULL REFERENCES Product(id) ON DELETE CASCADE,
  isPrimary boolean NOT NULL DEFAULT false,
  createdAt timestamptz NOT NULL DEFAULT now(),
  createdBy uuid REFERENCES "User"(id),
  UNIQUE (projectId, productId)
)
```

**Założenia:**
- `GalleryProject` przechowuje globalną listę projektów / plików z galerii (niezależnie od miejscowości czy obiektu).
- `slug` odpowiada polu `product` w plikach galerii (np. `files[].product`).
- `GalleryProjectProduct` mapuje wiele produktów (`Product.id`) do jednego projektu (relacja N→1).
- Mapowanie jest współdzielone przez wszystkie tryby formularza (PM, KI, w przyszłości PI/Ph).

---

## 6. API Endpoints

### 6.1. Autentykacja

| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/api/auth/login` | POST | Logowanie |
| `/api/auth/logout` | POST | Wylogowanie |
| `/api/auth/me` | GET | Dane zalogowanego użytkownika |
| `/api/auth/sync-role` | POST | Synchronizacja roli z cookies |

#### 6.1.1. Konwencja użycia cookies w backendzie

Wszystkie endpointy backendu, które potrzebują informacji o zalogowanym użytkowniku,
powinny korzystać wyłącznie z helpera `parseCookies(req)` z pliku `backend/server.js`,
zamiast bezpośredniego odwołania do `req.cookies`.

Standardowy wzorzec:

```js
const cookies = parseCookies(req);
const userId = cookies.auth_id;
const role = cookies.auth_role;

if (!userId) {
  return res.status(401).json({ status: 'error', message: 'Brak autoryzacji' });
}
```

Powód:

- helper `parseCookies` działa spójnie we wszystkich środowiskach (bez dodatkowych
  middleware typu `cookie-parser`),
- minimalizuje ryzyko rozbieżności w sposobie pobierania `auth_id` / `auth_role`
  między endpointami.

### 6.2. Zamówienia

| Endpoint | Metoda | Opis | Role |
|----------|--------|------|------|
| `/api/orders` | GET | Lista zamówień | Wszystkie |
| `/api/orders/:id` | GET | Szczegóły zamówienia (z pozycjami) | Wszystkie |
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

### 6.6. Mapowanie projektów galerii na produkty

Moduł admina do utrzymywania powiązań między projektami galerii (plikami) a produktami
z tabeli `Product`. Wykorzystywany przez formularz zamówień (lista produktów w galerii)
oraz w przyszłości przez panel produkcyjny.

| Endpoint | Metoda | Opis | Role |
|----------|--------|------|------|
| `/api/admin/gallery-projects` | GET | Lista projektów galerii (`GalleryProject`) z licznikami produktów | ADMIN |
| `/api/admin/gallery-projects` | POST | Utworzenie nowego projektu (slug + displayName) | ADMIN |
| `/api/admin/gallery-projects/:id` | PATCH | Aktualizacja nazwy / slug projektu | ADMIN |
| `/api/admin/gallery-projects/:id` | DELETE | Usunięcie projektu (wraz z powiązaniami) | ADMIN |
| `/api/admin/gallery-projects/:id/products` | GET | Lista przypiętych produktów (`GalleryProjectProduct`) | ADMIN |
| `/api/admin/gallery-projects/:id/products` | POST | Przypisanie produktu do projektu (productId) | ADMIN |
| `/api/admin/gallery-projects/:id/products/:productId` | DELETE | Usunięcie przypisania produktu | ADMIN |

**Uwagi implementacyjne:**

- Endpointy `/api/orders` i `/api/orders/:id` zwracają dla każdej pozycji (`items[]` / `OrderItem[]`) m.in.:
  - `selectedProjects` – oryginalny zapis numerów projektów,
  - `projectQuantities` – JSON z listą `{ projectNo, qty }`,
  - `quantitySource` – `'total'` lub `'perProject'`,
  - `totalQuantity` – suma ilości po projektach,
  - `source` – pochodzenie produktu (`MIEJSCOWOSCI`, `KATALOG_INDYWIDUALNY`, itp.),
  - `locationName` – nazwa miejscowości PM lub obiektu KI.

- Endpointy `/api/gallery/products/:city` oraz `/api/gallery/products-object` pozostają kompatybilne wstecznie,
  ale ich odpowiedź jest rozszerzona o strukturę `projects[]` zawierającą:
  - dane projektu (`slug`, `displayName`),
  - listę powiązanych produktów (`productId`, `identifier`, `index`).

- Formularz zamówień wykorzystuje `projects[].products` do budowy listy 2 (select "Produkt") z etykietą
  opartą o `identifier` (Identyfikator) oraz dopiskiem nazwy projektu. Produkty bez mapowania nadal są
  dostępne na liście na podstawie danych z galerii.


### 6.7. Stan formularza zamówień w localStorage

- **Zakres:** dotyczy wyłącznie frontendu (przeglądarka użytkownika). Dane nie są synchronizowane z backendem.
- **Klucze:**
  - `rezonCartV1` – serializowany stan koszyka (pozycje, ilości, uwagi). Zapisywany przy każdej zmianie koszyka
    (dodanie/edycja/usunięcie pozycji, wczytanie szablonu). Czyści się przy ręcznym „Wyczyść koszyk” oraz po
    poprawnym wysłaniu zamówienia.
  - `rezonGalleryStateV1` – ostatnio użyte ustawienia galerii:
    - tryb PM: `pmCity`, `pmProductSlug`,
    - tryb KI: `kiSalesperson`, `kiObject`, `kiProductSlug`.
- **Odtwarzanie stanu:** przy starcie formularza odczytywany jest zapisany stan. Zapisany produkt
  jest ustawiany tylko wtedy, gdy nadal istnieje w danych zwróconych przez API
  (`/api/gallery/products/:city` lub `/api/gallery/products-object`). W przeciwnym razie select produktu
  pozostaje pusty.

### 6.8. Logika ilości i numerów projektów (frontend)

Formularz zamówień i koszyk używają jednej spójnej logiki rozkładu ilości na projekty (`computePerProjectQuantities`).
Użytkownik może podać:
- łączną ilość (`Ilość`), albo
- ilości na projekty (`Ilości na proj.`: "po X" lub lista liczb).

Źródło prawdy oznaczane jest w pozycji koszyka polem `quantitySource` (`total` lub `perProject`). Numery projektów i
ilości są po stronie frontendu zawsze oczyszczane (usuwanie zbędnych przecinków, spacji), a drobne błędy formatu są
naprawiane bez wyświetlania komunikatów błędu użytkownikowi.

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
| SALES_DEPT | PENDING → APPROVED, SHIPPED → DELIVERED, * → CANCELLED |
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

**Wersja dokumentu:** 2.1  
**Data aktualizacji:** 2025-12-02
