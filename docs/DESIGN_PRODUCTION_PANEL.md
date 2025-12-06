# Panel Produkcyjny – Projekt UX/UI

## 1. Filozofia projektowa

### 1.1 Zasady nadrzędne

| Zasada | Opis |
|--------|------|
| **3-click rule** | Każda akcja operatora max 3 kliknięcia |
| **Glanceable** | Status widoczny z 3 metrów (duże kafelki, kolory) |
| **Role-first** | UI dostosowuje się do roli – operator widzi tylko swoje |
| **Mobile-ready** | Operator na tablecie, kierownik na telefonie |
| **Real-time** | WebSocket – zmiany widoczne natychmiast |

### 1.2 Paleta kolorów statusów

```
PLANNED     → #94A3B8 (slate-400)    szary
APPROVED    → #3B82F6 (blue-500)     niebieski  
IN_PROGRESS → #F59E0B (amber-500)    pomarańczowy
PAUSED      → #8B5CF6 (violet-500)   fioletowy
COMPLETED   → #22C55E (green-500)    zielony
PROBLEM     → #EF4444 (red-500)      czerwony
```

### 1.3 Typografia produkcyjna

- **Numer zlecenia:** 32px bold (widoczny z daleka)
- **Ilość:** 48px extra-bold (najważniejsza informacja)
- **Produkt:** 18px medium
- **Detale:** 14px regular

---

## 2. Struktura nawigacji

### 2.1 Główne widoki

```
/production                    → Dashboard (redirect wg roli)
/production/operator           → Panel operatora (kafelki zadań)
/production/board              → Tablica Kanban (kierownik)
/production/schedule           → Harmonogram Gantt (kierownik)
/production/graphics           → Panel grafika
/admin → Produkcja             → Konfiguracja (admin)
```

### 2.2 Nawigacja wg roli

| Rola | Domyślny widok | Dostępne widoki |
|------|----------------|-----------------|
| OPERATOR | /production/operator | operator |
| GRAPHIC_DESIGNER | /production/graphics | graphics, operator (swoje) |
| PRODUCTION_MANAGER | /production/board | board, schedule, operator, graphics |
| ADMIN | /production/board | wszystkie + admin/produkcja |

---

## 3. Panel Operatora

### 3.1 Layout główny

```
┌─────────────────────────────────────────────────────────────────┐
│  🏭 PRODUKCJA          [Pokój: LASER-1 ▼]    👤 Jan K.  [Wyloguj]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ 🟠 AKTYWNE  │  │ 🔵 KOLEJKA  │  │ 🟢 GOTOWE   │             │
│  │     2       │  │     5       │  │    12       │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                 │
│  ═══════════════════════════════════════════════════════════   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  🟠 PROD-2025-0847                              ⏱ 01:23:45│   │
│  │  ─────────────────────────────────────────────────────  │   │
│  │  KUBEK CERAMICZNY 300ml                                 │   │
│  │  Klient: Sklep Gdańsk                                   │   │
│  │                                                         │   │
│  │           ████████████████░░░░░░░░░░  67%              │   │
│  │                                                         │   │
│  │     Wykonano: 134 / 200 szt.                           │   │
│  │                                                         │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────────────────────┐ │   │
│  │  │ ⏸ PAUZA │  │ ⚠ PROBLEM│  │    ✅ ZAKOŃCZ PARTIĘ    │ │   │
│  │  └─────────┘  └─────────┘  └─────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  🔵 PROD-2025-0848                              Priorytet: 2│   │
│  │  ─────────────────────────────────────────────────────  │   │
│  │  MAGNES HDF 50x70                                       │   │
│  │  Klient: Hotel Kraków           Ilość: 500 szt.        │   │
│  │                                                         │   │
│  │  ┌───────────────────────────────────────────────────┐ │   │
│  │  │              ▶️  ROZPOCZNIJ                        │ │   │
│  │  └───────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  [⚠️ Brak materiału]  [🔧 Awaria]  [❓ Inny problem]  [☕ Przerwa]│
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Kafelek zadania – stany

**Stan: OCZEKUJE (niebieski)**
```
┌─────────────────────────────────────┐
│ 🔵 PROD-2025-0848        Priorytet 2│
│ ─────────────────────────────────── │
│ MAGNES HDF 50x70                    │
│ Klient: Hotel Kraków                │
│ Ilość: 500 szt.                     │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │       ▶️  ROZPOCZNIJ            │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**Stan: W TRAKCIE (pomarańczowy)**
```
┌─────────────────────────────────────┐
│ 🟠 PROD-2025-0847          ⏱ 01:23  │
│ ─────────────────────────────────── │
│ KUBEK CERAMICZNY 300ml              │
│ ████████████████░░░░░░░░  67%       │
│ Wykonano: 134 / 200 szt.            │
│                                     │
│ ┌────────┐ ┌────────┐ ┌───────────┐│
│ │⏸ PAUZA│ │⚠ PROBLEM│ │✅ ZAKOŃCZ ││
│ └────────┘ └────────┘ └───────────┘│
└─────────────────────────────────────┘
```

**Stan: PROBLEM (czerwony)**
```
┌─────────────────────────────────────┐
│ 🔴 PROD-2025-0846          ⚠️ PROBLEM│
│ ─────────────────────────────────── │
│ BRELOK METALOWY                     │
│ Problem: Brak materiału             │
│ Zgłoszono: 10:45 przez Jan K.       │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │      🔄 WZNÓW PO ROZWIĄZANIU    │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 3.3 Modal: Zakończ partię

```
┌─────────────────────────────────────────────┐
│  ✅ Zakończ partię                     [X]  │
├─────────────────────────────────────────────┤
│                                             │
│  PROD-2025-0847 • KUBEK CERAMICZNY 300ml    │
│                                             │
│  Zamówiono:        200 szt.                 │
│  ─────────────────────────────────────────  │
│                                             │
│  Wykonano OK:      ┌─────────────────┐      │
│                    │      196        │      │
│                    └─────────────────┘      │
│                                             │
│  Braki/odpady:     ┌─────────────────┐      │
│                    │       4         │      │
│                    └─────────────────┘      │
│                                             │
│  Uwagi jakościowe: ┌─────────────────────┐  │
│                    │ 2 szt. z rysami     │  │
│                    │ (odłożone do oceny) │  │
│                    └─────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │         ✅ POTWIERDŹ I ZAKOŃCZ        │  │
│  └───────────────────────────────────────┘  │
│                                             │
└─────────────────────────────────────────────┘
```

### 3.4 Modal: Zgłoś problem

```
┌─────────────────────────────────────────────┐
│  ⚠️ Zgłoś problem                      [X]  │
├─────────────────────────────────────────────┤
│                                             │
│  Typ problemu:                              │
│  ┌─────────────────────────────────────┐    │
│  │ ○ Brak materiału                    │    │
│  │ ○ Awaria maszyny                    │    │
│  │ ○ Błąd w projekcie                  │    │
│  │ ○ Problem jakościowy                │    │
│  │ ○ Inny                              │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  Opis (opcjonalnie):                        │
│  ┌─────────────────────────────────────┐    │
│  │                                     │    │
│  │                                     │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  [ ] Wstrzymaj zadanie do rozwiązania       │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │            ⚠️ ZGŁOŚ PROBLEM           │  │
│  └───────────────────────────────────────┘  │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 4. Tablica Kanban (Kierownik)

### 4.1 Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🏭 PRODUKCJA    [Tablica ▼]    [Filtr: Wszystkie ▼]    🔍 Szukaj...    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ZAPLANOWANE (8)   DO REALIZACJI (5)   W TRAKCIE (3)   GOTOWE (12)     │
│  ───────────────   ────────────────   ─────────────   ────────────     │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐ │
│  │ PROD-0852   │   │ PROD-0849   │   │🟠PROD-0847  │   │✅PROD-0840  │ │
│  │ Kubek 300ml │   │ Magnes HDF  │   │ Kubek 300ml │   │ Brelok      │ │
│  │ 200 szt.    │   │ 500 szt.    │   │ 134/200     │   │ 100 szt.    │ │
│  │ 📅 06.12    │   │ 🔴 Pilne!   │   │ Jan K.      │   │ ✓ 05.12     │ │
│  │ [Grafika ▶] │   │             │   │ ⏱ 01:23     │   │             │ │
│  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘ │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐ │
│  │ PROD-0853   │   │ PROD-0850   │   │🔴PROD-0846  │   │✅PROD-0839  │ │
│  │ Talerz      │   │ Kubek XL    │   │ Brelok      │   │ Magnes      │ │
│  │ 50 szt.     │   │ 150 szt.    │   │ ⚠ PROBLEM   │   │ 200 szt.    │ │
│  │ 📅 07.12    │   │             │   │ Brak mater. │   │ ✓ 05.12     │ │
│  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘ │
│        ⋮                 ⋮                 ⋮                 ⋮         │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  📊 Dziś: 15 zleceń | ⏱ Śr. czas: 45min | ⚠ Problemy: 2 | ✅ Gotowe: 12│
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Drag & Drop

- Karty można przeciągać między kolumnami
- Przeciągnięcie do „W TRAKCIE" → przypisuje do operatora (modal wyboru)
- Przeciągnięcie do „GOTOWE" → wymaga potwierdzenia ilości

### 4.3 Szczegóły zlecenia (panel boczny)

```
┌─────────────────────────────────────────────┐
│  PROD-2025-0847                        [X]  │
├─────────────────────────────────────────────┤
│                                             │
│  Status: 🟠 W TRAKCIE                       │
│  ─────────────────────────────────────────  │
│                                             │
│  📦 KUBEK CERAMICZNY 300ml                  │
│  Identyfikator: KUB-CER-300                 │
│                                             │
│  📋 Zamówienie: 2025/47/JRO                 │
│  👤 Klient: Sklep Gdańsk                    │
│  📅 Termin: 06.12.2025                      │
│                                             │
│  ─────────────────────────────────────────  │
│  POSTĘP                                     │
│  ─────────────────────────────────────────  │
│  Ilość: 134 / 200 szt. (67%)               │
│  ████████████████░░░░░░░░░░                │
│                                             │
│  Operator: Jan Kowalski                     │
│  Maszyna: LASER-CO2-01                      │
│  Czas: 01:23:45                             │
│                                             │
│  ─────────────────────────────────────────  │
│  HISTORIA                                   │
│  ─────────────────────────────────────────  │
│  10:00 Utworzono zlecenie                   │
│  10:15 Przekazano do produkcji              │
│  10:20 Jan K. rozpoczął                     │
│  11:00 Przerwa (15 min)                     │
│  11:15 Wznowiono                            │
│                                             │
│  ─────────────────────────────────────────  │
│  AKCJE                                      │
│  ─────────────────────────────────────────  │
│  [Zmień priorytet] [Przypisz] [Anuluj]      │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 5. Panel Grafika

### 5.1 Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🎨 GRAFIKA           [Moje zadania ▼]         👤 Anna G.    [Wyloguj]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ 📥 NOWE     │  │ 🎨 W PRACY  │  │ ⏳ AKCEPTACJA│  │ ✅ GOTOWE   │    │
│  │     4       │  │     2       │  │     1       │  │    15       │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
│                                                                         │
│  ═══════════════════════════════════════════════════════════════════   │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │  📥 NOWE ZADANIE                                     Priorytet: 1 │ │
│  │  ─────────────────────────────────────────────────────────────── │ │
│  │  Zamówienie: 2025/48/MNO                                         │ │
│  │  Klient: Restauracja Poznań                                      │ │
│  │  Produkt: MENU A4 laminowane                                     │ │
│  │  Ilość: 50 szt.  •  Termin: 07.12.2025                          │ │
│  │                                                                   │ │
│  │  Uwagi handlowca:                                                │ │
│  │  ┌─────────────────────────────────────────────────────────────┐ │ │
│  │  │ Logo w załączniku. Kolory: złoty + bordowy.                 │ │ │
│  │  │ Proszę o projekt do akceptacji przed drukiem.               │ │ │
│  │  └─────────────────────────────────────────────────────────────┘ │ │
│  │                                                                   │ │
│  │  ┌─────────────────┐  ┌─────────────────────────────────────────┐│ │
│  │  │ 📎 Załączniki (2)│  │           🎨 ROZPOCZNIJ PRACĘ          ││ │
│  │  └─────────────────┘  └─────────────────────────────────────────┘│ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Widok zadania w pracy

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🎨 Zadanie: 2025/48/MNO • MENU A4                              [Wróć] │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────┐  ┌───────────────────────────────┐│
│  │  INFORMACJE                     │  │  CHECKLIST                    ││
│  │  ─────────────────────────────  │  │  ─────────────────────────── ││
│  │  Klient: Restauracja Poznań     │  │  [✓] Dane klienta sprawdzone  ││
│  │  Produkt: MENU A4 laminowane    │  │  [✓] Logo w odpowiedniej      ││
│  │  Ilość: 50 szt.                 │  │      rozdzielczości           ││
│  │  Termin: 07.12.2025             │  │  [ ] Kolory CMYK              ││
│  │                                 │  │  [ ] Marginesy i spadki       ││
│  │  Projekty: 1, 2, 3              │  │  [ ] Warstwy nazwane          ││
│  │  Miejscowość: Poznań            │  │  [ ] Plik produkcyjny gotowy  ││
│  │                                 │  │                               ││
│  │  📎 Załączniki:                 │  │                               ││
│  │  • logo_restauracja.ai          │  │                               ││
│  │  • brief.pdf                    │  │                               ││
│  └─────────────────────────────────┘  └───────────────────────────────┘│
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  PLIKI PRODUKCYJNE                                                  ││
│  │  ─────────────────────────────────────────────────────────────────  ││
│  │                                                                     ││
│  │  Ścieżka: ┌────────────────────────────────────────────────────┐   ││
│  │           │ //QNAP/Produkcja/2025/12/MENU_A4_Poznan/           │   ││
│  │           └────────────────────────────────────────────────────┘   ││
│  │                                                                     ││
│  │  Pliki:   [ ] menu_front.pdf                                       ││
│  │           [ ] menu_back.pdf                                        ││
│  │                                                                     ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ┌───────────────────────┐  ┌───────────────────────────────────────┐  │
│  │  💬 Dodaj komentarz   │  │  ✅ GOTOWE DO PRODUKCJI / AKCEPTACJI  │  │
│  └───────────────────────┘  └───────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Admin: Konfiguracja produkcji

### 6.1 Zakładki w panelu admina

```
┌─────────────────────────────────────────────────────────────────────────┐
│  PANEL ADMINISTRATORA                                                   │
├──────────────────┬──────────────────────────────────────────────────────┤
│                  │                                                      │
│  📊 Dashboard    │  PRODUKCJA › POKOJE                                  │
│  👥 Użytkownicy  │  ════════════════════════════════════════════════   │
│  📋 Zamówienia   │                                                      │
│  🏙 Miejscowości │  [+ Dodaj pokój]                    🔍 Szukaj...     │
│  📁 Foldery KI   │                                                      │
│  🗺 Mapowanie    │  ┌─────────────────────────────────────────────────┐ │
│  ─────────────── │  │                                                 │ │
│  🏭 PRODUKCJA    │  │  ┌───────────┐  ┌───────────┐  ┌───────────┐   │ │
│    ├─ Pokoje     │  │  │ LASER-1   │  │ LASER-2   │  │ UV-PRINT  │   │ │
│    ├─ Gniazda    │  │  │ ───────── │  │ ───────── │  │ ───────── │   │ │
│    ├─ Maszyny    │  │  │ 45 m²     │  │ 30 m²     │  │ 25 m²     │   │ │
│    └─ Ścieżki    │  │  │ Gniazda: 3│  │ Gniazda: 2│  │ Gniazda: 1│   │ │
│                  │  │  │ Maszyny: 5│  │ Maszyny: 3│  │ Maszyny: 2│   │ │
│                  │  │  │           │  │           │  │           │   │ │
│                  │  │  │[Edytuj]   │  │[Edytuj]   │  │[Edytuj]   │   │ │
│                  │  │  └───────────┘  └───────────┘  └───────────┘   │ │
│                  │  │                                                 │ │
│                  │  └─────────────────────────────────────────────────┘ │
│                  │                                                      │
└──────────────────┴──────────────────────────────────────────────────────┘
```

### 6.2 Modal: Dodaj/Edytuj pokój

```
┌─────────────────────────────────────────────┐
│  🏭 Nowy pokój produkcyjny             [X]  │
├─────────────────────────────────────────────┤
│                                             │
│  Nazwa:         ┌─────────────────────────┐ │
│                 │ Laser CO2               │ │
│                 └─────────────────────────┘ │
│                                             │
│  Kod:           ┌─────────────────────────┐ │
│                 │ LASER-1                 │ │
│                 └─────────────────────────┘ │
│                                             │
│  Powierzchnia:  ┌──────────────┐ m²        │
│                 │ 45           │            │
│                 └──────────────┘            │
│                                             │
│  Nadzorca:      ┌─────────────────────────┐ │
│                 │ Jan Kowalski        ▼   │ │
│                 └─────────────────────────┘ │
│                                             │
│  Opis:          ┌─────────────────────────┐ │
│                 │ Główny pokój laserów    │ │
│                 │ CO2 do grawerowania     │ │
│                 └─────────────────────────┘ │
│                                             │
│  [ ] Aktywny                                │
│                                             │
│  ┌──────────────┐  ┌──────────────────────┐ │
│  │   Anuluj     │  │      💾 Zapisz       │ │
│  └──────────────┘  └──────────────────────┘ │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 7. Responsywność

### 7.1 Breakpointy

| Breakpoint | Szerokość | Urządzenie | Układ |
|------------|-----------|------------|-------|
| Mobile | < 640px | Telefon | 1 kolumna, duże przyciski |
| Tablet | 640-1024px | Tablet | 2 kolumny, touch-friendly |
| Desktop | > 1024px | Monitor | Pełny layout |

### 7.2 Panel operatora na tablecie

```
┌─────────────────────────────────┐
│  🏭 PRODUKCJA        👤 Jan K.  │
├─────────────────────────────────┤
│  🟠 2  │  🔵 5  │  🟢 12        │
├─────────────────────────────────┤
│                                 │
│  ┌─────────────────────────────┐│
│  │ 🟠 PROD-2025-0847   ⏱ 01:23 ││
│  │ KUBEK CERAMICZNY 300ml      ││
│  │ ████████████░░░░░░  67%     ││
│  │ 134 / 200 szt.              ││
│  │                             ││
│  │ ┌───────┐┌───────┐┌───────┐ ││
│  │ │⏸ PAUZA││⚠ PROBL││✅ GOTÓW│ ││
│  │ └───────┘└───────┘└───────┘ ││
│  └─────────────────────────────┘│
│                                 │
│  ┌─────────────────────────────┐│
│  │ 🔵 PROD-2025-0848           ││
│  │ MAGNES HDF 50x70            ││
│  │ 500 szt.                    ││
│  │                             ││
│  │ ┌─────────────────────────┐ ││
│  │ │    ▶️ ROZPOCZNIJ        │ ││
│  │ └─────────────────────────┘ ││
│  └─────────────────────────────┘│
│                                 │
├─────────────────────────────────┤
│ [⚠️ Problem] [🔧 Awaria] [☕]   │
└─────────────────────────────────┘
```

---

## 8. Interakcje i animacje

### 8.1 Mikro-interakcje

| Element | Akcja | Efekt |
|---------|-------|-------|
| Kafelek zadania | Hover | Lekkie powiększenie (scale 1.02), cień |
| Przycisk ROZPOCZNIJ | Klik | Ripple effect, zmiana koloru |
| Progress bar | Update | Płynna animacja (transition 300ms) |
| Status badge | Zmiana | Fade + slide |
| Nowe zadanie | Pojawienie | Slide-in z góry |

### 8.2 Powiadomienia toast

```
┌─────────────────────────────────────────────┐
│  ✅ Zadanie PROD-0847 zakończone            │
│     Wykonano: 196/200 szt.             [X]  │
└─────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────┐
│  ⚠️ Nowe pilne zadanie!                     │
│     PROD-0855 • Priorytet: URGENT      [X]  │
└─────────────────────────────────────────────┘
```

---

## 9. Dostępność (a11y)

### 9.1 Wymagania

- **Kontrast:** min 4.5:1 dla tekstu, 3:1 dla dużych elementów
- **Focus:** widoczny outline na wszystkich interaktywnych elementach
- **Klawiatura:** pełna nawigacja Tab/Enter/Escape
- **Screen reader:** aria-labels na przyciskach, aria-live dla statusów

### 9.2 Skróty klawiszowe (operator)

| Skrót | Akcja |
|-------|-------|
| `Space` | Start/Pauza aktywnego zadania |
| `Enter` | Otwórz szczegóły zaznaczonego |
| `P` | Zgłoś problem |
| `F` | Zakończ partię |
| `Esc` | Zamknij modal |

---

## 10. Plan implementacji UI

**Podział na moduły (programistycznie):**

- **Moduł Produkcji** – Fazy 1–3 (infrastruktura produkcyjna, panel operatora,
  tablica Kanban, bez zależności od modułu grafiki).
- **Moduł Grafiki** – Faza 4 (Panel grafika + integracja z zamówieniami /
  GraphicTask / GraphicRequest; może być realizowany jako osobny projekt po
  uruchomieniu produkcji).

### Faza 1: Fundament (tydzień 1)
1. Migracja DB: ProductionRoom, WorkCenter
2. API: GET/POST /api/production/rooms
3. Admin: zakładka „Produkcja → Pokoje" (lista + dodawanie)

### Faza 2: Rozbudowa admina (tydzień 2)
4. API: WorkStation, ProductionPath
5. Admin: zakładki Gniazda, Maszyny, Ścieżki
6. Relacje między tabelami w UI

### Faza 3: Panel operatora (tydzień 3-4)
7. Strona /production/operator
8. Kafelki zadań (statyczne)
9. WebSocket: real-time updates
10. Akcje: start/pause/complete

### Faza 4: Kierownik + Grafik (tydzień 5-6)
11. Tablica Kanban
12. Panel grafika
13. Drag & drop
14. Harmonogram (opcjonalnie)

---

*Dokument utworzony: 2025-12-05*
*Autor: Cascade (architekt UX/UI)*
