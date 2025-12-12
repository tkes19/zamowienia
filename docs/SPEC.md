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
Order (id, orderNumber, customerId, userId, status, total, deliveryDate, priority, notes, createdAt, updatedAt)

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

#### 6.2.1. POST `/api/orders` – pola związane z terminem dostawy

Endpoint tworzenia zamówienia przyjmuje dodatkowe pole:

- `deliveryDate` – **wymagane** pole daty w formacie `YYYY-MM-DD`, odpowiadające polu formularza „Na kiedy potrzebne”.

Zasady walidacji:

- jeśli `deliveryDate` jest puste lub brak pola → `400` z komunikatem `deliveryDate jest wymagane (data "Na kiedy potrzebne")`,
- jeśli `deliveryDate` nie da się sparsować jako poprawnej daty → `400` z komunikatem o nieprawidłowym formacie,
- jeśli `deliveryDate` < **dzisiaj** (porównanie po dacie, bez czasu) → `400` z komunikatem `deliveryDate nie może być datą z przeszłości`.

Zapis w bazie:

- kolumna `Order.deliveryDate` (TIMESTAMPTZ) przechowuje termin wymagany,
- kolumna `Order.priority` (INT, domyślnie `3`) może zostać w przyszłości nadpisana przez moduł auto‑priorytetu produkcyjnego,
- historyczne zamówienia utworzone przed dodaniem pola mogą mieć `deliveryDate = NULL` – w module produkcji są traktowane jako `timeStatus = 'UNKNOWN'`.

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

### 6.9. Presety terminów dostawy (OrderDeliveryPreset)

Presety terminów dostawy są używane w formularzu zamówień jako przyciski pod polem daty „Na kiedy potrzebne”.
Są konfigurowane w panelu admina i wykorzystywane przez frontend do szybkiego ustawiania `deliveryDate`.

Model danych:

- tabela `OrderDeliveryPreset`:
  - `id` – klucz główny,
  - `label` – etykieta widoczna w UI (np. `Standard (5 dni)`, `Na Sezon 1.04.2026`),
  - `mode` – tryb obliczania daty: `OFFSET` lub `FIXED_DATE`,
  - `offsetDays` – liczba dni od dzisiaj (dla trybu `OFFSET`),
  - `fixedDate` – konkretna data kalendarzowa (dla trybu `FIXED_DATE`),
  - `isDefault` – czy preset jest domyślnym wyborem w formularzu,
  - `isActive` – czy preset jest widoczny w UI,
  - `sortOrder` – kolejność wyświetlania.

Endpointy backendu:

| Endpoint | Metoda | Opis | Role |
|----------|--------|------|------|
| `/api/config/order-delivery-presets` | GET | Publiczna lista aktywnych presetów do formularza zamówień (dla frontendu) | Zalogowani / publiczne UI |
| `/api/admin/order-delivery-presets` | GET | Lista wszystkich presetów (z polami administracyjnymi) | ADMIN |
| `/api/admin/order-delivery-presets` | POST | Utworzenie nowego preset-u | ADMIN |
| `/api/admin/order-delivery-presets/:id` | PATCH | Aktualizacja istniejącego preset-u | ADMIN |
| `/api/admin/order-delivery-presets/:id` | DELETE | Usunięcie preset-u | ADMIN |

 - Zasady:
   - w danym momencie co najwyżej jeden rekord może mieć `isDefault = true` (backend po POST/PATCH czyści flagę na innych rekordach),
   - frontend formularza zawsze ma statyczne presety fallback (`Ekspres 2 dni`, `Standard 5 dni`, `Duże nakłady 10 dni`) –
     jeśli `/api/config/order-delivery-presets` działa poprawnie, dynamiczne presety z bazy nadpisują te wartości,
   - dla `mode = 'FIXED_DATE'` frontend pilnuje, aby ustawiona data nie była wcześniejsza niż dzisiejsza (`min = today`).

### 6.10. Plan wdrożenia ulepszeń UX formularza zamówień

Plan opisuje kolejne iteracje poprawiające użyteczność formularza zamówień dla handlowców
i nowych użytkowników. Implementacja powinna być wykonywana etapami, bez
przerywania istniejącego workflow zamówień i produkcji.

#### 6.10.1. Wskaźnik postępu ("kroki" formularza)

**Cel:** Pokazać użytkownikowi, na jakim etapie procesu zamówienia się znajduje i
jakie elementy musi jeszcze uzupełnić.

- Widoczne kroki (propozycja):
  - `1. Produkt` – wybór miasta/obiektu i produktu (galeria),
  - `2. Szczegóły` – parametry produktu i koszyk,
  - `3. Klient` – wybór klienta,
  - `4. Dostawa` – "Na kiedy potrzebne" + opcje wysyłki.
- Pliki:
  - `index.html` – pasek kroków nad głównymi panelami, klasy np. `order-steps`, `order-step--active`.
  - `assets/styles.css` – stylowanie paska kroków (flex, kolory, responsywność).
  - `scripts/app.js` – logika `currentStep`, `goToStep(step)`, `updateStepIndicator()`.
- Zdarzenia zmieniające krok:
  - dodanie pierwszej pozycji do koszyka → krok "Szczegóły"/"Klient",
  - ustawienie klienta → krok "Dostawa",
  - uzupełnienie daty dostawy → wszystkie kroki oznaczone jako kompletne.
- Kryteria akceptacji:
  - nowy użytkownik rozumie z samego UI, że proces ma 3–4 kroki,
  - na każdym etapie widzi, które elementy są jeszcze wymagane (np. krok wyszarzony / czerwony, gdy brakuje danych).

#### 6.10.2. Usprawnione wybieranie produktów (ulubione, ostatnio zamawiane, kategorie)

**Cel:** Zmniejszyć czas wyszukiwania produktów, szczególnie dla handlowców, którzy
często zamawiają powtarzalne pozycje.

- Wykorzystywane dane:
  - historia zamówień z tabel `Order`/`OrderItem` (ostatnio zamawiane produkty),
  - tabela `UserFavorites` (`type = 'product'` lub analogiczny) – ulubione produkty,
  - `Product.category` – kategorie produktów (już zdefiniowane w modelu danych).
- Backend:
  - ewentualny endpoint pomocniczy, np. `/api/orders/recent-products?customerId=...`
    albo `/api/orders/recent-products?userScope=me` (ostatnie N produktów).
- Frontend:
  - `index.html` – sekcje:
    - "Ulubione produkty" (lista przycisków / chipów nad selektorem produktu),
    - "Ostatnio zamawiane" (dla danego klienta lub handlowca),
    - filtr kategorii (dropdown lub lista chipów obok wyboru produktu).
  - `scripts/app.js`:
    - funkcje ładujące ulubione: wykorzystanie istniejącego `/api/favorites`,
    - funkcje ładujące "ostatnio zamawiane" z nowego endpointu,
    - integracja z istniejącym wyborem produktu (wybór z ulubionych/ostatnich
      ustawia bieżący produkt i przełącza krok formularza).
- Kryteria akceptacji:
  - handlowiec może utworzyć typowe zamówienie wybierając produkt z "Ulubionych"
    lub "Ostatnio zamawianych" bez ręcznego filtrowania całej listy.

#### 6.10.3. Smart defaults i auto‑podpowiedzi (termin dostawy i parametry)

**Cel:** Ograniczyć ręczne wpisywanie powtarzalnych danych i ryzyko wyboru
nierealnych terminów dostawy.

- Wykorzystywane dane:
  - `OrderDeliveryPreset` (patrz §6.9) – dynamiczne presety terminów,
  - zawartość koszyka (ilości, typy produktów),
  - historia zamówień (opcjonalnie) – do heurystyk jak "typowy" termin dla klienta.
- Frontend (`scripts/app.js`):
  - funkcja `getSuggestedDeliveryDate(cart, presets)`:
    - pobiera aktywne presety z `/api/config/order-delivery-presets`,
    - wybiera preset oznaczony `isDefault = true` albo fallback "Standard (5 dni)",
    - wyznacza datę wg `mode` (`OFFSET` lub `FIXED_DATE`),
    - zwraca datę w formacie `YYYY-MM-DD`.
  - przy pierwszym dodaniu produktu do koszyka:
    - jeśli pole "Na kiedy potrzebne" jest puste → wstaw datę z `getSuggestedDeliveryDate(...)`.
- HTML/CSS:
  - `index.html` – przyciski terminów bazują na danych z API (nie na sztywno),
    generowane dynamicznie przez JS.
- Kryteria akceptacji:
  - w typowym scenariuszu handlowiec akceptuje domyślną datę bez ręcznej zmiany,
  - daty z presetów zawsze spełniają walidację z §6.2.1 (nie są w przeszłości).

#### 6.10.4. Prewencja błędów i walidacja formularza (frontend)

**Cel:** Zminimalizować liczbę niekompletnych lub błędnych zamówień wysyłanych do
backendu oraz ryzyko późniejszych problemów w produkcji.

- Zależne od:
  - reguł walidacji z §6.2.1 (deliveryDate),
  - wymagań biznesowych: co najmniej 1 pozycja w koszyku, wybrany klient.
- Frontend:
  - `scripts/app.js`:
    - funkcja `validateOrderForm()` zwracająca obiekt z polami błędów,
    - funkcja `updateSubmitButtonState()`:
      - blokuje / odblokowuje przycisk "Wyślij zamówienie"
        (`#submit-order-inline`) w zależności od tego, czy:
        - koszyk nie jest pusty,
        - wybrano klienta (`currentCustomer`),
        - ustawiono poprawną datę dostawy,
    - obsługa komunikatów błędów:
      - lekkie komunikaty inline pod polami,
      - toast z listą błędów przy próbie wysyłki niekompletnego formularza.
  - `assets/styles.css`:
    - klasy typu `.field--error`, `.field__error-message` z prostą, spójną
      kolorystyką błędów.
- Kryteria akceptacji:
  - nie ma możliwości kliknięcia "Wyślij zamówienie", jeśli brakuje klienta,
    daty lub produktów,
  - błędy są komunikowane wprost, w języku użytkownika (bez technicznych komunikatów).

#### 6.10.5. Optymalizacje mobilne (mobile‑first)

**Cel:** Ułatwić pracę handlowcom w terenie, którzy korzystają głównie z telefonu.

- Frontend – layout:
  - `index.html`:
    - opcjonalny pasek akcji na dole ekranu mobilnego (`order-footer-mobile`)
      z datą "Na kiedy potrzebne" i przyciskiem "Wyślij zamówienie".
  - `assets/styles.css`:
    - w `@media (max-width: 768px)`:
      - stały pasek (`position: fixed; bottom: 0; left: 0; right: 0;`),
      - większe przyciski (min. 44px wysokości),
      - kolumnowy układ sekcji klient + dostawa (czytelne bloki jeden pod drugim).
    - powiększone pola dotykowe dla przycisków szybkich terminów (pełna szerokość
      w 1–2 rzędach).
- Kryteria akceptacji:
  - na urządzeniach mobilnych przycisk "Wyślij zamówienie" oraz data dostawy
    są zawsze łatwo dostępne (bez przewijania całej strony),
  - interfejs spełnia minimalne standardy dostępności dotykowej (rozmiar pól).

### 6.11. Rozszerzone scenariusze UX formularza zamówień (przyszłość)

Ta sekcja opisuje **pomysły na kolejne iteracje UX**, które nie są jeszcze
zaplanowane do natychmiastowego wdrożenia, ale powinny być brane pod uwagę przy
rozwoju wersji v1.x systemu (warstwa sprzedażowa, formularz zamówień).

#### 6.11.1. Powtórz zamówienie + szybka modyfikacja

**Cel:** Pozwolić handlowcowi w kilka kliknięć odtworzyć typowe zamówienie
na podstawie wcześniejszego.

- Koncepcja:
  - przy każdym zamówieniu w widoku `orders.html` widoczny przycisk
    "Powtórz zamówienie",
  - nowy koszyk tworzony jest na podstawie `Order` + `OrderItem[]` z wybranego
    zamówienia,
  - formularz uzupełnia domyślną datę dostawy (wg logiki smart defaults z §6.10),
    a użytkownik modyfikuje głównie ilości, datę oraz notatki.
- Backend – warianty:
  - **A. Frontend‑only:**
    - `orders.html` pobiera szczegóły zamówienia z `/api/orders/:id`,
    - dane pozycji są przekazywane do formularza `/` przez parametr URL
      (np. `?repeatOrderId=...`) lub `localStorage`,
    - `scripts/app.js` odtwarza koszyk po stronie przeglądarki.
  - **B. Endpoint pomocniczy (opcjonalnie):** `POST /api/orders/:id/repeat`
    - backend tworzy nowy szkic zamówienia (np. w `order_drafts`),
    - frontend przekierowuje użytkownika do formularza z ID szkicu.
- Frontend:
  - `orders.html` / `scripts/orders.js` – przycisk "Powtórz" oraz obsługa
    akcji (wywołanie API lub zapis do `localStorage`),
  - `index.html` / `scripts/app.js` – logika odtwarzania koszyka na podstawie
    przekazanych danych oraz ustawienia nowej daty dostawy.
- Kryteria akceptacji:
  - powtórzenie typowego zamówienia wymaga maksymalnie kilku kliknięć
    (bez ręcznego dodawania każdej pozycji od zera).

#### 6.11.2. Tryb „Szybkie zamówienie” (Quick Order)

**Cel:** Umożliwić doświadczonym handlowcom bardzo szybkie dodawanie pozycji
na podstawie indeksów / identyfikatorów produktów, bez przechodzenia przez galerię.

- Koncepcja UI:
  - dedykowany widok (np. `/quick-order`) lub zakładka/tryb w `index.html`,
  - tabela z kolumnami: `Index/Identyfikator`, `Nazwa`, `Ilość`, `Uwagi`,
  - pole do wklejenia listy z Excela (np. `INDEX;ILOŚĆ` w nowych liniach).
- Wykorzystywane dane:
  - tabela `Product` (kolumny `identifier`, `index`, `name`),
  - opcjonalnie `UserFavorites` – do podpowiedzi/autouzupełniania.
- Backend:
  - brak nowych tabel,
  - możliwość wykorzystania istniejącego endpointu listy produktów lub dodanie
    prostego endpointu wyszukującego po `identifier` / `index`.
- Frontend:
  - nowy moduł JS (`scripts/quick-order.js` lub sekcja w `scripts/app.js`),
  - walidacja indeksów (oznaczanie wierszy z błędnymi kodami),
  - po zatwierdzeniu – konwersja wierszy na pozycje koszyka zgodne z logiką
    z §6.8 i §6.10.
- Kryteria akceptacji:
  - handlowiec znający indeksy produktów może wprowadzić kompletne zamówienie
    głównie z klawiatury (minimalne użycie myszy / galerii).

#### 6.11.3. Checklisty sprzedażowe (Guided Selling) dla wybranych produktów

**Cel:** Zmniejszyć liczbę błędów i „niedomówień” między sprzedażą a produkcją
przy bardziej złożonych produktach (np. z hasłami, personalizacją, grafiką).

- Koncepcja:
  - dla wybranych kategorii produktów (`Product.category`) wyświetlana jest
    dodatkowa sekcja "Sprawdź przed wysłaniem" z listą punktów do odhaczenia,
  - przykładowe pozycje checklisty:
    - "Hasło do nadruku zostało zaakceptowane przez klienta",
    - "Logo/plik graficzny został dostarczony w wymaganym formacie",
    - "Uzgodniono kolorystykę / wariant produktu".
- Możliwe źródła konfiguracji:
  - prosty słownik po stronie frontendu (pierwsza iteracja),
  - docelowo tabela konfiguracyjna (np. `ProductChecklistTemplate`) z listą
    punktów na kategorię / typ produktu.
- Frontend:
  - `index.html` / `scripts/app.js` – logika wyświetlania odpowiedniej checklisty
    w zależności od zawartości koszyka,
  - stan checklisty może być przechowywany lokalnie (frontend) albo podsumowany
    tekstowo w `Order.productionNotes` / `OrderItem.productionNotes`.
- Kryteria akceptacji:
  - dla produktów wymagających dodatkowych ustaleń użytkownik zawsze widzi
    jasną listę rzeczy do sprawdzenia **przed wysłaniem** zamówienia.

#### 6.11.4. Widok „Ryzyko dostawy” (powiązanie sprzedaży z obciążeniem produkcji)

**Cel:** Dostarczyć handlowcowi prostą informację zwrotną, czy wybrany termin
"Na kiedy potrzebne" jest realny przy aktualnym obciążeniu produkcji.

- Koncepcja:
  - mały panel pod sekcją terminu dostawy, pokazujący status typu:
    - "Bezpieczny" (zielony),
    - "Napięty" (żółty),
    - "Ryzykowny" (czerwony),
  - status obliczany na podstawie daty `deliveryDate`, łącznej ilości / złożoności
    zamówienia i uproszczonych danych o obciążeniu produkcji.
- Backend (docelowo):
  - endpoint np. `/api/production/capacity-check` przyjmujący dane zamówienia
    (lub jego podsumowanie) i `deliveryDate`, zwracający status + krótkie uzasadnienie.
  - w MVP możliwe użycie prostych heurystyk bazujących wyłącznie na dacie
    i typach produktów (bez pełnego modelu obciążenia).
- Frontend:
  - `scripts/app.js` – wywołanie endpointu przy zmianie daty lub istotnych
    parametrów koszyka,
  - wizualizacja statusu w formularzu (ikona/kolor + krótki tekst typu
    "Termin bardzo krótki – skonsultuj z produkcją").
- Kryteria akceptacji:
  - handlowiec przed wysłaniem zamówienia widzi jednoznaczny sygnał, czy
    deklarowany termin mieści się w typowych możliwościach produkcji.

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
