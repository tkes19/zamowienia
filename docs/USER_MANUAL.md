# Podręcznik użytkownika – System zamówień

## Spis treści

1. [Wprowadzenie](#1-wprowadzenie)
2. [Role i uprawnienia](#2-role-i-uprawnienia)
3. [Logowanie i nawigacja](#3-logowanie-i-nawigacja)
4. [Handlowiec (SALES_REP)](#4-handlowiec-sales_rep)
5. [Dział sprzedaży (SALES_DEPT)](#5-dział-sprzedaży-sales_dept)
6. [Produkcja (PRODUCTION)](#6-produkcja-production)
7. [Magazyn (WAREHOUSE)](#7-magazyn-warehouse)
8. [Administrator (ADMIN)](#8-administrator-admin)
9. [Workflow zamówień](#9-workflow-zamówień)
10. [Panel Produkcyjny](#10-panel-produkcyjny)
    - [Operator Produkcji](#101-operator-produkcji)
    - [Kierownik Produkcji](#102-kierownik-produkcji)
    - [Administrator Produkcji](#103-administrator-produkcji)
    - [Dział Graficzny / Panel grafika](#104-dział-graficzny--panel-grafika)
11. [Przypisywanie miejscowości](#11-przypisywanie-miejscowości)
12. [Ulubione miejscowości](#12-ulubione-miejscowości)
13. [FAQ](#13-faq)

---

## 1. Wprowadzenie

System zamówień służy do obsługi sprzedaży pamiątek i gadżetów w firmie.

**Główne cele:**
- Ułatwić **handlowcom** składanie zamówień i pracę z klientami
- Dać **działowi sprzedaży** pełny wgląd w zamówienia
- Uporządkować przepływ pracy między sprzedażą, produkcją i magazynem
- Zapewnić **administratorom** zarządzanie użytkownikami i uprawnieniami

**Główne widoki:**
- Formularz zamówień (strona główna)
- "Moi klienci" – lista klientów
- Widok zamówień – lista i szczegóły zamówień
- Panel administratora

---

## 2. Role i uprawnienia

### 2.1. Role w systemie

| Rola | Opis |
|------|------|
| `ADMIN` | Administrator – pełny dostęp |
| `SALES_REP` | Handlowiec terenowy |
| `SALES_DEPT` | Dział sprzedaży (biuro) |
| `PRODUCTION_MANAGER` | Kierownik produkcji – zarządzanie produkcją |
| `OPERATOR` | Operator produkcyjny – realizacja zadań |
| `PRODUCTION` | Dział produkcji (legacy) |
| `WAREHOUSE` | Magazyn / wysyłka |
| `GRAPHICS` | Dział graficzny |
| `CLIENT` | Klient zewnętrzny |

### 2.2. Uprawnienia do widoków

| Rola | Formularz | Moi klienci | Zamówienia | Panel admina | Panel produkcyjny |
|------|-----------|-------------|------------|--------------|------------------|
| ADMIN | Pełny | Wszyscy | Wszystkie | Pełny | Pełny |
| SALES_REP | Pełny | Tylko swoi | Tylko swoje | Brak | Brak |
| SALES_DEPT | Podgląd | Wszyscy | Wszystkie | Częściowy | Podgląd |
| PRODUCTION_MANAGER | Podgląd | Brak | W produkcji | Częściowy | Pełny |
| OPERATOR | Brak | Brak | Swoje zadania | Brak | Pełny |
| PRODUCTION | Podgląd | Brak | W produkcji | Brak | Podgląd |
| WAREHOUSE | Podgląd | Brak | Gotowe/wysłane | Brak | Podgląd |

### 2.3. Uprawnienia do zamówień

| Rola | Tworzenie | Podgląd | Zmiana statusu | Anulowanie |
|------|-----------|---------|----------------|------------|
| ADMIN | Tak | Wszystkie | Wszystkie | Tak |
| SALES_REP | Tak | Własne | PENDING→CANCELLED | Tylko PENDING |
| SALES_DEPT | Nie | Wszystkie | Wiele przejść | Tak |
| PRODUCTION_MANAGER | Nie | W produkcji | IN_PRODUCTION→READY | Nie |
| OPERATOR | Nie | Swoje zadania | Krok po kroku | Nie |
| PRODUCTION | Nie | Swoje etapy | IN_PRODUCTION→READY | Nie |
| WAREHOUSE | Nie | READY/SHIPPED | READY→SHIPPED | Nie |

---

## 3. Logowanie i nawigacja

### 3.1. Ekran logowania

1. Otwórz stronę systemu
2. Wprowadź **email** i **hasło**
3. System automatycznie rozpozna Twoją rolę

### 3.2. Nawigacja

Po zalogowaniu w nagłówku widać:
- **Imię i rolę** użytkownika
- **Moi Klienci** – przejście do listy klientów
- **Zamówienia** – przejście do listy zamówień (dla uprawnionych ról)
- **Wyloguj** – wylogowanie z systemu

---

## 4. Handlowiec (SALES_REP)

### 4.1. Zakres odpowiedzialności

- Wyszukiwanie produktów i kompletowanie koszyka
- Praca z własnymi klientami
- Wysyłanie zamówień (status startowy: PENDING)
- Podgląd własnych zamówień

### 4.2. Tworzenie zamówienia

1. **Wybór trybu pracy:**
   - **Projekty miejscowości (PM)** – produkty przypisane do miejscowości
   - **Klienci indywidualni (KI)** – foldery klientów indywidualnych

2. **Wybór klienta:**
   - W pasku "Klient zamówienia" wyszukaj klienta
   - Widzisz tylko swoich klientów

3. **Dodawanie produktów:**
   - Wybierz produkty z galerii (lista zależy od trybu: PM lub KI)
   - Określ projekty i ilości:
     - **Nr projektów** – numeracja projektów, np. `1,2,3` lub `1-5,7`,
     - **Ilości na proj.** – jedno z:
       - `po 20` – ta sama ilość na każdy projekt,
       - `10,20,30` – indywidualne ilości dla kolejnych projektów,
       - puste – jeśli chcesz pracować tylko na łącznej ilości,
     - **Ilość (łącznie)** – suma sztuk na wszystkie projekty (np. `60`).

   System pilnuje **„źródła prawdy”** dla ilości:

   - jeśli wpiszesz tylko **"Ilość"**, a pole "Ilości na proj." zostawisz puste,
     rozkład na projekty zostanie wyliczony automatycznie, ale źródłem jest **Ilość**;
   - jeśli wpiszesz lub zmienisz **"Ilości na proj."** (lista lub `po X`),
     źródłem stają się **ilości na projekty**, a suma jest liczona z nich;
   - przejście TAB‑em przez pole **bez zmiany wartości** nie przelicza ilości.

4. **Uwagi do zamówienia:**
   - **Uwagi do pozycji** – pole w koszyku przy każdym produkcie (np. "druk dwustronny", "kolor złoty")
   - **Uwagi ogólne** – pole przed wysłaniem zamówienia (np. termin realizacji, sposób dostawy)

5. **Wysłanie zamówienia:**
   - Kliknij "Wyślij zamówienie"
   - System wygeneruje numer w formacie `YYYY/N/SHORTCODE`

### 4.3. Widok "Moi klienci"

- Lista tylko Twoich klientów
- Możesz dodawać, edytować i usuwać klientów
- Wyszukiwarka po nazwie, mieście, emailu, telefonie

### 4.4. Miejscowości i ulubione

Jeśli masz przypisane miejscowości:
- Widzisz tylko przypisane miejscowości
- Możesz kliknąć "pokaż wszystkie" aby zobaczyć wszystkie (podgląd)
- Możesz dodać miejscowości do ulubionych (gwiazdka ⭐)

---

## 5. Dział sprzedaży (SALES_DEPT)

### 5.1. Zakres odpowiedzialności

- Weryfikacja i zatwierdzanie zamówień
- Koordynacja między handlowcami a produkcją
- Zarządzanie klientami i przypisaniami

### 5.2. Widok zamówień

- Widzisz wszystkie zamówienia
- Filtry: status, handlowiec, data
- Możesz zmieniać statusy zgodnie z uprawnieniami

W szczegółach zamówienia (po rozwinięciu wiersza):

- kolumna **„Projekty”** pokazuje projekty z ilościami, np. `1: 10, 2: 20, 3: 30`;
- kolumna **„Ilość”** pokazuje łączną ilość (suma wszystkich projektów);
- jedna z kolumn jest **pogrubiona i podkreślona na niebiesko**:
  - jeśli handlowiec pracował na polu "Ilość" – wyróżniona jest kolumna "Ilość",
  - jeśli pracował na polu "Ilości na proj." – wyróżniona jest kolumna "Projekty".

Na wydruku obok lokalizacji widoczny jest skrót źródła:

- `PM` – projekty miejscowości,
- `KI` – katalog / klienci indywidualni,
- inne typy (imienne, hasła, okolicznościowe) mają własne skróty i kolory.

### 5.3. Zmiana statusów

Dozwolone przejścia:
- PENDING → APPROVED (zatwierdzenie)
- APPROVED → IN_PRODUCTION (przekazanie do produkcji)
- SHIPPED → DELIVERED (potwierdzenie dostawy)
- Dowolny → CANCELLED (anulowanie)

---

## 6. Produkcja (PRODUCTION)

### 6.1. Zakres odpowiedzialności

- Realizacja zamówień
- Oznaczanie zamówień jako gotowe

### 6.2. Widok zamówień

- Widzisz zamówienia w statusach: APPROVED, IN_PRODUCTION, READY
- Możesz zmieniać:
  - APPROVED → IN_PRODUCTION (przyjęcie do produkcji)
  - IN_PRODUCTION → READY (oznaczenie jako gotowe)

---

## 7. Magazyn (WAREHOUSE)

### 7.1. Zakres odpowiedzialności

- Przygotowanie i wysyłka zamówień
- Aktualizacja stanów magazynowych

### 7.2. Widok zamówień

- Widzisz zamówienia w statusach: READY, SHIPPED
- Możesz zmieniać:
  - READY → SHIPPED (wysłanie zamówienia)

---

## 8. Administrator (ADMIN)

### 8.1. Zakres odpowiedzialności

- Zarządzanie użytkownikami
- Zarządzanie przypisaniami (miejscowości, foldery KI)
- Pełny dostęp do wszystkich funkcji

### 8.2. Przypisywanie miejscowości

1. Wejdź w panel admina → "Miejscowości PM"
2. Kliknij "Dodaj przypisanie"
3. Wybierz użytkownika i miejscowość
4. Kliknij "Zapisz"

### 8.3. Zarządzanie przypisaniami

- **Aktywacja/Dezaktywacja:** Przełącznik w kolumnie "Aktywny"
- **Usuwanie:** Ikona kosza (tylko ADMIN)
- **Filtrowanie:** Pola filtru dla użytkownika i miejscowości
- **Szybkie filtry nad siatką miast:** checkboxy (współdzielone, nowe w 30 dniach, bez przypisań globalnie)
- **Wyczyść filtry:** przycisk resetujący wyszukiwarkę, sortowanie i checkboxy nad siatką miast
- **Eksport przypisań:** przycisk "Eksport CSV" w nagłówku widoku (globalna lista przypisań miejscowości do handlowców)
- **Podgląd wydruku:** przycisk "Podgląd wydruku" z układem Handlowiec → przypisane miejscowości (alfabetycznie)

### 8.4. Mapowanie produktów (galeria)

Moduł **"Mapowanie produktów"** służy do powiązania **projektów graficznych z galerii**
(np. `KUBEK_GRAWER`) z **produktami z bazy** (tabela `Product`). Dzięki temu:

- w formularzu zamówień na liście 2 pojawiają się **Identyfikatory produktów** z dopiskiem
  nazwy projektu (np. `KUBEK_300 (KUBEK GRAWER)`),
- wyszukiwarka (pole 1) potrafi zsynchronizować się z listą 2 i automatycznie
  zaznaczać odpowiedni projekt,
- handlowiec nie musi znać technicznych nazw plików z galerii.

#### Jak wejść do modułu

1. Zaloguj się jako **ADMIN**.
2. Wejdź do **Panelu administratora**.
3. W menu po lewej wybierz **"Mapowanie produktów"**.

#### Widok "Mapowanie produktów"

Widok jest podzielony na dwie główne kolumny:

- **Projekty graficzne (lewa kolumna)**
  - lista projektów galerii (np. `KUBEK_GRAWER`, `MAGNES_HDF`),
  - przy każdym projekcie liczba przypisanych produktów,
  - wyszukiwarka projektów (po slugu lub nazwie).
- **Wybierz projekt (prawa kolumna)**
  - po kliknięciu projektu z lewej strony widzisz listę przypisanych produktów
    (`Identyfikator`, `Indeks`),
  - przy każdym produkcie jest ikona kosza do usunięcia przypisania.

Na górze widoku są **statystyki**:

- liczba wszystkich projektów,
- ile projektów ma przypisane produkty,
- ile projektów nie ma żadnych przypisań.

#### Efekt dla handlowców

- Na liście produktów w galerii (lista 2) w pierwszej kolejności pojawiają się projekty
  z pełnym mapowaniem na produkty z bazy – w formie `IDENTYFIKATOR (NAZWA PROJEKTU)`.
- Wyszukiwarka wyników potrafi dopasować wybrany produkt do właściwego projektu i
  automatycznie zaznaczyć odpowiedni rekord na liście.
- Filtr "z projektem / bez projektu" bierze pod uwagę zarówno nazwy z galerii,
  jak i mapowanie w bazie. Produkty bez mapowania zachowują dotychczasowe zachowanie
  – są listowane na podstawie danych z galerii.

#### Przypisywanie produktu do projektu

1. Wybierz projekt z listy po lewej (np. `KUBEK_GRAWER`).
2. Kliknij przycisk **"Dodaj produkt"** w prawej kolumnie.
3. W oknie dialogowym:
   - sprawdź nazwę projektu (pole tylko do odczytu),
   - w polu **"Szukaj produktu"** wpisz fragment **Identyfikatora** lub **Indeksu**, 
   - z listy wybierz konkretny produkt (`IDENTYFIKATOR (INDEX)`).
4. Kliknij **"Przypisz"**.

Po zapisaniu:

- projekt pojawi się w galerii z listą produktów (lista 2 w formularzu zamówień),
- na liście 2 obok projektu będzie widoczny Identyfikator produktu,
- wyszukiwarka produktów (pole 1) będzie umiała **automatycznie zaznaczyć** ten projekt
  po znalezieniu danego produktu.

#### Usuwanie przypisań

1. Wybierz projekt z listy po lewej.
2. W tabeli produktów w prawej kolumnie kliknij ikonę kosza przy wybranym produkcie.
3. Potwierdź usunięcie.

Usunięcie przypisania **nie kasuje produktu ani projektu**, jedynie zrywa ich powiązanie
dla potrzeb galerii i formularza zamówień.

---

## 9. Workflow zamówień

### 9.1. Statusy zamówień

| Status | Opis | Kto zmienia |
|--------|------|-------------|
| PENDING | Oczekujące | Handlowiec (tworzy) |
| APPROVED | Zatwierdzone | Dział sprzedaży |
| IN_PRODUCTION | W produkcji | Produkcja |
| READY | Gotowe | Produkcja |
| SHIPPED | Wysłane | Magazyn |
| DELIVERED | Dostarczone | Dział sprzedaży |
| CANCELLED | Anulowane | Dział sprzedaży / Admin |

### 9.2. Typowy przebieg

```
SALES_REP tworzy → PENDING
    ↓
SALES_DEPT zatwierdza → APPROVED
    ↓
PRODUCTION przyjmuje → IN_PRODUCTION
    ↓
PRODUCTION kończy → READY
    ↓
WAREHOUSE wysyła → SHIPPED
    ↓
SALES_DEPT potwierdza → DELIVERED
```

---

## 10. Panel Produkcyjny

Panel produkcyjny to nowoczesny system zarządzania produkcją (MES), który umożliwia śledzenie i kontrolowanie całego procesu produkcyjnego w czasie rzeczywistym. System integruje się z zamówieniami, automatycznie przekształcając je w zlecenia produkcyjne.

### 10.1. Operator Produkcji

#### 10.1.1. Zakres odpowiedzialności
- Realizacja zadań produkcyjnych przypisanych do maszyny
- Śledzenie postępu pracy i zgłaszanie problemów
- Dokładne raportowanie ilości wyprodukowanych sztuk
- Przestrzeganie ścieżek produkcyjnych i standardów jakości

#### 10.1.2. Logowanie i interfejs
1. Zaloguj się systemem używając swoich danych
2. Przejdź do **Panel Produkcyjny** (dostępny w menu dla ról OPERATOR)
3. System wyświetla kafelkowy widok zadań:
   - **Zielone kafelki** – zadania aktywne
   - **Niebieskie kafelki** – zadania oczekujące
   - **Szare kafelki** – zadania zakończone

#### 10.1.3. Podstawowy workflow

**Rozpoczęcie zadania:**
1. Znajdź kafelek z zadaniem (numer zlecenia, produkt, ilość)
2. Sprawdź szczegóły: aktualny krok, wymagane materiały
3. Kliknij przycisk **"▶️ Rozpocznij"**
4. System rozpoczyna pomiar czasu i aktualizuje status

**Praca nad zadaniem:**
- Postęp jest widoczny na pasku postępu
- System automatycznie aktualizuje statusy w czasie rzeczywistym
- Możesz zgłosić problem przyciskiem **"⚠️ Zgłoś problem"**

**Zakończenie zadania:**
1. Po wykonaniu pracy kliknij **"✅ Zakończ"**
2. Wpisz rzeczywistą ilość wyprodukowanych sztuk
3. Dodaj uwagi dotyczące jakości (opcjonalnie)
4. System automatycznie przejdzie do następnego kroku lub zadania

#### 10.1.4. Obsługa problemów

**Brak materiału:**
1. Kliknij **"⚠️ Brak materiału"**
2. Wybierz brakujący materiał z listy
3. System wstrzyma zadanie i powiadomi kierownika

**Awaria maszyny:**
1. Kliknij **"🔧 Awaria maszyny"**
2. Opisz problem krótko
3. System oznaczy maszynę jako niedostępną

**Inne problemy:**
1. Kliknij **"❓ Inny problem"**
2. Wpisz szczegółowy opis
3. Dołącz zdjęcie jeśli to możliwe

#### 10.1.5. Przerwy techniczne
- Kliknij **"Przerwa techniczna"** w nagłówku
- System wstrzyma wszystkie aktywne zadania
- Powrót do pracy po kliknięciu **"Wznów pracę"**

### 10.2. Kierownik Produkcji

#### 10.2.1. Zakres odpowiedzialności
- Planowanie i harmonogramowanie produkcji
- Zarządzanie pokojami i maszynami produkcyjnymi
- Tworzenie i aktualizacja ścieżek produkcyjnych
- Monitorowanie efektywności i rozwiązywanie problemów
- Raportowanie wyników produkcyjnych

#### 10.2.2. Dostępne funkcje

**Panel Produkcyjny:**
- Podgląd wszystkich aktywnych zleceń
- Real-time monitoring postępu prac
- Filtrowanie po pokojach, maszynach, statusach
- Eksport raportów dziennych

**Panel Administratora → Produkcja:**
- Zarządzanie pokojami produkcyjnymi
- Konfiguracja maszyn i ich statusów
- Tworzenie ścieżek produkcyjnych
- Przypisywanie operatorów do maszyn

#### 10.2.3. Planowanie produkcji

**Tworzenie zlecenia z zamówienia:**
1. Przejdź do **Zamówienia** → wybierz zamówienie
2. Kliknij **"Utwórz zlecenie produkcyjne"**
3. System automatycznie przypisze ścieżkę produkcyjną
4. Sprawdź i dostosuj harmonogram
5. Potwierdź utworzenie zlecenia

**Harmonogramowanie zadań:**
1. W panelu produkcji wybierz widok **"Harmonogram"**
2. Przeciągnij zadania między maszynami (drag & drop)
3. Ustaw priorytety i terminy
4. System automatycznie przeliczy czasy realizacji

#### 10.2.4. Zarządzanie zasobami

**Pokoje produkcyjne:**
1. Panel Admin → Produkcja → **"📍 Pokoje"**
2. Dodaj nowy pokój: nazwa, kod, powierzchnia, opis
3. Przypisz nadzorowcę pokoju
4. Aktywuj/deaktywuj pokój

**Maszyny:**
1. Panel Admin → Produkcja → **"🛠️ Maszyny"**
2. Dodaj maszynę: nazwa, typ, producent, model
3. Przypisz do pokoju produkcyjnego
4. Ustaw harmonogram konserwacji
5. Zdefiniuj możliwości (materiały, maksymalny rozmiar)

**Ścieżki produkcyjne:**
1. Panel Admin → Produkcja → **"🗺️ Ścieżki"**
2. Wybierz produkt i utwórz ścieżkę
3. Dodaj kolejne kroki:
   - Operacja (np. grawerowanie, cięcie)
   - Maszyna lub pokój
   - Szacowany czas
4. Zapisz i aktywuj ścieżkę

#### 10.2.5. Monitoring i raportowanie

**Podgląd w czasie rzeczywistym:**
- Statusy wszystkich maszyn i zadań
- Postęp prac na poszczególnych etapach
- Wydajność operatorów
- Wykrywanie wąskich gardeł

**Raporty dzienne:**
1. Panel Produkcyjny → **"Raporty"**
2. Wybierz okres i typ raportu
3. Generuj PDF lub Excel
4. Dostępne raporty:
   - Produkcja dzienna
   - Wydajność maszyn
   - Czasy realizacji zleceń
   - Jakość produkcji

### 10.3. Administrator Produkcji

#### 10.3.1. Zakres odpowiedzialności
- Pełna konfiguracja systemu produkcyjnego
- Zarządzanie użytkownikami i uprawnieniami produkcyjnymi
- Integracja systemu produkcyjnego z zamówieniami
- Optymalizacja procesów i rozwiązywanie problemów technicznych
- Archiwizacja danych i backup

#### 10.3.2. Konfiguracja systemu

**Użytkownicy produkcyjni:**
1. Panel Admin → **"Użytkownicy"**
2. Dodaj użytkownika z rolą **OPERATOR** lub **PRODUCTION_MANAGER**
3. Przypisz do odpowiednich pokojów/maszyn
4. Ustaw uprawnienia dostępu

**Integracja z zamówieniami:**
1. Panel Admin → **"Ustawienia"** → **"Produkcja"**
2. Skonfiguruj automatyczne tworzenie zleceń
3. Ustaw reguły przypisywania ścieżek
4. Włącz powiadomienia o problemach

**Parametry systemowe:**
- Częstotliwość aktualizacji WebSocket
- Progi alertów (np. opóźnienia > 30 minut)
- Formaty numerów zleceń produkcyjnych
- Zasady archiwizacji danych

#### 10.3.3. Zaawansowane funkcje

**Szablony ścieżek:**
- Tworzenie szablonów dla typowych produktów
- Klonowanie ścieżek dla podobnych produktów
- Wersjonowanie ścieżek produkcyjnych

**Automatyzacja:**
- Przypisywanie zadań do dostępnych maszyn
- Automatyczne powiadamianie o problemach
- Generowanie sugerowanych harmonogramów

**Integracje zewnętrzne:**
- Systemy ERP (planowanie zasobów)
- Systemy magazynowe (stan materiałów)
- Systemy jakości (kontrola jakości)

#### 10.3.4. Rozwiązywanie problemów

**Diagnostyka systemu:**
- Logi operacji produkcyjnych
- Statystyki wydajności API
- Status połączeń WebSocket
- Monitorowanie obciążenia serwera

**Typowe problemy:**
1. **Brak synchronizacji statusów** – sprawdź WebSocket
2. **Złe przypisanie zadań** – weryfikuj ścieżki produkcyjne
3. **Operator nie widzi zadań** – sprawdź uprawnienia
4. **Maszyna niedostępna** – zaktualizuj status w adminie

---

### 10.4. Dział Graficzny / Panel grafika

#### 10.4.1. Zakres odpowiedzialności

- Przyjmowanie zadań graficznych wynikających z zamówień.
- Przygotowanie plików produkcyjnych (projekty PM/KI/PI/Ph).
- Dopisanie numerów projektów i ścieżek plików dla produkcji.
- Współpraca z handlowcem przy akceptacji projektów (jeśli jest wymagana).

Panel grafika nie zastępuje programów typu Corel/Illustrator – jest
"tablicą zadań" i miejscem na ustalenia między sprzedażą a produkcją.

#### 10.4.2. Typy zleceń z punktu widzenia handlowca

W systemie przewidziane są dwa główne typy zleceń związanych z grafiką:

- **Produkty + projekty** – standardowe zamówienie produktów, w którym
  część pozycji ma gotowe projekty, a część wymaga pracy działu graficznego.
- **Tylko projekty** – osobne zamówienie na przygotowanie projektów, bez
  natychmiastowego uruchamiania produkcji.

Informacja o typie zlecenia i tym, czy projekty wymagają akceptacji,
jest widoczna zarówno dla handlowca, jak i grafika.

#### 10.4.3. Jak wygląda praca grafika w Panelu grafika

1. Grafik widzi listę/kafelki **zadań graficznych** powiązanych z
   zamówieniami (numer zamówienia, klient/miejscowość, produkt, ilość,
   priorytet, planowana data wysyłki).
2. Dla każdego zadania widoczny jest **status** (np. do zrobienia,
   w trakcie, oczekuje na akceptację, gotowe do produkcji, do poprawy).
3. W szczegółach zadania grafik może:
   - podejrzeć uwagi z zamówienia,
   - podlinkować odpowiednie projekty z galerii / QNAP,
   - wpisać ścieżkę do plików produkcyjnych,
   - odznaczyć checklistę (sprawdzone dane klienta, ilości, format,
     warstwy i nazewnictwo plików).
4. Po przygotowaniu plików grafik oznacza zadanie jako:
   - **Gotowe do produkcji** – gdy akceptacja nie jest wymagana,
   - **Oczekuje na akceptację** – gdy handlowiec/klient ma obejrzeć
     projekt przed startem produkcji.

W przypadku odrzucenia projektu przez handlowca zadanie wraca do kolumny
"do poprawy" z komentarzem.

#### 10.4.4. Rola handlowca w procesie akceptacji projektów

Przy składaniu zamówienia handlowiec może zdecydować, czy chce **oglądać i
zatwierdzać projekty**, czy wystarczy dokładny opis w zamówieniu.

- Jeśli akceptacja **nie jest wymagana**:
  - grafik po przygotowaniu plików oznacza zadania jako "gotowe do
    produkcji";
  - po zakończeniu wszystkich zadań grafika zamówienie może trafić od razu
    do produkcji.
- Jeśli akceptacja **jest wymagana**:
  - po przygotowaniu projektu grafik ustawia status "oczekuje na
    akceptację" i podaje ścieżkę do plików;
  - handlowiec w szczegółach zamówienia widzi sekcję **"Projekty"** z
    listą zadań, miniaturami/linkami i przyciskami **Zatwierdź** /
    **Do poprawy**;
  - po zatwierdzeniu wszystkich projektów zamówienie może być przekazane
    do produkcji.

Szczegółowe aspekty techniczne (tabele, API) opisane są w
`docs/SPEC_PRODUCTION_PANEL.md`, sekcja 9.

---

## 11. Przypisywanie miejscowości

### 10.1. Dla administratora

1. **Wejdź w "Miejscowości PM"** w panelu admina
2. **Kliknij "Dodaj przypisanie"**
3. **Wybierz użytkownika** z listy
4. **Wpisz nazwę miejscowości** (autouzupełnianie)
5. **Kliknij "Zapisz"**

### 10.2. Dla handlowca

- Widzisz tylko przypisane miejscowości
- Możesz przełączyć na "pokaż wszystkie" (tylko podgląd)
- Bez przypisań widzisz wszystkie w trybie readOnly

---

## 11. Ulubione miejscowości

### 11.1. Dodawanie do ulubionych

1. Wybierz miejscowość z listy
2. Kliknij gwiazdkę ⭐ obok listy
3. Gwiazdka stanie się żółta
4. Miejscowość pojawi się w pasku ulubionych

### 11.2. Zarządzanie ulubionymi

- **Limit:** Maksymalnie 12 ulubionych
- **Usuwanie:** Kliknij ❌ na chipie lub ponownie gwiazdkę
- **Szybki dostęp:** Kliknij chip w pasku ulubionych

### 11.3. Ulubione obiekty (tryb "Klienci indywidualni")

W trybie **Klienci indywidualni** możesz w podobny sposób zapisać swoje najczęściej używane obiekty (np. konkretne sklepy lub punkty sprzedaży):

1. Wybierz handlowca i obiekt z list.
2. Kliknij gwiazdkę ⭐ obok listy obiektów.
3. Obiekt pojawi się w pasku ulubionych.
4. Kliknięcie nazwy obiektu w pasku ulubionych od razu ustawi odpowiedniego handlowca i obiekt.

Obowiązują te same zasady, co przy ulubionych miejscowościach:

- Maksymalnie 12 ulubionych obiektów.
- Usuwanie przez ❌ na chipie lub ponowne kliknięcie gwiazdki.

---
12. Blokada wybranego produktu i sortowanie listy produktów

12.1. Blokada wybranego produktu

Funkcja blokady produktu pozwala zachować wybrany produkt przy zmianie miejscowości (w trybie PM) lub obiektu (w trybie KI). Jest szczególnie przydatna, gdy chcesz porównać ten sam produkt w różnych lokalizacjach.

**Jak korzystać (blokada):**

- Wybierz żądany produkt z listy „Produkt”.
- Zaznacz pole wyboru **"Nie zmieniaj wybranego produktu przy zmianie miejscowości ani trybu"**.
- System zapamięta aktualnie wybrany produkt (`lastLockedProductSlug`).
- Przy kolejnych zmianach miejscowości/obiektu system będzie próbował wybrać ten sam produkt; jeśli w danej lokalizacji go nie ma, produkt pojawi się z dopiskiem „brak w tej miejscowości/obiekcie”.
- Odznaczenie pola powoduje wyczyszczenie zapamiętanego produktu.

Uwagi:

- Funkcja działa zarówno w trybie **„Projekty miejscowości” (PM)**, jak i **„Klienci indywidualni” (KI)**.
- Po odświeżeniu strony ostatnio zablokowany produkt nie jest trwale zapisywany w bazie (blokada działa w ramach bieżącej sesji).

12.2. Sortowanie listy produktów (Nowości / Dostępne)

Obok pola blokady produktu znajdują się dwa małe pola wyboru, które zmieniają kolejność listy „Produkt” w galerii:

- **Nowości** – na górze listy pojawią się produkty oznaczone w systemie jako nowe (np. świeżo wprowadzone do oferty).
- **Dostępne** – na górze listy pojawią się produkty, które są aktualnie dostępne na głównym magazynie (stan większy niż 0) i można je normalnie zamawiać.

Zasada działania:

- Domyślnie lista jest sortowana **alfabetycznie (A→Z)** wg widocznej nazwy produktu, z uwzględnieniem polskich liter.
- Po zaznaczeniu **„Nowości”** wszystkie nowe produkty trafiają **nad** pozostałe, reszta pozostaje niżej.
- Po zaznaczeniu **„Dostępne”** wszystkie produkty dostępne na magazynie trafiają **nad** te, których chwilowo brakuje.
- Jeśli zaznaczysz **oba** pola:
  - na samej górze będą produkty **nowe i dostępne**, 
  - niżej produkty tylko nowe **albo** tylko dostępne,
  - na samym dole produkty ani nowe, ani dostępne.
- W każdej z tych grup produkty są dalej ułożone alfabetycznie (A→Z).

Zmiana stanu tych pól działa **od razu** – lista produktów się przelicza, bez ponownego ładowania miasta/obiektu.

Sortowanie działa zarówno w trybie **PM (miejscowości)**, jak i **KI (handlowiec/obiekt)** i dotyczy tylko listy w polu „Produkt” w galerii.

12.3. Wyszukiwanie a dostępność produktu

Pole wyszukiwania (na górze strony) pokazuje listę produktów, które możesz dodać do zamówienia.

- W wynikach pojawiają się tylko produkty **aktywne** – takie, które są aktualnie w sprzedaży.
- Czasem w galerii możesz zobaczyć projekt produktu (np. stary wzór), ale jeśli produkt został wycofany z oferty, **nie pojawi się na liście wyników** i nie będzie można go dodać do koszyka.
- Jeśli podejrzewasz, że produkt powinien być dostępny do zamówienia, a go nie widzisz, skontaktuj się z działem handlowym lub administratorem systemu.
## 13. FAQ

**Q: Nie widzę żadnych miejscowości**  
A: Skontaktuj się z administratorem o przypisanie miejscowości.

**Q: Nie mogę dodać do ulubionych**  
A: Sprawdź czy masz mniej niż 12 ulubionych. Usuń stare aby dodać nowe.

**Q: Przełącznik "pokaż wszystkie" nie działa**  
A: Odśwież stronę (F5). Jeśli problem się powtarza, skontaktuj się z adminem.

**Q: Jak zmienić status zamówienia?**  
A: W widoku szczegółów zamówienia użyj dropdownu statusu. Widzisz tylko dozwolone przejścia dla Twojej roli.

**Q: Czy mogę pracować offline?**  
A: Nie, system wymaga stałego połączenia z internetem.

---

## Rozwiązywanie problemów

### Brak dostępu
1. Sprawdź czy jesteś zalogowany
2. Sprawdź swoją rolę w systemie
3. Skontaktuj się z administratorem

### Błędy sieciowe
1. Sprawdź połączenie z internetem
2. Odśwież stronę (Ctrl+F5)
3. Sprawdź konsolę przeglądarki (F12)

### Kontakt z pomocą
- Email: support@pamiatki.pl
- Telefon: [numer działu IT]

---

**Wersja dokumentu:** 2.0  
**Data aktualizacji:** 2025-11-30
