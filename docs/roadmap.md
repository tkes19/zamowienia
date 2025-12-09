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

---

### 📋 Planowane (niski priorytet)

#### Testy automatyczne
- [ ] Testy jednostkowe (Vitest)
- [ ] Testy E2E (Playwright)
- [ ] CI/CD dla automatycznego uruchamiania

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
  - [x] Migracja bazodanowa: ProductionRoom, WorkCenter, WorkStation, ProductionPath, ProductionOrder, ProductionOperation
  - [x] **Nowa tabela ProductionWorkOrder** (grupowanie zleceń po pokojach) ✅ 2025-12-08
  - [x] **Rozszerzenie ProductionOrder o workOrderId** (powiązanie z ProductionWorkOrder) ✅ 2025-12-08
  - [ ] Backend API: zarządzanie pokojami, gniazdami, stanowiskami, ścieżkami
  - [x] Integracja: automatyczne zamówienie → zlecenia produkcyjne (`ProductionOrder`) na podstawie ścieżek produkcji (`createProductionOrdersForOrder`) ✅ 2025-12-08
  - [x] System numeracji zleceń pokojowych `ZP-YYYY-NNNN` (np. `ZP-2025-0001`) dla `ProductionWorkOrder.workOrderNumber` ✅ 2025-12-08
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

**Wersja dokumentu:** 3.2  
**Data aktualizacji:** 2025-12-08
