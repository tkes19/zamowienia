# Słownik Terminologii Produkcyjnej

## 📋 Wprowadzenie

Ten dokument definiuje jednolite słownictwo używane w Panelu Produkcyjnym systemu zamówień. Celem jest zapewnienie spójności terminologicznej w całej dokumentacji, kodzie i interfejsie użytkownika.

---

## 🏗️ Hierarchia Fizyczna (Obiekty Produkcyjne)

| Termin Polski | Odpowiednik Angielski | Definicja | Przykład Użycia |
|---------------|------------------------|-----------|-----------------|
| **Hala produkcyjna** | Production Hall | Największy obszar produkcyjny w zakładzie | "Hala A", "Hala B" |
| **Pokój produkcyjny** | Production Room | Wydzielony obszar w hali z określonym przeznaczeniem | "Pokój grawerowania", "Pokój cięcia" |
| **Gniazdo produkcyjne** | Work Center | Zespół stanowisk roboczych zgrupowanych funkcjonalnie | "Gniazdo laserowe", "Gniazdo druku UV" |
| **Stanowisko robocze** | Work Station | Konkretne miejsce pracy z maszyną/urządzeniem | "Stanowisko laser CO2", "Stanowisko CNC" |
| **Maszyna** | Machine | Sprzęt techniczny do wykonywania operacji | "Laser CO2 50W", "Drukarka UV A3" |

---

## 🔧 Hierarchia Procesowa (Działania Produkcyjne)

| Termin Polski | Odpowiednik Angielski | Definicja | Przykład Użycia |
|---------------|------------------------|-----------|-----------------|
| **Proces produkcyjny** | Production Process | Całokształt działań od surowca do gotowego wyrobu | "Proces produkcji pamiątek szklanych" |
| **Ścieżka produkcyjna** | Production Path | Ustalony ciąg operacji dla konkretnego produktu | "Grawerowanie → Polerowanie → Pakowanie" |
| **Operacja technologiczna** | Operation | Wyodrębniona część pracy wykonywana na stanowisku | "Grawerowanie laserowe" |
| **Czynność robocza** | Activity | Najmniejszy element pracy w ramach operacji | "Przygotowanie matryc" |
| **Krok roboczy** | Work Step | Pojedyncza, mierzalna czynność w operacji | "Ustawienie mocy lasera" |

---

## 📊 Statusy i Stany Systemowe

| Kategoria | Termin Polski | Angielski | Opis |
|-----------|---------------|-----------|-------|
| **Zlecenia** | Zaplanowane | Planned | Zlecenie utworzone, czeka na realizację |
| | W realizacji | In Progress | Zlecenie aktywne, trwa produkcja |
| | Zakończone | Completed | Zlecenie zakończone sukcesem |
| | Wstrzymane | Paused | Tymczasowo wstrzymane |
| | Anulowane | Cancelled | Zlecenie anulowane |
| **Stanowiska** | Dostępne | Available | Stanowisko gotowe do pracy |
| | W użyciu | In Use | Stanowisko aktualnie pracuje |
| | W konserwacji | Maintenance | Planowana konserwacja |
| | Awaria | Breakdown | Stanowisko niesprawne |
| **Operacje** | Oczekuje | Pending | Operacja czeka na rozpoczęcie |
| | W toku | Active | Operacja aktualnie wykonywana |
| | Zakończona | Completed | Operacja zakończona |
| | Błąd | Error | Problem z operacją |

---

## 👥 Role i Użytkownicy Produkcyjni

| Rola | Zakres odpowiedzialności | Kluczowe uprawnienia |
|------|-------------------------|----------------------|
| **Operator produkcyjny** | Wykonywanie operacji na stanowisku | Rozpoczęcie/zakończenie zadań, zgłaszanie problemów |
| **Kierownik produkcji** | Planowanie i nadzór produkcji | Tworzenie zleceń, harmonogramowanie, raporty |
| **Mistrz produkcji** | Bezpośredni nadzór operacyjny | Przydział zadań, kontrola jakości |
| **Technik utrzymania ruchu** | Konserwacja stanowisk | Statusy stanowisk, planowanie przeglądów |

---

## 🧩 Struktura organizacyjna

| Termin Polski | Odpowiednik Angielski | Definicja | Powiązanie w systemie |
|---------------|------------------------|-----------|------------------------|
| **Dział** | Department | Jednostka organizacyjna firmy (np. Sprzedaż, Produkcja, Magazyn, Grafika, IT) | `Department` + `User.departmentId` |
| **Rola użytkownika** | User Role | Typ uprawnień użytkownika w systemie (np. ADMIN, SALES_DEPT, GRAPHICS, WAREHOUSE, PRODUCTION, OPERATOR) | `User.role`, middleware `requireRole([...])` |

> Szczegółowy opis relacji między Działami, Pokojami produkcyjnymi i Rolami
> znajduje się w `docs/SPEC.md` §5.4.1.

---

## 🏭 Typy Operacji Technologicznych

| Kategoria | Operacja | Opis | Przykładowe stanowiska |
|-----------|----------|------|----------------------|
| **Obróbka** | Grawerowanie laserowe | Nanoszenie wzorów laserem | Laser CO2, Laser Fiber |
| | Cięcie laserowe | Dzielenie materiałów | Laser CO2, Ploter tnący |
| | Frezowanie CNC | Obróbka mechaniczna | Frezarka CNC, Router |
| **Druk** | Druk UV | Druk na różnych materiałach | Drukarka UV flatbed |
| | Druk sublimacyjny | Druk na tkaninach | Drukarka sublimacyjna |
| **Wykończenie** | Polerowanie | Wygładzanie powierzchni | Polerka, Szlifierka |
| | Montaż | Składanie elementów | Stanowisko montażowe |
| | Pakowanie | Finalne przygotowanie | Stanowisko pakowania |
| **Przygotowanie** | Przygotowanie matryc | Tworzenie form do produkcji | Stanowisko przygotowania |
| | Przygotowanie materiałów | Cięcie surowców | Ploter tnący, Gilotyna |

---

## 📈 Parametry i Wskaźniki Produkcyjne

| Termin | Definicja | Jednostka |
|--------|-----------|-----------|
| **Czas taktu** | Czas dostępny na wyprodukowanie jednej sztuki | min/szt |
| **Czas cyklu** | Rzeczywisty czas produkcji jednej sztuki | min/szt |
| **Wydajność** | Stosunek ilości wyprodukowanej do planowanej | % |
| **OEE** | Overall Equipment Effectiveness | % |
| **TPZ** | Czas przygotowawczo-zakończeniowy | min |
| **Tj** | Czas jednostkowy operacji | min/szt |

---

## 🔄 Zalecane Nazewnictwo w Systemie

### **Tabele bazodanowe:**
```sql
ProductionRoom      -- Pokój produkcyjny
WorkCenter         -- Gniazdo produkcyjne  
WorkStation        -- Stanowisko robocze
ProductionPath     -- Ścieżka produkcyjna
ProductionOrder    -- Pozycja zlecenia produkcyjnego (rekord dla pojedynczej pozycji zamówienia)
ProductionWorkOrder-- Zlecenie produkcyjne (kartka / nagłówek dla pokoju, grupa wielu ProductionOrder)
ProductionOperation-- Operacja technologiczna
ProductionLog      -- Log operacji produkcyjnych
PrintAudit         -- Audyt druku dokumentów
GraphicTask        -- Zadanie graficzne
```

### **Endpointy API:**
```javascript
/api/production/rooms           -- Zarządzanie pokojami
/api/production/work-centers    -- Zarządzanie gniazdami
/api/production/work-stations   -- Zarządzanie stanowiskami
/api/production/paths           -- Ścieżki produkcyjne
/api/production/orders          -- Zlecenia produkcyjne
/api/production/operations      -- Operacje technologiczne
```

### **Interfejs użytkownika:**
- **Panel operatora:** "Moje zadania", "Aktualna operacja"
- **Panel kierownika:** "Harmonogram produkcji", "Ścieżki produktów"
- **Panel admina:** "Zarządzanie gniazdami", "Konfiguracja stanowisk"

### **Komunikaty systemowe:**
- "Rozpocznij operację: Grawerowanie laserowe"
- "Zakończono czynność: Przygotowanie matryc"
- "Stanowisko w konserwacji: Laser CO2"

---

## 📝 Słownik Pojęć Kluczowych

| Termin | Niepoprawne określenia | Poprawne użycie |
|--------|------------------------|-----------------|
| **Przygotowanie matryc** | "Maszyna: matryce" | "Czynność: przygotowanie matryc" |
| **Grawerowanie** | "Krok: grawerowanie" | "Operacja: grawerowanie laserowe" |
| **Laser CO2** | "Pokój: laser" | "Stanowisko: Laser CO2" |
| **Pokój grawerowania** | "Dział: grawerowanie" | "Pokój produkcyjny: Grawerowanie" |
| **Krok produkcyjny** | "Step" | "Operacja technologiczna" |
| **Maszyna** | "Work Center" | "Stanowisko robocze" |
| **Zlecenie produkcyjne** | "ProductionOrder" | Dla użytkownika: kartka / PDF dla pokoju (ProductionWorkOrder). W kodzie: `ProductionOrder` to **pozycja zlecenia produkcyjnego**, nie używać tej nazwy w UI dla pojedynczej pozycji. |

---

## 🎯 Zasady Użycia Terminologii

1. **Spójność:** Używaj tych samych terminów w dokumentacji, kodzie i UI
2. **Precyzja:** Rozróżniaj obiekty fizyczne od procesów
3. **Użyteczność:** Terminy muszą być zrozumiałe dla operatorów produkcyjnych
4. **Skalowalność:** Hierarchia pozwala na rozbudowę systemu

---

## 📚 Kontekst Implementacji

### **Migracja terminologiczna:**
- Stare tabele: `Machine` → `WorkStation`
- Stare pola: `stepNumber` → `operationNumber`
- Stare endpointy: `/api/machines` → `/api/work-stations`

### **Wpływ na kod:**
- Zmienne: `machineId` → `workStationId`
- Funkcje: `startStep()` → `startOperation()`
- Klasy: `MachineManager` → `WorkStationManager`

---

**Wersja dokumentu:** 1.0  
**Data utworzenia:** 2025-12-01  
**Autor:** System ZAMÓWIENIA Development Team

*Ten słownik stanowi oficjalne źródło terminologii dla Panelu Produkcyjnego i powinien być konsultowany przy wszystkich zmianach w kodzie, dokumentacji i interfejsie użytkownika.*
