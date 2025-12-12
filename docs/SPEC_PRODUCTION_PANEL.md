# Specyfikacja: Panel Produkcyjny

## 1. Cel modułu

Wdrożenie kompletnego systemu zarządzania produkcją (MES) integrowanego z istniejącym systemem zamówień. Moduł umożliwia automatyczne przekształcanie zamówień w zlecenia produkcyjne, zarządzanie pokojami i maszynami produkcyjnymi oraz monitorowanie postępu w czasie rzeczywistym.

### 1.1. Kontekst: Działy, Pokoje i Role

Panel Produkcyjny operuje głównie na **strukturze fizycznej** (Pokoje, Gniazda, Stanowiska).
Struktura organizacyjna (Działy) i role użytkowników są opisane szczegółowo w
`docs/SPEC.md` §5.4.1, a tutaj są używane w skrócie:

- **Działy (Department)** – klasyczne działy firmy (Sprzedaż, Produkcja, Magazyn itp.),
  powiązane z użytkownikami przez `User.departmentId`.
- **Pokoje produkcyjne (ProductionRoom)** – fizyczne pokoje / hale produkcyjne,
  na których oparty jest Panel Produkcyjny (tabele `ProductionRoom`, `WorkCenter`,
  `WorkStation`).
- **Role (`User.role`)** – kontrolują dostęp do Panelu Produkcyjnego oraz
  poszczególnych widoków (operator, kierownik, admin itp.).

Relacja między tymi elementami jest taka sama jak w SPEC.md:
użytkownik ma przypisany dział, pokój produkcyjny i rolę, a panel korzysta z tych
informacji przy filtrowaniu zadań i uprawnień.

---

## 2. Decyzje architektoniczne

### 2.1 Model danych

#### Tabele produkcyjne

```sql
-- Pokoje produkcyjne
CREATE TABLE public."ProductionRoom" (
  id serial PRIMARY KEY,
  name varchar(100) NOT NULL,
  code varchar(20) UNIQUE NOT NULL,
  area decimal(8,2), -- powierzchnia w m²
  description text,
  "supervisorId" text REFERENCES "User"(id) ON DELETE SET NULL,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP
);

-- Flaga ograniczająca maszynę tylko do przypisanych produktów
ALTER TABLE public."WorkStation"
  ADD COLUMN IF NOT EXISTS "restrictToAssignedProducts" boolean NOT NULL DEFAULT false;

-- Menedżer pokoju produkcyjnego (odpowiedzialny za przypisania produktów)
ALTER TABLE public."ProductionRoom"
  ADD COLUMN IF NOT EXISTS "roomManagerUserId" text REFERENCES public."User"(id);

-- Przypisania produktów do maszyn w pokojach (Machine→Product)
CREATE TABLE IF NOT EXISTS public."MachineProductAssignment" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workStationId" integer NOT NULL REFERENCES public."WorkStation"(id) ON DELETE CASCADE,
  "productId" text NOT NULL REFERENCES public."Product"(id) ON DELETE CASCADE,
  "assignedBy" text NOT NULL REFERENCES public."User"(id),
  "assignedAt" timestamp with time zone DEFAULT now(),
  notes text,
  UNIQUE ("workStationId", "productId")
);

-- Gniazda produkcyjne
CREATE TABLE public."WorkCenter" (
  id serial PRIMARY KEY,
  name varchar(100) NOT NULL,
  code varchar(20) UNIQUE NOT NULL,
  "roomId" integer REFERENCES "ProductionRoom"(id) ON DELETE SET NULL,
  type varchar(50) NOT NULL, -- laser_co2, laser_fiber, uv_print, cnc, cutting
  description text,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP
);

-- Stanowiska robocze i maszyny
CREATE TABLE public."WorkStation" (
  id serial PRIMARY KEY,
  name varchar(100) NOT NULL,
  code varchar(20) UNIQUE NOT NULL,
  "workCenterId" integer REFERENCES "WorkCenter"(id) ON DELETE SET NULL,
  type varchar(50) NOT NULL, -- laser_co2, laser_fiber, uv_print, cnc, cutting
  manufacturer varchar(100),
  model varchar(100),
  "powerRating" decimal(8,2), -- kW
  status varchar(20) NOT NULL DEFAULT 'available', -- available, in_use, maintenance, breakdown
  capabilities jsonb, -- {"materials": ["wood", "acrylic"], "max_size": "600x400"}
  "maintenanceSchedule" jsonb, -- {"interval": "monthly", "last_maintenance": "2025-01-15"}
  "currentOperatorId" text REFERENCES "User"(id) ON DELETE SET NULL,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP
);

-- Ścieżki produkcyjne
CREATE TABLE public."ProductionPath" (
  id serial PRIMARY KEY,
  "productId" integer REFERENCES "Product"(id) ON DELETE CASCADE,
  name varchar(200) NOT NULL,
  version integer NOT NULL DEFAULT 1,
  "isActive" boolean NOT NULL DEFAULT true,
  "estimatedTime" integer, -- całkowity szacowany czas w minutach
  operations jsonb NOT NULL, -- [
    -- {"operation": 1, "operationType": "prepare_materials", "workCenterId": 1, "estimatedTime": 5},
    -- {"operation": 2, "operationType": "laser_engrave", "workStationId": 1, "estimatedTime": 15},
    -- {"operation": 3, "operationType": "quality_check", "workCenterId": 1, "estimatedTime": 3}
  ]
  "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("productId", "version")
);

-- Zlecenia produkcyjne
CREATE TABLE public."ProductionOrder" (
  id serial PRIMARY KEY,
  "orderNumber" varchar(20) UNIQUE NOT NULL,
  "sourceOrderId" integer REFERENCES "Order"(id) ON DELETE CASCADE,
  "productId" integer REFERENCES "Product"(id) ON DELETE CASCADE,
  quantity integer NOT NULL,
  "completedQuantity" integer NOT NULL DEFAULT 0,
  priority integer NOT NULL DEFAULT 3, -- 1-urgent, 2-high, 3-normal, 4-low
  status varchar(20) NOT NULL DEFAULT 'planned', -- planned, approved, in_progress, completed, cancelled
  "plannedStartDate" timestamp,
  "plannedEndDate" timestamp,
  "actualStartDate" timestamp,
  "actualEndDate" timestamp,
  "assignedWorkCenterId" integer REFERENCES "WorkCenter"(id) ON DELETE SET NULL,
  "productionPathId" integer REFERENCES "ProductionPath"(id) ON DELETE SET NULL,
  "estimatedTime" integer, -- całkowity szacowany czas w minutach
  "confidenceScore" varchar(10) DEFAULT 'medium', -- high, medium, low
  "productionNotes" text,
  "qualityStatus" varchar(20) DEFAULT 'pending', -- pending, passed, failed, rework
  "createdBy" text REFERENCES "User"(id) ON DELETE SET NULL,
  "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP
);

-- Operacje technologiczne zlecenia
CREATE TABLE public."ProductionOperation" (
  id serial PRIMARY KEY,
  "productionOrderId" integer REFERENCES "ProductionOrder"(id) ON DELETE CASCADE,
  "operationNumber" integer NOT NULL,
  "operationType" varchar(50) NOT NULL, -- laser_engrave, uv_print, cutting, assembly (kod słownika OperationType)
  "workStationId" integer REFERENCES "WorkStation"(id) ON DELETE SET NULL,
  "operatorId" text REFERENCES "User"(id) ON DELETE SET NULL,
  status varchar(20) NOT NULL DEFAULT 'pending', -- pending, active, completed, failed
  "plannedTime" integer, -- szacowany czas w minutach
  "actualTime" integer, -- rzeczywisty czas w minutach
  "startTime" timestamp,
  "endTime" timestamp,
  parameters jsonb, -- {"power": "80%", "speed": "100mm/s", "passes": 2}
  "qualityNotes" text,
  "outputQuantity" integer NOT NULL DEFAULT 0,
  "wasteQuantity" integer NOT NULL DEFAULT 0,
  "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("productionOrderId", "operationNumber")
);

-- Słownik typów operacji technologicznych
CREATE TABLE public."OperationType" (
  id serial PRIMARY KEY,
  code varchar(50) UNIQUE NOT NULL,
  name varchar(100) NOT NULL,
  description text,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP
);

-- Audyt zmian produkcyjnych
CREATE TABLE public."ProductionLog" (
  id serial PRIMARY KEY,
  "productionOrderId" integer REFERENCES "ProductionOrder"(id) ON DELETE CASCADE,
  action varchar(50) NOT NULL, -- created, started, paused, completed, cancelled
  "previousStatus" varchar(20),
  "newStatus" varchar(20),
  "userId" text REFERENCES "User"(id) ON DELETE SET NULL,
  notes text,
  "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP
);

-- Zlecenia produkcyjne grupowane po pokojach (ProductionWorkOrder)
CREATE TABLE public."ProductionWorkOrder" (
  id serial PRIMARY KEY,
  "workOrderNumber" varchar(20) UNIQUE NOT NULL,
  "sourceOrderId" uuid REFERENCES "Order"(id) ON DELETE CASCADE,
  "roomName" varchar(100) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'planned', -- planned, approved, in_progress, completed, cancelled
  priority integer NOT NULL DEFAULT 3, -- 1-urgent, 2-high, 3-normal, 4-low
  "plannedDate" timestamp,
  "actualDate" timestamp,
  notes text,
  "printedAt" timestamp,
  "printedBy" uuid REFERENCES "User"(id) ON DELETE SET NULL,
  "templateVersion" varchar(10) DEFAULT '1.0',
  "createdBy" uuid REFERENCES "User"(id) ON DELETE SET NULL,
  "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP
);

-- Powiązanie pojedynczych zleceń produkcyjnych (ProductionOrder)
-- z nagłówkowymi zleceniami produkcyjnymi dla pokoi produkcyjnych (ProductionWorkOrder)
ALTER TABLE public."ProductionOrder" 
ADD COLUMN "workOrderId" integer REFERENCES "ProductionWorkOrder"(id) ON DELETE SET NULL;

-- Przypisania ról użytkowników (wielorole)
CREATE TABLE public."UserRoleAssignment" (
  id serial PRIMARY KEY,
  "userId" text REFERENCES "User"(id) ON DELETE CASCADE,
  role "UserRole" NOT NULL,
  "assignedBy" text REFERENCES "User"(id) ON DELETE SET NULL,
  "assignedAt" timestamp DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("userId", role)
);
```

#### 2.1.1 Powiązanie OperationType ze ścieżkami

- Pole `ProductionPath.operations[].operationType` przechowuje **kod** typu operacji (`OperationType.code`).
- Pole `ProductionOperation.operationType` również jest tekstowym kodem ze słownika – brak FK z powodów
  wydajności/kompatybilności, ale aplikacja opiera się na tym samym zestawie kodów.
- Panel admina posiada widok **„Typy operacji”** (CRUD, aktywacja/dezaktywacja) bazujący na
  endpointach `/api/production/operation-types`.

#### 2.1.2 Kolejność operacji w ścieżce

- Kolejność kroków w `ProductionPath.operations` jest determinowana pozycją w tablicy oraz polem `step`
  nadawanym przez frontend w momencie zapisu.
- Edytor ścieżki w panelu admina pozwala **przenosić operacje w górę / w dół** (przyciski z chevronami),
  co skutkuje zmianą kolejności w DOM i ponownym nadaniem sekwencji `step` przy zapisie.
- Zmiana kolejności ścieżki:
  - wpływa na **nowo tworzone zlecenia produkcyjne** (operacje generowane są wg aktualnej wersji ścieżki),
  - **nie modyfikuje istniejących** rekordów `ProductionOrder` / `ProductionOperation`.
- Dzięki temu modyfikacja technologii w ścieżce jest bezpieczna z punktu widzenia danych historycznych –
  wymaga jedynie świadomej decyzji po stronie administratora / technologa.

### 2.2 Uprawnienia

| Rola | Zarządzanie pokojami | Zarządzanie gniazdami | Zarządzanie stanowiskami | Ścieżki produkcyjne | Panel operatora | Moduł grafiki | Raporty |
|------|----------------------|-----------------------|-------------------------|---------------------|-----------------|---------------|---------|
| ADMIN | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| SALES_DEPT | ❌ | ❌ | ❌ | ❌ | 📊 (tylko podgląd) | 📄 (podgląd plików) | ✅ |
| PRODUCTION_MANAGER | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| GRAPHIC_DESIGNER | ❌ | ❌ | ❌ | ❌ | 🔒 (tylko przypisane operacje) | ✅ | 📊 (swoje projekty) |
| OPERATOR | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | 📊 (tylko swoje) |
| CLIENT | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

> **Uwaga:**
> - `PRODUCTION` to zwykła rola działu produkcji (podgląd + wybrane akcje),
>   nie ma pełnych uprawnień konfiguracyjnych.
> - `PRODUCTION_MANAGER` ma dodatkowo: zarządzanie strukturą produkcji,
>   dostęp do panelu grafiki oraz **edytora przypisań produktów do maszyn**
>   (operuje na tabeli `MachineProductAssignment`).

### 2.2.1 Wielorole i tryb pracy

- Każdy użytkownik może mieć przypisane wiele ról poprzez tabelę `UserRoleAssignment`.
- Uprawnienia w systemie to suma wszystkich przydzielonych ról (np. `GRAPHIC_DESIGNER` + `OPERATOR` = dostęp do narzędzi graficznych i panelu operatora).
- UI musi umożliwiać przełączanie kontekstu roli (np. "Tryb grafika" / "Tryb operatora"), aby ograniczyć widoczne akcje do danego kontekstu.
- Rola podstawowa (`User.role`) zostaje zachowana dla kompatybilności z istniejącymi modułami, ale wszystkie nowe moduły muszą korzystać z `UserRoleAssignment`.

### 2.2.2 Plan wdrożenia wieloról i roli GRAPHIC_DESIGNER

#### Faza 1 – baza danych (Supabase)

- Upewnij się, że istnieje typ enum `"UserRole"` lub utwórz go (ADMIN, SALES_REP, SALES_DEPT, WAREHOUSE, GRAPHIC_DESIGNER, PRODUCTION_MANAGER, OPERATOR, CLIENT, NEW_USER).
- Dostosuj kolumnę `User.role` tak, aby korzystała z tego samego zestawu wartości (enum lub `CHECK` na varchar).
- Utwórz tabelę `UserRoleAssignment` zgodnie ze schematem z sekcji 2.1 (unikalna para `userId` + `role`).
- Wykonaj migrację danych: dla każdego rekordu w `User` utwórz domyślne przypisanie w `UserRoleAssignment` (`userId = User.id`, `role = User.role`).

Przykładowa migracja (SQL, do adaptacji):

```sql
INSERT INTO "UserRoleAssignment" ("userId", role, "assignedAt")
SELECT id, role, COALESCE("createdAt", NOW())
FROM "User"
ON CONFLICT ("userId", role) DO NOTHING;
```

#### Faza 2 – backend (auth i uprawnienia)

- Zachowaj istniejący mechanizm ciasteczek (`auth_id`, `auth_role`) jako **aktywną rolę** użytkownika.
- Dodaj endpoint `GET /api/auth/roles`, który zwróci listę ról zalogowanego użytkownika na podstawie `UserRoleAssignment`.
- Dodaj endpoint `POST /api/auth/active-role`, który:
  - przyjmie w body `{ role: "GRAPHIC_DESIGNER" }`,
  - sprawdzi, czy rola jest przypisana użytkownikowi,
  - zaktualizuje ciasteczko `auth_role` na wybraną rolę.
- W dokumentacji `requireRole(allowedRoles)` przyjmujemy, że sprawdza ona **aktywną** rolę z ciasteczka; uprawnienia wynikają z tego, że użytkownik może przełączyć się na dowolną ze swoich ról.

#### Faza 3 – panel administratora użytkowników

- W widoku zarządzania użytkownikami dodać sekcję "Role użytkownika":
  - pobieranie ról: `GET /api/admin/user-role-assignments?userId=...`,
  - nadawanie roli: `POST /api/admin/user-role-assignments` (`userId`, `role`),
  - odbieranie roli: `DELETE /api/admin/user-role-assignments/:id`.
- Formularz powinien umożliwiać wybór **wielu ról** (np. checkboxy lub multi-select): użytkownik może mieć jednocześnie `GRAPHIC_DESIGNER` i `OPERATOR`.
- Zasady:
  - tylko `ADMIN` może nadawać/odbierać role systemowe,
  - w przypadku ról produkcyjnych (`PRODUCTION_MANAGER`, `OPERATOR`, `GRAPHIC_DESIGNER`) zmiany powinny być logowane w audycie (osobny moduł / tabela).

#### Faza 4 – frontend: przełączanie trybu pracy

- Dodaj w UI komponent "Aktywna rola" (np. w headerze):
  - lista dostępnych ról (z `GET /api/auth/roles`),
  - wybór aktywnej roli (wywołuje `POST /api/auth/active-role`).
- Widoki powinny filtrować funkcje na podstawie aktywnej roli:
  - w trybie `GRAPHIC_DESIGNER`: dostęp do modułu przygotowania projektów/matryc + tylko przypisane operacje produkcyjne,
  - w trybie `OPERATOR`: standardowy panel operatora bez dostępu do konfiguracji plików,
  - w trybie `PRODUCTION_MANAGER`: pełen dostęp do konfiguracji produkcji.

#### Faza 5 – migracja użytkowników i testy

- Dla istniejących użytkowników ręcznie/skrzyżowo nadać role zgodnie z rzeczywistymi obowiązkami:
  - osoby łączące produkcję i grafikę: `GRAPHIC_DESIGNER` + `OPERATOR`,
  - osoby nadzorujące produkcję: `PRODUCTION_MANAGER` (+ ewentualnie inne role).
- Scenariusze testowe (do dopisania w zestawie testów ręcznych / automatycznych):
  - użytkownik z jedną rolą (np. tylko `OPERATOR`) nie widzi modułu grafiki,
  - użytkownik z dwiema rolami (`GRAPHIC_DESIGNER` + `OPERATOR`) może przełączać tryb i każdy tryb widzi poprawny zestaw funkcji,
  - zmiana aktywnej roli aktualizuje dostęp do endpointów chronionych przez `requireRole`.

> **Implementacja wieloról nie jest wymagana do startu Panelu Produkcyjnego**, ale jest rekomendowana przed uruchomieniem produkcji w pokojach, gdzie te same osoby pełnią funkcje grafika i operatora.

### 2.2.3 Status implementacji wieloról (grudzień 2025)

✅ **Zrealizowane:**
- Tabela `UserRoleAssignment` z polami `isActive`, `assignedBy`, `assignedAt`
- Endpointy CRUD: `GET/POST/DELETE /api/admin/user-role-assignments`
- Endpoint synchronizacji: `PUT /api/admin/user-role-assignments/sync/:userId`
- Endpoint przełączania roli: `POST /api/auth/active-role`
- Endpoint listy ról: `GET /api/auth/roles`
- UI Admin: sekcja wieloról w formularzu użytkownika (checkboxy)
- Testy jednostkowe: `backend/roles-permissions.test.js`

### 2.2.4 Helpery uprawnień produkcyjnych (MES-compliant)

Backend używa następujących helperów do kontroli dostępu:

```javascript
// Poziomy dostępu do pokoju
const RoomAccessLevel = {
    NONE: 'none',      // Brak dostępu
    VIEW: 'view',      // Tylko podgląd
    OPERATE: 'operate', // Wykonywanie operacji
    MANAGE: 'manage',   // Zarządzanie przypisaniami
    FULL: 'full'       // Pełny dostęp (ADMIN)
};

// Główny helper - określa poziom dostępu użytkownika do pokoju
function getRoomAccessLevel(userRole, userId, room) { ... }

// Helpery pochodne
function canManageRoomAssignments(userRole, userId, room) { ... }
function canViewRoom(userRole, userId, room) { ... }
function canOperateInRoom(userRole, userId, room) { ... }
```

**Hierarchia uprawnień:**
| Rola | Poziom domyślny | Uwagi |
|------|-----------------|-------|
| ADMIN | FULL | Pełny dostęp do wszystkich pokojów |
| PRODUCTION_MANAGER | MANAGE | Zarządzanie wszystkimi pokojami |
| Room Manager | MANAGE | Tylko dla przypisanego pokoju (`roomManagerUserId`) |
| Supervisor | MANAGE | Tylko dla przypisanego pokoju (`supervisorId`) |
| PRODUCTION | OPERATE | Brygadzista - operowanie we wszystkich pokojach |
| OPERATOR (przypisany) | OPERATE | Tylko w przypisanym pokoju |
| OPERATOR (nieprzypisany) | VIEW | Podgląd innych pokojów |
| GRAPHIC_DESIGNER | VIEW | Tylko podgląd |
| SALES_* | NONE | Brak dostępu do produkcji |

### 2.3 Integracja z zamówieniami

- Automatyczne tworzenie zlecenia produkcyjnego przy zmianie statusu zamówienia na "in_production"
- Aktualizacja statusu zamówienia przy zakończeniu produkcji
- Sprawdzanie dostępności materiałów przed rozpoczęciem produkcji

#### 2.3.1 Stan wdrożenia (2025-12-06)

- Tabele `ProductionRoom`, `WorkCenter`, `WorkStation`, `ProductionPath`, `ProductionOrder`, `ProductionOperation` są utworzone w Supabase (migracje 20251205 i 20251206).
- Backend posiada helpery `createProductionOrdersForOrder` i `cancelProductionOrdersForOrder` operujące na tych tabelach.
- Endpoint `PATCH /api/orders/:id/status`:
  - przy przejściu na `APPROVED` automatycznie tworzy zlecenia produkcyjne dla zamówienia,
  - przy przejściu na `CANCELLED` automatycznie anuluje powiązane zlecenia produkcyjne.
- W widoku zamówień backend oblicza pole `productionProgress` na podstawie `ProductionOrder` i `ProductionOperation`, które może być używane do wizualizacji postępu (paski postępu) w panelu.
- Helper `createProductionOrdersForOrder` grupuje pozycje zamówienia według `Product.productionPath` i dla każdej unikalnej ścieżki tworzy jedno `ProductionWorkOrder` (nagłówek zlecenia produkcyjnego dla pokoju produkcyjnego) zawierające wszystkie powiązane `ProductionOrder`.
- Dla `ProductionWorkOrder` dostępny jest wydruk PDF karty zlecenia produkcyjnego dla pokoju produkcyjnego, który pokazuje:
  - nagłówek (pokój produkcyjny, numer ZP, numer zamówienia, klient, priorytet),
  - tabelę pozycji z lokalizacją, ilością całkowitą oraz podziałem na projekty (`selectedProjects`, `projectQuantities`, `quantitySource`),
  - sekcję podpisów (wydaje/przyjmuje/zakończył) i stopkę na dole strony.

Docelowo (zgodnie z powyższą specyfikacją) przejście na `IN_PRODUCTION` może stać się głównym wyzwalaczem tworzenia zleceń, ale aktualna implementacja wykorzystuje status `APPROVED`.

---

## 3. API Backend (Express)

### 3.1 Endpointy - Zarządzanie Pokojami Produkcyjnymi

```javascript
// GET /api/production/rooms - lista pokoi produkcyjnych
// POST /api/production/rooms - tworzenie pokoju
// GET /api/production/rooms/:id - szczegóły pokoju
// PATCH /api/production/rooms/:id - aktualizacja pokoju
// DELETE /api/production/rooms/:id - usuwanie pokoju

// Przykład implementacji
app.get('/api/production/rooms', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('ProductionRoom')
      .select(`
        *,
        supervisor:User(id, name, email),
        workCenters:WorkCenter(id, name, type)
      `)
      .eq('isActive', true)
      .order('name');
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 3.2 Endpointy - Zarządzanie Gniazdami Produkcyjnymi

```javascript
// GET /api/production/work-centers - lista gniazd produkcyjnych
// POST /api/production/work-centers - tworzenie gniazda
// GET /api/production/work-centers/:id - szczegóły gniazda
// PATCH /api/production/work-centers/:id - aktualizacja gniazda
// DELETE /api/production/work-centers/:id - usuwanie gniazda
// GET /api/production/work-centers/available - dostępne gniazda (dla harmonogramu)

app.get('/api/production/work-centers', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('WorkCenter')
      .select(`
        *,
        room:ProductionRoom(id, name, code),
        workStations:WorkStation(id, name, type, status)
      `)
      .eq('isActive', true)
      .order('room_id, name');
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 3.3 Endpointy - Zarządzanie Stanowiskami Roboczymi

```javascript
// GET /api/production/work-stations - lista stanowisk roboczych
// POST /api/production/work-stations - tworzenie stanowiska
// GET /api/production/work-stations/:id - szczegóły stanowiska
// PATCH /api/production/work-stations/:id - aktualizacja stanowiska
// DELETE /api/production/work-stations/:id - usuwanie stanowiska
// GET /api/production/work-stations/available - dostępne stanowiska (dla harmonogramu)

app.get('/api/production/work-stations', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('WorkStation')
      .select(`
        *,
        workCenter:WorkCenter(id, name, code),
        operator:User(id, name, email)
      `)
      .eq('isActive', true)
      .order('work_center_id, name');
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 3.3 Endpointy - Ścieżki Produkcyjne

```javascript
// GET /api/production/paths - lista ścieżek
// POST /api/production/paths - tworzenie ścieżki
// GET /api/production/paths/:id - szczegóły ścieżki
// PATCH /api/production/paths/:id - aktualizacja ścieżki
// DELETE /api/production/paths/:id - usuwanie ścieżki
// POST /api/production/paths/:id/duplicate - duplikowanie ścieżki

app.post('/api/production/paths', async (req, res) => {
  try {
    const { productId, name, steps } = req.body;
    
    // Walidacja operacji
    const totalEstimatedTime = operations.reduce((sum, operation) => sum + (operation.estimatedTime || 0), 0);
    
    const { data, error } = await supabase
      .from('ProductionPath')
      .insert({
        productId,
        name,
        operations,
        estimatedTime: totalEstimatedTime
      })
      .select()
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

#### 3.3.1 Przykład ścieżki: druk solventowy – gotowy projekt vs nowy projekt

Dla druku solventowego wyróżniamy dwa typowe warianty przepływu:

- **A. Gotowy projekt** – plik/projekt został przygotowany wcześniej, a handlowiec
  wybiera go w formularzu zamówienia (ma numery projektów);
- **B. Nowy projekt** – klient zamawia nowy projekt i nie podaje numerów projektów,
  pozycja zamówienia trafia najpierw do modułu Grafiki (GraphicTask), a dopiero potem
  na produkcję.

Warianty te odwzorowujemy dwiema ścieżkami `ProductionPath` dla tego samego produktu.

**Ścieżka A – Solvent (gotowy projekt)**

Używana, gdy pozycja zamówienia ma przypisane istniejące projekty.

```json
[
  {
    "operation": 1,
    "phase": "PREP",
    "operationType": "prepress_layout",
    "name": "Rozkład matryc / impozycja (Grafika)",
    "description": "Ułożenie elementów na arkuszu do druku solventowego.",
    "workCenterType": "graphic_prepress",
    "estimatedTime": 10
  },
  {
    "operation": 2,
    "phase": "OP",
    "operationType": "solvent",
    "name": "Druk solventowy",
    "workCenterType": "solvent",
    "estimatedTime": 30
  },
  {
    "operation": 3,
    "phase": "PACK",
    "operationType": "packing",
    "name": "Pakowanie",
    "estimatedTime": 10
  }
]
```

**Ścieżka B – Solvent (nowy projekt)**

Używana, gdy w zamówieniu **nie podano numerów projektów** – pozycja trafia do działu
Grafiki, który przygotowuje nowy projekt, a następnie wykonuje impozycję.

```json
[
  {
    "operation": 1,
    "phase": "PREP",
    "operationType": "graphic_design",
    "name": "Przygotowanie plików projektu (Grafika)",
    "description": "Projektowanie / obróbka plików na potrzeby produkcji.",
    "workCenterType": "graphic_design",
    "estimatedTime": 30
  },
  {
    "operation": 2,
    "phase": "PREP",
    "operationType": "prepress_layout",
    "name": "Rozkład matryc / impozycja (Grafika)",
    "estimatedTime": 10
  },
  {
    "operation": 3,
    "phase": "OP",
    "operationType": "solvent",
    "name": "Druk solventowy",
    "workCenterType": "solvent",
    "estimatedTime": 30
  },
  {
    "operation": 4,
    "phase": "PACK",
    "operationType": "packing",
    "name": "Pakowanie",
    "estimatedTime": 10
  }
]
```

Powiązanie z logiką zamówień:

- jeśli handlowiec **poda numery projektów** w pozycji zamówienia → system używa
  ścieżki A (pomijamy etap `graphic_design`, realizujemy tylko impozycję + druk);
- jeśli **nie poda numerów projektów** → pozycja zamówienia trafia do modułu Grafika
  jako zadanie (GraphicTask) i jest obsługiwana ścieżką B, w której pierwsza operacja
  `graphic_design` jest wykonywana przez dział Grafika, a dopiero potem uruchamiane
  są operacje `prepress_layout` i `solvent`.

### 3.4 Endpointy - Zlecenia Produkcyjne

```javascript
// GET /api/production/orders - lista zleceń
// POST /api/production/orders - tworzenie zlecenia
// GET /api/production/orders/:id - szczegóły zlecenia
// PATCH /api/production/orders/:id - aktualizacja zlecenia
// POST /api/production/orders/from-order/:orderId - tworzenie z zamówienia
// GET /api/production/orders/active - aktywne zlecenia (dla panelu operatora)

app.post('/api/production/orders/from-order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // Pobranie zamówienia
    const { data: order, error: orderError } = await supabase
      .from('Order')
      .select('*, items:OrderItem(*)')
      .eq('id', orderId)
      .single();
    
    if (orderError) throw orderError;
    
    // Tworzenie zleceń produkcyjnych dla każdego itemu
    const productionOrders = [];
    
    for (const item of order.items) {
      // Pobranie ścieżki produkcyjnej dla produktu
      const { data: path } = await supabase
        .from('ProductionPath')
        .select('*')
        .eq('productId', item.productId)
        .eq('isActive', true)
        .single();
      
      const orderNumber = `PROD-${new Date().getFullYear()}-${String(orderId).padStart(4, '0')}`;
      
      const { data: prodOrder } = await supabase
        .from('ProductionOrder')
        .insert({
          orderNumber,
          sourceOrderId: orderId,
          productId: item.productId,
          quantity: item.quantity,
          productionPathId: path?.id,
          priority: order.priority || 3,
          plannedEndDate: order.deliveryDate
        })
        .select()
        .single();
      
      // Tworzenie operacji zlecenia
      if (path?.operations) {
        const operations = path.operations.map((operation, index) => ({
          productionOrderId: prodOrder.id,
          operationNumber: index + 1,
          operationType: operation.operationType,
          workStationId: operation.workStationId,
          plannedTime: operation.estimatedTime,
          status: 'pending'
        }));
        
        await supabase.from('ProductionOperation').insert(operations);
      }
      
      productionOrders.push(prodOrder);
    }
    
    // Aktualizacja statusu zamówienia
    await supabase
      .from('Order')
      .update({ status: 'in_production' })
      .eq('id', orderId);
    
    res.json(productionOrders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 3.5 Endpointy - Operacje Produkcyjne

```javascript
// POST /api/production/operations/:operationId/start - rozpoczęcie operacji
// POST /api/production/operations/:operationId/complete - zakończenie operacji
// POST /api/production/operations/:operationId/pause - wstrzymanie operacji
// POST /api/production/operations/:operationId/report-problem - zgłoszenie problemu

app.post('/api/production/operations/:operationId/start', async (req, res) => {
  try {
    const { operationId } = req.params;
    const { operatorId } = req.body;
    
    // Rozpoczęcie operacji
    const { data, error } = await supabase
      .from('ProductionOperation')
      .update({
        status: 'active',
        operatorId,
        startTime: new Date().toISOString()
      })
      .eq('id', operationId)
      .select()
      .single();
    
    if (error) throw error;
    
    // Aktualizacja statusu zlecenia
    await supabase
      .from('ProductionOrder')
      .update({
        status: 'in_progress',
        actualStartDate: new Date().toISOString()
      })
      .eq('id', data.productionOrderId);
    
    // Logowanie operacji
    await supabase.from('ProductionLog').insert({
      productionOrderId: data.productionOrderId,
      action: 'operation_started',
      userId: operatorId,
      notes: `Operacja ${data.operationNumber} rozpoczęta`
    });
    
    // WebSocket broadcast
    broadcastProductionUpdate({
      type: 'OPERATION_STARTED',
      operationId,
      orderId: data.productionOrderId
    });
    
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## 4. Frontend Components

### 4.1 Panel Operatora (production.html)

Panel operatora to główny interfejs dla osób wykonujących operacje produkcyjne. Został zbudowany w technologii Vanilla JS z real-time aktualizacjami przez WebSocket.

#### 4.1.1 Funkcje UI/UX

**Statystyki produkcyjne (górny pasek)**
- Liczba zleceń w kolejce (nieprzypisanych)
- Liczba aktywnych zleceń (w realizacji)
- Liczba zleceń zakończonych dzisiaj

**Toolbar (pod statystykami)**
- **Przycisk odświeżania** - ręczne odświeżenie listy zleceń
- **Przełącznik widoku** - kafelki → kompaktowy → lista
- **Sortowanie**:
  - ⚡ Priorytet (domyślne)
  - 📌 Przypięte (przypięte zawsze na górze)
  - 📦 Ilość ↑/↓
  - 📅 Data
- **Filtry szybkie** z etykietą "Filtry:":
  - 🔥 **PILNE** - tylko zlecenia priorytet 1-2
  - ⚡ **MAŁE** - tylko zlecenia ≤20 szt (szybkie do wykonania)
  - 📌 **MOJE** - tylko przypięte zlecenia

**Przypinanie zleceń**
- Każde zlecenie ma przycisk pinezki (📍/📌) przy numerze
- Kliknięcie przypina/zdejmuje zlecenie
- Przypięte zlecenia mają żółtą ramkę i poświatę
- Stan przypięć zapisywany w localStorage
- Przypięte zawsze na górze listy (chyba że sortowanie po przypiętych)

**Tryby widoku**
- **Kafelki** (domyślny) - duże karty z pełnymi informacjami
- **Kompaktowy** - mniejsze karty, więcej na ekranie
- **Lista** - bardzo kompaktowy, tylko najważniejsze info w jednej linii

**Szacowany czas operacji**
- Obok ilości wyświetlany szacowany czas: ⏱️ ~25 min
- Obliczany na podstawie `plannedTime` z operacji
- Algorytm: `czas = TPZ + ilość × czas_jednostkowy`

#### 4.1.2 Implementacja techniczna

```javascript
class ProductionOperatorPanel {
  constructor() {
    this.currentOrders = [];
    this.filteredOrders = [];
    this.userRole = null;
    this.viewMode = localStorage.getItem('prodViewMode') || 'grid';
    this.sortMode = localStorage.getItem('prodSortMode') || 'priority';
    this.activeFilters = {
      urgent: false,
      small: false,
      pinned: false
    };
    this.pinnedOrders = JSON.parse(localStorage.getItem('pinnedOrders') || '[]');
    this.init();
  }

  async init() {
    await this.loadUserData();
    await this.loadActiveOrders();
    this.render();
    this.setupWebSocket();
    this.setupEventListeners();
  }

  render() {
    const container = document.getElementById('production-dashboard');
    const activeCount = this.orders.filter(o => o.status === 'in_progress').length;
    const queueCount = this.orders.filter(o => o.status === 'approved' || o.status === 'planned').length;
    const completedCount = this.orders.filter(o => o.status === 'completed' && 
      new Date(o.updatedAt).toDateString() === new Date().toDateString()).length;
    
    container.innerHTML = `
      <header class="production-header">
        <div class="user-info">
          <span>Zalogowany: ${this.userName}</span>
          <span>Rola: ${this.userRole}</span>
        </div>
        <div class="header-actions">
          <button id="logout-btn" class="btn-danger">Wyloguj</button>
        </div>
      </header>
      
      <!-- Statystyki -->
      <div class="prod-stats">
        <div class="prod-stat queue">
          <div class="prod-stat-value">${queueCount}</div>
          <div class="prod-stat-label">W kolejce</div>
        </div>
        <div class="prod-stat active">
          <div class="prod-stat-value">${activeCount}</div>
          <div class="prod-stat-label">Aktywne</div>
        </div>
        <div class="prod-stat completed">
          <div class="prod-stat-value">${completedCount}</div>
          <div class="prod-stat-label">Dziś</div>
        </div>
      </div>
      
      <!-- Toolbar -->
      <div class="prod-toolbar">
        <div class="prod-toolbar-left">
          <button class="prod-tool-btn" onclick="refreshOrders()" title="Odśwież">
            <i class="fas fa-sync-alt"></i>
          </button>
          <button class="prod-tool-btn" onclick="toggleViewMode()" id="viewModeBtn" title="Zmień widok">
            <i class="fas fa-th-large"></i>
          </button>
          <select class="prod-tool-select" id="sortSelect" onchange="sortOrders()">
            <option value="priority">⚡ Priorytet</option>
            <option value="pinned">📌 Przypięte</option>
            <option value="quantity-asc">📦 Ilość ↑</option>
            <option value="quantity-desc">📦 Ilość ↓</option>
            <option value="date">📅 Data</option>
          </select>
        </div>
        <div class="prod-toolbar-right">
          <span class="prod-toolbar-label"><i class="fas fa-filter"></i> Filtry:</span>
          <button class="prod-filter-chip urgent" onclick="toggleFilter('urgent')" id="filterUrgent">
            <i class="fas fa-fire"></i> PILNE
          </button>
          <button class="prod-filter-chip small" onclick="toggleFilter('small')" id="filterSmall">
            <i class="fas fa-feather"></i> MAŁE
          </button>
          <button class="prod-filter-chip pinned" onclick="toggleFilter('pinned')" id="filterPinned">
            <i class="fas fa-thumbtack"></i> MOJE
          </button>
        </div>
      </div>
      
      <main class="production-main" id="ordersList">
        <div class="orders-grid ${this.viewMode}">
          ${this.filteredOrders.map(order => this.renderOrderTile(order)).join('')}
        </div>
      </main>
    `;
  }

  renderOrderTile(order) {
    const progress = (order.completedQuantity / order.quantity) * 100;
    const statusClass = this.getStatusClass(order.status);
    
    return `
      <div class="order-tile ${statusClass}" data-order-id="${order.id}">
        <div class="tile-header">
          <h3>${order.orderNumber}</h3>
          <span class="status-badge ${order.status}">${this.getStatusText(order.status)}</span>
        </div>
        
        <div class="tile-content">
          <div class="product-info">
            <strong>${order.productName}</strong>
            <small>${order.quantity} szt.</small>
          </div>
          
          <div class="progress-section">
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${progress}%"></div>
            </div>
            <span class="progress-text">${order.completedQuantity}/${order.quantity} szt.</span>
          </div>
          
          <div class="current-step">
            <strong>Aktualny krok:</strong>
            <span>${order.currentStep?.operation || 'Brak'}</span>
          </div>
        </div>
        
        <div class="tile-actions">
          ${order.status === 'pending' ? `
            <button class="action-btn start-btn" data-order-id="${order.id}">
              ▶️ Rozpocznij
            </button>
          ` : ''}
          
          ${order.status === 'in_progress' ? `
            <button class="action-btn pause-btn" data-order-id="${order.id}">
              ⏸️ Przerwa
            </button>
            <button class="action-btn complete-btn" data-order-id="${order.id}">
              ✅ Zakończ
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  getStatusClass(status) {
    const classes = {
      'pending': 'status-pending',
      'in_progress': 'status-active',
      'completed': 'status-completed',
      'paused': 'status-paused'
    };
    return classes[status] || 'status-unknown';
  }

  setupWebSocket() {
    this.ws = new WebSocket('ws://localhost:3001/production');
    
    this.ws.onmessage = (event) => {
      const update = JSON.parse(event.data);
      this.handleRealtimeUpdate(update);
    };
  }

  handleRealtimeUpdate(update) {
    switch (update.type) {
      case 'ORDER_UPDATED':
        this.updateOrderInList(update.data);
        break;
      case 'NEW_ORDER':
        this.addOrderToList(update.data);
        break;
      case 'OPERATION_COMPLETED':
        this.updateOperationStatus(update.data);
        break;
      case 'SYSTEM_ALERT':
        this.showAlert(update.message, update.level);
        break;
    }
  }
}

### 4.2 Panel Admina Produkcji (admin/production.html)

```javascript
class ProductionAdminPanel {
  constructor() {
    this.currentTab = 'rooms';
    this.rooms = [];
    this.workCenters = [];
    this.workStations = [];
    this.paths = [];
    this.init();
  }

  render() {
    const container = document.getElementById('production-admin');
    container.innerHTML = `
      <div class="admin-tabs">
        <button class="tab-btn ${this.currentTab === 'rooms' ? 'active' : ''}" 
                data-tab="rooms">📍 Pokoje</button>
        <button class="tab-btn ${this.currentTab === 'work-centers' ? 'active' : ''}" 
                data-tab="work-centers">🔧 Gniazda</button>
        <button class="tab-btn ${this.currentTab === 'work-stations' ? 'active' : ''}" 
                data-tab="work-stations">🛠️ Stanowiska</button>
        <button class="tab-btn ${this.currentTab === 'paths' ? 'active' : ''}" 
                data-tab="paths">🗺️ Ścieżki</button>
      </div>
      
      <div class="tab-content">
        <div class="tab-header">
          <h2>${this.getTabTitle()}</h2>
          <button class="btn-primary" id="add-new-btn">
            + Dodaj ${this.getTabItemName()}
          </button>
        </div>
        
        <div id="tab-content">
          ${this.renderTabContent()}
        </div>
      </div>
    `;
  }

  renderTabContent() {
    switch (this.currentTab) {
      case 'rooms':
        return this.renderRoomsContent();
      case 'work-centers':
        return this.renderWorkCentersContent();
      case 'work-stations':
        return this.renderWorkStationsContent();
      case 'paths':
        return this.renderPathsContent();
      default:
        return '';
    }
  }

  renderRoomsContent() {
    return `
      <div class="rooms-grid">
        ${this.rooms.map(room => `
          <div class="room-card">
            <h3>${room.name}</h3>
            <p>Kod: ${room.code}</p>
            <p>Powierzchnia: ${room.area}m²</p>
            <p>Gniazda: ${room.workCenters?.length || 0}</p>
            <div class="card-actions">
              <button class="btn-secondary" onclick="editRoom(${room.id})">Edytuj</button>
              <button class="btn-danger" onclick="deleteRoom(${room.id})">Usuń</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  renderWorkCentersContent() {
    return `
      <div class="work-centers-grid">
        ${this.workCenters.map(center => `
          <div class="work-center-card">
            <h3>${center.name}</h3>
            <p>Kod: ${center.code}</p>
            <p>Typ: ${center.type}</p>
            <p>Stanowiska: ${center.workStations?.length || 0}</p>
            <div class="card-actions">
              <button class="btn-secondary" onclick="editWorkCenter(${center.id})">Edytuj</button>
              <button class="btn-danger" onclick="deleteWorkCenter(${center.id})">Usuń</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  renderWorkStationsContent() {
    return `
      <div class="work-stations-grid">
        ${this.workStations.map(station => `
          <div class="work-station-card">
            <h3>${station.name}</h3>
            <p>Kod: ${station.code}</p>
            <p>Typ: ${station.type}</p>
            <p>Status: ${station.status}</p>
            <div class="card-actions">
              <button class="btn-secondary" onclick="editWorkStation(${station.id})">Edytuj</button>
              <button class="btn-danger" onclick="deleteWorkStation(${station.id})">Usuń</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
}
```

---

## 5. WebSocket - Real-time Updates

### 5.1 Server Setup

```javascript
// server.js - WebSocket dla produkcji
const productionWss = new WebSocketServer({ port: 3001 });

productionWss.on('connection', (ws, req) => {
  const userId = req.user?.id; // z middleware autentykacji
  
  ws.on('message', async (message) => {
    const data = JSON.parse(message);
    
    switch (data.type) {
      case 'SUBSCRIBE_ORDERS':
        ws.userId = userId;
        ws.subscribeType = 'orders';
        break;
        
      case 'SUBSCRIBE_ROOM':
        ws.userId = userId;
        ws.subscribeType = 'room';
        ws.roomId = data.roomId;
        break;
    }
  });
});

// Broadcast funkcje
function broadcastProductionUpdate(update) {
  productionWss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      // Filtrowanie według subskrypcji
      if (shouldSendUpdate(client, update)) {
        client.send(JSON.stringify(update));
      }
    }
  });
}

function shouldSendUpdate(client, update) {
  switch (update.type) {
    case 'ORDER_UPDATED':
      return client.subscribeType === 'orders';
    case 'ROOM_STATUS_CHANGED':
      return client.subscribeType === 'room' && client.roomId === update.roomId;
    default:
      return true;
  }
}
```

### 5.2 Client Implementation

```javascript
// production.html - WebSocket client
class ProductionWebSocket {
  constructor(updateCallback) {
    this.ws = null;
    this.updateCallback = updateCallback;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.connect();
  }

  connect() {
    this.ws = new WebSocket('ws://localhost:3001/production');
    
    this.ws.onopen = () => {
      console.log('Connected to production WebSocket');
      this.reconnectAttempts = 0;
      
      // Subskrypcja aktualizacji zamówień
      this.ws.send(JSON.stringify({
        type: 'SUBSCRIBE_ORDERS'
      }));
    };
    
    this.ws.onmessage = (event) => {
      const update = JSON.parse(event.data);
      this.updateCallback(update);
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket connection closed');
      this.attemptReconnect();
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connect();
      }, 2000 * this.reconnectAttempts);
    }
  }
}
```

---

## 6. System Szacowania Czasów Produkcyjnych

### 6.1 Rozszerzenie Schematu Bazy Danych

```sql
-- Szablony czasów operacji
CREATE TABLE public."TimeEstimationTemplate" (
  id serial PRIMARY KEY,
  name varchar(100) NOT NULL,
  "operationType" varchar(50) NOT NULL, -- laser_engrave, uv_print, cutting, assembly
  "standardTime" integer NOT NULL, -- czas jednostkowy w minutach
  "setupTime" integer DEFAULT 0, -- czas przygotowawczo-zakończeniowy
  "bufferTime" integer DEFAULT 0, -- czas bufora na nieprzewidziane sytuacje
  "materialFactor" decimal(3,2) DEFAULT 1.0, -- współczynnik dla materiału
  "complexityFactor" decimal(3,2) DEFAULT 1.0, -- współczynnik dla złożoności
  "machineEfficiencyFactor" decimal(3,2) DEFAULT 1.0, -- wydajność maszyny
  "operatorSkillFactor" decimal(3,2) DEFAULT 1.0, -- umiejętności operatora
  description text,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP
);

-- Historyczne czasy wykonania operacji
CREATE TABLE public."OperationTimeHistory" (
  id serial PRIMARY KEY,
  "productionOperationId" integer REFERENCES "ProductionOperation"(id) ON DELETE CASCADE,
  "plannedTime" integer NOT NULL, -- planowany czas
  "actualTime" integer NOT NULL, -- rzeczywisty czas
  "operatorId" text REFERENCES "User"(id) ON DELETE SET NULL,
  "workStationId" integer REFERENCES "WorkStation"(id) ON DELETE SET NULL,
  "materialType" varchar(50), -- typ materiału
  "complexity" varchar(20), -- simple, medium, complex
  "qualityIssues" boolean DEFAULT false, -- czy były problemy z jakością
  "notes" text,
  "recordedAt" timestamp DEFAULT CURRENT_TIMESTAMP
);

-- Kalibracje czasów
CREATE TABLE public."TimeCalibration" (
  id serial PRIMARY KEY,
  "templateId" integer REFERENCES "TimeEstimationTemplate"(id) ON DELETE CASCADE,
  "oldStandardTime" integer NOT NULL,
  "newStandardTime" integer NOT NULL,
  "calibrationReason" varchar(200), -- manual, auto_learning, operator_feedback
  "sampleSize" integer NOT NULL, -- liczba operacji w próbce
  "averageActualTime" decimal(8,2), -- średni rzeczywisty czas
  "calibrationAccuracy" decimal(5,2), -- dokładność kalibracji w %
  "calibratedBy" text REFERENCES "User"(id) ON DELETE SET NULL,
  "calibratedAt" timestamp DEFAULT CURRENT_TIMESTAMP
);
```

### 6.2 API Endpoints dla Szacowania Czasów

```javascript
// GET /api/production/time-templates - pobierz szablony czasów
app.get('/api/production/time-templates', authenticateToken, requireRole(['ADMIN', 'PRODUCTION_MANAGER']), async (req, res) => {
  try {
    const { operationType, active } = req.query;
    let query = 'SELECT * FROM "TimeEstimationTemplate" WHERE 1=1';
    const params = [];
    
    if (operationType) {
      params.push(operationType);
      query += ` AND "operationType" = $${params.length}`;
    }
    
    if (active !== undefined) {
      params.push(active === 'true');
      query += ` AND "isActive" = $${params.length}`;
    }
    
    query += ' ORDER BY name';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/production/time-templates - utwórz szablon czasu
app.post('/api/production/time-templates', authenticateToken, requireRole(['ADMIN', 'PRODUCTION_MANAGER']), validateTimeTemplate, async (req, res) => {
  try {
    const { name, operationType, standardTime, setupTime, bufferTime, 
            materialFactor, complexityFactor, machineEfficiencyFactor, 
            operatorSkillFactor, description } = req.body;
    
    const result = await pool.query(`
      INSERT INTO "TimeEstimationTemplate" 
      (name, "operationType", "standardTime", "setupTime", "bufferTime", 
       "materialFactor", "complexityFactor", "machineEfficiencyFactor", 
       "operatorSkillFactor", description)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [name, operationType, standardTime, setupTime, bufferTime, 
        materialFactor, complexityFactor, machineEfficiencyFactor, 
        operatorSkillFactor, description]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/production/calculate-time - oblicz szacowany czas
app.post('/api/production/calculate-time', authenticateToken, async (req, res) => {
  try {
    const { operations, materialType, complexity, workStationId } = req.body;
    
    let totalTime = 0;
    const detailedTimes = [];
    
    for (const operation of operations) {
      // Pobierz szablon czasu dla operacji
      const templateResult = await pool.query(
        'SELECT * FROM "TimeEstimationTemplate" WHERE "operationType" = $1 AND "isActive" = true',
        [operation.operationType]
      );
      
      if (templateResult.rows.length === 0) {
        return res.status(400).json({ error: `Brak szablonu czasu dla operacji: ${operation.operationType}` });
      }
      
      const template = templateResult.rows[0];
      
      // Oblicz czas z uwzględnieniem współczynników
      const materialFactor = operation.materialFactor || template.materialFactor;
      const complexityFactor = operation.complexityFactor || template.complexityFactor;
      
      const operationTime = Math.round(
        (template.standardTime * materialFactor * complexityFactor) + 
        template.setupTime + 
        template.bufferTime
      );
      
      totalTime += operationTime;
      detailedTimes.push({
        operationType: operation.operationType,
        templateTime: template.standardTime,
        calculatedTime: operationTime,
        factors: { materialFactor, complexityFactor }
      });
    }
    
    res.json({
      totalTime,
      estimatedHours: Math.round(totalTime / 60 * 100) / 100,
      detailedTimes
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/production/record-operation-time - zapisz rzeczywisty czas operacji
app.post('/api/production/record-operation-time', authenticateToken, async (req, res) => {
  try {
    const { productionOperationId, actualTime, materialType, complexity, qualityIssues, notes } = req.body;
    
    // Pobierz planowany czas
    const operationResult = await pool.query(
      'SELECT "plannedTime", "operatorId", "workStationId" FROM "ProductionOperation" WHERE id = $1',
      [productionOperationId]
    );
    
    if (operationResult.rows.length === 0) {
      return res.status(404).json({ error: 'Operacja nie znaleziona' });
    }
    
    const operation = operationResult.rows[0];
    
    // Zapisz do historii
    await pool.query(`
      INSERT INTO "OperationTimeHistory" 
      ("productionOperationId", "plannedTime", "actualTime", "operatorId", 
       "workStationId", "materialType", "complexity", "qualityIssues", "notes")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [productionOperationId, operation.plannedTime, actualTime, 
        operation.operatorId, operation.workStationId, 
        materialType, complexity, qualityIssues, notes]);
    
    // Aktualizuj operację
    await pool.query(
      'UPDATE "ProductionOperation" SET "actualTime" = $1 WHERE id = $2',
      [actualTime, productionOperationId]
    );
    
    res.json({ message: 'Czas operacji zapisany' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/production/estimate-completion-date - szacuj datę zakończenia zamówienia
app.post('/api/production/estimate-completion-date', authenticateToken, async (req, res) => {
  try {
    const { products, priority = 'normal', workCenterId } = req.body;
    
    // Krok 1: Pobierz ścieżki produkcyjne dla wszystkich produktów
    const productIds = products.map(p => p.productId);
    const pathsResult = await pool.query(`
      SELECT p.id as "productId", pp.operations, pp."estimatedTime" as "pathTime"
      FROM "Product" p
      JOIN "ProductionPath" pp ON p.id = pp."productId"
      WHERE p.id = ANY($1) AND pp."isActive" = true
    `, [productIds]);
    
    if (pathsResult.rows.length !== products.length) {
      return res.status(400).json({ 
        error: 'Brak ścieżki produkcyjnej dla niektórych produktów' 
      });
    }
    
    // Krok 2: Sprawdź dostępność materiałów
    const materialCheck = await checkMaterialAvailability(products);
    
    // Krok 3: Sprawdź planowane konserwacje stanowisk
    const maintenanceCheck = await checkMaintenanceWindows(Object.keys(
      pathsResult.rows.reduce((acc, path) => {
        path.operations.forEach(op => {
          if (op.workStationId) acc[op.workStationId] = true;
        });
        return acc;
      }, {})
    ));
    
    // Krok 4: Oblicz całkowity czas produkcji
    let totalProductionTime = 0;
    const operationsByWorkCenter = {};
    
    for (const product of products) {
      const path = pathsResult.rows.find(p => p.productId === product.productId);
      const productTime = path.pathTime * product.quantity;
      totalProductionTime += productTime;
      
      // Grupuj operacje po gniazdach produkcyjnych
      for (const operation of path.operations) {
        const workCenterId = operation.workCenterId;
        if (!operationsByWorkCenter[workCenterId]) {
          operationsByWorkCenter[workCenterId] = 0;
        }
        operationsByWorkCenter[workCenterId] += operation.estimatedTime * product.quantity;
      }
    }
    
    // Krok 5: Sprawdź aktualne obciążenie gniazd produkcyjnych
    const queueResult = await pool.query(`
      SELECT 
        po."assignedWorkCenterId",
        COUNT(*) as "queueCount",
        SUM(po."estimatedTime") as "totalQueueTime"
      FROM "ProductionOrder" po
      WHERE po.status IN ('planned', 'in_progress')
      AND po."assignedWorkCenterId" = ANY($1)
      GROUP BY po."assignedWorkCenterId"
    `, [Object.keys(operationsByWorkCenter)]);
    
    // Krok 6: Znajdź wąskie gardło
    let maxQueueTime = 0;
    let bottleneckWorkCenter = null;
    
    for (const [workCenterId, requiredTime] of Object.entries(operationsByWorkCenter)) {
      const queue = queueResult.rows.find(q => q.assignedWorkCenterId == workCenterId);
      const queueTime = queue ? parseInt(queue.totalQueueTime) : 0;
      const totalTime = queueTime + requiredTime;
      
      if (totalTime > maxQueueTime) {
        maxQueueTime = totalTime;
        bottleneckWorkCenter = workCenterId;
      }
    }
    
    // Krok 7: Oblicz datę zakończenia z uwzględnieniem konserwacji
    const now = new Date();
    const workingHoursStart = 8; // 8:00
    const workingHoursEnd = 16; // 16:00
    const workingDays = [1, 2, 3, 4, 5]; // Poniedziałek - Piątek
    
    let completionDate = new Date(now);
    let remainingMinutes = maxQueueTime + totalProductionTime;
    
    // Dodaj czas na konserwację
    if (maintenanceCheck.totalMaintenanceTime > 0) {
      remainingMinutes += maintenanceCheck.totalMaintenanceTime;
    }
    
    // Dodaj współczynnik priorytetu
    if (priority === 'rush') {
      remainingMinutes = Math.round(remainingMinutes * 0.7); // 30% szybciej
    }
    
    while (remainingMinutes > 0) {
      completionDate.setMinutes(completionDate.getMinutes() + 1);
      
      // Sprawdź czy to godziny pracy i nie ma konserwacji
      const hour = completionDate.getHours();
      const dayOfWeek = completionDate.getDay();
      
      if (hour >= workingHoursStart && hour < workingHoursEnd && 
          workingDays.includes(dayOfWeek) && 
          !isInMaintenanceWindow(completionDate, maintenanceCheck.windows)) {
        remainingMinutes--;
      }
    }
    
    // Krok 8: Oblicz wynik pewności szacowania
    let confidenceScore = 'high';
    if (!materialCheck.allAvailable) confidenceScore = 'medium';
    if (maintenanceCheck.hasUpcomingMaintenance) confidenceScore = 'medium';
    if (maxQueueTime > totalProductionTime * 2) confidenceScore = 'low';
    
    // Krok 9: Pobierz informacje o wąskim gardle
    let bottleneckInfo = null;
    if (bottleneckWorkCenter) {
      const bottleneckResult = await pool.query(
        'SELECT name, code FROM "WorkCenter" WHERE id = $1',
        [bottleneckWorkCenter]
      );
      bottleneckInfo = bottleneckResult.rows[0];
    }
    
    // Krok 10: Oblicz opcję ekspresową
    let rushOption = null;
    if (priority === 'normal') {
      const rushDate = new Date(now);
      let rushMinutes = Math.round((maxQueueTime + totalProductionTime) * 0.7);
      
      while (rushMinutes > 0) {
        rushDate.setMinutes(rushDate.getMinutes() + 1);
        const hour = rushDate.getHours();
        const dayOfWeek = rushDate.getDay();
        
        if (hour >= workingHoursStart && hour < workingHoursEnd && 
            workingDays.includes(dayOfWeek) && 
            !isInMaintenanceWindow(rushDate, maintenanceCheck.windows)) {
          rushMinutes--;
        }
      }
      
      rushOption = {
        completionDate: rushDate.toISOString(),
        additionalCost: Math.round(totalProductionTime * 0.1), // 10% ceny za przyspieszenie
        timeSaved: Math.round((maxQueueTime + totalProductionTime) * 0.3)
      };
    }
    
    res.json({
      estimatedCompletionDate: completionDate.toISOString(),
      totalProductionTime: Math.round(totalProductionTime),
      queueTime: maxQueueTime,
      queuePosition: queueResult.rows.reduce((sum, q) => sum + parseInt(q.queueCount), 0),
      bottleneckWorkCenter: bottleneckInfo,
      operationsBreakdown: operationsByWorkCenter,
      rushOption,
      confidenceScore,
      materialAvailability: materialCheck,
      maintenanceWindows: maintenanceCheck,
      calculationFactors: {
        priority,
        workingHours: `${workingHoursStart}:00 - ${workingHoursEnd}:00`,
        workingDays: workingDays.length
      }
    });
    
  } catch (error) {
    console.error('Error estimating completion date:', error);
    res.status(500).json({ error: error.message });
  }
});

// Funkcje pomocnicze do sprawdzania dostępności
async function checkMaterialAvailability(products) {
  // TODO: Implementacja sprawdzania stanów magazynowych
  // Na podstawie tabeli Inventory i wymagań materiałowych produktów
  return {
    allAvailable: true,
    missingMaterials: [],
    restockDates: {}
  };
}

async function checkMaintenanceWindows(workStationIds) {
  try {
    const result = await pool.query(`
      SELECT 
        ws.id,
        ws.name,
        ws."maintenanceSchedule"
      FROM "WorkStation" ws
      WHERE ws.id = ANY($1) AND ws.status = 'maintenance'
    `, [workStationIds]);
    
    const windows = result.rows.map(station => ({
      workStationId: station.id,
      workStationName: station.name,
      schedule: station.maintenanceSchedule
    }));
    
    return {
      hasUpcomingMaintenance: windows.length > 0,
      totalMaintenanceTime: windows.length * 240, // 4h na konserwację
      windows
    };
  } catch (error) {
    return { hasUpcomingMaintenance: false, totalMaintenanceTime: 0, windows: [] };
  }
}

function isInMaintenanceWindow(date, maintenanceWindows) {
  // TODO: Implementacja sprawdzania czy data wypada w oknie konserwacji
  return false;
}

// POST /api/production/calibrate-times - kalibruj szablony czasów
app.post('/api/production/calibrate-times', authenticateToken, requireRole(['ADMIN', 'PRODUCTION_MANAGER']), async (req, res) => {
  try {
    const { operationType, minSampleSize = 10 } = req.body;
    
    // Pobierz historię czasów dla danego typu operacji
    const historyResult = await pool.query(`
      SELECT 
        t."operationType",
        t."standardTime" as "templateTime",
        AVG(h."actualTime") as "avgActualTime",
        COUNT(*) as "sampleSize",
        STDDEV(h."actualTime") as "stdDev"
      FROM "OperationTimeHistory" h
      JOIN "ProductionOperation" po ON h."productionOperationId" = po.id
      JOIN "TimeEstimationTemplate" t ON po."operationType" = t."operationType"
      WHERE t."operationType" = $1
      AND h."recordedAt" > NOW() - INTERVAL '30 days'
      GROUP BY t."operationType", t."standardTime"
      HAVING COUNT(*) >= $2
    `, [operationType, minSampleSize]);
    
    if (historyResult.rows.length === 0) {
      return res.status(400).json({ error: 'Niewystarczająca liczba próbek do kalibracji' });
    }
    
    const calibration = historyResult.rows[0];
    const newStandardTime = Math.round(calibration.avgActualTime);
    const accuracy = Math.round((1 - Math.abs(calibration.avgActualTime - calibration.templateTime) / calibration.templateTime) * 100 * 100) / 100;
    
    // Zapisz kalibrację
    await pool.query(`
      INSERT INTO "TimeCalibration" 
      ("templateId", "oldStandardTime", "newStandardTime", "calibrationReason", 
       "sampleSize", "averageActualTime", "calibrationAccuracy", "calibratedBy")
      SELECT t.id, t."standardTime", $1, 'auto_learning', $2, $3, $4, $5
      FROM "TimeEstimationTemplate" t 
      WHERE t."operationType" = $6
    `, [newStandardTime, calibration.sampleSize, calibration.avgActualTime, accuracy, req.user.id, operationType]);
    
    // Aktualizuj szablon
    await pool.query(
      'UPDATE "TimeEstimationTemplate" SET "standardTime" = $1 WHERE "operationType" = $2',
      [newStandardTime, operationType]
    );
    
    res.json({
      message: 'Kalibracja zakończona',
      oldTime: calibration.templateTime,
      newTime: newStandardTime,
      accuracy,
      sampleSize: calibration.sampleSize
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 6.3 Komponenty Frontend dla Zarządzania Czasami

```javascript
// TimeEstimationManager.js - zarządzanie szablonami czasów
class TimeEstimationManager {
  constructor() {
    this.templates = [];
    this.calibrations = [];
    this.init();
  }
  
  async init() {
    await this.loadTemplates();
    this.render();
  }
  
  async loadTemplates() {
    try {
      const response = await fetch('/api/production/time-templates');
      this.templates = await response.json();
    } catch (error) {
      console.error('Error loading time templates:', error);
    }
  }
  
  render() {
    return `
      <div class="time-estimation-manager">
        <div class="manager-header">
          <h2>Zarządzanie Czasami Produkcyjnymi</h2>
          <div class="header-actions">
            <button class="btn-primary" onclick="timeManager.showCreateTemplate()">
              Nowy Szablon Czasu
            </button>
            <button class="btn-secondary" onclick="timeManager.showCalibration()">
              Kalibruj Automatycznie
            </button>
            <button class="btn-secondary" onclick="timeManager.importTemplates()">
              Importuj CSV
            </button>
          </div>
        </div>
        
        <div class="templates-grid">
          ${this.renderTemplates()}
        </div>
        
        <div class="calibration-history">
          <h3>Historia Kalibracji</h3>
          ${this.renderCalibrationHistory()}
        </div>
      </div>
    `;
  }
  
  renderTemplates() {
    return this.templates.map(template => `
      <div class="time-template-card">
        <div class="template-header">
          <h4>${template.name}</h4>
          <span class="operation-type">${template.operationType}</span>
        </div>
        
        <div class="template-times">
          <div class="time-item">
            <label>Czas standardowy:</label>
            <span>${template.standardTime} min</span>
          </div>
          <div class="time-item">
            <label>Czas przygotowania:</label>
            <span>${template.setupTime} min</span>
          </div>
          <div class="time-item">
            <label>Bufor czasowy:</label>
            <span>${template.bufferTime} min</span>
          </div>
          <div class="time-item">
            <label>Całkowity czas:</label>
            <strong>${template.standardTime + template.setupTime + template.bufferTime} min</strong>
          </div>
        </div>
        
        <div class="template-factors">
          <h5>Współczynniki:</h5>
          <div class="factor-grid">
            <div class="factor-item">
              <label>Materiał:</label>
              <span>${template.materialFactor}x</span>
            </div>
            <div class="factor-item">
              <label>Złożoność:</label>
              <span>${template.complexityFactor}x</span>
            </div>
            <div class="factor-item">
              <label>Wydajność maszyny:</label>
              <span>${template.machineEfficiencyFactor}x</span>
            </div>
            <div class="factor-item">
              <label>Umiejętności operatora:</label>
              <span>${template.operatorSkillFactor}x</span>
            </div>
          </div>
        </div>
        
        <div class="template-actions">
          <button class="btn-secondary" onclick="timeManager.editTemplate(${template.id})">
            Edytuj
          </button>
          <button class="btn-secondary" onclick="timeManager.duplicateTemplate(${template.id})">
            Duplikuj
          </button>
          <button class="btn-danger" onclick="timeManager.deleteTemplate(${template.id})">
            Usuń
          </button>
        </div>
      </div>
    `).join('');
  }
  
  showCreateTemplate() {
    const modal = new TimeTemplateModal();
    modal.show();
  }
  
  async calculateProductionTime(operations) {
    try {
      const response = await fetch('/api/production/calculate-time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operations })
      });
      
      return await response.json();
    } catch (error) {
      console.error('Error calculating production time:', error);
      return null;
    }
  }
}

// TimeTemplateModal.js - modal do tworzenia/edycji szablonów
class TimeTemplateModal {
  constructor(template = null) {
    this.template = template;
    this.isEdit = !!template;
  }
  
  show() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content time-template-modal">
        <div class="modal-header">
          <h3>${this.isEdit ? 'Edytuj Szablon Czasu' : 'Nowy Szablon Czasu'}</h3>
          <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        
        <form id="time-template-form" class="template-form">
          <div class="form-row">
            <div class="form-group">
              <label for="template-name">Nazwa szablonu:</label>
              <input type="text" id="template-name" name="name" required 
                     value="${this.template?.name || ''}">
            </div>
            
            <div class="form-group">
              <label for="operation-type">Typ operacji:</label>
              <select id="operation-type" name="operationType" required>
                <option value="">Wybierz typ operacji</option>
                <option value="laser_engrave" ${this.template?.operationType === 'laser_engrave' ? 'selected' : ''}>
                  Grawerowanie laserowe
                </option>
                <option value="uv_print" ${this.template?.operationType === 'uv_print' ? 'selected' : ''}>
                  Druk UV
                </option>
                <option value="cutting" ${this.template?.operationType === 'cutting' ? 'selected' : ''}>
                  Cięcie
                </option>
                <option value="assembly" ${this.template?.operationType === 'assembly' ? 'selected' : ''}>
                  Montaż
                </option>
              </select>
            </div>
          </div>
          
          <div class="form-section">
            <h4>Czasy operacji (w minutach)</h4>
            <div class="form-row">
              <div class="form-group">
                <label for="standard-time">Czas standardowy:</label>
                <input type="number" id="standard-time" name="standardTime" 
                       min="1" required value="${this.template?.standardTime || 15}">
                <small>Czas na wykonanie jednej sztuki</small>
              </div>
              
              <div class="form-group">
                <label for="setup-time">Czas przygotowania:</label>
                <input type="number" id="setup-time" name="setupTime" 
                       min="0" value="${this.template?.setupTime || 0}">
                <small>Przygotowanie maszyny i materiałów</small>
              </div>
              
              <div class="form-group">
                <label for="buffer-time">Czas bufora:</label>
                <input type="number" id="buffer-time" name="bufferTime" 
                       min="0" value="${this.template?.bufferTime || 0}">
                <small>Nieprzewidziane sytuacje</small>
              </div>
            </div>
          </div>
          
          <div class="form-section">
            <h4>Współczynniki korekty</h4>
            <div class="form-row">
              <div class="form-group">
                <label for="material-factor">Współczynnik materiału:</label>
                <input type="number" id="material-factor" name="materialFactor" 
                       min="0.1" max="3" step="0.1" value="${this.template?.materialFactor || 1.0}">
                <small>0.5 = szybki materiał, 2.0 = trudny materiał</small>
              </div>
              
              <div class="form-group">
                <label for="complexity-factor">Współczynnik złożoności:</label>
                <input type="number" id="complexity-factor" name="complexityFactor" 
                       min="0.1" max="3" step="0.1" value="${this.template?.complexityFactor || 1.0}">
                <small>0.5 = prosta operacja, 2.0 = złożona</small>
              </div>
              
              <div class="form-group">
                <label for="machine-efficiency">Wydajność maszyny:</label>
                <input type="number" id="machine-efficiency" name="machineEfficiencyFactor" 
                       min="0.1" max="2" step="0.1" value="${this.template?.machineEfficiencyFactor || 1.0}">
                <small>0.8 = wolna maszyna, 1.2 = szybka</small>
              </div>
              
              <div class="form-group">
                <label for="operator-skill">Umiejętności operatora:</label>
                <input type="number" id="operator-skill" name="operatorSkillFactor" 
                       min="0.1" max="2" step="0.1" value="${this.template?.operatorSkillFactor || 1.0}">
                <small>0.8 = początkujący, 1.2 = doświadczony</small>
              </div>
            </div>
          </div>
          
          <div class="form-section">
            <div class="form-group">
              <label for="template-description">Opis:</label>
              <textarea id="template-description" name="description" rows="3">${this.template?.description || ''}</textarea>
            </div>
          </div>
          
          <div class="form-actions">
            <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">
              Anuluj
            </button>
            <button type="submit" class="btn-primary">
              ${this.isEdit ? 'Zapisz zmiany' : 'Utwórz szablon'}
            </button>
          </div>
        </form>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Obsługa formularza
    const form = modal.querySelector('#time-template-form');
    form.addEventListener('submit', (e) => this.handleSubmit(e));
  }
  
  async handleSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    // Konwersja pól numerycznych
    ['standardTime', 'setupTime', 'bufferTime'].forEach(field => {
      data[field] = parseInt(data[field]) || 0;
    });
    
    ['materialFactor', 'complexityFactor', 'machineEfficiencyFactor', 'operatorSkillFactor'].forEach(field => {
      data[field] = parseFloat(data[field]) || 1.0;
    });
    
    try {
      const url = this.isEdit 
        ? `/api/production/time-templates/${this.template.id}`
        : '/api/production/time-templates';
      
      const method = this.isEdit ? 'PATCH' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (response.ok) {
        document.querySelector('.modal-overlay').remove();
        timeManager.loadTemplates(); // Przeładuj listę
        showNotification('Szablon czasu zapisany pomyślnie', 'success');
      } else {
        const error = await response.json();
        showNotification(error.error || 'Błąd zapisu szablonu', 'error');
      }
    } catch (error) {
      showNotification('Błąd połączenia z serwerem', 'error');
    }
  }
}
```

### 6.4 Import/Export Czasów

```javascript
// TimeImportExport.js - import/export szablonów czasów
class TimeImportExport {
  static exportToCSV(templates) {
    const headers = [
      'Nazwa', 'Typ operacji', 'Czas standardowy', 'Czas przygotowania', 
      'Czas bufora', 'Wsp. materiału', 'Wsp. złożoności', 
      'Wsp. wydajności maszyny', 'Wsp. umiejętności operatora', 'Opis'
    ];
    
    const csvContent = [
      headers.join(','),
      ...templates.map(template => [
        `"${template.name}"`,
        template.operationType,
        template.standardTime,
        template.setupTime,
        template.bufferTime,
        template.materialFactor,
        template.complexityFactor,
        template.machineEfficiencyFactor,
        template.operatorSkillFactor,
        `"${template.description || ''}"`
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `time-templates-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }
  
  static async importFromCSV(file) {
    const text = await file.text();
    const lines = text.split('\n');
    
    if (lines.length < 2) {
      throw new Error('Plik CSV jest pusty lub nieprawidłowy');
    }
    
    const templates = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = line.split(',').map(v => v.replace(/"/g, ''));
      
      if (values.length >= 5) {
        templates.push({
          name: values[0],
          operationType: values[1],
          standardTime: parseInt(values[2]) || 15,
          setupTime: parseInt(values[3]) || 0,
          bufferTime: parseInt(values[4]) || 0,
          materialFactor: parseFloat(values[5]) || 1.0,
          complexityFactor: parseFloat(values[6]) || 1.0,
          machineEfficiencyFactor: parseFloat(values[7]) || 1.0,
          operatorSkillFactor: parseFloat(values[8]) || 1.0,
          description: values[9] || ''
        });
      }
    }
    
    return templates;
  }
}
```

### 6.5 Powiązanie z edytorem ścieżki/operacji i panelem operatora

- **Źródło prawdy dla czasów operacji**:
  - Czas jednostkowy, TPZ i bufor są definiowane przez **Kierownika/Administratora produkcji** w edytorze ścieżki produkcyjnej / szablonów czasów (`TimeEstimationTemplate`, widok `TimeEstimationManager`).
  - Dla każdej operacji ścieżki system oblicza i zapisuje planowany czas w polu `ProductionOperation.plannedTime` oraz sumaryczny czas ścieżki w `ProductionPath.estimatedTime` / `ProductionOrder.estimatedTime`.

- **Panel operatora**:
  - nie pozwala zmieniać planowanych czasów – operator nie „ustawia” czasu, tylko **realizuje** operację,
  - na kafelku zlecenia wyświetla szacowany czas (np. `~25 min` lub `~1h 10min`) obliczony na podstawie `plannedTime` i ilości sztuk,
  - przy zakończeniu operacji zapisuje rzeczywisty czas (`actualTime`) oraz wpis w `OperationTimeHistory`, co w przyszłości pozwala na kalibrację szablonów.

- **Edytor ścieżki/operacji**:
  - podczas dodawania/edycji operacji użytkownik widzi podgląd całkowitego czasu operacji i całej ścieżki,
  - może korzystać z gotowych szablonów czasów (np. „Laser CO2 – bambus”, „Druk UV – kubek ceramiczny”) albo nadpisać wartości ręcznie,
  - zapisane wartości są używane automatycznie przy generowaniu nowych zleceń produkcyjnych.

### 6.6 Auto-priorytet zamówień produkcyjnych

- **Cel:** zapewnienie spójnego, automatycznego priorytetyzowania zleceń na podstawie daty wymaganej przez klienta (`Order.deliveryDate`) oraz szacowanego czasu produkcji.

#### 6.6.1 Wejścia algorytmu

Dla każdego zlecenia produkcyjnego (i powiązanego zamówienia) backend wykorzystuje:

- `now` – aktualny czas serwera (UTC),
- `Order.deliveryDate` – data/godzina wymagana przez klienta (pole obowiązkowe w formularzu zamówienia, wprowadzane przez handlowca),
- `ProductionOrder.estimatedTime` – całkowity szacowany czas produkcji w minutach (zasilany z `ProductionPath` / szablonów czasów, patrz §6),
- (opcjonalnie w przyszłości) `serviceLevel` – tryb obsługi (`STANDARD`, `EXPRESS`, `VIP`).

Na tej podstawie obliczane są pomocnicze wartości czasowe:

- `timeToDeadlineMinutes = deliveryDate - now` (w minutach; może być ujemne),
- `slackMinutes = timeToDeadlineMinutes - estimatedProductionTimeMinutes` (zapas czasu względem szacowanego czasu produkcji).

#### 6.6.2 Status czasowy `timeStatus`

Pole `timeStatus` przyjmuje jedną z wartości:

- `ON_TIME` – zlecenie na razie bezpieczne czasowo,
- `AT_RISK` – zlecenie zagrożone (mały margines czasowy),
- `OVERDUE` – zlecenie po terminie.

Proponowany algorytm:

- jeśli `timeToDeadlineMinutes < 0` → `timeStatus = OVERDUE`,
- w przeciwnym razie, jeśli `timeToDeadlineMinutes <= 24 * 60` **lub** `slackMinutes <= 0` → `timeStatus = AT_RISK`,
- w przeciwnym razie → `timeStatus = ON_TIME`.

Próg 24h powinien być konfigurowalny (np. zmienna środowiskowa lub wpis w tabeli ustawień).

#### 6.6.3 Priorytet `priority` (1–4)

Priorytet w tabelach produkcyjnych (`ProductionOrder.priority`, `ProductionWorkOrder.priority`) korzysta ze skali:

- `1` – urgent (najwyższy priorytet),
- `2` – high,
- `3` – normal (domyślny),
- `4` – low.

Algorytm auto-priorytetu:

- jeśli `timeStatus = OVERDUE` → `priority = 1` (urgent),
- w przeciwnym razie, jeśli `timeStatus = AT_RISK` **i** (`timeToDeadlineMinutes <= 4 * 60` **lub** `slackMinutes <= 60`) → `priority = 2` (high),
- w przeciwnym razie, jeśli `timeStatus = ON_TIME` **i** `timeToDeadlineMinutes > 72 * 60` **i** `slackMinutes > 2 * estimatedProductionTimeMinutes` → `priority = 4` (low),
- we wszystkich pozostałych przypadkach → `priority = 3` (normal).

Progi czasowe (4h, 72h, dodatkowy mnożnik 2×) również powinny być konfigurowalne.

#### 6.6.4 Zastosowanie w API i UI

- Obliczenia wykonywane są w warstwie backendu (np. helper `computeOrderTimePriority(order, productionOrders)` wywoływany w endpointach pobierających zlecenia).
- Endpointy produkcyjne (`/api/production/orders/active`, `/api/production/kpi/overview`) powinny zwracać dla każdego zlecenia przynajmniej:
  - `deliveryDate`,
  - `timeToDeadlineMinutes`,
  - `timeStatus`,
  - `priority`.
- Panel operatora wykorzystuje te pola do:
  - domyślnego sortowania (najpierw po `deliveryDate`, następnie po `priority`),
  - kolorowania kart zleceń (zielony / żółty / czerwony) w oparciu o `timeStatus`,
  - wyświetlania tekstów typu „Pozostało: X dni/godzin” lub „Przeterminowane: X godzin”.
- Widok sprzedaży (lista zamówień) pokazuje `deliveryDate` razem z uproszczonym statusem czasowym („na czas / zagrożone / po terminie”).

#### 6.6.5 Ręczne nadpisywanie priorytetu (przyszłość)

W ramach **Fazy 6: Admin produkcji** możliwe jest dodanie opcji ręcznego nadpisania priorytetu przez `PRODUCTION_MANAGER`:

- pole `manualPriority` w `ProductionOrder` i/lub `ProductionWorkOrder`,
- jeśli `manualPriority` jest ustawione, UI pokazuje je zamiast auto‑wyliczonego `priority`,
- logowanie wszystkich zmian priorytetu w `ProductionLog` (kto, kiedy, z jakiej wartości na jaką).

---

## 7. Implementacja Notes

### 6.1 Kolejność Implementacji

1. **Faza 1: Baza danych + podstawowe API**
   - Migracje SQL (ProductionRoom, WorkCenter, WorkStation)
   - Podstawowe CRUD endpointy
   - Testy integracji

2. **Faza 2: Panel operatora**
   - Kafelkowy interfejs
   - WebSocket
   - Podstawowe operacje (start/pauza/zakończenie)

3. **Faza 3: Admin produkcji**
   - Rozszerzenie panelu admina
   - Zarządzanie zasobami (pokoje, gniazda, stanowiska)
   - Ścieżki produkcyjne

4. **Faza 4: Harmonogram i optymalizacja**
   - Drag & drop
   - Automatyczne planowanie
   - Raporty

5. **Faza 5: Konfigurowalny czas operacji (Time Estimation)**
   - Edytor ścieżki/operacji pozwalający zdefiniować dla każdej operacji:
     - czas jednostkowy (Tj – min/szt.),
     - czas przygotowawczo‑zakończeniowy (TPZ),
     - opcjonalny bufor.
   - Zasilanie pól `ProductionPath.estimatedTime` oraz `ProductionOperation.plannedTime` na etapie generowania zleceń.
   - Panel operatora tylko **odczytuje** te wartości i pokazuje szacowany czas na kafelkach – operator nie edytuje czasów z poziomu swojego panelu.

### 6.2 Wytyczne UI/UX

- **Maksymalnie 3 kliknięcia** do wykonania zadania
- **Duże przyciski** (minimum 100x100px dla akcji głównych)
- **Kolorowe statusy**: zielony (OK), żółty (uwaga), czerwony (problem)
- **Real-time aktualizacje** bez potrzeby odświeżania strony
- **Proste formularze** (max 4-5 pól)
- **Responsywny design** dla tabletów i telefonów

### 6.3 Bezpieczeństwo

- Wszystkie endpointy chronione middleware autentykacji
- Role-based access control dla każdej operacji
- Audyt wszystkich zmian w tabeli ProductionLog
- Walidacja danych wejściowych po stronie serwera
- SQL injection prevention przez Supabase

### 6.4 Performance

- Paginacja dla dużych list (default 50 items)
- Cache'owanie często używanych danych (pokoje, maszyny)
- Optimistic updates w UI z rollback przy błędzie
- Lazy loading dla ścieżek produkcyjnych
- WebSocket zamiast polling dla real-time updates

### 6.5 Plan implementacji daty wymagalności i auto-priorytetu

Ten plan opisuje **kolejność wdrażania** pola daty wymagalności (`Order.deliveryDate`) oraz algorytmu auto-priorytetu (`timeStatus`, `priority`) tak, aby zachować spójność z UX handlowca i operatorem.

#### 6.5.1 Faza 1 – Model danych i migracje (DB + SPEC)

- Zweryfikować w Supabase, że tabela `Order` posiada kolumny:
  - `deliveryDate timestamptz` – data/godzina „na kiedy potrzebne”,
  - `priority integer NOT NULL DEFAULT 3` – wewnętrzny priorytet MES (1–4).
- W razie braków dodać migracje SQL w `backend/migrations/...` (`ALTER TABLE "Order" ...`).
- Utrzymać spójność z `docs/SPEC.md` (sekcja 5.2) i `docs/SPEC_PRODUCTION_PANEL.md` (§6.6).

#### 6.5.2 Faza 2 – Formularz zamówień (frontend sprzedaż)

- **UI (`index.html`)**:
  - dodać w formularzu pole `input type="date"` z etykietą „Na kiedy potrzebne”,
  - ustawić domyślną wartość (np. dziś + 2 dni),
  - dać czytelny opis, że jest to data wymagana przez klienta.
- **Logika JS (`scripts/app.js`)**:
  - przy wysyłce `POST /api/orders` odczytać wartość `deliveryDate`,
  - walidować, że data nie jest w przeszłości (front blokuje wysłanie),
  - wysłać `deliveryDate` w body (np. `YYYY-MM-DD`, backend konwertuje na koniec dnia).
- (Opcjonalnie) w widoku edycji zamówienia umożliwić zmianę daty zgodnie z regułami ról i statusów.

#### 6.5.3 Faza 3 – Backend zamówień (API)

- **`POST /api/orders`**:
  - wymaga pola `deliveryDate`,
  - waliduje datę (≥ dziś),
  - zapisuje `deliveryDate` w `Order`,
  - ustawia `priority = 3` (normal), jeśli nie przekazano innej wartości.
- **`PATCH /api/orders/:id`**:
  - umożliwia zmianę `deliveryDate` z kontrolą ról i statusów (np. `PENDING`/`APPROVED` – sprzedaż, dalej tylko `PRODUCTION_MANAGER`/`ADMIN`),
  - opcjonalnie loguje zmiany daty w historii.
- **`GET /api/orders`, `GET /api/orders/:id`**:
  - zwracają `deliveryDate` i `priority` w strukturze zamówienia.

#### 6.5.4 Faza 4 – Backend produkcji: auto-priorytet

- Zaimplementować helper (np. `computeOrderTimePriority(order, productionOrders)`), który:
  - wczytuje `Order.deliveryDate` i `ProductionOrder.estimatedTime`,
  - liczy `timeToDeadlineMinutes`, `slackMinutes`,
  - wyznacza `timeStatus` i `priority` wg §6.6.
- Wpiąć helper do:
  - `GET /api/production/orders/active` – każda pozycja powinna zwracać `deliveryDate`, `timeToDeadlineMinutes`, `timeStatus`, `priority`,
  - `GET /api/production/kpi/overview` – wykorzystanie `timeStatus`/`priority` w KPI (np. licznik zleceń zagrożonych/po terminie).
- W przypadku braku `estimatedTime` traktować je jako `0` (priorytet liczony wyłącznie z daty); takie przypadki można oznaczać do kalibracji w przyszłości.

#### 6.5.5 Faza 5 – Panel operatora (production.html, scripts/production.js)

- **Wyświetlanie daty i czasu do terminu**:
  - w komponentach karty zlecenia wykorzystać dane `deliveryDate`, `timeToDeadlineMinutes`, `timeStatus`,
  - pokazywać teksty typu „Data: 2025-12-15” oraz „Pozostało: 2 dni” / „Przeterminowane: 3h”,
  - formatowanie czasu wykonać w helperze JS (dni/godziny, bez sekund).
- **Sortowanie i kolorystyka**:
  - domyślne sortowanie: najpierw po `deliveryDate` (rosnąco), następnie po `priority` (1–4),
  - mapować `timeStatus` na klasy kolorów kart (zielony = `ON_TIME`, żółty = `AT_RISK`, czerwony = `OVERDUE`),
  - wykorzystać istniejącą paletę statusów z `production.html`.
- **Filtry**:
  - filtr „PILNE” oprzeć na `priority <= 2` lub `timeStatus != ON_TIME`,
  - opcjonalnie dodać filtr „tylko po terminie”.

#### 6.5.6 Faza 6 – Widok sprzedaży (lista zamówień)

- W `orders.html` i powiązanym JS:
  - dodać kolumnę „Data potrzebna” (`deliveryDate`),
  - dodać uproszczony status czasu („na czas / zagrożone / po terminie”),
  - umożliwić filtrowanie zamówień zagrożonych/po terminie.

#### 6.5.7 Faza 7 – Testy i rollout

- Testy backendowe:
  - tworzenie zamówienia z prawidłową datą → 200 + zapis `deliveryDate`,
  - tworzenie z datą w przeszłości → 400,
  - scenariusze ON_TIME / AT_RISK / OVERDUE dla helpera auto-priorytetu.
- Testy frontendu (manualne/E2E):
  - formularz nie akceptuje dat w przeszłości,
  - panel operatora poprawnie sortuje i koloruje zlecenia,
  - lista zamówień sprzedaży pokazuje daty i statusy czasu.
- Rollout:
  - najpierw włączyć pole `deliveryDate` i jego zapis,
  - następnie auto-priorytet w backendzie,
  - na końcu pełną wizualizację i sortowanie po czasie w panelu operatora.

---

## 7. Testy

### 7.1 Testy Jednostkowe

```javascript
// tests/production.test.js
describe('Production API', () => {
  test('should create production order from order', async () => {
    const order = await createTestOrder();
    const response = await request(app)
      .post(`/api/production/orders/from-order/${order.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(order.items.length);
  });
  
  test('should start production operation', async () => {
    const operation = await createTestProductionOperation();
    const response = await request(app)
      .post(`/api/production/operations/${operation.id}/start`)
      .send({ operatorId: testOperator.id })
      .set('Authorization', `Bearer ${operatorToken}`);
    
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('active');
  });
});
```

### 7.2 Testy E2E

```javascript
// tests/e2e/production.spec.js
test('operator can complete production workflow', async ({ page }) => {
  // Login jako operator
  await page.goto('/production.html');
  await page.fill('#username', 'operator');
  await page.fill('#password', 'password');
  await page.click('#login-btn');
  
  // Sprawdzenie widoku kafelków
  await expect(page.locator('.order-tile')).toBeVisible();
  
  // Rozpoczęcie operacji
  await page.click('.start-btn');
  await expect(page.locator('.status-active')).toBeVisible();
  
  // Zakończenie operacji
  await page.click('.complete-btn');
  await expect(page.locator('.status-completed')).toBeVisible();
});
```

---

## 8. Wdrożenie

### 8.1 Migracja Bazy Danych

```sql
-- migrations/20251201_add_production_tables.sql
-- (zawiera wszystkie CREATE TABLE z sekcji 2.1)
```

### 8.2 Konfiguracja Środowiska

```javascript
// .env - nowe zmienne
PRODUCTION_WS_PORT=3001
PRODUCTION_MAX_RECONNECT_ATTEMPTS=5
PRODUCTION_CACHE_TTL=300
PRODUCTION_AUDIT_ENABLED=true
```

### 8.3 Docker Compose

```yaml
# docker-compose.yml - dodanie serwisu WebSocket
production-ws:
  build: .
  ports:
    - "3001:3001"
  environment:
    - NODE_ENV=production
    - PRODUCTION_WS_PORT=3001
  depends_on:
    - postgres
    - redis
```

---

## 9. Moduł grafiki / Panel pracy grafika

### 9.1 Cel modułu

Moduł grafiki pełni rolę **przygotowalni (pre‑press)** między działem handlowym a produkcją.
Obsługuje dwa główne scenariusze:

1. **Zamówienie na produkty + projekty (mieszane)** – część pozycji ma gotowe projekty,
   część wymaga pracy grafika.
2. **Zamówienie tylko na projekty** – handlowiec zamawia wyłącznie przygotowanie
   projektów (bez uruchamiania produkcji).

Grafik pracuje na **zadaniach graficznych** powiązanych z zamówieniami i pozycjami
zamówień, dopisuje numery projektów i ścieżki plików dla produkcji oraz (opcjonalnie)
umożliwia handlowcowi akceptację projektów.

---

### 9.2 Rozszerzenia modelu zamówień

#### 9.2.1 Tabela `Order` – typ zlecenia i akceptacja projektów

Dodajemy pola (docelowo migracją):

```sql
Order (
  ...,
  orderType varchar(30) NOT NULL DEFAULT 'PRODUCTS_AND_PROJECTS',
  -- PRODUCTS_ONLY, PRODUCTS_AND_PROJECTS, PROJECTS_ONLY

  projectApprovalRequired boolean NOT NULL DEFAULT false,
  -- Czy handlowiec/klient musi zatwierdzić projekty przed produkcją

  projectsReady boolean NOT NULL DEFAULT false
  -- True, gdy wszystkie zadania graficzne powiązane z zamówieniem mają
  -- status "ready_for_production"
);
```

Zachowanie:

- `orderType = 'PRODUCTS_AND_PROJECTS'` – standardowy przypadek „produkty + projekty”.
- `orderType = 'PROJECTS_ONLY'` – zamówienie na same projekty, bez automatycznego
  tworzenia `ProductionOrder`.
- `projectApprovalRequired = true` – wymagane zatwierdzenie projektów zanim
  produkcja wystartuje.
- `projectsReady = true` – sygnał dla panelu produkcji, że **z punktu widzenia grafiki**
  zamówienie jest kompletne.

> Pola mogą być opcjonalne w pierwszej migracji; logika produkcyjna powinna być
> przygotowana na `NULL` / wartości domyślne.

#### 9.2.2 (Opcjonalnie) rozszerzenie `OrderItem`

W przyszłości można doprecyzować per‑pozycję:

```sql
OrderItem (
  ...,
  requiresDesign boolean NOT NULL DEFAULT false,
  -- Czy dla pozycji konieczny jest projekt w dziale grafiki

  requiresDesignApproval boolean NOT NULL DEFAULT false
  -- Czy dla tej pozycji konieczna jest akceptacja projektu
);
```

Na start można operować tylko na poziomie `Order` (globalnie dla zamówienia),
jednak docelowo zamówienia **tylko na projekty** będą przeniesione do osobnego
bytu `GraphicRequest` (patrz 9.2.3), aby nie mieszać ich z numeracją i raportami
zamówień produkcyjnych.

### 9.2.3 Byt `GraphicRequest` – osobna numeracja zleceń graficznych

Ponieważ dział sprzedaży nie musi widzieć zleceń **tylko na projekty** w swoim
zestawieniu zamówień, a jednocześnie chcemy zachować ciągłą numerację
zamówień produkcyjnych, wprowadzamy osobny byt `GraphicRequest`.

Główne założenia:

- `Order` – reprezentuje zamówienia handlowe / produkcyjne (produkty, produkty + projekty).
  Ma dotychczasową numerację, np. `2025/15/JRO`. Widziany w modułach sprzedaży
  i produkcji.
- `GraphicRequest` – reprezentuje zlecenia **tylko na projekty** (bez rezerwacji
  mocy produkcyjnych). Ma osobną numerację, np. `G-2025/015`. Widoczny
  głównie w module Grafiki i ewentualnym widoku „Zlecenia na projekty” dla
  handlowców.

Przykładowy szkic tabel:

```sql
CREATE TABLE public."GraphicRequest" (
  id serial PRIMARY KEY,

  requestNumber varchar(30) UNIQUE NOT NULL,
  -- Np. G-2025/015/JRO (osobna sekwencja niezależna od Order.orderNumber)

  customerId integer REFERENCES "Customer"(id) ON DELETE SET NULL,
  sourceType varchar(30) NOT NULL DEFAULT 'manual',
  -- manual, from_order

  sourceOrderId integer REFERENCES "Order"(id) ON DELETE SET NULL,
  -- opcjonalne powiązanie, jeśli zlecenie powstało z istniejącego zamówienia

  status varchar(30) NOT NULL DEFAULT 'open',
  -- open, in_progress, completed, cancelled

  priority integer NOT NULL DEFAULT 3,
  dueDate timestamp,

  createdBy text REFERENCES "User"(id) ON DELETE SET NULL,
  createdAt timestamp DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public."GraphicRequestItem" (
  id serial PRIMARY KEY,

  "graphicRequestId" integer NOT NULL
    REFERENCES "GraphicRequest"(id) ON DELETE CASCADE,

  "orderItemId" integer REFERENCES "OrderItem"(id) ON DELETE SET NULL,
  -- jeśli pozycja projektowa jest powiązana z konkretną pozycją zamówienia

  productId integer REFERENCES "Product"(id) ON DELETE SET NULL,
  description text NOT NULL,
  -- opis od handlowca: co dorobić, jakie zdjęcia, jakie warianty

  requiresProduction boolean NOT NULL DEFAULT false,
  -- czy docelowo z tych projektów ma powstać produkcja

  quantity integer,
  city varchar(100),
  kiReference text,

  createdAt timestamp DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp DEFAULT CURRENT_TIMESTAMP
);
```

Relacja z `GraphicTask`:

- `GraphicTask` reprezentuje **konkretne zadanie grafika**.
- Zadanie może być powiązane bezpośrednio z `Order` / `OrderItem` **lub**
  z `GraphicRequest` / `GraphicRequestItem`.

Proponowane rozszerzenia `GraphicTask`:

```sql
ALTER TABLE public."GraphicTask" ADD COLUMN "graphicRequestId" integer
  REFERENCES "GraphicRequest"(id) ON DELETE SET NULL;

ALTER TABLE public."GraphicTask" ADD COLUMN "graphicRequestItemId" integer
  REFERENCES "GraphicRequestItem"(id) ON DELETE SET NULL;
```

Zasady użycia:

- Zamówienia produkcyjne (`Order.orderType = 'PRODUCTS_ONLY'` lub
  `'PRODUCTS_AND_PROJECTS'`) → zadania grafika (`GraphicTask`) powiązane są
  z `Order` / `OrderItem`.
- Zlecenia **tylko na projekty** → tworzone jest `GraphicRequest` +
  `GraphicRequestItem`, a `GraphicTask` wskazuje na te rekordy.
- Moduł sprzedaży w widoku „Zamówienia” operuje wyłącznie na `Order`, dzięki
  czemu numeracja zamówień pozostaje ciągła i nie jest „dziurawiona” przez
  zlecenia czysto graficzne.

---

### 9.3 Tabela `GraphicTask` – zadania grafika

Każde zamówienie i (opcjonalnie) pozycja zamówienia, która wymaga pracy grafika,
mapuje się na rekord w tabeli `GraphicTask`.

```sql
CREATE TABLE public."GraphicTask" (
  id serial PRIMARY KEY,

  "orderId" integer NOT NULL REFERENCES "Order"(id) ON DELETE CASCADE,
  "orderItemId" integer REFERENCES "OrderItem"(id) ON DELETE SET NULL,

  status varchar(30) NOT NULL DEFAULT 'todo',
  -- todo, in_progress, waiting_approval, ready_for_production, rejected, archived

  priority integer NOT NULL DEFAULT 3,
  -- 1-urgent, 2-high, 3-normal, 4-low

  "dueDate" timestamp,
  -- np. data wysyłki z zamówienia - bufor na produkcję

  "assignedTo" text REFERENCES "User"(id) ON DELETE SET NULL,
  -- przypisany grafik

  "galleryContext" jsonb,
  -- np. {"mode": "PM", "city": "Zakopane", "kiFolder": "KI_Jan_Kowalski",
  --       "qnapObjectIds": [123, 456]}

  "filesLocation" text,
  -- Lokalizacja plików na QNAP / w galerii

  "projectNumbers" jsonb,
  -- np. {"front": "PM-ZAK-00123", "back": "PM-ZAK-00123-B", "variant": "A"}

  "checklist" jsonb,
  -- {"dataVerified": true, "quantitiesVerified": true,
  --  "layersOk": true, "namingOk": true}

  "approvalRequired" boolean NOT NULL DEFAULT false,
  -- czy dla tego zadania wymagana jest akceptacja projektu

  "approvalStatus" varchar(30) DEFAULT 'not_required',
  -- not_required, pending, approved, rejected

  "createdBy" text REFERENCES "User"(id) ON DELETE SET NULL,
  "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP
);
```

---

### 9.4 Statusy zadań grafika

Pole `GraphicTask.status` wykorzystuje następujące wartości:

1. `todo` – zadanie utworzone (zamówienie zatwierdzone, potrzeba projektu).
2. `in_progress` – grafik pracuje nad projektem.
3. `waiting_approval` – projekt gotowy, **czeka na akceptację** (jeśli
   `approvalRequired = true`).
4. `ready_for_production` – projekt gotowy, spełnia wymagania produkcji
   (checklista wypełniona, numery projektów i ścieżki plików uzupełnione).
5. `rejected` – projekt odrzucony (feedback handlowca/klienta, wraca do poprawy).
6. `archived` – zadanie zakończone i zamknięte (po wysyłce / po pewnym czasie).

Zachowanie:

- Przejście do `ready_for_production` ustawia:
  - `GraphicTask.approvalStatus = 'approved'`, jeśli wymagana akceptacja
    została udzielona,
  - `approvalStatus = 'not_required'`, jeśli akceptacja nie jest wymagana.
- Gdy wszystkie aktywne zadania dla `orderId` osiągną `ready_for_production`,
  system może ustawić `Order.projectsReady = true`.

---

### 9.5 Scenariusze biznesowe

#### 9.5.1 Scenariusz 1 – Produkty + projekty (mieszane)

Handlowiec składa standardowe zamówienie na produkty, ale dla części pozycji
nie ma jeszcze gotowych projektów.

Parametry zamówienia:

- `Order.orderType = 'PRODUCTS_AND_PROJECTS'`
- `Order.projectApprovalRequired`:
  - `false` – handlowiec **nie chce** oglądać / zatwierdzać projektów,
  - `true` – chce mieć etap akceptacji.

Kroki wspólne:

1. Zamówienie przechodzi `PENDING → APPROVED`.
2. Backend na podstawie zamówienia tworzy 1+ `GraphicTask`
   (dla pozycji wymagających projektów).
3. Zadania pojawiają się w Panelu grafika (`status = 'todo'`).

##### 9.5.1.1 Wariant A – bez akceptacji projektów

- `Order.projectApprovalRequired = false`.

Przepływ:

1. Grafik pracuje nad zadaniem (`in_progress`), uzupełnia `projectNumbers`,
   `filesLocation`, `checklist`.
2. Po zakończeniu ustawia status `ready_for_production`.
3. System aktualizuje powiązane `OrderItem` (np. pola z numerami projektów)
   i sprawdza, czy wszystkie `GraphicTask` dla zamówienia są
   w `ready_for_production`:
   - jeśli tak → `Order.projectsReady = true`.
4. Panel produkcji może tworzyć / uruchamiać `ProductionOrder` **bez udziału
   handlowca** – projekty są traktowane jako gotowe.

##### 9.5.1.2 Wariant B – z akceptacją projektów

- `Order.projectApprovalRequired = true`.

Przepływ:

1. Grafik po zakończeniu pracy ustawia `status = 'waiting_approval'`,
   wypełnia `filesLocation`, ustawia `approvalRequired = true`,
   `approvalStatus = 'pending'`.
2. System oznacza w widoku zamówienia, że są projekty „do akceptacji” i może
   wysłać powiadomienie do handlowca (w przyszłości e‑mail / notyfikacja).
3. Handlowiec w widoku zamówienia widzi listę zadań graficznych z linkami
   do plików i przyciskami `Zatwierdź` / `Odeślij do poprawy`.
4. Decyzje handlowca:
   - `Zatwierdź` → `approvalStatus = 'approved'`, `status = 'ready_for_production'`.
   - `Odeślij do poprawy` → `approvalStatus = 'rejected'`, `status = 'rejected'`.
5. Po zatwierdzeniu wszystkich zadań: `Order.projectsReady = true` i panel
   produkcji może startować `ProductionOrder`.

#### 9.5.2 Scenariusz 2 – Zamówienie tylko na projekty

Handlowiec składa zlecenie **wyłącznie na projekty**, bez rezerwowania mocy
produkcyjnych.

- `Order.orderType = 'PROJECTS_ONLY'`

Przepływ:

1. Tworzone są `GraphicTask` jak w scenariuszu 1.
2. Grafik pracuje, zmienia statusy (`todo → in_progress → waiting_approval / ready_for_production`).
3. Gdy projekty są gotowe: `Order.projectsReady = true`, status zamówienia może
   przejść do np. `READY` (lub pomocniczego statusu typu „PROJEKTY_GOTOWE” –
   do doprecyzowania).
4. **Nie** tworzymy automatycznie `ProductionOrder`.
5. W przyszłości handlowiec może założyć zwykłe zamówienie produkcyjne
   (`orderType = 'PRODUCTS_ONLY'` lub `PRODUCTS_AND_PROJECTS`), wskazując
   istniejące `projectNumbers`.

---

### 9.6 API Backend – szkic modułu grafiki

#### 9.6.1 Endpointy zadań grafika

```javascript
// GET /api/graphics/tasks
// Lista zadań grafika (filtry po statusie, orderType, mine=1 itp.)

// GET /api/graphics/tasks/:id
// Szczegóły zadania

// PATCH /api/graphics/tasks/:id
// Aktualizacja zadania (status, checklist, filesLocation, projectNumbers, assignedTo)

// POST /api/graphics/tasks/:id/ready-for-production
// Akcja biznesowa: walidacja checklisty, ustawienie ready_for_production,
// ewentualna aktualizacja Order.projectsReady

// POST /api/graphics/tasks/:id/request-approval (opcjonalnie)
// Ustawia waiting_approval + przypina ścieżkę do plików
```

Uprawnienia:

- `GRAPHIC_DESIGNER` – widzi wszystkie zadania w puli, samodzielnie wybiera zadania do pracy,
  może zmieniać status do `ready_for_production`, decyduje o potrzebie akceptacji handlowej.
- `SALES_DEPT` – widzi zadania ze swoich zamówień, może akceptować/odrzucać projekty
  (`waiting_approval` → `approved/rejected`), dodawać komentarze.
- `PRODUCTION_MANAGER` – podgląd wszystkich zadań (nadzór), przeglądanie statystyk,
  bez ingerencji w pracę grafików.

#### 9.6.2 Endpointy akceptacji projektów (widok handlowca)

```javascript
// GET /api/orders/:id/graphics-tasks
// Zwraca zadania graficzne powiązane z zamówieniem (do widoku "projekty do akceptacji")

// POST /api/orders/:id/graphics-approval
// Body: { taskId, decision: 'approve' | 'reject', comment }
// Aktualizuje GraphicTask.approvalStatus + status (ready_for_production / rejected)
```

Uprawnienia:

- `SALES_REP`, `SALES_DEPT` – mogą akceptować/odrzucać projekty powiązane
  z „własnymi” zamówieniami (zgodnie z RLS/CHECK na właściciela zamówienia).

---

## 10. System Druku Zleceń Produkcyjnych

### 10.1 Cel i zakres

System druku zleceń produkcyjnych zapewnia cyfrowo-papierowy most między działem sprzedaży a produkcją.

**WAŻNE – nazewnictwo biznesowe vs techniczne:**

- Dla użytkowników (**sprzedaż, produkcja, grafika**):
  - „**Zlecenie produkcyjne**” = **kartka / PDF dla pokoju** – technicznie `ProductionWorkOrder`.
  - Pozycje na tej kartce to „**pozycje zlecenia produkcyjnego**” – technicznie `ProductionOrder`.
- W kodzie **nie używamy nazwy „zlecenie produkcyjne” dla pojedynczego `ProductionOrder`** – to zawsze tylko element `ProductionWorkOrder`.

System umożliwia:
- Generowanie **kart zleceń produkcyjnych (ProductionWorkOrder) pogrupowanych po pokojach**
- Drukowanie zleceń graficznych (GraphicTask)
- Tworzenie list kompletacyjnych dla pakowania (packing list)
- Audyt druku z historią i wersjonowaniem szablonów

### 10.2 Architektura PDF

#### 10.2.1 Szablony dokumentów

| Typ dokumentu (biznesowo) | Szablon | Tabele źródłowe | Przypadek użycia |
|---------------------------|---------|-----------------|-----------------|
| **Zlecenie produkcyjne (karta pokoju)** | `productionWorkOrderTemplate` | ProductionWorkOrder, ProductionOrder, Order, OrderItem, Product | Sprzedaż drukuje kartkę dla pokoju (ZP) |
| **Zlecenie graficzne** | `graphicsTaskTemplate` | GraphicTask, Order, OrderItem, Product | Graficy drukują swoje zadania |
| **Lista kompletacyjna** | `packingListTemplate` | Order, OrderItem, ProductionOrder, Product | Pakowanie kompletuje zamówienia |

#### 10.2.2 Generatory PDF

```javascript
// backend/pdfGenerator.js - nowe funkcje
async function createProductionWorkOrderPDF(workOrderData) {
  // Pobiera dane z ProductionWorkOrder + powiązane ProductionOrder
  // Generuje kartę z:
  // - Numerem zlecenia pokojowego (workOrderNumber)
  // - Numerem zamówienia źródłowego (orderNumber)
  // - Nazwą klienta (customerName)
  // - Priorytetem (1-4) z kolorowym badge'em
  // - Datą planowaną i datą wydruku
  // - Tabelą pozycji zawierającą:
  //   - Lp., Produkt, Lokalizacja (PM/KI + nazwa), Ilość, Projekty (z podziałem ilości)
  //   - Uwagi produkcyjne (jeśli są)
  //   - Szczegółowy podział na projekty z oznaczeniem źródła prawdy
  //   - Dane projektów pobierane z:
  //     - item.selectedProjects: np. "1,3,5"
  //     - item.projectQuantities: JSON.stringify([{ projectNo, qty }]) – np. [{ projectNo: 1, qty: 20 }, { projectNo: 3, qty: 20 }]
  //   - Kolumna „Projekty” prezentuje skrót: „1: 20, 3: 20, 5: 20”
  // - Podsumowaniem (Razem pozycji, Razem sztuk)
  // - Miejscem na podpisy (Wydał, Przyjął, Zakończył)
  //
  // Źródło prawdy dla ilości:
  // - Jeśli quantitySource === 'total' → kolumna "Ilość" jest pogrubiona
  // - Jeśli quantitySource === 'perProject' → kolumna "Projekty" jest pogrubiona
  //
  // Lokalizacja wyświetlana jako: "PM Kołobrzeg" lub "KI Arka Medical SPA2"
  // na podstawie pól: source (MIEJSCOWOSCI/KATALOG_INDYWIDUALNY/...) + locationName
}

async function createGraphicsTaskPDF(taskId) {
  // Pobiera dane z GraphicTask + Order
  // Generuje kartę z:
  // - Numerem zadania i zamówienia
  // - Projektami i plikami
  // - Checklistą graficzną
  // - Terminami i osobami odpowiedzialnymi
}

async function createPackingListPDF(orderId) {
  // Pobiera dane z Order + OrderItem + ProductionOrder
  // Generuje listę z:
  // - Wszystkimi pozycjami zamówienia
  // - Statusami realizacji
  // - Miejscem na podpisy pakującego i kontrolującego
}
```

### 10.3 API Endpoints do druku

#### 10.3.1 Zlecenia produkcyjne (ProductionWorkOrder)

```javascript
// GET /api/orders/:id/production-work-orders
// Zwraca listę zleceń pokojowych (ProductionWorkOrder) powiązanych z zamówieniem.
// Używane przez:
//   - widok zamówień (scripts/orders.js → printProductionWorkOrders)
//   - panel admina (admin/admin.js → adminPrintProductionWorkOrders)
// Uprawnienia: ADMIN, SALES_DEPT, PRODUCTION_MANAGER, PRODUCTION, OPERATOR, WAREHOUSE

// GET /api/production/work-orders/:id/print
// Generuje PDF zlecenia produkcyjnego dla pokoju (createProductionWorkOrderPDF).
// Zwraca: application/pdf (binary stream)
// Uprawnienia: SALES_DEPT, ADMIN (pełne), PRODUCTION (ponowny druk własnych zleceń),
//              PRODUCTION_MANAGER, OPERATOR, WAREHOUSE
```

#### 10.3.2 Zlecenia na projekty (GraphicTask)

```javascript
// GET /api/graphics/tasks/:id/print
// Uprawnienia: GRAPHICS / GRAPHIC_DESIGNER, ADMIN, SALES_DEPT, PRODUCTION_MANAGER
// Zwraca: PDF GraphicsTask

// GET /api/graphics/tasks/:id/print-preview
// Podgląd PDF zlecenia na projekty
```

#### 10.3.3 Listy kompletacyjne (Packing List)

```javascript
// GET /api/orders/:id/packing-list/print
// Uprawnienia: SALES_DEPT, ADMIN, WAREHOUSE, PRODUCTION_MANAGER
// Zwraca: PDF lista kompletacyjna

// GET /api/orders/:id/packing-status
// Zwraca status kompletacji zamówienia
```

### 10.4 Uprawnienia do druku

| Rola | Zlecenia produkcyjne (karty pokoju) | Zlecenia na projekty | Listy kompletacyjne | Uwagi |
|------|--------------------------------------|----------------------|---------------------|-------|
| SALES_DEPT | ✅ Tworzy i drukuje pierwsze zlecenia | ✅ Podgląd i druk | ✅ Druk i statusy | Główna rola druku |
| ADMIN | ✅ Pełne uprawnienia | ✅ Pełne uprawnienia | ✅ Pełne uprawnienia | Nadzór i awarie |
| PRODUCTION_MANAGER | ✅ Podgląd i druk wszystkich zleceń | ✅ Podgląd i druk | ✅ Podgląd i druk | Nadzór produkcji |
| PRODUCTION / OPERATOR | ✅ Tylko ponowny druk zleceń swojego pokoju | ❌ | ❌ | Kopie zapasowe na hali |
| GRAPHICS / GRAPHIC_DESIGNER | ❌ | ✅ Druk swoich zadań | ❌ | Zlecenia na projekty |
| WAREHOUSE | ❌ | ❌ | ✅ Druk list kompletacyjnych | Pakowanie |
| SALES_REP | ✅ Druk ZP wyłącznie dla własnych zamówień (po utworzeniu zleceń) | ❌ | ❌ | Tylko zamówienia + własne ZP |

> Uwaga: `PRODUCTION_MANAGER` jest rolą dodatkową. System nie wymaga, aby ktoś miał tę rolę – uprawnienia do druku pozostają dostępne z innych ról zgodnie z powyższą tabelą.

### 10.5 Audyt druku

#### 10.5.1 Pola audytowe

Każdy drukowany dokument zapisuje:
- `printedAt` - timestamp druku
- `printedBy` - UUID użytkownika
- `templateVersion` - wersja szablonu PDF
- `printCount` - liczba wydruków

#### 10.5.2 Tabela audytu

```sql
CREATE TABLE public."PrintAudit" (
  id serial PRIMARY KEY,
  documentType text NOT NULL, -- 'production_work_order', 'graphics_task', 'packing_list'
  documentId text NOT NULL,
  "printedAt" timestamp DEFAULT CURRENT_TIMESTAMP,
  "printedBy" text REFERENCES "User"(id) ON DELETE SET NULL,
  "templateVersion" varchar(10) DEFAULT '1.0',
  "printCount" integer DEFAULT 1,
  "ipAddress" inet,
  "userAgent" text
);
```

### 10.6 Workflow druku

#### 10.6.1 Proces sprzedaży → produkcja

1. **Sprzedaż tworzy zamówienie** (status APPROVED)
2. **Podział na pokoje** w interfejsie sprzedaży:
   - Przeciąganie pozycji do pokoi
   - Automatyczne tworzenie ProductionWorkOrder (status: DRAFT)
   - Możliwość edycji podziału przed drukiem
3. **Walidacja i podgląd**:
   - Sprawdzenie czy wszystkie pozycje przypisane
   - Podgląd PDF przed finalnym drukiem
4. **Druk zleceń**:
   - Przycisk "Drukuj zlecenia produkcyjne"
   - Status zmienia się na PLANNED → IN_PRODUCTION
   - Zapis audytu druku
5. **Przekazanie do produkcji**:
   - Papierowe karty + kod QR
   - Status w systemie: IN_PRODUCTION

**Uwaga:** Podział na pokoje można edytować tylko do momentu pierwszego druku. Po wydruku zlecenia są zamrożone.

#### 10.6.2 Proces produkcji

1. **Operator odbiera kartę** papierową
2. **Realizacja zlecenia** w panelu produkcyjnym
3. **Ponowny druk** (opcjonalnie):
   - Jeśli karta się zgubi
   - Przycisk "Drukuj ponownie" (tylko swoje zlecenia)
4. **Zakończenie zlecenia**:
   - Status COMPLETED
   - Karta przechodzi do pakowania

#### 10.6.3 Proces pakowania

1. **Sprawdzenie statusów** wszystkich zleceń zamówienia
2. **Druk listy kompletacyjnej**:
   - Przycisk "Drukuj listę kompletacyjną"
   - Podsumowanie pozycji i statusów
3. **Kompletacja fizyczna**:
   - Zaznaczanie pozycji na liście
   - Podpisy pakującego i kontrolującego
4. **Status zamówienia**: PACKED → SHIPPED

### 10.7 Szczegóły techniczne

#### 10.7.1 Mapowania pól PDF

**Karta zlecenia produkcyjnego:**
- `workOrderNumber` → ProductionWorkOrder.workOrderNumber
- `orderNumber` → Order.orderNumber
- `customerName` → Customer.name
- `roomName` → ProductionWorkOrder.roomName
- `items[]` → JOIN ProductionOrder + OrderItem + Product

**Karta zlecenia na projekty:**
- `taskNumber` → GraphicTask.id (formatowany)
- `orderNumber` → Order.orderNumber
- `projectNumbers` → GraphicTask.projectNumbers
- `checklist` → GraphicTask.checklist
- `filesLocation` → GraphicTask.filesLocation

#### 10.7.2 Obsługa błędów

- **Brak danych**: PDF z pustymi polami i ostrzeżeniem
- **Błąd generowania**: Log błędu + powiadomienie użytkownika
- **Timeout**: Retry mechanism (max 3 próby)
- **Brak uprawnień**: HTTP 403 z komunikatem

#### 10.7.3 Wersjonowanie szablonów

- Każdy szablon ma wersję (np. "1.0", "1.1")
- Wersja zapisywana w audycie druku
- Możliwość druku starszą wersją (dla zgodności)
- Mechanizm migracji szablonów

### 10.8 Przejście papier → cyfra (future)

#### 10.8.1 Kody QR

Każdy dokument zawiera kod QR z:
- Linkiem do dokumentu w systemie
- ID dokumentu i typem
- Wersją szablonu

#### 10.8.2 Skanowanie statusów

- Stanowiska skanują kody QR przy rozpoczęciu/zakończeniu
- Automatyczna aktualizacja statusów
- Redukcja ręcznych wpisów

---

### 9.7 Widoki frontend (wysoki poziom)

- **Panel grafika (tryb roli: GRAPHIC_DESIGNER)**
  - tablica Kanban (`todo`, `in_progress`, `waiting_approval`,
    `ready_for_production`, `rejected`),
  - lista zadań (tabelka z filtrami, priorytetami i deadline’ami),
  - panel szczegółów zadania (`GraphicTask` + powiązane `Order` / `OrderItem`).
- **Widok handlowca (zamówienia)**
  - sekcja „Projekty” w szczegółach zamówienia z listą zadań graficznych,
    linkami do plików i akcjami `Zatwierdź` / `Do poprawy`.
- **Panel produkcji**
  - informacje o `Order.projectsReady` i liczbie otwartych/zamkniętych
    zadań graficznych dla zlecenia.

> Implementacja modułu grafiki może być realizowana etapami i nie jest
> wymagana do podstawowego uruchomienia Panelu Produkcyjnego. Specyfikacja
> powyżej pełni rolę dokumentu „na później” dla wersji v2.x systemu.

## 11. Plan wdrożenia modułu akcji operatora i dashboardu KPI (v2.0.0)

### 11.1 Zakres modułu

Moduł akcji operatora i dashboardu KPI obejmuje trzy główne obszary:

1. **Akcje operatora na operacjach produkcyjnych** – spójne API do zmiany
   statusów `ProductionOperation` (`start`, `pause`, `complete`, `cancel`,
   `problem`) wraz z aktualizacją `ProductionOrder`, `ProductionWorkOrder`
   i `WorkStation`.
2. **ProductionLog + śledzenie czasu** – audyt wszystkich akcji operatorów
   na zleceniach, z możliwością odtworzenia osi czasu pracy i analizy
   problemów.
3. **Prosty dashboard KPI produkcyjnych** – zagregowane wskaźniki dla
   pokoi i operatorów (ilości, czasy, braki, problemy) dostępne dla
   ról `PRODUCTION_MANAGER`, `PRODUCTION` i `ADMIN`.

### 11.2 Stany i reguły przejść

**Statusy `ProductionOperation.status`:**

- `pending` – operacja oczekuje na start,
- `active` – operacja w toku,
- `paused` – operacja wstrzymana,
- `completed` – zakończona sukcesem,
- `cancelled` – anulowana,
- `error` – zakończona z błędem (np. po zgłoszeniu problemu).

**Statusy `ProductionOrder.status`:**

- `planned`, `approved`, `in_progress`, `completed`, `cancelled`.

**Statusy `ProductionWorkOrder.status`:**

- `planned`, `approved`, `in_progress`, `completed`, `cancelled`.

Reguły:

- `start` – dozwolone z `pending` lub `paused`; po pierwszym starcie dowolnej
  operacji z danego `ProductionOrder` status zlecenia przechodzi na
  `in_progress` (i ustawiane jest `actualStartDate`).
- `pause` – dozwolone **tylko** z `active`.
- `complete` – dozwolone z `active` lub `paused`; wymaga podania
  `outputQuantity` i `wasteQuantity`, ustawia `endTime` oraz `actualTime`.
- `cancel` – dozwolone z dowolnego statusu oprócz `completed`; tylko role
  `ADMIN`, `PRODUCTION_MANAGER` (opcjonalnie `PRODUCTION`).
- `problem` – zgłoszenie problemu; co najmniej wpis do `ProductionLog`
  z typem problemu i opisem, opcjonalnie zmiana statusu na `error`.

Dla każdego `ProductionWorkOrder` helper
`updateWorkOrderStatusFromOperations(workOrderId)` oblicza status nagłówka
na podstawie statusów powiązanych `ProductionOrder` / `ProductionOperation`:

- jeśli wszystkie operacje są `completed` → work order = `completed`,
- jeśli istnieje co najmniej jedna `active` → work order = `in_progress`,
- jeśli wszystkie są `cancelled` → work order = `cancelled`,
- w pozostałych przypadkach – `approved` lub `planned` zgodnie z bieżącą
  implementacją.

### 11.3 API akcji operatora (szkic)

Endpointy operują na pojedynczych rekordach `ProductionOperation` i zakładają
autoryzację ciasteczkami (`auth_id`, `auth_role`) oraz helperami
`requireRole([...])` i `canOperateInRoom(...)`.

```javascript
// POST /api/production/operations/:id/start
// Body: { operatorId?: string, workStationId?: number }
// Efekt:
// - ProductionOperation: status = 'active', operatorId, workStationId,
//   jeśli startTime null → startTime = now()
// - ProductionOrder: jeśli status != 'in_progress' →
//   status = 'in_progress', actualStartDate = now()
// - WorkStation: status = 'in_use', currentOperatorId = operatorId
// - ProductionLog: wpis action = 'operation_started'

// POST /api/production/operations/:id/pause
// Body: { operatorId?: string, reason?: string }
// Efekt:
// - ProductionOperation: status = 'paused'
// - opcjonalnie WorkStation: status = 'available'
// - ProductionLog: action = 'operation_paused', notes = reason

// POST /api/production/operations/:id/complete
// Body: { operatorId?: string, outputQuantity: number, wasteQuantity: number, notes?: string }
// Efekt:
// - ProductionOperation: status = 'completed', endTime = now(),
//   actualTime = ceil((endTime - startTime) / 60000),
//   outputQuantity, wasteQuantity
// - ProductionOrder: completedQuantity += outputQuantity;
//   jeśli completedQuantity >= quantity → status = 'completed',
//   actualEndDate = now()
// - ProductionWorkOrder: helper updateWorkOrderStatusFromOperations(...)
// - WorkStation: status = 'available', currentOperatorId = null
// - ProductionLog: action = 'operation_completed'

// POST /api/production/operations/:id/cancel
// Body: { operatorId?: string, reason: string }
// Efekt:
// - tylko role: ADMIN, PRODUCTION_MANAGER (ew. PRODUCTION)
// - ProductionOperation: status = 'cancelled', endTime = now()
// - ProductionOrder / ProductionWorkOrder: aktualizacja statusów
// - ProductionLog: action = 'operation_cancelled', notes = reason

// POST /api/production/operations/:id/problem
// Body: { problemType: string, description: string, severity?: 'LOW'|'MEDIUM'|'HIGH' }
// Efekt:
// - ProductionLog: action = 'problem_reported', notes = JSON(body)
// - opcjonalnie ProductionOperation: status = 'error'
```

### 11.4 ProductionLog i śledzenie czasu

Tabela `ProductionLog` pozostaje główną tabelą audytową. Zalecane jest
rozszerzenie o pola techniczne powiązane z operacjami i stanowiskami:

```sql
ALTER TABLE "ProductionLog"
  ADD COLUMN IF NOT EXISTS "operationId" integer REFERENCES "ProductionOperation"(id),
  ADD COLUMN IF NOT EXISTS "workStationId" integer REFERENCES "WorkStation"(id);
```

Minimalny zestaw pól logicznych przy insercie logów:

- `productionOrderId` – powiązane zlecenie produkcyjne,
- `operationId` – id operacji (jeśli dotyczy),
- `workStationId` – stanowisko robocze (jeśli dotyczy),
- `action` – `operation_started`, `operation_paused`, `operation_completed`,
  `operation_cancelled`, `problem_reported`,
- `previousStatus`, `newStatus` – status operacji / zlecenia przed i po akcji,
- `userId` – operator / użytkownik wykonujący akcję,
- `notes` – uwagi biznesowe lub serializowany JSON z dodatkowymi danymi,
- `createdAt` – timestamp akcji (domyślnie `now()`).

Na podstawie logów i pól `startTime` / `endTime` w `ProductionOperation`
obliczany jest `actualTime` w minutach. Na poziomie MVP wystarczy:

```text
actualTime = ceil( (endTime - startTime) / 60000 )
```

W przyszłości można doprecyzować ewidencję pauz (np. osobna tabela lub
logi `pause`/`resume` z agregacją czasu przestojów).

### 11.5 Dashboard KPI – API i UI (MVP)

#### 11.5.1 Endpoint ogólny KPI

```javascript
// GET /api/production/kpi/overview
// Query (opcjonalnie): ?dateFrom=ISO&dateTo=ISO&roomId=number
// Uprawnienia: PRODUCTION_MANAGER, ADMIN, PRODUCTION
// Zwraca zagregowane dane do dashboardu:
// {
//   status: 'success',
//   data: {
//     summary: {
//       completedOperations: number,
//       producedQuantity: number,
//       wasteQuantity: number,
//       problemsReported: number
//     },
//     byRoom: [
//       { roomId, roomName, completedWorkOrders, inProgressWorkOrders, avgLeadTimeMinutes }
//     ],
//     topProducts: [
//       { productId, name, producedQuantity, wasteQuantity }
//     ]
//   }
// }
```

#### 11.5.2 Statystyki operatorów

```javascript
// GET /api/production/operator/stats
// Query (opcjonalnie): ?dateFrom=ISO&dateTo=ISO&roomId=number
// Uprawnienia: PRODUCTION_MANAGER, ADMIN, PRODUCTION, OPERATOR (tylko własne)
// Zwraca listę operatorów z KPI, np.:
// [
//   {
//     operatorId,
//     operatorName,
//     completedOperations,
//     producedQuantity,
//     wasteQuantity,
//     avgOperationTimeMinutes,
//     onTimeRatio
//   }
// ]
```

#### 11.5.3 Wymagania dla UI (wysoki poziom)

- **Panel operatora (production.html)**
  - przyciski `Start`, `Pauza`, `Zakończ`, `Problem` na kafelkach operacji,
  - minimalnie 2–3 kliknięcia do wykonania typowej akcji,
  - po akcji odświeżenie tylko zmienionego kafelka (bez pełnego reloadu).
- **Dashboard KPI (nowa sekcja)**
  - trzy kafle podsumowujące: liczba zakończonych operacji, ilość wyprodukowana,
    ilość braków w wybranym zakresie dat,
  - tabela operatorów z KPI (sortowalna po wybranych kolumnach),
  - tabela pokoi z liczbą aktywnych / zakończonych zleceń i średnim czasem
    realizacji ZP.

### 11.6 Status implementacji (2025-12-10)

✅ **Zrealizowane:**

- **Backend:**
  - Endpoint `GET /api/production/kpi/overview` w `backend/server.js`
  - Agregacje: `completedOperations`, `producedQuantity`, `wasteQuantity`, `problemsReported`, `avgOperationTimeMinutes`
  - Statystyki per pokój (`byRoom`) i top 5 produktów (`topProducts`)
  - Filtrowanie po zakresie dat (`dateFrom`, `dateTo`) i pokoju (`roomId`)
  - Uprawnienia: `ADMIN`, `PRODUCTION_MANAGER`, `PRODUCTION`

- **Frontend:**
  - Sekcja dashboardu KPI w `production.html` (style CSS + HTML)
  - Funkcje JavaScript w `scripts/production.js`:
    - `initKpiDashboard()` – inicjalizacja z kontrolą uprawnień
    - `loadKpiData()` – pobieranie danych z API
    - `renderKpiData()` – renderowanie kafli i tabel
    - `toggleKpiDashboard()` – zwijanie/rozwijanie dashboardu
  - Zapisywanie stanu widoczności w `localStorage`

- **Testy:**
  - Plik `backend/kpi.test.js` z testami jednostkowymi:
    - `calculateSummary()` – obliczanie podsumowania
    - `aggregateProductStats()` – agregacja statystyk produktów
    - `aggregateRoomStats()` – agregacja statystyk pokojów
    - Walidacja zakresu dat i uprawnień

---

**Wersja dokumentu:** 1.1  
**Data utworzenia:** 2025-12-01  
**Data aktualizacji:** 2025-12-10  
**Autor:** System ZAMÓWIENIA Development Team
