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
10. [Przypisywanie miejscowości](#10-przypisywanie-miejscowości)
11. [Ulubione miejscowości](#11-ulubione-miejscowości)
12. [FAQ](#12-faq)

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
| `PRODUCTION` | Dział produkcji |
| `WAREHOUSE` | Magazyn / wysyłka |
| `GRAPHICS` | Dział graficzny |
| `CLIENT` | Klient zewnętrzny |

### 2.2. Uprawnienia do widoków

| Rola | Formularz | Moi klienci | Zamówienia | Panel admina |
|------|-----------|-------------|------------|--------------|
| ADMIN | Pełny | Wszyscy | Wszystkie | Pełny |
| SALES_REP | Pełny | Tylko swoi | Tylko swoje | Brak |
| SALES_DEPT | Podgląd | Wszyscy | Wszystkie | Częściowy |
| PRODUCTION | Podgląd | Brak | W produkcji | Brak |
| WAREHOUSE | Podgląd | Brak | Gotowe/wysłane | Brak |

### 2.3. Uprawnienia do zamówień

| Rola | Tworzenie | Podgląd | Zmiana statusu | Anulowanie |
|------|-----------|---------|----------------|------------|
| ADMIN | Tak | Wszystkie | Wszystkie | Tak |
| SALES_REP | Tak | Własne | PENDING→CANCELLED | Tylko PENDING |
| SALES_DEPT | Nie | Wszystkie | Wiele przejść | Tak |
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
   - Wybierz produkty z galerii
   - Określ projekty i ilości (Nr projektów + Ilości na proj.)
   - Dodaj uwagi produkcyjne do pozycji (opcjonalnie)

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

## 10. Przypisywanie miejscowości

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

---
12. Blokada wybranego produktu
12.1. Opis funkcji
Funkcja blokady produktu pozwala zachować wybrany produkt przy zmianie miejscowości (w trybie PM) lub obiektu (w trybie KI). Jest szczególnie przydatna, gdy chcesz porównać ten sam produkt w różnych lokalizacjach.

12.2. Jak korzystać
Włączenie blokady
Wybierz żądany produkt z listy
Kliknij w pole wyboru "Nie zmieniaj wybranego produktu"
System zapamięta aktualnie wybrany produkt
Zmiana produktu przy włączonej blokadzie
Wybierz nowy produkt z listy
Nowy produkt zostanie automatycznie zapamiętany
Przy następnej zmianie miejscowości/obiektu zostanie przywrócony nowy produkt
Wyłączenie blokady
Odznacz pole "Nie zmieniaj wybranego produktu"
System przestanie pamiętać ostatni wybrany produkt
12.3. Uwagi
Funkcja działa zarówno w trybie "Projekty miejscowości" jak i "Klienci indywidualni"
Po odświeżeniu strony ustawienia blokady są zachowywane
Maksymalnie można zapamiętać jeden produkt na raz
Jeśli zapamiętany produkt nie jest dostępny w nowo wybranym obiekcie/miejscowości, zostanie wyświetlony z informacją "brak w tym obiekcie"
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
