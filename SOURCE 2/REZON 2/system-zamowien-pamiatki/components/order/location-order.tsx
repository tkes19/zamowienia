'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Combobox, ComboboxOption } from '@/components/ui/combobox';
import { ArrowLeft, MapPin, ImageIcon, ShoppingCart, Lock, Unlock, RefreshCw } from 'lucide-react';
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
  selectedProjects?: string;
  projectQuantities?: string;
  totalQuantity?: number;
  productionNotes?: string;
}

interface LocationWithProducts {
  name: string;
  productIdentifiers: string[];
}

interface LocationsResponse {
  success: boolean;
  locations: LocationWithProducts[];
  source?: string;
}

interface EnhancedProductInfo {
  fileIdentifier: string;
  databaseProduct?: Product;
  displayName: string;
  searchableText: string;
}

export function LocationOrder({ onBack, onProductSelect }: LocationOrderProps) {
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [locations, setLocations] = useState<LocationWithProducts[]>([]);
  const [enhancedProducts, setEnhancedProducts] = useState<EnhancedProductInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [productsLoading, setProductsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [productError, setProductError] = useState<string>('');

  // Product lock functionality
  const [isProductLocked, setIsProductLocked] = useState<boolean>(false);
  const [lockedProduct, setLockedProduct] = useState<string>('');

  // Image and OCR states
  const [productImage, setProductImage] = useState<string>('');
  const [imageLoading, setImageLoading] = useState<boolean>(false);
  const [imageError, setImageError] = useState<string>('');
  const [maxProjectsFromOCR, setMaxProjectsFromOCR] = useState<number>(50);
  const [ocrDetectedNumbers, setOcrDetectedNumbers] = useState<number[]>([]);
  const { processImage, isProcessing: ocrProcessing } = useAdvancedOCR();

  // Project selector states
  const [projectSelection, setProjectSelection] = useState<ProjectSelection | null>(null);
  const [showProjectSelector, setShowProjectSelector] = useState<boolean>(false);
  const [isProjectSelectorValid, setIsProjectSelectorValid] = useState<boolean>(false);
  const projectSelectorRef = useRef<ProjectSelectorRef>(null);

  // Database products
  const [databaseProducts, setDatabaseProducts] = useState<Product[]>([]);

  // Cache configuration
  const LOCATIONS_CACHE_KEY = 'locations_cache_v1';
  const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

  // Helper functions
  const convertFileToDatabase = (fileIdentifier: string): string => {
    return fileIdentifier
      .replace(/_/g, ' ')
      .toUpperCase()
      .replace(/KOLO/g, 'KOŁO')
      .replace(/KREG/g, 'KRĄG')
      .replace(/TRZMA/g, 'TRZYMA');
  };

  const findMatchingProduct = (
    fileIdentifier: string,
    products: Product[]
  ): Product | undefined => {
    const targetDatabaseFormat = convertFileToDatabase(fileIdentifier);

    let exactMatch = products.find(
      product => product.identifier?.toUpperCase() === targetDatabaseFormat
    );

    if (exactMatch) return exactMatch;

    exactMatch = products.find(
      product => product.index?.toUpperCase().replace(/[-\s]/g, ' ') === targetDatabaseFormat
    );

    if (exactMatch) return exactMatch;

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

      for (const word of fileWords) {
        if (productText.includes(word)) {
          score += 1;
        }
      }

      if (score === fileWords.length && score > bestScore) {
        bestScore = score;
        bestMatch = product;
      } else if (score > bestScore && score >= Math.ceil(fileWords.length * 0.6)) {
        bestScore = score;
        bestMatch = product;
      }
    }

    return bestMatch;
  };

  const loadCachedOrFetchLocations = async () => {
    try {
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
            sessionStorage.removeItem(LOCATIONS_CACHE_KEY);
          }
        } catch (parseError) {
          sessionStorage.removeItem(LOCATIONS_CACHE_KEY);
        }
      }

      console.log('🌐 Pobieranie danych z API...');
      const response = await fetch('/api/r2/locations');
      const data: LocationsResponse = await response.json();

      if (data.success && data.locations && data.locations.length > 0) {
        const cacheData = {
          locations: data.locations,
          timestamp: Date.now(),
        };
        try {
          sessionStorage.setItem(LOCATIONS_CACHE_KEY, JSON.stringify(cacheData));
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

  // Load locations
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        setError('');
        const data = await loadCachedOrFetchLocations();

        if (data.success && data.locations && data.locations.length > 0) {
          setLocations(data.locations);
        } else {
          throw new Error('Brak danych z wszystkich źródeł');
        }
      } catch (err) {
        console.error('Error fetching locations:', err);
        setError('Błąd ładowania miejscowości');

        const fallbackLocations: LocationWithProducts[] = [
          {
            name: 'Gdańsk',
            productIdentifiers: ['kieliszek_metal', 'niezbędnik', 'otwieracz_koło_ratunkowe'],
          },
          {
            name: 'Kołobrzeg',
            productIdentifiers: ['brelok_metal_miś', 'długopis_bambus', 'korkociąg_otwieracz'],
          },
          {
            name: 'Kraków',
            productIdentifiers: [
              'brelok_grawer_koło',
              'brelok_grawer_owal',
              'brelok_grawer_prostokąt',
            ],
          },
        ];

        setLocations(fallbackLocations);
      } finally {
        setLoading(false);
      }
    };

    fetchLocations();
  }, []);

  // Load database products
  useEffect(() => {
    const fetchDatabaseProducts = async () => {
      try {
        let response = await fetch('/api/products');

        if (response.status === 401) {
          response = await fetch('/api/products?demo=true');
        }

        if (response.ok) {
          const products = await response.json();
          setDatabaseProducts(products);
        }
      } catch (error) {
        console.error('Błąd połączenia z API produktów:', error);
        setDatabaseProducts([]);
      }
    };

    fetchDatabaseProducts();
  }, []);

  // Funkcja odświeżania produktów z R2
  const refreshProductsFromR2 = async (locationName: string) => {
    if (!locationName) return;

    setProductsLoading(true);
    setProductError('');

    try {
      console.log(`🔄 Odświeżam produkty dla lokalizacji: ${locationName}`);
      const response = await fetch(`/api/products?location=${encodeURIComponent(locationName)}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success && data.products) {
        console.log(`✅ Odświeżono ${data.products.length} produktów z R2 dla ${locationName}`);

        // Konwertuj produkty z R2 na enhanced products
        const enhanced: EnhancedProductInfo[] = data.products.map((product: any) => {
          const matchingDbProduct =
            databaseProducts.length > 0
              ? findMatchingProduct(product.identifier, databaseProducts)
              : undefined;

          const baseDisplayName = product.identifier
            .replace(/_/g, ' ')
            .toUpperCase()
            .replace(/KOLO/g, 'KOŁO')
            .replace(/KREG/g, 'KRĄG')
            .replace(/RATUNKOWE/g, 'RATUNKOWY');

          return {
            fileIdentifier: product.identifier,
            databaseProduct: matchingDbProduct,
            displayName: matchingDbProduct
              ? `${baseDisplayName} (${matchingDbProduct.index || matchingDbProduct.identifier})`
              : baseDisplayName,
            searchableText: matchingDbProduct
              ? `${matchingDbProduct.identifier || ''} ${matchingDbProduct.index || ''} ${product.identifier} ${baseDisplayName}`.toLowerCase()
              : `${product.identifier} ${baseDisplayName}`.toLowerCase(),
          };
        });

        setEnhancedProducts(enhanced);

        // Handle product locking logic
        if (isProductLocked && lockedProduct) {
          const lockedProductExists = enhanced.some(p => p.fileIdentifier === lockedProduct);
          if (lockedProductExists) {
            setSelectedProduct(lockedProduct);
          } else {
            // Try to find similar product
            const similarProduct = enhanced.find(p =>
              p.displayName.toLowerCase().includes(lockedProduct.toLowerCase().split('_')[0])
            );
            if (similarProduct) {
              setSelectedProduct(similarProduct.fileIdentifier);
              setLockedProduct(similarProduct.fileIdentifier);
            } else {
              setSelectedProduct('');
            }
          }
        } else {
          setSelectedProduct('');
        }

        // Aktualizuj dane locations z nowymi produktami
        const updatedLocations = locations.map(loc =>
          loc.name === locationName
            ? { ...loc, productIdentifiers: data.products.map((p: any) => p.identifier) }
            : loc
        );
        setLocations(updatedLocations);
      } else {
        throw new Error(data.error || 'Failed to load products');
      }
    } catch (error) {
      console.error('Error refreshing products:', error);
      setProductError(
        `Błąd odświeżania produktów: ${error instanceof Error ? error.message : 'Nieznany błąd'}`
      );

      // Fallback do starej metody
      console.log('🔄 Fallback do standardowej metody...');
      const selectedLocationData = locations.find(loc => loc.name === locationName);
      if (selectedLocationData) {
        const enhanced: EnhancedProductInfo[] = selectedLocationData.productIdentifiers.map(
          fileIdentifier => {
            const matchingProduct =
              databaseProducts.length > 0
                ? findMatchingProduct(fileIdentifier, databaseProducts)
                : undefined;

            const baseDisplayName = fileIdentifier
              .replace(/_/g, ' ')
              .toUpperCase()
              .replace(/KOLO/g, 'KOŁO')
              .replace(/KREG/g, 'KRĄG')
              .replace(/RATUNKOWE/g, 'RATUNKOWY');

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
      }
    } finally {
      setProductsLoading(false);
    }
  };

  // Update enhanced products when location changes - używa nowego API
  useEffect(() => {
    if (selectedLocation) {
      // Spróbuj najpierw nowego API
      refreshProductsFromR2(selectedLocation);
    } else {
      setEnhancedProducts([]);
      setSelectedProduct('');
    }
  }, [selectedLocation, databaseProducts, isProductLocked, lockedProduct]);

  // Funkcja do pobierania obrazka produktu (przywrócona z backup)
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
    if (selectedLocation && selectedProduct) {
      fetchProductImage(selectedLocation, selectedProduct);
      // Pokaż selektor projektów po wybraniu produktu
      setShowProjectSelector(true);
    } else {
      setProductImage('');
      setImageError('');
      setShowProjectSelector(false);
    }
  }, [selectedLocation, selectedProduct]);

  // Automatyczne OCR po załadowaniu obrazka (przywrócone z backup)
  useEffect(() => {
    if (productImage && !imageLoading && !imageError) {
      runAutomaticOCR(productImage);
    }
  }, [productImage, imageLoading, imageError]);

  // Funkcja automatycznego OCR (przywrócona z backup)
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

  // Cleanup blob URLs
  useEffect(() => {
    return () => {
      if (productImage && productImage.startsWith('blob:')) {
        URL.revokeObjectURL(productImage);
      }
    };
  }, [productImage]);

  const getCurrentProjectSelection = (): ProjectSelection | null => {
    if (projectSelectorRef.current) {
      return projectSelectorRef.current.getCurrentSelection();
    }
    return null;
  };

  const maxProjectsSoftLimit = useMemo(() => {
    const base = Math.max(1, maxProjectsFromOCR);
    const buffer = Math.max(6, Math.round(base * 0.4));
    const extended = base + buffer;
    return Math.min(84, Math.max(extended, base + 6));
  }, [maxProjectsFromOCR]);

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

  const getLocationFilePrefix = (locationName: string): string => {
    // Używaj uniwersalnej normalizacji zamiast sztywnego mapowania
    return normalizeName(locationName);
  };

  const handleLocationChange = (value: string) => {
    setSelectedLocation(value);
  };

  const handleProductChange = (value: string) => {
    setSelectedProduct(value);
  };

  const handleProductLockToggle = (checked: boolean) => {
    setIsProductLocked(checked);
    if (checked && selectedProduct) {
      setLockedProduct(selectedProduct);
    } else {
      setLockedProduct('');
    }
  };

  const handleContinue = () => {
    const currentProjectSelection = getCurrentProjectSelection();
    if (selectedLocation && selectedProduct && currentProjectSelection) {
      const enhancedProduct = enhancedProducts.find(p => p.fileIdentifier === selectedProduct);

      let productData: Product;
      if (enhancedProduct?.databaseProduct) {
        productData = {
          ...enhancedProduct.databaseProduct,
          identifier: enhancedProduct.databaseProduct.identifier,
          description: '',
          productionPath: `PROJEKTY MIEJSCOWOŚCI/${selectedLocation}/${getLocationFilePrefix(selectedLocation)}_${selectedProduct}.jpg`,
        };
      } else {
        productData = {
          id: `mock_${selectedLocation.toLowerCase()}_${selectedProduct}_${Date.now()}`,
          identifier: selectedProduct.replace(/_/g, ' ').toUpperCase(),
          index: `${selectedLocation.toUpperCase()}-${selectedProduct.toUpperCase().slice(0, 6)}`,
          description: '',
          price: 15.99,
          imageUrl: `/products/${selectedLocation.toLowerCase()}_${selectedProduct}.jpg`,
          category: 'MAGNESY',
          productionPath: `PROJEKTY MIEJSCOWOŚCI/${selectedLocation}/${getLocationFilePrefix(selectedLocation)}_${selectedProduct}.jpg`,
          isActive: true,
          new: false,
        };
      }

      const locationData: LocationData = {
        locationName: selectedLocation,
        productIdentifier: selectedProduct,
        selectedProjects: currentProjectSelection.selectedProjects,
        projectQuantities: currentProjectSelection.projectQuantities,
        totalQuantity: currentProjectSelection.totalQuantity,
        productionNotes: currentProjectSelection.productionNotes,
      };

      onProductSelect(productData, locationData);
    }
  };

  // Prepare options for location combobox
  const locationOptions: ComboboxOption<LocationWithProducts>[] = locations.map(location => ({
    value: location.name,
    label:
      location.productIdentifiers.length > 1
        ? `${location.name} (${location.productIdentifiers.length} produktów)`
        : location.name,
    data: location,
  }));

  // Prepare options for product combobox
  const productOptions: ComboboxOption<EnhancedProductInfo>[] = enhancedProducts.map(product => {
    const isAvailable = selectedLocation ? true : false; // All products in location are available

    return {
      value: product.fileIdentifier,
      label: product.displayName,
      disabled: !isAvailable,
      data: product,
    };
  });

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
        {/* Location Selection */}
        <Card>
          <CardHeader>
            <CardTitle>1. Wybierz miejscowość</CardTitle>
            <CardDescription>Znajdź miejscowość dla której chcesz zamówić pamiątkę</CardDescription>
          </CardHeader>
          <CardContent>
            <Combobox<LocationWithProducts>
              value={selectedLocation}
              onChange={handleLocationChange}
              options={locationOptions}
              placeholder="Wybierz miejscowość..."
              searchPlaceholder="Wyszukaj miejscowość..."
              emptyMessage="Nie znaleziono miejscowości"
              loading={loading}
              disabled={loading}
              label="Miejscowość"
              error={error || undefined}
            />
          </CardContent>
        </Card>

        {/* Product Selection */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>2. Wybierz produkt</CardTitle>
                <CardDescription>Określ identyfikator lub indeks produktu</CardDescription>
              </div>
              {selectedLocation && (
                <Button
                  onClick={() => refreshProductsFromR2(selectedLocation)}
                  variant="outline"
                  size="sm"
                  disabled={productsLoading}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${productsLoading ? 'animate-spin' : ''}`} />
                  Odśwież
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Combobox<EnhancedProductInfo>
              value={selectedProduct}
              onChange={handleProductChange}
              options={productOptions}
              placeholder="Wybierz produkt (nazwa lub kod)..."
              searchPlaceholder="Wyszukaj produkt..."
              emptyMessage="Brak produktów"
              loading={productsLoading}
              disabled={!selectedLocation || productsLoading}
              label="Produkt"
              error={!selectedLocation ? 'Najpierw wybierz miejscowość' : productError || undefined}
            />

            {productError && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">⚠️ {productError}</p>
                <Button
                  onClick={() => selectedLocation && refreshProductsFromR2(selectedLocation)}
                  variant="outline"
                  size="sm"
                  className="mt-2 text-xs"
                >
                  Spróbuj ponownie
                </Button>
              </div>
            )}

            {/* Product lock checkbox */}
            {selectedLocation && selectedProduct && (
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

      {/* Product Preview */}
      {selectedLocation && selectedProduct && (
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              {selectedLocation} - {selectedProduct}
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
              <div className="space-y-4">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-md">
                  <div className="flex items-center justify-center space-y-2">
                    <div className="text-center">
                      <ImageIcon className="h-16 w-16 text-gray-400 mx-auto mb-2" />
                      <p className="text-amber-700 text-sm font-medium">{imageError}</p>
                      <p className="text-amber-600 text-xs mt-1">
                        Możesz kontynuować wybór projektów bez podglądu obrazka
                      </p>
                    </div>
                  </div>
                </div>

                {/* Informacje o produkcie bez obrazka */}
                <div className="space-y-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm">
                    <strong>Miejscowość:</strong> {selectedLocation}
                  </p>
                  <p className="text-sm">
                    <strong>Identyfikator:</strong> {selectedProduct}
                  </p>

                  {ocrProcessing && (
                    <div className="flex items-center gap-2 text-sm text-purple-600">
                      <div className="animate-spin rounded-full h-3 w-3 border-2 border-purple-600 border-t-transparent"></div>
                      🤖 Próbuję automatyczne skanowanie...
                    </div>
                  )}

                  {!ocrProcessing && (
                    <div className="text-sm text-amber-700">
                      ⚠️ Bez obrazka używam domyślnej wartości: {maxProjectsFromOCR} projektów
                    </div>
                  )}

                  <p className="text-xs text-blue-700 mt-2">
                    💡 Teraz wybierz projekty i ilości poniżej
                  </p>
                </div>
              </div>
            )}

            {productImage && !imageLoading && (
              <div className="space-y-4">
                <div className="relative w-full bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                  <Image
                    src={productImage}
                    alt={`${selectedLocation} - ${selectedProduct}`}
                    width={800}
                    height={600}
                    className="w-full h-auto object-contain max-h-96 md:max-h-[500px]"
                    priority
                    onError={() => {
                      console.error('🖼️ Image component failed to load:', productImage);
                      setImageError(
                        `Błąd wyświetlania obrazka dla: ${selectedLocation} - ${selectedProduct}`
                      );
                      setProductImage('');
                    }}
                  />
                </div>

                <div className="space-y-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm">
                    <strong>Miejscowość:</strong> {selectedLocation}
                  </p>
                  <p className="text-sm">
                    <strong>Identyfikator:</strong> {selectedProduct}
                  </p>

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
                      <p className="text-xs">
                        Maksymalna liczba projektów wykryta automatycznie: {maxProjectsFromOCR}
                        {maxProjectsSoftLimit > maxProjectsFromOCR && (
                          <>
                            {' '}
                            • Limit ręcznego wyboru: {maxProjectsSoftLimit}
                          </>
                        )}
                      </p>
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

      {/* Project Selector */}
      {showProjectSelector && selectedLocation && selectedProduct && (
        <div className="max-w-4xl mx-auto">
          <ProjectSelector
            ref={projectSelectorRef}
            maxProjects={maxProjectsSoftLimit}
            disabled={ocrProcessing}
            onValidationChange={setIsProjectSelectorValid}
          />
        </div>
      )}

      {/* Continue Button */}
      {selectedLocation && selectedProduct && (
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

          {!isProjectSelectorValid && (
            <p className="text-sm text-amber-600">
              ⚠️ Wybierz projekty i określ ilości przed dodaniem do zamówienia
            </p>
          )}
        </div>
      )}
    </div>
  );
}
