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
  - [ ] Migracja bazodanowa: ProductionRoom, WorkCenter, WorkStation, ProductionPath, ProductionOrder, ProductionOperation
  - [ ] Backend API: zarządzanie pokojami, gniazdami, stanowiskami, ścieżkami
  - [ ] Integracja: automatyczne zamowienie → zlecenie produkcyjne
  - [ ] Podstawowy routing w panelu admina

- [ ] **Faza 2: Panel operatora**
  - [ ] Kafelkowy interfejs (wzorzec Prodio)
  - [ ] WebSocket: real-time updates statusów
  - [ ] Proste formularze: start/pause/complete (max 3 kliknięcia)
  - [ ] Kolorowe statusy i duże przyciski

- [ ] **Faza 3: Admin produkcji**
  - [ ] Rozszerzenie panelu admina o zakładkę "Produkcja"
  - [ ] Zarządzanie pokojami produkcyjnymi
  - [ ] Zarządzanie gniazdami produkcyjnymi
  - [ ] Zarządzanie stanowiskami roboczymi i maszynami
  - [ ] Tworzenie ścieżek produkcyjnych (wzorzec Katany)
  - [ ] System szacowania czasów produkcyjnych
  - [ ] Szablony czasów operacji i kalibracja
  - [ ] Moduł grafiki / Panel pracy grafika (zadania `GraphicTask`, scenariusze akceptacji projektów; szczegóły w `docs/SPEC_PRODUCTION_PANEL.md` §9)

- [ ] **Faza 4: Harmonogram i optymalizacja**
  - [ ] Drag & drop harmonogram zadań
  - [ ] Automatyczne planowanie i priorytetyzacja
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

**Wersja dokumentu:** 3.1  
**Data aktualizacji:** 2025-12-02
