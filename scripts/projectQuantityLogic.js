/**
 * Logika rozpisywania ilości na projekty
 * 3 tryby: łączna ilość, po X na projekt, indywidualne ilości
 */

/**
 * Parsuje zakres projektów (np. "1-5,10" -> [1,2,3,4,5,10])
 */
function parseProjects(projectsStr) {
    if (!projectsStr || typeof projectsStr !== 'string') return [];
    
    const projects = [];
    const parts = projectsStr.split(',').map(p => p.trim());
    
    for (const part of parts) {
        if (part.includes('-')) {
            const [start, end] = part.split('-').map(Number);
            if (!isNaN(start) && !isNaN(end)) {
                for (let i = start; i <= end; i++) {
                    if (!projects.includes(i)) projects.push(i);
                }
            }
        } else {
            const num = Number(part);
            if (!isNaN(num) && !projects.includes(num)) {
                projects.push(num);
            }
        }
    }
    
    return projects.sort((a, b) => a - b);
}

/**
 * Główna funkcja: rozpoznaje tryb i oblicza rozkład ilości
 * 
 * @param {string} projectsStr - np. "1,2,3,6" lub "1-5"
 * @param {string|number} totalQty - pole A: całkowita ilość (np. "200")
 * @param {string} perProjectQty - pole B: ilości na projekty (np. "po 20" lub "20,30,40")
 * @returns {object} { success, mode, totalQuantity, perProjectQuantities, warning, error }
 */
function computePerProjectQuantities(projectsStr, totalQty, perProjectQty) {
    const projects = parseProjects(projectsStr);
    
    if (projects.length === 0) {
        return {
            success: false,
            error: 'Brak poprawnych numerów projektów'
        };
    }
    
    const totalQtyNum = Number(totalQty);
    const perProjectQtyStr = String(perProjectQty || '').trim();
    
    // Sprawdzenie: czy oba pola są puste
    if (!totalQtyNum && !perProjectQtyStr) {
        return {
            success: false,
            error: 'Wpisz ilość w polu "Łącznie sztuk" lub "Ilości na projekty"'
        };
    }
    
    let mode = null;
    let totalQuantity = 0;
    let perProjectQuantities = [];
    let warning = null;
    
    // TRYB 1: Tylko pole A (łączna ilość)
    if (totalQtyNum > 0 && !perProjectQtyStr) {
        mode = 'total';
        totalQuantity = totalQtyNum;
        
        const base = Math.floor(totalQtyNum / projects.length);
        const remainder = totalQtyNum - (base * projects.length);
        
        perProjectQuantities = projects.map((projectNo, index) => ({
            projectNo,
            qty: base + (index < remainder ? 1 : 0)
        }));
    }
    
    // TRYB 2: Tylko pole B z "po X"
    else if (!totalQtyNum && perProjectQtyStr) {
        // Sprawdzamy czy to "po 20" lub "20"
        const match = perProjectQtyStr.match(/^(?:po\s+)?(\d+)$/i);
        
        if (match) {
            mode = 'perProject';
            const qtyPerProject = Number(match[1]);
            totalQuantity = qtyPerProject * projects.length;
            
            perProjectQuantities = projects.map(projectNo => ({
                projectNo,
                qty: qtyPerProject
            }));
        }
        // TRYB 3: Pole B z listą "20,30,40"
        else if (perProjectQtyStr.includes(',')) {
            mode = 'individual';
            const quantities = perProjectQtyStr.split(',').map(q => Number(q.trim()));
            
            // Walidacja: liczba ilości musi zgadzać się z liczbą projektów
            if (quantities.length !== projects.length) {
                return {
                    success: false,
                    error: `Liczba ilości (${quantities.length}) nie zgadza się z liczbą projektów (${projects.length})`
                };
            }
            
            // Walidacja: wszystkie ilości muszą być > 0
            if (quantities.some(q => isNaN(q) || q <= 0)) {
                return {
                    success: false,
                    error: 'Wszystkie ilości muszą być liczbami dodatnimi'
                };
            }
            
            totalQuantity = quantities.reduce((sum, q) => sum + q, 0);
            perProjectQuantities = projects.map((projectNo, index) => ({
                projectNo,
                qty: quantities[index]
            }));
        } else {
            return {
                success: false,
                error: 'Wpisz "po 20" lub "20,30,40"'
            };
        }
    }
    
    // OBA POLA WYPEŁNIONE: liczymy z pola B, sprawdzamy zgodność z A
    else if (totalQtyNum > 0 && perProjectQtyStr) {
        // Najpierw spróbujemy parsować pole B
        const match = perProjectQtyStr.match(/^(?:po\s+)?(\d+)$/i);
        
        if (match) {
            // Tryb "po X"
            mode = 'perProject';
            const qtyPerProject = Number(match[1]);
            const calculatedTotal = qtyPerProject * projects.length;
            
            if (calculatedTotal !== totalQtyNum) {
                warning = `Z ilości na projekt (po ${qtyPerProject}) wychodzi ${calculatedTotal}, a w polu łącznie wpisałeś ${totalQtyNum}. Popraw jedną z wartości.`;
                return {
                    success: false,
                    error: warning
                };
            }
            
            totalQuantity = calculatedTotal;
            perProjectQuantities = projects.map(projectNo => ({
                projectNo,
                qty: qtyPerProject
            }));
        }
        else if (perProjectQtyStr.includes(',')) {
            // Tryb "indywidualne"
            mode = 'individual';
            const quantities = perProjectQtyStr.split(',').map(q => Number(q.trim()));
            
            if (quantities.length !== projects.length) {
                return {
                    success: false,
                    error: `Liczba ilości (${quantities.length}) nie zgadza się z liczbą projektów (${projects.length})`
                };
            }
            
            if (quantities.some(q => isNaN(q) || q <= 0)) {
                return {
                    success: false,
                    error: 'Wszystkie ilości muszą być liczbami dodatnimi'
                };
            }
            
            const calculatedTotal = quantities.reduce((sum, q) => sum + q, 0);
            
            if (calculatedTotal !== totalQtyNum) {
                warning = `Z ilości na projekt wychodzi ${calculatedTotal}, a w polu łącznie wpisałeś ${totalQtyNum}. Popraw jedną z wartości.`;
                return {
                    success: false,
                    error: warning
                };
            }
            
            totalQuantity = calculatedTotal;
            perProjectQuantities = projects.map((projectNo, index) => ({
                projectNo,
                qty: quantities[index]
            }));
        } else {
            return {
                success: false,
                error: 'Wpisz "po 20" lub "20,30,40"'
            };
        }
    }
    
    return {
        success: true,
        mode,
        totalQuantity,
        perProjectQuantities,
        warning,
        // Dla debugowania
        projects
    };
}

/**
 * Formatuje wynik do wyświetlenia w UI
 */
function formatResult(result) {
    if (!result.success) {
        return `❌ ${result.error}`;
    }
    
    const projectsStr = result.perProjectQuantities
        .map(p => `Proj. ${p.projectNo}: ${p.qty}`)
        .join(' | ');
    
    return `✓ Łącznie sztuk: ${result.totalQuantity}\n${projectsStr}`;
}

// Eksport dla modułów ES6
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { computePerProjectQuantities, parseProjects, formatResult };
}

// Eksport dla ES6 modules (import/export)
export { computePerProjectQuantities, parseProjects, formatResult };
