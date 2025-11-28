# System zamówień – Podręcznik użytkownika

## Spis treści

1. Wprowadzenie
   1.1. Dla kogo jest ten podręcznik
   1.2. Architektura systemu (w skrócie)
2. Role i uprawnienia
   2.1. Zestawienie ról w systemie
   2.2. Uprawnienia do widoków
   2.3. Uprawnienia do operacji na zamówieniach
   2.4. Uprawnienia do klientów i użytkowników
3. Logowanie i nawigacja po systemie
   3.1. Ekran logowania
   3.2. Główny formularz zamówień
   3.3. Menu i przyciski w nagłówku
4. Handlowiec (SALES_REP)
   4.1. Zakres odpowiedzialności
   4.2. Tworzenie nowego zamówienia
   4.3. Praca z listą "Moi klienci"
   4.4. Podgląd własnych zamówień
5. Dział sprzedaży (SALES_DEPT)
   5.1. Zakres odpowiedzialności
   5.2. Widok klientów i filtrowanie po handlowcach
   5.3. Widok wszystkich zamówień
   5.4. Zmiana statusów zamówień
   5.5. Szczegóły zamówienia i notatki
6. Produkcja (PRODUCTION)
   6.1. Zakres odpowiedzialności
   6.2. Przegląd zamówień w produkcji
   6.3. Oznaczanie zamówień jako gotowe (READY)
7. Magazyn (WAREHOUSE)
   7.1. Zakres odpowiedzialności
   7.2. Przygotowanie i wysyłka zamówień (SHIPPED)
   7.3. Praca z dokumentami wysyłkowymi
8. Administrator (ADMIN)
   8.1. Zakres odpowiedzialności
   8.2. Zarządzanie użytkownikami
   8.3. Zarządzanie klientami i uprawnieniami
   8.4. Przegląd i audyt zamówień
9. Workflow zamówień
   9.1. Statusy zamówień i ich znaczenie
   9.2. Dozwolone przejścia statusów
   9.3. Przykładowy przebieg zamówienia (od koszyka do dostawy)
10. Najczęstsze scenariusze
   10.1. Handlowiec – od pierwszego kontaktu do zamówienia
   10.2. Dział sprzedaży – weryfikacja i przekazanie do produkcji
   10.3. Produkcja i magazyn – realizacja zamówienia
   10.4. Reklamacje i anulowanie zamówień
11. FAQ / pytania i odpowiedzi

---

## 1. Wprowadzenie

System zamówień służy do obsługi sprzedaży pamiątek i gadżetów w firmie.

Główne cele systemu:

- Ułatwić **handlowcom** składanie zamówień i pracę z własnymi klientami.
- Dać **działowi sprzedaży** pełny wgląd w zamówienia i możliwość sterowania statusem.
- Uporządkować przepływ pracy między **sprzedażą**, **produkcją** i **magazynem**.
- Zapewnić **administratorom** prosty sposób zarządzania użytkownikami i uprawnieniami.

System składa się z kilku głównych widoków:

- Formularz zamówień (strona główna).
- „Moi klienci” – lista klientów przypisanych do handlowca / działu sprzedaży.
- Widok zamówień (obecnie: w panelu admina, docelowo także osobny widok dla SALES_DEPT).
- Panel administratora (zarządzanie użytkownikami, działami, itp.).

---

## 2. Role i uprawnienia

### 2.1. Role w systemie

- `ADMIN`
- `SALES_REP` – Handlowiec terenowy / opiekun klienta.
- `SALES_DEPT` – Dział sprzedaży (biuro, koordynacja, akceptacje).
- `PRODUCTION` – Dział produkcji.
- `WAREHOUSE` – Magazyn / wysyłka.
- `GRAPHICS` – Dział graficzny (opcjonalnie, ograniczone uprawnienia).
- `NEW_USER` – Nowe konto, zanim zostanie nadana właściwa rola.

### 2.2. Uprawnienia do widoków

| Rola        | Formularz zamówień | Moi klienci         | Widok zamówień (lista)                   | Panel admina |
|------------|---------------------|---------------------|-------------------------------------------|-------------|
| **ADMIN**      | Pełny dostęp        | Pełny               | Wszystkie zamówienia                     | Pełny       |
| **SALES_REP**  | Pełny (tworzenie)  | Tylko swoich klientów | Tylko własne zamówienia (obecnie dół formularza) | Brak        |
| **SALES_DEPT** | Podgląd + koordynacja | Wszyscy klienci    | Wszystkie zamówienia (docelowo osobny widok) | Częściowy (np. przegląd użytkowników) |
| **PRODUCTION** | Podgląd            | Brak                | Zamówienia w produkcji / gotowe          | Brak        |
| **WAREHOUSE**  | Podgląd            | Brak                | Zamówienia gotowe / wysyłane             | Brak        |
| **GRAPHICS**   | Podgląd wybranych danych | Brak           | Ewentualnie podgląd zamówień do opracowania graficznego | Brak |
| **NEW_USER**   | Bardzo ograniczony | Brak                | Brak                                      | Brak        |

> Uwaga: niektóre widoki (np. szczegółowe zamówienia) będą dostępne z poziomu różnych ról, ale z innym zakresem akcji.

### 2.3. Uprawnienia do operacji na zamówieniach

| Rola        | Tworzenie zamówień | Podgląd własnych | Podgląd wszystkich | Zmiana statusu                                                                 | Anulowanie |
|------------|--------------------|------------------|--------------------|-------------------------------------------------------------------------------|-----------|
| **ADMIN**      | Tak                | Tak              | Tak                | Wszystkie przejścia                                                           | Tak       |
| **SALES_REP**  | Tak                | Tak              | Nie                | PENDING → CANCELLED (dopóki nie zatwierdzone)                                 | Tylko PENDING |
| **SALES_DEPT** | Nie (standardowo)  | Tak              | Tak                | PENDING→APPROVED, APPROVED→IN_PRODUCTION, IN_PRODUCTION→CANCELLED, READY→CANCELLED, SHIPPED→DELIVERED | Tak       |
| **PRODUCTION** | Nie                | Tak (dla swoich etapów) | Ograniczony (tylko przydzielone etapy) | APPROVED→IN_PRODUCTION (opcjonalnie), IN_PRODUCTION→READY                    | Nie       |
| **WAREHOUSE**  | Nie                | Tak (READY/SHIPPED) | Ograniczony       | READY→SHIPPED                                                                  | Nie       |
| **GRAPHICS**   | Nie                | Brak              | Brak               | Brak                                                                           | Nie       |
| **NEW_USER**   | Nie                | Brak              | Brak               | Brak                                                                           | Nie       |

### 2.4. Uprawnienia do klientów i użytkowników

| Rola        | Przegląd klientów            | Edycja klientów                     | Przegląd użytkowników | Edycja użytkowników |
|------------|------------------------------|-------------------------------------|-----------------------|---------------------|
| **ADMIN**      | Wszyscy klienci               | Tak (pełny zakres)                  | Wszyscy użytkownicy   | Tak (tworzenie, edycja, blokowanie) |
| **SALES_REP**  | Tylko własni klienci         | Tak (dla własnych)                  | Brak                  | Brak                |
| **SALES_DEPT** | Wszyscy klienci               | Tak (koordynacja, przypisania)      | Podgląd wybranych informacji | Ograniczona (np. przypisanie do działu) |
| **PRODUCTION** | Brak                          | Brak                                | Brak                  | Brak                |
| **WAREHOUSE**  | Brak                          | Brak                                | Brak                  | Brak                |
| **GRAPHICS**   | Brak                          | Brak                                | Brak                  | Brak                |
| **NEW_USER**   | Brak                          | Brak                                | Brak                  | Brak                |

---

## 3. Logowanie i nawigacja po systemie

### 3.1. Ekran logowania

- Adres: `/login` lub panel logowania w nagłówku formularza.
- Wymagane dane: **email** i **hasło**.
- Po poprawnym logowaniu system:
  - Ustawia ciasteczka `auth_id` i `auth_role`.
  - Przekierowuje:
    - `ADMIN` → panel admina lub formularz (w zależności od konfiguracji).
    - `SALES_REP`, `SALES_DEPT` → główny formularz zamówień.

W nagłówku głównego formularza widać:

- Imię/nazwę użytkownika.
- Rolę (np. „Handlowiec”, „Dział sprzedaży”).
- Przyciski: **Moi klienci**, (docelowo) **Zamówienia**, **Wyloguj**.

### 3.2. Główny formularz zamówień

Główne elementy:

- Wyszukiwarka produktów (po identyfikatorze, opisie, itp.).
- Tryby: „Projekty miejscowości”, „Klienci indywidualni” (inne w planie).
- Podgląd dostępności w magazynie (stany, optymalny poziom, rezerwacje).
- Koszyk zamówienia (lista pozycji, ilości, wartości).
- Sekcja eksportu i wysyłki:
  - Pobierz koszyk (JSON).
  - Pobierz zamówienie (PDF).
  - **Wyślij zamówienie** – wysyła dane do backendu i zapisuje `Order` + `OrderItem`.

Na dole (dla handlowca) może być lista **„Moje zamówienia”** – podgląd zamówień danego użytkownika.

### 3.3. Menu i przyciski w nagłówku

- **Logo / nazwa firmy** – kliknięcie zwykle wraca do formularza.
- **Zakładki** trybów formularza (projekty miejscowości, klienci indywidualni, itp.).
- Po prawej stronie (dla zalogowanych):
  - **Imię i rola** użytkownika.
  - **Moi Klienci** – przejście do `clients.html`.
  - (Docelowo) **Zamówienia** – przejście do widoku listy zamówień.
  - **Wyloguj** – wylogowanie i powrót do ekranu logowania.

---

## 4. Handlowiec (SALES_REP)

*(do uzupełnienia – szczegółowy opis pracy handlowca krok po kroku, po wdrożeniu wszystkich widoków)*

## 5. Dział sprzedaży (SALES_DEPT)

*(do uzupełnienia – szczegółowy opis widoków klientów, zamówień i zmiany statusów)*

## 6. Produkcja (PRODUCTION)

*(do uzupełnienia – widok listy zamówień w produkcji, zmiana statusów)*

## 7. Magazyn (WAREHOUSE)

*(do uzupełnienia – widok zamówień gotowych do wysyłki, obsługa SHIPPED)*

## 8. Administrator (ADMIN)

*(do uzupełnienia – zarządzanie użytkownikami, działami, uprawnieniami)*

## 9. Workflow zamówień

Szczegółowy opis statusów i przejść znajduje się w dokumencie `DOC_WORKFLOW_ZAMOWIEN.md`. W tym rozdziale podręcznika można zamieścić skrócony wykres lub tabelę.

## 10. Najczęstsze scenariusze

*(do uzupełnienia – gotowe scenariusze typu „jak zrobić…”)*

## 11. FAQ / pytania i odpowiedzi

*(do uzupełnienia na podstawie realnych pytań użytkowników)*
