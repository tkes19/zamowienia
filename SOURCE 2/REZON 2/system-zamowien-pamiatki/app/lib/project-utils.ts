/**
 * Utilities for handling project selection and quantity calculations
 */

export interface ProjectParseResult {
  success: boolean;
  projects: number[];
  error?: string;
}

export interface QuantityParseResult {
  success: boolean;
  quantities: number[];
  totalQuantity: number;
  isUniform: boolean;
  uniformQuantity?: number;
  error?: string;
}

/**
 * Parsuje string projektów (np. "1,2,3,4,5" lub "1-5" lub "1,3,5-8")
 * @param projectsStr String z numerami projektów
 * @returns Obiekt z rozparsowanymi projektami
 */
export function parseProjects(projectsStr: string): ProjectParseResult {
  if (!projectsStr || typeof projectsStr !== 'string') {
    return {
      success: false,
      projects: [],
      error: 'Nie podano numerów projektów',
    };
  }

  const cleanStr = projectsStr.trim().replace(/\s+/g, '');
  if (cleanStr === '') {
    return {
      success: false,
      projects: [],
      error: 'Nie podano numerów projektów',
    };
  }

  // Walidacja: tylko cyfry, przecinki i myślniki
  if (!/^[\d,-]+$/.test(cleanStr)) {
    return {
      success: false,
      projects: [],
      error: 'Dozwolone są tylko cyfry, przecinki i myślniki (np. "1,2,3" lub "1-5")',
    };
  }

  try {
    const projects: number[] = [];
    const parts = cleanStr.split(',');

    for (const part of parts) {
      const trimmedPart = part.trim();
      if (trimmedPart === '') continue;

      if (trimmedPart.includes('-')) {
        // Obsługa zakresu (np. "1-5")
        const [start, end] = trimmedPart.split('-').map(s => s.trim());

        if (!start || !end) {
          return {
            success: false,
            projects: [],
            error: `Nieprawidłowy zakres: "${trimmedPart}". Użyj formatu "1-5"`,
          };
        }

        const startNum = parseInt(start);
        const endNum = parseInt(end);

        if (isNaN(startNum) || isNaN(endNum)) {
          return {
            success: false,
            projects: [],
            error: `Nieprawidłowe liczby w zakresie: "${trimmedPart}"`,
          };
        }

        if (startNum < 1 || endNum < 1) {
          return {
            success: false,
            projects: [],
            error: 'Numery projektów muszą być większe od 0',
          };
        }

        if (startNum > endNum) {
          return {
            success: false,
            projects: [],
            error: `W zakresie "${trimmedPart}" początek nie może być większy niż koniec`,
          };
        }

        if (endNum - startNum > 50) {
          return {
            success: false,
            projects: [],
            error: `Zakres "${trimmedPart}" jest zbyt duży (maksymalnie 50 projektów w zakresie)`,
          };
        }

        // Dodaj wszystkie numery z zakresu
        for (let i = startNum; i <= endNum; i++) {
          projects.push(i);
        }
      } else {
        // Pojedyncza liczba
        const num = parseInt(trimmedPart);

        if (isNaN(num)) {
          return {
            success: false,
            projects: [],
            error: `Nieprawidłowa liczba: "${trimmedPart}"`,
          };
        }

        if (num < 1) {
          return {
            success: false,
            projects: [],
            error: 'Numery projektów muszą być większe od 0',
          };
        }

        if (num > 9999) {
          return {
            success: false,
            projects: [],
            error: 'Numer projektu nie może być większy niż 9999',
          };
        }

        projects.push(num);
      }
    }

    // Usuń duplikaty i posortuj
    const uniqueProjects = [...new Set(projects)].sort((a, b) => a - b);

    if (uniqueProjects.length === 0) {
      return {
        success: false,
        projects: [],
        error: 'Nie znaleziono żadnych poprawnych numerów projektów',
      };
    }

    if (uniqueProjects.length > 100) {
      return {
        success: false,
        projects: [],
        error: 'Maksymalnie 100 projektów w jednym zamówieniu',
      };
    }

    return {
      success: true,
      projects: uniqueProjects,
    };
  } catch (error) {
    return {
      success: false,
      projects: [],
      error: 'Błąd podczas parsowania numerów projektów',
    };
  }
}

/**
 * Parsuje string ilości (np. "40,40,40,40,40" lub "po 40")
 * @param quantitiesStr String z ilościami
 * @param projectCount Liczba projektów dla walidacji
 * @returns Obiekt z rozparsowanymi ilościami
 */
export function parseQuantities(quantitiesStr: string, projectCount: number): QuantityParseResult {
  if (!quantitiesStr || typeof quantitiesStr !== 'string') {
    return {
      success: false,
      quantities: [],
      totalQuantity: 0,
      isUniform: false,
      error: 'Nie podano ilości',
    };
  }

  const cleanStr = quantitiesStr.trim();
  if (cleanStr === '') {
    return {
      success: false,
      quantities: [],
      totalQuantity: 0,
      isUniform: false,
      error: 'Nie podano ilości',
    };
  }

  try {
    // Obsługa formatu "po X"
    const uniformMatch = cleanStr.match(/^po\s+(\d+)$/i);
    if (uniformMatch) {
      const uniformQuantity = parseInt(uniformMatch[1]);

      if (isNaN(uniformQuantity) || uniformQuantity < 1) {
        return {
          success: false,
          quantities: [],
          totalQuantity: 0,
          isUniform: false,
          error: 'Ilość musi być większa od 0',
        };
      }

      if (uniformQuantity > 10000) {
        return {
          success: false,
          quantities: [],
          totalQuantity: 0,
          isUniform: false,
          error: 'Ilość nie może być większa niż 10,000',
        };
      }

      const quantities = Array(projectCount).fill(uniformQuantity);
      const totalQuantity = uniformQuantity * projectCount;

      return {
        success: true,
        quantities,
        totalQuantity,
        isUniform: true,
        uniformQuantity,
      };
    }

    // Obsługa formatu z przecinkami "X,Y,Z"
    const parts = cleanStr
      .split(',')
      .map(p => p.trim())
      .filter(p => p !== '');
    const quantities: number[] = [];

    for (const part of parts) {
      const num = parseInt(part);

      if (isNaN(num)) {
        return {
          success: false,
          quantities: [],
          totalQuantity: 0,
          isUniform: false,
          error: `Nieprawidłowa ilość: "${part}"`,
        };
      }

      if (num < 0) {
        return {
          success: false,
          quantities: [],
          totalQuantity: 0,
          isUniform: false,
          error: 'Ilości nie mogą być ujemne',
        };
      }

      if (num > 10000) {
        return {
          success: false,
          quantities: [],
          totalQuantity: 0,
          isUniform: false,
          error: 'Ilość nie może być większa niż 10,000',
        };
      }

      quantities.push(num);
    }

    // Walidacja czy liczba ilości pasuje do liczby projektów
    if (quantities.length !== projectCount) {
      return {
        success: false,
        quantities: [],
        totalQuantity: 0,
        isUniform: false,
        error: `Liczba ilości (${quantities.length}) nie pasuje do liczby projektów (${projectCount})`,
      };
    }

    const totalQuantity = quantities.reduce((sum, qty) => sum + qty, 0);

    if (totalQuantity > 100000) {
      return {
        success: false,
        quantities: [],
        totalQuantity: 0,
        isUniform: false,
        error: 'Całkowita ilość nie może być większa niż 100,000',
      };
    }

    // Sprawdź czy wszystkie ilości są jednakowe
    const isUniform = quantities.every(qty => qty === quantities[0]);
    const uniformQuantity = isUniform ? quantities[0] : undefined;

    return {
      success: true,
      quantities,
      totalQuantity,
      isUniform,
      uniformQuantity,
    };
  } catch (error) {
    return {
      success: false,
      quantities: [],
      totalQuantity: 0,
      isUniform: false,
      error: 'Błąd podczas parsowania ilości',
    };
  }
}

/**
 * Generuje string ilości na podstawie całkowitej liczby i liczby projektów
 * @param totalQuantity Całkowita liczba sztuk
 * @param projectCount Liczba projektów
 * @returns String z ilościami
 */
export function generateQuantitiesFromTotal(
  totalQuantity: number,
  projectCount: number
): QuantityParseResult {
  if (totalQuantity < 1 || projectCount < 1) {
    return {
      success: false,
      quantities: [],
      totalQuantity: 0,
      isUniform: false,
      error: 'Błędne parametry wejściowe',
    };
  }

  try {
    // Podziel równo, resztę rozłóż na pierwsze projekty
    const baseQuantity = Math.floor(totalQuantity / projectCount);
    const remainder = totalQuantity % projectCount;

    const quantities: number[] = [];

    for (let i = 0; i < projectCount; i++) {
      quantities.push(baseQuantity + (i < remainder ? 1 : 0));
    }

    const isUniform = remainder === 0;
    const uniformQuantity = isUniform ? baseQuantity : undefined;

    return {
      success: true,
      quantities,
      totalQuantity,
      isUniform,
      uniformQuantity,
    };
  } catch (error) {
    return {
      success: false,
      quantities: [],
      totalQuantity: 0,
      isUniform: false,
      error: 'Błąd podczas generowania ilości',
    };
  }
}

/**
 * Formatuje ilości do wyświetlenia w formie string
 * @param quantities Tablica ilości
 * @param isUniform Czy ilości są jednakowe
 * @param uniformQuantity Jednakowa ilość (jeśli dotyczy)
 * @returns Sformatowany string
 */
export function formatQuantitiesDisplay(
  quantities: number[],
  isUniform: boolean,
  uniformQuantity?: number
): string {
  if (quantities.length === 0) return '';

  if (isUniform && uniformQuantity !== undefined) {
    return `po ${uniformQuantity}`;
  }

  return quantities.join(',');
}

/**
 * Waliduje i synchronizuje pola projektów
 * @param projectsStr String projektów
 * @param quantitiesStr String ilości
 * @param totalQuantity Całkowita ilość
 * @returns Zsynchronizowane dane
 */
export interface ProjectSyncResult {
  success: boolean;
  projects: number[];
  quantities: number[];
  totalQuantity: number;
  formattedQuantities: string;
  errors: string[];
}

export function syncProjectFields(
  projectsStr: string,
  quantitiesStr: string,
  totalQuantity?: number
): ProjectSyncResult {
  const errors: string[] = [];

  // Parsuj projekty
  const projectResult = parseProjects(projectsStr);
  if (!projectResult.success) {
    errors.push(projectResult.error || 'Błąd projektów');
    return {
      success: false,
      projects: [],
      quantities: [],
      totalQuantity: 0,
      formattedQuantities: '',
      errors,
    };
  }

  const projects = projectResult.projects;
  const projectCount = projects.length;

  // Jeśli podano totalQuantity, generuj quantities
  if (totalQuantity && totalQuantity > 0 && (!quantitiesStr || quantitiesStr.trim() === '')) {
    const quantityResult = generateQuantitiesFromTotal(totalQuantity, projectCount);
    if (quantityResult.success) {
      return {
        success: true,
        projects,
        quantities: quantityResult.quantities,
        totalQuantity: quantityResult.totalQuantity,
        formattedQuantities: formatQuantitiesDisplay(
          quantityResult.quantities,
          quantityResult.isUniform,
          quantityResult.uniformQuantity
        ),
        errors: [],
      };
    } else {
      errors.push(quantityResult.error || 'Błąd generowania ilości');
    }
  }

  // Jeśli podano quantities, parsuj je
  if (quantitiesStr && quantitiesStr.trim() !== '') {
    const quantityResult = parseQuantities(quantitiesStr, projectCount);
    if (quantityResult.success) {
      return {
        success: true,
        projects,
        quantities: quantityResult.quantities,
        totalQuantity: quantityResult.totalQuantity,
        formattedQuantities: formatQuantitiesDisplay(
          quantityResult.quantities,
          quantityResult.isUniform,
          quantityResult.uniformQuantity
        ),
        errors: [],
      };
    } else {
      errors.push(quantityResult.error || 'Błąd ilości');
    }
  }

  // Brak danych o ilościach
  errors.push('Podaj ilości lub całkowitą liczbę sztuk');
  return {
    success: false,
    projects,
    quantities: [],
    totalQuantity: 0,
    formattedQuantities: '',
    errors,
  };
}
