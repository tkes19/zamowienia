'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  MapPin,
  Search,
  ImageIcon,
  Lock,
  Unlock,
  AlertTriangle,
  ShoppingCart,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Product } from '@/lib/types';
import { ProjectSelector, ProjectSelection, ProjectSelectorRef } from './project-selector';
import { useAdvancedOCR } from '@/hooks/use-advanced-ocr';

interface LocationOrderProps {
  onBack: () => void;
  onProductSelect: (product: Product, locationData: LocationData) => void;
}

export interface LocationData {
  locationName: string;
  productIdentifier: string;
  projectNumber?: string;
  // Nowe pola dla systemu projektów
  selectedProjects?: string; // np. "1,2,3,4,5" lub "1-5"
  projectQuantities?: string; // np. "40,40,40,40,40" lub "po 40"
  totalQuantity?: number; // np. 200 (suma wszystkich projektów)
  productionNotes?: string; // Dodatkowy opis dla produkcji
}

// Interfejs dla danych miejscowości z R2
interface LocationWithProducts {
  name: string;
  productIdentifiers: string[];
}

interface LocationsResponse {
  success: boolean;
  locations: LocationWithProducts[];
  source?: string;
}

// Interfejs dla produktu połączonego z danymi z bazy i folderu
interface EnhancedProductInfo {
  fileIdentifier: string; // np. "brelok_graver_kolo"
  databaseProduct?: Product; // dane z bazy jeśli znalezione
  displayName: string; // nazwa do wyświetlenia
  searchableText: string; // tekst do przeszukiwania
}

export function LocationOrder({ onBack, onProductSelect }: LocationOrderProps) {
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedIdentifier, setSelectedIdentifier] = useState<string>('');
  const [searchLocation, setSearchLocation] = useState<string>('');
  const [searchIdentifier, setSearchIdentifier] = useState<string>('');
  const [locations, setLocations] = useState<LocationWithProducts[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<LocationWithProducts[]>([]);
  const [filteredIdentifiers, setFilteredIdentifiers] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [productImage, setProductImage] = useState<string>('');
  const [imageLoading, setImageLoading] = useState<boolean>(false);
  const [imageError, setImageError] = useState<string>('');

  // Nowe state-y dla integracji z bazą danych
  const [databaseProducts, setDatabaseProducts] = useState<Product[]>([]);
  const [enhancedProducts, setEnhancedProducts] = useState<EnhancedProductInfo[]>([]);
  const [filteredEnhancedProducts, setFilteredEnhancedProducts] = useState<EnhancedProductInfo[]>(
    []
  );

  // State dla statusu cache
  const [isFromCache, setIsFromCache] = useState<boolean>(false);

  // State dla funkcji blokowania produktu
  const [isProductLocked, setIsProductLocked] = useState<boolean>(false);
  const [lockedProduct, setLockedProduct] = useState<string>('');
  const [previousLocation, setPreviousLocation] = useState<string>('');
  const [showLocationChangeDialog, setShowLocationChangeDialog] = useState<boolean>(false);

  // State dla systemu projektów
  const [projectSelection, setProjectSelection] = useState<ProjectSelection | null>(null);
  const [showProjectSelector, setShowProjectSelector] = useState<boolean>(false);
  const [isProjectSelectorValid, setIsProjectSelectorValid] = useState<boolean>(false);
  const projectSelectorRef = useRef<ProjectSelectorRef>(null);

  // State dla automatycznego OCR
  const [maxProjectsFromOCR, setMaxProjectsFromOCR] = useState<number>(50);
  const [ocrDetectedNumbers, setOcrDetectedNumbers] = useState<number[]>([]);
  const { processImage, isProcessing: ocrProcessing } = useAdvancedOCR();

  // Funkcje konwersji między formatami nazw
  const convertFileToDatabase = (fileIdentifier: string): string => {
    // Konwersja z "brelok_graver_kolo" na "BRELOK GRAVER KOŁO"
    return (
      fileIdentifier
        .replace(/_/g, ' ')
        .toUpperCase()
        // Obsługa polskich znaków i specjalnych przypadków
        .replace(/KOLO/g, 'KOŁO')
        .replace(/KRÊG/g, 'KRĄG')
        .replace(/TRZMA/g, 'TRZYMA')
    );
  };

  const convertDatabaseToFile = (databaseIdentifier: string): string => {
    // Konwersja z "BRELOK GRAVER KOŁO" na "brelok_graver_kolo"
    return (
      databaseIdentifier
        .toLowerCase()
        .replace(/\s+/g, '_')
        // Obsługa polskich znaków
        .replace(/koło/g, 'kolo')
        .replace(/krąg/g, 'kreg')
        .replace(/trzyma/g, 'trzma')
    );
  };

  const findMatchingProduct = (
    fileIdentifier: string,
    products: Product[]
  ): Product | undefined => {
    const targetDatabaseFormat = convertFileToDatabase(fileIdentifier);

    // Najpierw szukaj dokładnego dopasowania identifier
    let exactMatch = products.find(
      product => product.identifier?.toUpperCase() === targetDatabaseFormat
    );

    if (exactMatch) return exactMatch;

    // Następnie szukaj dokładnego dopasowania index
    exactMatch = products.find(
      product => product.index?.toUpperCase().replace(/[-\s]/g, ' ') === targetDatabaseFormat
    );

    if (exactMatch) return exactMatch;

    // Jeśli nie ma dokładnego dopasowania, szukaj najlepszego częściowego dopasowania
    // Ale tylko jeśli fileIdentifier zawiera znaczącą część
    const fileWords = fileIdentifier
      .toLowerCase()
      .replace(/_/g, ' ')
      .split(' ')
      .filter(w => w.length > 2);

    if (fileWords.length === 0) return undefined;

    let bestMatch: Product | undefined = undefined;
    let bestScore = 0;

    for (const product of products) {
      if (!product.identifier && !product.index) continue;

      const productText = `${product.identifier || ''} ${product.index || ''}`.toLowerCase();
      let score = 0;

      // Liczymy ile słów z fileIdentifier jest w nazwie produktu
      for (const word of fileWords) {
        if (productText.includes(word)) {
          score += 1;
        }
      }

      // Dodajemy bonus jeśli wszystkie słowa pasują
      if (score === fileWords.length && score > bestScore) {
        bestScore = score;
        bestMatch = product;
      } else if (score > bestScore && score >= Math.ceil(fileWords.length * 0.6)) {
        // Akceptuj jeśli przynajmniej 60% słów pasuje
        bestScore = score;
        bestMatch = product;
      }
    }

    return bestMatch;
  };

  // Cache key dla miejscowości
  const LOCATIONS_CACHE_KEY = 'locations_cache_v1';
  const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minut

  // Funkcja do ładowania danych z cache lub API
  const loadCachedOrFetchLocations = async () => {
    try {
      // Sprawdź cache w sessionStorage
      const cachedData = sessionStorage.getItem(LOCATIONS_CACHE_KEY);
      if (cachedData) {
        try {
          const parsedCache = JSON.parse(cachedData);
          const now = Date.now();

          if (
            parsedCache.timestamp &&
            now - parsedCache.timestamp < CACHE_EXPIRY_MS &&
            parsedCache.locations
          ) {
            console.log('📋 Używanie danych z cache');
            return {
              success: true,
              locations: parsedCache.locations,
              source: 'cache',
            };
          } else {
            console.log('🕐 Cache wygasł, usuwanie...');
            sessionStorage.removeItem(LOCATIONS_CACHE_KEY);
          }
        } catch (parseError) {
          console.error('Błąd parsowania cache:', parseError);
          sessionStorage.removeItem(LOCATIONS_CACHE_KEY);
        }
      }

      // Brak cache lub wygasł - pobierz z API
      console.log('🌐 Pobieranie danych z API...');
      const response = await fetch('/api/r2/locations');
      const data: LocationsResponse = await response.json();

      if (data.success && data.locations && data.locations.length > 0) {
        // Zapisz w cache
        const cacheData = {
          locations: data.locations,
          timestamp: Date.now(),
        };
        try {
          sessionStorage.setItem(LOCATIONS_CACHE_KEY, JSON.stringify(cacheData));
          console.log('💾 Dane zapisane w cache');
        } catch (cacheError) {
          console.warn('Nie można zapisać w cache:', cacheError);
        }

        return data;
      } else {
        throw new Error('Brak danych z API');
      }
    } catch (error) {
      console.error('Błąd pobierania danych:', error);
      throw error;
    }
  };

  // Pobieranie danych z R2 przy pierwszym załadowaniu z cache i preloadingiem
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        setError('');

        const data = await loadCachedOrFetchLocations();

        if (data.success && data.locations && data.locations.length > 0) {
          console.log('Loaded locations:', data.locations.length, 'items');
          console.log('Data source:', (data as any).source);
          setLocations(data.locations);
          setFilteredLocations(data.locations);
          setIsFromCache((data as any).source === 'cache');

          if ((data as any).source === 'cache') {
            // Gdy używamy cache, uruchom preloading w tle
            setTimeout(() => {
              loadCachedOrFetchLocations()
                .then(freshData => {
                  if (
                    freshData.success &&
                    freshData.locations &&
                    (freshData as any).source !== 'cache'
                  ) {
                    setLocations(freshData.locations);
                    setFilteredLocations(freshData.locations);
                    setIsFromCache(false);
                    console.log('🔄 Dane odświeżone w tle');
                  }
                })
                .catch(() => {
                  console.log('🔄 Odświeżenie w tle nie powiodło się');
                });
            }, 100); // Uruchom po krótkim opóźnieniu
          }
        } else {
          throw new Error('Brak danych z wszystkich źródeł');
        }
      } catch (err) {
        console.error('Error fetching locations:', err);
        setError('Błąd ładowania miejscowości. Używam danych podstawowych.');

        // W przypadku błędu połączenia, używamy fallback danych
        const fallbackLocations: LocationWithProducts[] = [
          {
            name: 'Gdańsk',
            productIdentifiers: ['kieliszek_metal', 'niezbędnik', 'otwieracz_koło_ratunkowe'],
          },
          {
            name: 'Kołobrzeg',
            productIdentifiers: [
              'brelok_metal_miś',
              'długopis_bambus',
              'korkociąg_otwieracz',
              'otwieracz_łyżeczka_serce',
            ],
          },
          {
            name: 'Kraków',
            productIdentifiers: [
              'brelok_grawer_koło',
              'brelok_grawer_owal',
              'brelok_grawer_prostokąt',
              'brelok_i_love',
              'kieliszek_metal',
            ],
          },
        ];

        setLocations(fallbackLocations);
        setFilteredLocations(fallbackLocations);
        console.log('Using error fallback location data');
      } finally {
        setLoading(false);
      }
    };

    // Ustaw natychmiastowo loading state
    setLoading(true);
    fetchLocations();
  }, []);

  // Pobieranie produktów z bazy danych
  useEffect(() => {
    const fetchDatabaseProducts = async () => {
      try {
        let response = await fetch('/api/products');

        // If unauthorized, try demo mode
        if (response.status === 401) {
          console.log('No authorization, switching to demo mode for products');
          response = await fetch('/api/products?demo=true');
        }

        if (response.ok) {
          const products = await response.json();
          setDatabaseProducts(products);
          console.log(`Załadowano ${products.length} produktów z bazy danych`);
        } else {
          console.error('Błąd pobierania produktów z bazy:', response.status);
          // W przypadku błędu używamy fallback produktów (może być problem z autoryzacją)
          console.log('🔄 Używam fallback produktów z powodu błędu API');
          setDatabaseProducts([]);
        }
      } catch (error) {
        console.error('Błąd połączenia z API produktów:', error);
        // W przypadku błędu połączenia używamy fallback produktów
        console.log('🔄 Używam fallback produktów z powodu błędu połączenia');
        setDatabaseProducts([]);
      }
    };

    fetchDatabaseProducts();
  }, []);

  // Aktualizacja enhanced products po wybraniu miejscowości
  useEffect(() => {
    const selectedLocationData = locations.find(loc => loc.name === selectedLocation);
    if (selectedLocationData) {
      const enhanced: EnhancedProductInfo[] = selectedLocationData.productIdentifiers.map(
        fileIdentifier => {
          // Szukaj dopasowania tylko jeśli mamy dane z bazy danych
          const matchingProduct =
            databaseProducts.length > 0
              ? findMatchingProduct(fileIdentifier, databaseProducts)
              : undefined;

          // Zawsze używaj nazwy opartej na fileIdentifier, ale wzbogać o dane z bazy jeśli są dostępne
          const baseDisplayName = fileIdentifier
            .replace(/_/g, ' ')
            .toUpperCase()
            .replace(/KOLO/g, 'KOŁO')
            .replace(/KREG/g, 'KRĄG')
            .replace(/TRZMA/g, 'TRZYMA');

          return {
            fileIdentifier,
            databaseProduct: matchingProduct,
            displayName: matchingProduct
              ? `${baseDisplayName} (${matchingProduct.index || matchingProduct.identifier})`
              : baseDisplayName,
            searchableText: matchingProduct
              ? `${matchingProduct.identifier || ''} ${matchingProduct.index || ''} ${fileIdentifier} ${baseDisplayName}`.toLowerCase()
              : `${fileIdentifier} ${baseDisplayName}`.toLowerCase(),
          };
        }
      );

      setEnhancedProducts(enhanced);
      setFilteredEnhancedProducts(enhanced);
      console.log(`Utworzono ${enhanced.length} enhanced products dla ${selectedLocation}`);
      if (databaseProducts.length > 0) {
        console.log('Dopasowania z bazy danych:', enhanced.filter(p => p.databaseProduct).length);
      } else {
        console.log('🔄 Używam produktów bez dopasowań z bazy danych (fallback mode)');
      }
    } else {
      setEnhancedProducts([]);
      setFilteredEnhancedProducts([]);
    }

    setSelectedIdentifier(''); // Resetuj wybrany identyfikator
  }, [selectedLocation, locations, databaseProducts]);

  // Filtrowanie miejscowości
  useEffect(() => {
    if (searchLocation) {
      setFilteredLocations(
        locations.filter(location =>
          location.name.toLowerCase().includes(searchLocation.toLowerCase())
        )
      );
    } else {
      setFilteredLocations(locations);
    }
  }, [searchLocation, locations]);

  // Nowe filtrowanie identyfikatorów z wyszukiwaniem po fragmentach słów
  useEffect(() => {
    if (!selectedLocation || enhancedProducts.length === 0) {
      setFilteredEnhancedProducts([]);
      return;
    }

    if (searchIdentifier.trim() === '') {
      setFilteredEnhancedProducts(enhancedProducts);
      return;
    }

    // Rozdziel wyszukiwane słowa po spacjach (podobnie jak w katalogu produktów)
    const searchWords = searchIdentifier
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0);

    const filtered = enhancedProducts.filter(enhanced => {
      // Jeśli nie ma słów do wyszukania, pokaż wszystkie
      if (searchWords.length === 0) return true;

      // Każde słowo musi być znalezione w searchableText
      return searchWords.every(word => {
        return enhanced.searchableText.includes(word);
      });
    });

    setFilteredEnhancedProducts(filtered);
    console.log(`Filtrowanie "${searchIdentifier}" -> ${filtered.length} wyników`);
  }, [searchIdentifier, enhancedProducts, selectedLocation]);

  // Aktualizacja filteredIdentifiers dla kompatybilności z istniejącym kodem
  useEffect(() => {
    setFilteredIdentifiers(filteredEnhancedProducts.map(p => p.fileIdentifier));
  }, [filteredEnhancedProducts]);

  // Handler dla wyszukiwania miejscowości z klawiaturą
  const handleLocationSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const exactMatch = filteredLocations.find(
        location => location.name.toLowerCase() === searchLocation.toLowerCase()
      );

      if (exactMatch) {
        setSelectedLocation(exactMatch.name);
        setSearchLocation('');
      } else if (filteredLocations.length > 0) {
        // Wybierz pierwszy wynik z listy
        setSelectedLocation(filteredLocations[0].name);
        setSearchLocation('');
      }
    }
  };

  // Handler dla wyszukiwania identyfikatorów z klawiaturą
  const handleIdentifierSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();

      // Sprawdź czy jest dokładne dopasowanie w enhanced products
      const exactMatch = filteredEnhancedProducts.find(
        enhanced =>
          enhanced.fileIdentifier.toLowerCase() === searchIdentifier.toLowerCase() ||
          enhanced.displayName.toLowerCase() === searchIdentifier.toLowerCase()
      );

      if (exactMatch) {
        setSelectedIdentifier(exactMatch.fileIdentifier);
        setSearchIdentifier('');
      } else if (filteredEnhancedProducts.length > 0) {
        // Wybierz pierwszy wynik z listy
        setSelectedIdentifier(filteredEnhancedProducts[0].fileIdentifier);
        setSearchIdentifier('');
      }
    }
  };

  // Automatyczne wybieranie przy dokładnym dopasowaniu
  useEffect(() => {
    if (searchLocation.length > 0) {
      const exactMatch = filteredLocations.find(
        location => location.name.toLowerCase() === searchLocation.toLowerCase()
      );
      if (exactMatch && selectedLocation !== exactMatch.name) {
        setSelectedLocation(exactMatch.name);
        setSearchLocation('');
      }
    }
  }, [searchLocation, filteredLocations, selectedLocation]);

  useEffect(() => {
    if (searchIdentifier.length > 0 && selectedLocation && filteredEnhancedProducts.length > 0) {
      const exactMatch = filteredEnhancedProducts.find(
        enhanced =>
          enhanced.fileIdentifier.toLowerCase() === searchIdentifier.toLowerCase() ||
          enhanced.displayName.toLowerCase() === searchIdentifier.toLowerCase()
      );
      if (exactMatch && selectedIdentifier !== exactMatch.fileIdentifier) {
        setSelectedIdentifier(exactMatch.fileIdentifier);
        setSearchIdentifier('');
      }
    }
  }, [searchIdentifier, filteredEnhancedProducts, selectedIdentifier, selectedLocation]);

  // Funkcja normalizacji nazwy (identyczna jak w KLIENCI INDYWIDUALNI)
  const normalizeName = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/ /g, '_')
      .replace(/ą/g, 'ą')
      .replace(/ć/g, 'ć')
      .replace(/ę/g, 'ę')
      .replace(/ł/g, 'ł')
      .replace(/ń/g, 'ń')
      .replace(/ó/g, 'ó')
      .replace(/ś/g, 'ś')
      .replace(/ź/g, 'ź')
      .replace(/ż/g, 'ż');
  };

  // Mapowanie nazw miejscowości na rzeczywiste prefiksy plików w R2
  const getLocationFilePrefix = (location: string): string => {
    // Używaj uniwersalnej normalizacji zamiast sztywnego mapowania
    return normalizeName(location);
  };

  // Funkcja do pobierania obrazka produktu z R2
  const fetchProductImage = async (location: string, identifier: string) => {
    if (!location || !identifier) return;

    try {
      setImageLoading(true);
      setImageError('');
      setProductImage('');

      // Właściwie zakodowanie ścieżki z polskimi znakami
      // Użyj mapowania do uzyskania właściwego prefiksu pliku
      const filePrefix = getLocationFilePrefix(location);
      const imagePath = `PROJEKTY MIEJSCOWOŚCI/${location}/${filePrefix}_${identifier}.jpg`;

      // Kodowanie każdej części ścieżki osobno, zachowując ukośniki
      const pathParts = imagePath.split('/');
      const encodedPath = pathParts.map(part => encodeURIComponent(part)).join('/');

      console.log('🔍 Pobieranie obrazka produktu:');
      console.log('  - Miejscowość:', location);
      console.log('  - Identyfikator:', identifier);
      console.log('  - Prefiks pliku:', filePrefix);
      console.log('  - Ścieżka:', imagePath);
      console.log('  - Zakodowana ścieżka:', encodedPath);
      console.log('  - Pełny URL:', `/api/r2/file/${encodedPath}`);

      const response = await fetch(`/api/r2/file/${encodedPath}`);
      console.log(`📊 Status odpowiedzi: ${response.status}`);

      if (response.ok) {
        const blob = await response.blob();
        const imageUrl = URL.createObjectURL(blob);
        setProductImage(imageUrl);
        console.log('✅ Obrazek załadowany pomyślnie');
      } else {
        const errorText = await response.text();
        console.error('❌ Błąd response:', response.status, errorText);
        setImageError(
          `Nie znaleziono obrazka dla ${location} - ${identifier} (status: ${response.status})`
        );
      }
    } catch (err) {
      console.error('Error fetching product image:', err);
      setImageError(
        'Błąd przy pobieraniu obrazka produktu: ' +
          (err instanceof Error ? err.message : 'Nieznany błąd')
      );
    } finally {
      setImageLoading(false);
    }
  };

  // Automatyczne pobieranie obrazka po wybraniu miejscowości i identyfikatora
  useEffect(() => {
    if (selectedLocation && selectedIdentifier) {
      fetchProductImage(selectedLocation, selectedIdentifier);
      // Pokaż selektor projektów po wybraniu produktu
      setShowProjectSelector(true);
    } else {
      setShowProjectSelector(false);
      setProjectSelection(null);
      setMaxProjectsFromOCR(50); // Reset do domyślnej wartości
      setOcrDetectedNumbers([]);
    }
  }, [selectedLocation, selectedIdentifier]);

  // Automatyczne OCR po załadowaniu obrazka
  useEffect(() => {
    if (productImage && !imageLoading && !imageError) {
      runAutomaticOCR(productImage);
    }
  }, [productImage, imageLoading, imageError]);

  // Funkcja automatycznego OCR
  const runAutomaticOCR = async (imageUrl: string) => {
    console.log('🤖 Automatyczne OCR dla obrazka:', imageUrl);

    try {
      const result = await processImage(imageUrl, {
        useColorSegmentation: false,
        preprocessImage: false,
        tesseractPSM: '6',
        characterWhitelist: '0123456789',
      });

      console.log('✅ OCR wykrył projekty:', result.projectNumbers);
      setOcrDetectedNumbers(result.projectNumbers);

      if (result.projectNumbers.length > 0) {
        const maxProject = Math.max(...result.projectNumbers);
        setMaxProjectsFromOCR(maxProject);
        console.log(`🎯 Maksymalna liczba projektów z OCR: ${maxProject}`);
      } else {
        console.log('⚠️ OCR nie wykrył numerów, używam domyślnej wartości 50');
        setMaxProjectsFromOCR(50);
      }
    } catch (error) {
      console.error('❌ Błąd automatycznego OCR:', error);
      setMaxProjectsFromOCR(50); // Fallback do domyślnej wartości
    }
  };

  // Funkcja do pobierania aktualnej selekcji projektów
  const getCurrentProjectSelection = (): ProjectSelection | null => {
    return projectSelectorRef.current?.getCurrentSelection() || null;
  };

  // Obsługa blokowania produktu przy zmianie miejscowości
  useEffect(() => {
    if (selectedLocation && previousLocation && selectedLocation !== previousLocation) {
      if (isProductLocked && lockedProduct) {
        // Sprawdź czy zablokowany produkt istnieje w nowej miejscowości
        const productExistsInNewLocation = enhancedProducts.some(
          enhanced => enhanced.fileIdentifier === lockedProduct
        );

        if (!productExistsInNewLocation) {
          setShowLocationChangeDialog(true);
        } else {
          // Produkt istnieje, ustaw go automatycznie
          setSelectedIdentifier(lockedProduct);
        }
      }
    }

    if (selectedLocation) {
      setPreviousLocation(selectedLocation);
    }
  }, [selectedLocation, previousLocation, isProductLocked, lockedProduct, enhancedProducts]);

  // Cleanup obrazka przy unmount komponencie
  useEffect(() => {
    return () => {
      if (productImage && productImage.startsWith('blob:')) {
        URL.revokeObjectURL(productImage);
      }
    };
  }, [productImage]);

  // Funkcje obsługi blokowania produktu
  const handleProductLockToggle = (checked: boolean) => {
    setIsProductLocked(checked);
    if (checked && selectedIdentifier) {
      setLockedProduct(selectedIdentifier);
    } else {
      setLockedProduct('');
    }
  };

  const handleKeepProduct = () => {
    setShowLocationChangeDialog(false);
    // Zachowaj zablokowany produkt mimo że nie istnieje w nowej miejscowości
  };

  const handleUnlockProduct = () => {
    setIsProductLocked(false);
    setLockedProduct('');
    setSelectedIdentifier('');
    setShowLocationChangeDialog(false);
  };

  const handleFindSimilar = () => {
    setShowLocationChangeDialog(false);
    // Automatycznie spróbuj znaleźć podobny produkt
    const similarProduct = enhancedProducts.find(enhanced =>
      enhanced.displayName.toLowerCase().includes(lockedProduct.toLowerCase().split('_')[0])
    );

    if (similarProduct) {
      setSelectedIdentifier(similarProduct.fileIdentifier);
      setLockedProduct(similarProduct.fileIdentifier);
    } else {
      // Jeśli nie znaleziono podobnego, odblokuj produkt
      setIsProductLocked(false);
      setLockedProduct('');
      setSelectedIdentifier('');
    }
  };

  const handleContinue = () => {
    const currentProjectSelection = getCurrentProjectSelection();
    if (selectedLocation && selectedIdentifier && currentProjectSelection) {
      // Znajdź enhanced product info dla wybranego identyfikatora
      const enhancedProduct = enhancedProducts.find(p => p.fileIdentifier === selectedIdentifier);

      // Jeśli mamy produkt z bazy danych, użyj jego danych
      let productData: Product;
      if (enhancedProduct?.databaseProduct) {
        productData = {
          ...enhancedProduct.databaseProduct,
          // Krótki identifier bez długiego opisu
          identifier: enhancedProduct.databaseProduct.identifier,
          description: '', // Pusty opis - nie jest potrzebny w tabeli
          productionPath: `PROJEKTY MIEJSCOWOŚCI/${selectedLocation}/${getLocationFilePrefix(selectedLocation)}_${selectedIdentifier}.jpg`,
        };
      } else {
        // Fallback - tworzymy mock product jak wcześniej
        // UWAGA: To też może być problemem jeśli fallback używa nieprawidłowych ID
        console.warn('Używam fallback produktu - może powodować błędy z ID:', {
          selectedLocation,
          selectedIdentifier,
        });
        productData = {
          id: `mock_${selectedLocation.toLowerCase()}_${selectedIdentifier}_${Date.now()}`,
          identifier: selectedIdentifier.replace(/_/g, ' ').toUpperCase(),
          index: `${selectedLocation.toUpperCase()}-${selectedIdentifier.toUpperCase().slice(0, 6)}`,
          description: '', // Pusty opis - nie jest potrzebny w tabeli
          price: 15.99,
          imageUrl: `/products/${selectedLocation.toLowerCase()}_${selectedIdentifier}.jpg`,
          category: 'MAGNESY',
          productionPath: `PROJEKTY MIEJSCOWOŚCI/${selectedLocation}/${getLocationFilePrefix(selectedLocation)}_${selectedIdentifier}.jpg`,
          isActive: true,
          new: false,
        };
      }

      const locationData: LocationData = {
        locationName: selectedLocation,
        productIdentifier: selectedIdentifier,
        // Nowe pola z ProjectSelector
        selectedProjects: currentProjectSelection.selectedProjects,
        projectQuantities: currentProjectSelection.projectQuantities,
        totalQuantity: currentProjectSelection.totalQuantity,
        productionNotes: currentProjectSelection.productionNotes,
      };

      onProductSelect(productData, locationData);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center justify-center gap-2">
          <MapPin className="h-6 w-6 text-blue-600" />
          Projekty miejscowości
        </h1>
        <p className="text-gray-600 mt-2">Wybierz miejscowość i produkt</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {/* Wybór miejscowości */}
        <Card>
          <CardHeader>
            <CardTitle>1. Wybierz miejscowość</CardTitle>
            <CardDescription>Znajdź miejscowość dla której chcesz zamówić pamiątkę</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="search-location">Wyszukaj miejscowość</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="search-location"
                  placeholder="np. Gdańsk, Kołobrzeg... (Enter/Tab aby wybrać)"
                  value={searchLocation}
                  onChange={e => setSearchLocation(e.target.value)}
                  onKeyDown={handleLocationSearch}
                  className="pl-10"
                  autoComplete="off"
                />
              </div>
              {searchLocation && filteredLocations.length > 0 && (
                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                  <p className="text-blue-700 font-medium">
                    Znaleziono {filteredLocations.length} wyników:
                  </p>
                  <ul className="text-blue-600 mt-1 space-y-1">
                    {filteredLocations.slice(0, 3).map((location, index) => (
                      <li key={location.name} className={index === 0 ? 'font-semibold' : ''}>
                        • {location.name} {index === 0 && '(Enter aby wybrać)'}
                      </li>
                    ))}
                    {filteredLocations.length > 3 && (
                      <li className="text-blue-500">... i {filteredLocations.length - 3} więcej</li>
                    )}
                  </ul>
                </div>
              )}
              {searchLocation && filteredLocations.length === 0 && (
                <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-sm">
                  <p className="text-amber-700">Brak wyników dla "{searchLocation}"</p>
                </div>
              )}
            </div>

            <div>
              <Label>Lub wybierz z listy</Label>
              {error && (
                <div className="p-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded mb-2">
                  {error}
                </div>
              )}
              {loading ? (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                    <span className="text-sm text-gray-600">Ładowanie miejscowości...</span>
                  </div>
                  <div className="animate-pulse">
                    <div className="h-10 bg-gray-200 rounded-md"></div>
                  </div>
                </div>
              ) : (
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                  <SelectTrigger className={error ? 'border-amber-300 bg-amber-50' : ''}>
                    <SelectValue
                      placeholder={
                        filteredLocations.length === 0
                          ? 'Brak dostępnych miejscowości'
                          : `Wybierz miejscowość (${filteredLocations.length} dostępnych)`
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {error && (
                      <div className="px-2 py-1 text-xs text-amber-700 bg-amber-50 border-b border-amber-200">
                        <p className="font-medium">Uwaga:</p>
                        <p>{error}</p>
                      </div>
                    )}
                    {filteredLocations.length === 0 ? (
                      <SelectItem value="no-results" disabled>
                        {error ? 'Używam danych podstawowych' : 'Brak dostępnych miejscowości'}
                      </SelectItem>
                    ) : (
                      filteredLocations.map(location => (
                        <SelectItem key={location.name} value={location.name}>
                          <div className="flex items-center justify-between w-full">
                            <span>{location.name}</span>
                            <span className="text-xs text-gray-500 ml-2">
                              {location.productIdentifiers.length} produktów
                            </span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Wybór produktu */}
        <Card>
          <CardHeader>
            <CardTitle>2. Wybierz produkt</CardTitle>
            <CardDescription>Określ identyfikator lub indeks produktu</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="search-identifier">Wyszukaj produkt</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="search-identifier"
                  placeholder="np. mag me koł 4... (Enter/Tab aby wybrać)"
                  value={searchIdentifier}
                  onChange={e => setSearchIdentifier(e.target.value)}
                  onKeyDown={handleIdentifierSearch}
                  className="pl-10"
                  disabled={!selectedLocation}
                  autoComplete="off"
                />
              </div>
              {selectedLocation && searchIdentifier && filteredEnhancedProducts.length > 0 && (
                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                  <p className="text-blue-700 font-medium">
                    Znaleziono {filteredEnhancedProducts.length} wyników:
                  </p>
                  <ul className="text-blue-600 mt-1 space-y-1 max-h-24 overflow-y-auto">
                    {filteredEnhancedProducts.slice(0, 3).map((enhanced, index) => (
                      <li
                        key={enhanced.fileIdentifier}
                        className={index === 0 ? 'font-semibold' : ''}
                      >
                        • {enhanced.displayName} {index === 0 && '(Enter aby wybrać)'}
                        {enhanced.databaseProduct && (
                          <span className="ml-1 text-xs text-green-600">✓ w bazie</span>
                        )}
                      </li>
                    ))}
                    {filteredEnhancedProducts.length > 3 && (
                      <li className="text-blue-500">
                        ... i {filteredEnhancedProducts.length - 3} więcej
                      </li>
                    )}
                  </ul>
                </div>
              )}
              {selectedLocation && searchIdentifier && filteredEnhancedProducts.length === 0 && (
                <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-sm">
                  <p className="text-amber-700">Brak wyników dla "{searchIdentifier}"</p>
                </div>
              )}
              {!selectedLocation && (
                <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded text-sm">
                  <p className="text-gray-600">Najpierw wybierz miejscowość</p>
                </div>
              )}
            </div>

            <div>
              <Label>Lub wybierz z listy</Label>
              <Select value={selectedIdentifier} onValueChange={setSelectedIdentifier}>
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz produkt" />
                </SelectTrigger>
                <SelectContent>
                  {filteredEnhancedProducts.map(enhanced => (
                    <SelectItem key={enhanced.fileIdentifier} value={enhanced.fileIdentifier}>
                      {enhanced.displayName}
                      {enhanced.databaseProduct && (
                        <span className="ml-1 text-xs text-green-600">✓</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Checkbox blokowania produktu */}
            {selectedIdentifier && (
              <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="lock-product"
                    checked={isProductLocked}
                    onCheckedChange={handleProductLockToggle}
                  />
                  <Label
                    htmlFor="lock-product"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                  >
                    {isProductLocked ? (
                      <Lock className="h-4 w-4 text-blue-600" />
                    ) : (
                      <Unlock className="h-4 w-4 text-gray-500" />
                    )}
                    Zachowaj produkt przy zmianie miejscowości
                  </Label>
                </div>
                <p className="text-xs text-gray-600 mt-2 ml-6">
                  {isProductLocked
                    ? 'Produkt zostanie automatycznie wybrany po zmianie miejscowości (jeśli dostępny)'
                    : 'Zaznacz aby zachować wybrany produkt przy przełączaniu między miejscowościami'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Preview produktu z obrazkiem */}
      {selectedLocation && selectedIdentifier && (
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              {selectedLocation} - {selectedIdentifier}
            </CardTitle>
            <CardDescription>Wybierz numer projektu, który chcesz dodać do koszyka</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {imageLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center gap-2 text-gray-600">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  Ładowanie obrazka produktu...
                </div>
              </div>
            )}

            {imageError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-700 text-center">{imageError}</p>
              </div>
            )}

            {productImage && !imageLoading && (
              <div className="space-y-4">
                <div className="relative w-full bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                  <Image
                    src={productImage}
                    alt={`${selectedLocation} - ${selectedIdentifier}`}
                    width={800}
                    height={600}
                    className="w-full h-auto object-contain max-h-96 md:max-h-[500px]"
                    priority
                  />
                </div>

                <div className="space-y-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm">
                    <strong>Miejscowość:</strong> {selectedLocation}
                  </p>
                  <p className="text-sm">
                    <strong>Identyfikator:</strong> {selectedIdentifier}
                  </p>

                  {/* Informacja o automatycznym OCR */}
                  {ocrProcessing && (
                    <div className="flex items-center gap-2 text-sm text-purple-600">
                      <div className="animate-spin rounded-full h-3 w-3 border-2 border-purple-600 border-t-transparent"></div>
                      🤖 Automatyczne skanowanie projektów...
                    </div>
                  )}

                  {!ocrProcessing && ocrDetectedNumbers.length > 0 && (
                    <div className="text-sm text-green-700">
                      <p className="font-medium">
                        🎯 Wykryte projekty: {ocrDetectedNumbers.join(', ')}
                      </p>
                      <p className="text-xs">Maksymalna liczba projektów: {maxProjectsFromOCR}</p>
                    </div>
                  )}

                  {!ocrProcessing && ocrDetectedNumbers.length === 0 && !imageLoading && (
                    <div className="text-sm text-amber-700">
                      ⚠️ OCR nie wykrył numerów projektów (używam domyślnej wartości: 50)
                    </div>
                  )}

                  <p className="text-xs text-blue-700 mt-2">
                    💡 Teraz wybierz projekty i ilości poniżej
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Selektor projektów */}
      {showProjectSelector && selectedLocation && selectedIdentifier && (
        <div className="max-w-4xl mx-auto">
          <ProjectSelector
            ref={projectSelectorRef}
            maxProjects={maxProjectsFromOCR}
            disabled={ocrProcessing}
            onValidationChange={setIsProjectSelectorValid}
          />
        </div>
      )}

      {/* Przycisk dodaj do zamówienia */}
      {selectedLocation && selectedIdentifier && (
        <div className="text-center space-y-3">
          <Button
            onClick={handleContinue}
            disabled={!isProjectSelectorValid}
            size="lg"
            className="px-8 py-3 text-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
          >
            <ShoppingCart className="h-5 w-5" />
            Dodaj do zamówienia
          </Button>

          {/* Informacja o wymaganych polach */}
          {!isProjectSelectorValid && (
            <p className="text-sm text-amber-600">
              ⚠️ Wybierz projekty i określ ilości przed dodaniem do zamówienia
            </p>
          )}
        </div>
      )}

      {/* Dialog dla zmiany miejscowości z zablokowanym produktem */}
      {showLocationChangeDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Produkt niedostępny
              </CardTitle>
              <CardDescription>
                Zablokowany produkt "{lockedProduct}" nie jest dostępny w miejscowości "
                {selectedLocation}".
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-gray-600">Co chcesz zrobić?</div>

              <div className="flex flex-col gap-3">
                <Button
                  onClick={handleKeepProduct}
                  variant="outline"
                  className="flex items-center justify-center gap-2"
                >
                  <Lock className="h-4 w-4" />
                  Zachowaj wybór (bez automatycznego ustawiania)
                </Button>

                <Button
                  onClick={handleFindSimilar}
                  className="flex items-center justify-center gap-2"
                >
                  <Search className="h-4 w-4" />
                  Znajdź podobny produkt
                </Button>

                <Button
                  onClick={handleUnlockProduct}
                  variant="destructive"
                  className="flex items-center justify-center gap-2"
                >
                  <Unlock className="h-4 w-4" />
                  Odblokuj i wyczyść wybór
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
