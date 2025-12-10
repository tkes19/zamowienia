/**
 * Testy jednostkowe dla generatora kodów produkcyjnych
 * 
 * Uruchomienie: node backend/code-generator.test.js
 */

// ============================================
// FUNKCJE GENERATORA (kopia z server.js do testów)
// ============================================

/**
 * Generuje kod z nazwy - usuwa polskie znaki, bierze pierwsze litery słów lub całe słowo
 * @param {string} name - nazwa do przetworzenia
 * @returns {string} - kod bazowy (bez numeru)
 */
function generateBaseCode(name) {
    if (!name) return 'ITEM';
    
    // Zamień polskie znaki na ASCII
    const polishMap = {
        'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n',
        'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
        'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N',
        'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z'
    };
    
    let normalized = name;
    for (const [pl, ascii] of Object.entries(polishMap)) {
        normalized = normalized.replace(new RegExp(pl, 'g'), ascii);
    }
    
    // Usuń znaki specjalne, zostaw tylko litery i cyfry
    normalized = normalized.replace(/[^a-zA-Z0-9\s]/g, '');
    
    const words = normalized.trim().split(/\s+/).filter(w => w.length > 0);
    
    if (words.length === 0) return 'ITEM';
    
    if (words.length === 1) {
        // Jedno słowo - weź pierwsze 6 znaków
        return words[0].substring(0, 6).toUpperCase();
    }
    
    // Wiele słów - weź pierwsze litery (max 6)
    const initials = words.map(w => w[0]).join('').substring(0, 6).toUpperCase();
    
    // Jeśli za krótkie, dodaj więcej liter z pierwszego słowa
    if (initials.length < 3 && words[0].length > 1) {
        return (words[0].substring(0, 4) + initials.substring(1)).toUpperCase();
    }
    
    return initials;
}

// ============================================
// TESTY
// ============================================

let passedTests = 0;
let failedTests = 0;

function test(description, actual, expected) {
    if (actual === expected) {
        console.log(`✅ PASS: ${description}`);
        passedTests++;
    } else {
        console.log(`❌ FAIL: ${description}`);
        console.log(`   Expected: "${expected}"`);
        console.log(`   Actual:   "${actual}"`);
        failedTests++;
    }
}

console.log('\n========================================');
console.log('TESTY GENERATORA KODÓW PRODUKCYJNYCH');
console.log('========================================\n');

// Test 1: Puste wejście
console.log('--- Test: Puste wejście ---');
test('null zwraca ITEM', generateBaseCode(null), 'ITEM');
test('undefined zwraca ITEM', generateBaseCode(undefined), 'ITEM');
test('pusty string zwraca ITEM', generateBaseCode(''), 'ITEM');
test('same spacje zwracają ITEM', generateBaseCode('   '), 'ITEM');

// Test 2: Pojedyncze słowa
console.log('\n--- Test: Pojedyncze słowa ---');
test('Laser -> LASER', generateBaseCode('Laser'), 'LASER');
test('UV -> UV', generateBaseCode('UV'), 'UV');
test('CNC -> CNC', generateBaseCode('CNC'), 'CNC');
test('Montaż -> MONTAZ (max 6 znaków)', generateBaseCode('Montaż'), 'MONTAZ');
test('Pakowanie -> PAKOWA (max 6 znaków)', generateBaseCode('Pakowanie'), 'PAKOWA');

// Test 3: Wiele słów (2 słowa - za krótkie inicjały, więc rozszerzone)
console.log('\n--- Test: Wiele słów ---');
test('Laser CO2 -> LASEC (2 słowa, rozszerzone)', generateBaseCode('Laser CO2'), 'LASEC');
test('Druk UV -> DRUKU (2 słowa, rozszerzone)', generateBaseCode('Druk UV'), 'DRUKU');
test('Hala Montażu Główna -> HMG (3 słowa)', generateBaseCode('Hala Montażu Główna'), 'HMG');
test('Pokój Laserów CO2 -> PLC (3 słowa)', generateBaseCode('Pokój Laserów CO2'), 'PLC');

// Test 4: Polskie znaki
console.log('\n--- Test: Polskie znaki ---');
test('Żółty -> ZOLTY', generateBaseCode('Żółty'), 'ZOLTY');
test('Ścieżka -> SCIEZK', generateBaseCode('Ścieżka'), 'SCIEZK');
test('Łódź -> LODZ', generateBaseCode('Łódź'), 'LODZ');
test('Gniazdo Główne -> GNIAG (2 słowa, rozszerzone)', generateBaseCode('Gniazdo Główne'), 'GNIAG');

// Test 5: Znaki specjalne
console.log('\n--- Test: Znaki specjalne ---');
test('Laser #1 -> LASE1 (# usunięte)', generateBaseCode('Laser #1'), 'LASE1');
test('UV-Print -> UVPRIN (- usunięte, jedno słowo)', generateBaseCode('UV-Print'), 'UVPRIN');
test('CNC (główny) -> CNCG (nawiasy usunięte)', generateBaseCode('CNC (główny)'), 'CNCG');

// Test 6: Mieszane przypadki (wielkość liter)
console.log('\n--- Test: Mieszane przypadki ---');
test('laser co2 -> LASEC', generateBaseCode('laser co2'), 'LASEC');
test('LASER CO2 -> LASEC', generateBaseCode('LASER CO2'), 'LASEC');
test('LaSeR cO2 -> LASEC', generateBaseCode('LaSeR cO2'), 'LASEC');

// Test 7: Długie nazwy
console.log('\n--- Test: Długie nazwy ---');
test('Bardzo Długa Nazwa Pokoju Produkcyjnego -> BDNPP (5 słów)', 
    generateBaseCode('Bardzo Długa Nazwa Pokoju Produkcyjnego'), 'BDNPP');
test('Superdługanazwabezspacji -> SUPERD (max 6)', 
    generateBaseCode('Superdługanazwabezspacji'), 'SUPERD');

// Test 8: Cyfry w nazwie
console.log('\n--- Test: Cyfry w nazwie ---');
test('Laser 1 -> LASE1 (2 słowa, rozszerzone)', generateBaseCode('Laser 1'), 'LASE1');
test('UV 2000 -> UV2 (2 słowa, rozszerzone)', generateBaseCode('UV 2000'), 'UV2');
test('CNC5 -> CNC5', generateBaseCode('CNC5'), 'CNC5');

// ============================================
// PODSUMOWANIE
// ============================================

console.log('\n========================================');
console.log('PODSUMOWANIE TESTÓW');
console.log('========================================');
console.log(`✅ Passed: ${passedTests}`);
console.log(`❌ Failed: ${failedTests}`);
console.log(`📊 Total:  ${passedTests + failedTests}`);
console.log('========================================\n');

if (failedTests > 0) {
    console.log('⚠️  Niektóre testy nie przeszły!');
    process.exit(1);
} else {
    console.log('🎉 Wszystkie testy przeszły pomyślnie!');
    process.exit(0);
}
