# Roadmap – Plan rozwoju systemu zamówień

## Aktualny status (2025-11-30)

### ✅ Zakończone

#### Faza 1: Fundament (Backend)
- [x] Migracja endpointu produktów do Supabase
- [x] Proxy do galerii QNAP
- [x] Podstawowe API zamówień

#### Faza 2: Autentykacja
- [x] Logowanie i role użytkowników
- [x] Middleware `requireRole()` w Express
- [x] Cookies `auth_id`, `auth_role`

#### Faza 3: Koszyk i klienci
- [x] Panel "Moi klienci" z CRUD
- [x] Wybór klienta w formularzu zamówień
- [x] Przypisanie klienta do handlowca
- [x] Szablony zamówień (zapis, wczytywanie, ulubione)

#### Faza 4: Zamówienia
- [x] Konwersja koszyka → zamówienie
- [x] Generowanie numeru zamówienia (YYYY/N/SHORTCODE)
- [x] Workflow statusów z walidacją przejść
- [x] Historia zmian statusu
- [x] Widok listy zamówień z filtrami
- [x] Modal szczegółów zamówienia
- [x] **Hurtowe usuwanie zamówień wraz ze zleceniami produkcyjnymi** (panel admina + endpoint `/api/orders/bulk-delete`) ✅ 2025-12-09

#### Faza 5: Kontrola dostępu
- [x] **Foldery KI** – przypisywanie folderów do handlowców
  - Panel admina "Foldery KI"
  - Filtrowanie galerii po przypisaniach
  - Audyt zmian (`UserFolderAccessLog`)
  - Rola `CLIENT` dla klientów zewnętrznych

- [x] **Miejscowości PM** – przypisywanie miejscowości do handlowców
  - Panel admina "Miejscowości PM"
  - Filtrowanie listy miejscowości
  - Przełącznik "pokaż wszystkie / tylko moje"
  - Ulubione miejscowości (limit 12)
  - Pasek ulubionych z szybkim dostępem
  - Audyt zmian (`UserCityAccessLog`)

#### Faza 6: UX Mobile
- [x] Responsywny design (breakpointy: 720px, 1024px)
- [x] Touch-friendly (min-height 44-48px)
- [x] Double-tap zoom na obrazkach galerii

---

### 🔄 W trakcie

Brak aktywnych prac – wszystkie zaplanowane funkcje zaimplementowane.

#### ✅ Ukończone (2025-12-24)
- [x] **Domknięcie refaktoryzacji backendu (serwisy + routing)**
  - `backend/app.js` stał się jedynym miejscem konfiguracji Expressa oraz montowania routerów domenowych (`/api/orders`, `/api/production/*`, `/api/admin`, itd.).
  - `backend/server.js` pełni wyłącznie rolę bootstrapu (start serwera + graceful shutdown) i eksportuje `app` do testów/innych runnerów.
  - `backend/services/orderService.js` agreguje logikę biznesową zamówień (walidacje, generowanie numerów, uprawnienia), co pozwala na ponowne użycie w routerach i testach jednostkowych.
  - `backend/services/pdfService.js` opakowuje generatory PDF i audyt druku, dzięki czemu routery `/api/production/.../print` oraz `/api/orders/:id/packing-list/print` korzystają z jednego entrypointu.
  - `/api/production` zostało rozbite na dedykowane routery (`routes/production/*.js`) montowane w `app.js`, co upraszcza testowanie i dalszą rozbudowę modułu MES.
  - **Zaimplementowane (Real-time SSE dla produkcji) – 2025-12-24:**
    - ✅ moduł emisji zdarzeń produkcyjnych (`backend/modules/sse/productionEvents.js`) z typami zdarzeń dla operacji, work orders i KPI;
    - ✅ emisja zdarzeń SSE w endpointach akcji operatora (`/api/production/operations/:id/{start|pause|complete}`);
    - ✅ automatyczna aktualizacja statusu work order po zakończeniu operacji z emisją zdarzenia SSE (`updateWorkOrderStatusFromOperations` w `productionService.js`);
    - ✅ emisja zdarzeń KPI po obliczeniu statystyk (`/api/production/kpi/overview`);
    - ✅ subskrypcja SSE w panelu operatora (`scripts/production.js`) z obsługą zdarzeń produkcyjnych;
    - ✅ inteligentna aktualizacja UI bez pełnego fetchu – optymistyczne update'y lokalnego stanu (`handleProductionEvent`, `handleOperationEvent`, `handleWorkOrderEvent`);
    - ✅ automatyczny fallback do pollingu przy rozłączeniu SSE (reconnect po 3s);
    - ✅ testy jednostkowe modułu emisji zdarzeń (`backend/modules/sse/productionEvents.test.js`);

#### ✅ Ukończone (2025-12-18)
- [x] **Multiroom dla operatorów produkcji** – przypisywanie użytkowników do wielu pokoi produkcyjnych
  - Migracja SQL: tabela `UserProductionRoom` (userId, roomId, isPrimary, notes, assignedBy)
  - Trigger synchronizacji: `User.productionroomid` jako cache pokoju głównego
  - Backend: endpointy CRUD `/api/admin/user-production-rooms`
  - Backend: rozszerzenie `/api/auth/me` o `productionRooms[]` i `hasMultipleRooms`
  - Backend: rozszerzenie `/api/kiosk/operators` o obsługę multiroom
  - Backend: rozszerzenie `/api/admin/users` o `productionRooms[]`
  - Backend: helper `isUserAssignedToRoom()` z obsługą multiroom
  - UI Admin: kolumna "Pokoje prod." w tabeli użytkowników
  - UI Admin: modal zarządzania pokojami (dodawanie, usuwanie, ustawianie głównego)
  - UI Produkcja: dropdown selector pokoju dla użytkowników z wieloma pokojami
  - Persystencja aktywnego pokoju w `localStorage`

#### ✅ Ukończone (2025-12-14)
- [x] **Refaktoryzacja UX panelu operatora** – płynne działanie bez przeładowań
  - Kafelki ZP: naprawiony glitch „pół-otwartego" kafelka (CSS `.wo-details.open`)
  - Stan otwarcia kafelków zapisywany w `localStorage`
  - Akcje Start/Pauza/Zakończ bez przeładowania strony (optymistyczne update'y)
  - Szybki polling na start (5s przez 2 min, potem 30s)
  - Badge SLA/termin na kafelkach (Dziś!/Jutro/Przeterminowane)
  - Usunięto filtr „Wszystkie" – zostały tylko „Do zrobienia" / „Wykonane"
  - Testy jednostkowe: `backend/workorders-view.test.js` (badge SLA, optymistyczne aktualizacje, stan kafelków)

#### ✅ Ukończone (2025-12-10)
- [x] **Refaktoryzacja ról i uprawnień MES** – zgodność z best practices MES
  - Rozszerzenie enum `UserRole` o nowe role produkcyjne (OPERATOR, PRODUCTION_MANAGER, GRAPHIC_DESIGNER)
  - Tabela `UserRoleAssignment` z wielorolami (isActive, assignedBy, assignedAt)
  - Endpointy CRUD: `GET/POST/DELETE /api/admin/user-role-assignments`
  - Endpoint synchronizacji: `PUT /api/admin/user-role-assignments/sync/:userId`
  - Endpoint przełączania roli: `POST /api/auth/active-role`
  - Helpery uprawnień: `getRoomAccessLevel()`, `canManageRoomAssignments()`, `canViewRoom()`, `canOperateInRoom()`
  - UI Admin: sekcja wieloról w formularzu użytkownika (checkboxy)
  - UI Admin: pole `roomManagerUserId` + lista operatorów w formularzu pokoju
  - Testy jednostkowe: `backend/roles-permissions.test.js` (29 testów)

#### ✅ Ukończone (2025-12-XX)
- [x] **Generator kodów produkcyjnych** – automatyczne generowanie unikalnych kodów dla pokoi, gniazd i maszyn
  - Backend: funkcje `generateRoomCode()`, `generateWorkCenterCode()`, `generateWorkStationCode()` w `server.js`
  - Format kodów: `BAZOWY-NNN` (pokoje), `ROOMCODE-TYP-NN` (gniazda), `WORKCENTERCODE-NN` (maszyny)
  - Testy jednostkowe: `backend/code-generator.test.js`
- [x] **Modale UX/UI** – piękne formularze do dodawania/edycji pokoi, gniazd i maszyn
  - HTML: `admin/index.html` (modale z gradientami: amber/blue/green)
  - JS: `admin/admin.js` (IIFE `initProductionModals()`)
  - Automatyczne ładowanie list (nadzorcy, pokoje, gniazda)

---

### 🧾 Do przejrzenia później (pending review)

Poniższa lista to zmiany obecne w workspace (status `git diff` / pliki nieśledzone), które nie są bezpośrednio związane z bieżącym wątkiem i wymagają późniejszego przeglądu (czy zostają, czy cofamy / rozdzielamy na osobne commity).

#### Zmodyfikowane pliki (M)
- `README.md`
- `assets/styles.css`
- `backend/server.js`
- `index.html`
- `login.html`
- `orders.html`
- `production.html`
- `scripts/app.js`
- `scripts/graphics.js`
- `scripts/login.js`
- `scripts/orders.js`
- `scripts/production.js`
- `admin/index.html`
- `admin/admin.js`
- `docs/SPEC.md`
- `docs/SPEC_PRODUCTION_PANEL.md`
- `docs/USER_MANUAL.md`

#### Pliki nieśledzone (??)
- `backend/debug_production_orders.js`
- `backend/diagnose_by_source_order.js`
- `backend/diagnose_new_orders.js`
- `backend/diagnose_today_orders.js`
- `backend/fix_orphaned_orders.js`
- `backend/normalize-project-view-url.test.js`
- `backend/order-number.test.js`
- `backend/workorders-view.test.js`

### 📋 Planowane (niski priorytet)

#### Testy automatyczne
- [x] Testy jednostkowe (Vitest) ✅ 2025-12-19
- [x] CI/CD dla automatycznego uruchamiania (GitHub Actions) ✅ 2025-12-19
- [ ] Testy E2E (Playwright)

#### Refaktoryzacja backendu
- [x] **Modularyzacja server.js** ✅ 2025-12-19
  - [x] Moduł konfiguracji (`config/env.js`)
  - [x] Moduł autentykacji (`modules/auth/`)
  - [x] Moduł SSE (`modules/sse/`)
  - [x] Serwis produkcji (`services/productionService.js`)
  - [x] Serwis zamówień (`services/orderService.js`) ✅ 2025-12-24
  - [x] Serwis PDF (`services/pdfService.js`) ✅ 2025-12-24
  - [x] Routing (`routes/auth.js`, `routes/orders.js`, `routes/production*.js`) ✅ 2025-12-24
  - [x] Główna aplikacja (`app.js`) ✅ 2025-12-24

#### Optymalizacje
- [ ] Cache'owanie listy miejscowości
- [ ] Paginacja dla dużych list w panelu admina
- [ ] Lepsza obsługa błędów sieciowych

#### Funkcjonalności dodatkowe
- [ ] Eksport/import przypisań do CSV
- [ ] Masowe przypisywanie miejscowości
- [ ] Statystyki wykorzystania przypisań
- [ ] Historia zmian w UI admina
- [ ] Powiadomienia email przy zmianie statusu
 - [x] Mapowanie projektów galerii na produkty (rodziny produktów + panel admina) ✅ 2025-12-02

#### 🏭 Panel Produkcyjny (v2.0.0)
- [ ] **Faza 1: Fundamenty produkcyjne**
  - [x] Migracja bazodanowa: `ProductionRoom`, `WorkCenter`, `WorkStation`, `ProductionPath`, `ProductionOrder`, `ProductionOperation`
  - [x] **Nowa tabela `ProductionWorkOrder`** (grupowanie zleceń po pokojach) ✅ 2025-12-08
  - [x] **Rozszerzenie `ProductionOrder` o `workOrderId`** (powiązanie z `ProductionWorkOrder`) ✅ 2025-12-08
  - [ ] Backend API: zarządzanie pokojami, gniazdami, stanowiskami, ścieżkami (CRUD w `backend/server.js`)
  - [x] Integracja: automatyczne zamówienie → zlecenia produkcyjne (`ProductionWorkOrder` + `ProductionOrder` + `ProductionOperation`) na podstawie ścieżek produkcji (`createProductionOrdersForOrder`) ✅ 2025-12-08
  - [x] System numeracji zleceń pokojowych `ZP-YYYY-NNNN` (np. `ZP-2025-0001`) dla `ProductionWorkOrder.workOrderNumber` ✅ 2025-12-08

- [x] **Faza 2: Panel operatora (MVP)** ✅ 2025-12-10
  - [x] Widok panelu produkcji: lista zleceń, filtry, widoki kompaktowe/szczegółowe, podgląd produktów (modal ze zdjęciem z galerii) – `production.html`, `scripts/production.js`
  - [x] Endpoint `/api/production/orders/active` – zwraca aktywne zlecenia produkcyjne zgrupowane w ramach work orders
  - [x] Endpoint `/api/production/work-orders/:id/print` – generowanie PDF zlecenia produkcyjnego (work order)
  - [x] Endpointy akcji operatora dla operacji produkcyjnych: **start / pause / complete / cancel / problem** ✅ 2025-12-09
  - [x] Logika `ProductionLog`: zapisywanie historii akcji operatorów (czasy startu/pauzy/zakończenia, użytkownik) ✅ 2025-12-09
  - [x] Trwałe śledzenie czasu trwania operacji po stronie serwera (sumaryczny czas `actualtime` w minutach) ✅ 2025-12-09
  - [x] Automatyczne przejścia statusów `ProductionWorkOrder` na podstawie statusów powiązanych operacji (`updateWorkOrderStatusFromOperations`) ✅ 2025-12-09
  - [x] Endpoint statystyk operatora / sali produkcyjnej (`/api/production/operator/stats`) – podstawowe KPI do panelu ✅ 2025-12-09
  - [x] **Endpoint dashboardu KPI** (`/api/production/kpi/overview`) – zagregowane KPI produkcyjne ✅ 2025-12-10
  - [x] **Dashboard KPI w UI** (`production.html`) – kafle, tabele pokojów i top produktów ✅ 2025-12-10
  - [x] Weryfikacja i dopięcie reguł uprawnień dla produkcji (role: `PRODUCTION`, `OPERATOR`, `ADMIN`, `PRODUCTION_MANAGER`) ✅ 2025-12-09
  - [x] Testy jednostkowe: `backend/production.test.js`, `backend/kpi.test.js` ✅ 2025-12-10
  - [x] Real-time updates (SSE) dla listy zleceń i statystyk ✅ 2025-12-24
  - [ ] (opcjonalnie) Migracja z SSE na pełny WebSocket jeśli zajdzie potrzeba interakcji dwukierunkowej
  - [ ] Podstawowy routing w panelu admina

- [ ] **Faza 2: System druku zleceń produkcyjnych**
  - [x] **Generatory PDF**:
    - [x] Karta zlecenia produkcyjnego (ProductionWorkOrder) – `createProductionWorkOrderPDF` ✅ 2025-12-08
    - [x] Karta zlecenia na projekty (GraphicsTask) – `createGraphicsTaskPDF` ✅ 2025-12-08
    - [ ] Lista kompletacyjna zamówienia (pakowanie) – backend + testy (`createPackingListPDF`, endpoint `/api/orders/:id/packing-list/print`) gotowe, wymaga akceptacji w realnym procesie pakowania
  - [x] **Endpointy API do druku**:
    - [x] `GET /api/orders/:id/production-work-orders` – lista ZP dla zamówienia ✅ 2025-12-08
    - [x] `GET /api/production/work-orders/:id/print` (SALES_DEPT, ADMIN, PRODUCTION, PRODUCTION_MANAGER, OPERATOR, WAREHOUSE)
    - [x] `GET /api/graphics/tasks/:id/print` (GRAPHICS, ADMIN, SALES_DEPT, PRODUCTION_MANAGER)
    - [x] `GET /api/orders/:id/packing-list/print` (SALES_DEPT, ADMIN, WAREHOUSE, PRODUCTION, OPERATOR, PRODUCTION_MANAGER)
  - [x] **Uprawnienia do druku** (rola-based – zgodnie z tabelą w `docs/SPEC_PRODUCTION_PANEL.md` §10.4) ✅ 2025-12-08
  - [x] **Audyt druku** (tabela `PrintAudit`, wpisy dla: production_work_order, graphics_task, packing_list) ✅ 2025-12-08

- [ ] **Faza 3: Panel operatora**
  - [ ] Kafelkowy interfejs (wzorzec Prodio)
  - [ ] WebSocket: real-time updates statusów
  - [ ] Proste formularze: start/pause/complete (max 3 kliknięcia)
  - [ ] Kolorowe statusy i duże przyciski
  - [x] **Widok zleceń pokojowych + podgląd grafik prosto z OrderItem.projectViewUrl** (dekodowanie nazw, poprawione proporcje modala) ✅ 2025-12-09
  - [ ] **Przyciski druku** dla swoich zleceń (ponowny druk)
  - [x] **System przypisań produktów do maszyn** (tabela `MachineProductAssignment`, RLS po `roomManagerUserId`, Kanban w panelu admina + link „Przypisania” w panelu produkcji) ✅ 2025-12-09
  - [x] **Data wymagana w zamówieniu (`Order.deliveryDate`)** – pole „na kiedy potrzebne" w formularzu zamówień (handlowiec), z walidacją daty w przyszłości ✅ 2025-12-10
  - [x] **Przekazanie `deliveryDate` do modułu produkcji** – rozszerzenie `/api/orders` i `/api/production/orders/active` o datę wymaganą ✅ 2025-12-10
  - [x] **Auto-priorytet zamówień** na podstawie daty wymagalności i szacowanego czasu produkcji (`timeStatus`, `priority`) – zgodnie z `docs/SPEC_PRODUCTION_PANEL.md` §6.6 ✅ 2025-12-10
  - [x] **Wizualizacja czasu do terminu** w panelu operatora (pozostały czas / przeterminowane, kolorystyka kart) ✅ 2025-12-10

- [ ] **Faza 4: Podział zleceń w sprzedaży**
  - [ ] **Ekran podziału zamówienia na pokoje**:
    - [ ] Lista pozycji zamówienia
    - [ ] Przeciąganie i upuszczanie do pokoi
    - [ ] Automatyczne tworzenie ProductionWorkOrder
    - [ ] Podgląd zleceń przed drukiem
  - [ ] **Walidacja podziału** (wszystkie pozycje przypisane)
  - [ ] **Historia podziału zamówień**
  - [ ] **Przyciski druku zleceń** (pierwszy komplet dla produkcji)

- [ ] **Faza 5: Pakowanie i kompletacja**
  - [ ] **Logika kompletacji zamówienia**:
    - [ ] Sprawdzanie statusów wszystkich zleceń
    - [ ] Generowanie listy braków
    - [ ] Statusy: `READY_FOR_PACKING`, `PACKING_IN_PROGRESS`, `PACKED`
  - [ ] **Endpointy pakowania**:
    - [ ] `GET /api/orders/:id/packing-status`
    - [ ] `POST /api/orders/:id/mark-packed`
  - [ ] **Panel pakowania**:
    - [ ] Lista zamówień gotowych do pakowania
    - [ ] Lista kompletacyjna z checkboxami
    - [ ] Podpisy elektroniczne/papierowe

- [ ] **Faza 6: Admin produkcji**
  - [ ] Rozszerzenie panelu admina o zakładkę "Produkcja"
  - [ ] Zarządzanie pokojami produkcyjnymi
  - [ ] Zarządzanie gniazdami produkcyjnymi
  - [ ] Zarządzanie stanowiskami roboczymi i maszynami
  - [ ] Tworzenie ścieżek produkcyjnych (wzorzec Katany)
  - [ ] System szacowania czasów produkcyjnych
  - [ ] Szablony czasów operacji i kalibracja
  - [ ] Moduł grafiki / Panel pracy grafika (zadania `GraphicTask`, scenariusze akceptacji projektów; szczegóły w `docs/SPEC_PRODUCTION_PANEL.md` §9)

- [ ] **Faza 7: Optymalizacje i rozszerzenia**
  - [ ] Drag & drop harmonogram zadań
  - [ ] Automatyczne planowanie i priorytetyzacja
  - [ ] **Kody QR na dokumentach** (skanowanie statusów)
  - [ ] **Szablony PDF v2.0** (logo, typografia, wersje językowe)
  - [ ] **Raporty produkcyjne** (dzienny, wydajność maszyn)
  - [ ] Testy użyteczności z operatorami
  - [ ] Dokumentacja i materiały szkoleniowe

#### Magazyn (przyszłość)
- [ ] Widok stanów magazynowych
- [ ] Logika rezerwacji (`stockReserved`)
- [ ] Dostępność produktu w czasie
- [ ] Planowanie zakupów

#### PWA
- [ ] Manifest i ikony
- [ ] Service worker (cache offline)
- [ ] "Dodaj do ekranu głównego"

---

## Tryby formularza

### Zaimplementowane
- **PM** – Projekty miejscowości
- **KI** – Klienci indywidualni

### Planowane
- **PI** – Projekty imienne
- **Ph** – Projekty hasła

---

## Wersje systemu

### v1.0.0 (Produkcja) – 2025-11-30
- Podstawowy system zamówień
- Workflow statusów
- Panel klientów
- Przypisywanie folderów KI
- Przypisywanie miejscowości PM
- Ulubione miejscowości
- Responsywny design

### v1.1.0 (Planowane) – Q1 2026
- Testy automatyczne
- Optymalizacje wydajności
- Eksport/import danych

#### Usprawnienia UX formularza zamówień (podstawowe, SPEC §6.10)

- [ ] Pasek kroków / wskaźnik postępu w formularzu ("1. Produkt", "2. Szczegóły", "3. Klient", "4. Dostawa")
- [ ] Usprawnione wybieranie produktów: ulubione, ostatnio zamawiane, filtry kategorii
- [ ] Smart defaults dla terminu "Na kiedy potrzebne" na bazie presetów `OrderDeliveryPreset`
- [ ] Walidacja formularza i blokada przycisku "Wyślij zamówienie" przy brakujących danych (klient, produkty, data)
- [ ] Dalsza optymalizacja mobile: pasek akcji na dole, większe przyciski, lepszy układ sekcji klient + dostawa

#### Rozszerzenia UX formularza zamówień (kandydaci do v1.x)

- [ ] "Powtórz zamówienie" + szybka modyfikacja (frontend + opcjonalny endpoint pomocniczy)
- [ ] Tryb "Szybkie zamówienie" (Quick Order) dla doświadczonych handlowców
- [ ] Checklisty sprzedażowe (guided selling) dla wybranych kategorii produktów
- [ ] Widok "Ryzyko dostawy" powiązany z obciążeniem produkcji (capacity check)

### v2.0.0 (Planowane) – Q2 2026
- **Panel Produkcyjny** – kompletny system zarządzania produkcją
  - Kafelkowy interfejs operatora (wzorzec Prodio)
  - Real-time monitoring i WebSocket
  - Zarządzanie pokojami, gniazdami i stanowiskami
  - Ścieżki produkcyjne i harmonogramowanie
  - Integracja z zamówieniami

### v2.1.0 (Planowane) – Q3 2026
- Testy automatyczne
- Optymalizacje wydajności
- Eksport/import danych

### v2.2.0 (Planowane) – Q4 2026
- System raportów
- Integracje zewnętrzne
- Zaawansowany magazyn
- PWA

---

## Uwagi

**Postęp prac oznaczaj:**
- W tym pliku `docs/roadmap.md` – perspektywa biznesowa
- W `docs/SPEC.md` – perspektywa techniczna

**Dokumentacja:**
- `README.md` – szybki start
- `docs/SPEC.md` – specyfikacja techniczna
- `docs/USER_MANUAL.md` – podręcznik użytkownika
- `docs/SPEC_FOLDER_ACCESS.md` – szczegóły modułu KI
- `docs/SPEC_PRODUCTION_PANEL.md` – szczegóły panelu produkcyjnego

---

**Wersja dokumentu:** 3.4  
**Data aktualizacji:** 2025-12-10
