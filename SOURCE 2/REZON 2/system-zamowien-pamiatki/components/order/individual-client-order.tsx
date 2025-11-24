'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Combobox, ComboboxOption } from '@/components/ui/combobox';
import { ArrowLeft, Users, Building2, ImageIcon, ShoppingCart, RefreshCw } from 'lucide-react';
import { Product } from '@/lib/types';
import { ProjectSelector, ProjectSelection, ProjectSelectorRef } from './project-selector';
import { useAdvancedOCR } from '@/hooks/use-advanced-ocr';

interface IndividualClientOrderProps {
  onBack: () => void;
  onClientDataComplete: (clientData: ClientData) => void;
}

export interface ClientData {
  clientName: string;
  clientCompany?: string;
  customizationDescription: string;
  specialInstructions?: string;
  folderName?: string;
  objectName?: string;
  productIdentifier?: string;
  selectedProjects?: string;
  projectQuantities?: string;
  totalQuantity?: number;
  productionNotes?: string;
  selectedProductData?: EnhancedIndividualProduct;
}

// Keep old interface for backward compatibility
export interface IndividualClientData extends ClientData {
  folderName: string;
  objectName: string;
  productIdentifier: string;
}

interface FolderInfo {
  folderName: string;
}

interface ObjectInfo {
  name: string;
  productCount?: number;
}

interface EnhancedIndividualProduct {
  id: string;
  identifier: string;
  name: string;
  imageUrl: string;
  category: string;
  price: number;
  isActive: boolean;
  databaseProduct?: Product;
}

export function IndividualClientOrder({
  onBack,
  onClientDataComplete,
}: IndividualClientOrderProps) {
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [selectedObject, setSelectedObject] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<string>('');

  const [folders, setFolders] = useState<FolderInfo[]>([]);
  const [objects, setObjects] = useState<ObjectInfo[]>([]);
  const [products, setProducts] = useState<EnhancedIndividualProduct[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [objectsLoading, setObjectsLoading] = useState<boolean>(false);
  const [productsLoading, setProductsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [objectError, setObjectError] = useState<string>('');
  const [productError, setProductError] = useState<string>('');

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

  // Load user folders on component mount
  useEffect(() => {
    const fetchFolders = async () => {
      try {
        setError('');
        console.log('🔍 Fetching user folders...');

        const response = await fetch('/api/products/individual');

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Brak uprawnień do klientów indywidualnych');
          } else if (response.status === 403) {
            throw new Error('Brak przypisanych folderów klientów');
          } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        }

        const data = await response.json();

        if (data.success && data.folders) {
          const folderList: FolderInfo[] = data.folders.map((folder: any) => ({
            folderName: folder.folderName,
          }));

          setFolders(folderList);
          console.log(`✅ Loaded ${folderList.length} folders for user`);

          // Auto-select if only one folder
          if (folderList.length === 1) {
            setSelectedFolder(folderList[0].folderName);
            console.log(`🎯 Auto-selected single folder: ${folderList[0].folderName}`);
          }
        } else {
          throw new Error(data.error || 'Failed to load folders');
        }
      } catch (err) {
        console.error('Error fetching folders:', err);
        setError(err instanceof Error ? err.message : 'Błąd ładowania folderów klientów');

        // Fallback empty state
        setFolders([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFolders();
  }, []);

  // Load objects when folder changes
  useEffect(() => {
    if (selectedFolder) {
      fetchObjects(selectedFolder);
    } else {
      setObjects([]);
      setSelectedObject('');
    }
  }, [selectedFolder]);

  // Load products when object changes
  useEffect(() => {
    if (selectedFolder && selectedObject) {
      fetchProducts(selectedFolder, selectedObject);
    } else {
      setProducts([]);
      setSelectedProduct('');
    }
  }, [selectedFolder, selectedObject]);

  // Load product image when product changes
  useEffect(() => {
    if (selectedFolder && selectedObject && selectedProduct) {
      fetchProductImage(selectedFolder, selectedObject, selectedProduct);
      setShowProjectSelector(true);
    } else {
      setProductImage('');
      setImageError('');
      setShowProjectSelector(false);
    }
  }, [selectedFolder, selectedObject, selectedProduct]);

  // Auto OCR when image loads
  useEffect(() => {
    if (productImage && !imageLoading && !imageError) {
      runAutomaticOCR(productImage);
    }
  }, [productImage, imageLoading, imageError]);

  const fetchObjects = async (folderName: string) => {
    if (!folderName) return;

    setObjectsLoading(true);
    setObjectError('');

    try {
      console.log(`🔍 Fetching objects for folder: ${folderName}`);
      const response = await fetch(
        `/api/products/individual?folder=${encodeURIComponent(folderName)}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success && data.objects) {
        const objectList: ObjectInfo[] = data.objects.map((objectName: string) => ({
          name: objectName,
        }));

        setObjects(objectList);
        console.log(`✅ Loaded ${objectList.length} objects for ${folderName}`);

        // Auto-select if only one object
        if (objectList.length === 1) {
          setSelectedObject(objectList[0].name);
          console.log(`🎯 Auto-selected single object: ${objectList[0].name}`);
        }
      } else {
        throw new Error(data.error || 'Failed to load objects');
      }
    } catch (error) {
      console.error('Error fetching objects:', error);
      setObjectError(
        `Błąd ładowania obiektów: ${error instanceof Error ? error.message : 'Nieznany błąd'}`
      );
      setObjects([]);
    } finally {
      setObjectsLoading(false);
    }
  };

  const fetchProducts = async (folderName: string, objectName: string) => {
    if (!folderName || !objectName) return;

    setProductsLoading(true);
    setProductError('');

    try {
      console.log(`🔍 Fetching products for ${folderName}/${objectName}`);
      const response = await fetch(
        `/api/products/individual?folder=${encodeURIComponent(folderName)}&object=${encodeURIComponent(objectName)}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success && data.products) {
        setProducts(data.products);
        console.log(`✅ Loaded ${data.products.length} products for ${folderName}/${objectName}`);
      } else {
        throw new Error(data.error || 'Failed to load products');
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      setProductError(
        `Błąd ładowania produktów: ${error instanceof Error ? error.message : 'Nieznany błąd'}`
      );
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  };

  const fetchProductImage = async (folderName: string, objectName: string, identifier: string) => {
    if (!folderName || !objectName || !identifier) return;

    try {
      setImageLoading(true);
      setImageError('');
      setProductImage('');

      // Build image path
      const selectedProductData = products.find(p => p.identifier === identifier);
      if (!selectedProductData) {
        throw new Error('Product data not found');
      }

      console.log('🔍 Fetching product image:');
      console.log('  - Folder:', folderName);
      console.log('  - Object:', objectName);
      console.log('  - Identifier:', identifier);
      console.log('  - Image URL:', selectedProductData.imageUrl);

      const response = await fetch(selectedProductData.imageUrl);
      console.log(`📊 Image response status: ${response.status}`);

      if (response.ok) {
        const blob = await response.blob();
        const imageUrl = URL.createObjectURL(blob);
        setProductImage(imageUrl);
        console.log('✅ Image loaded successfully');
      } else {
        const errorText = await response.text();
        console.error('❌ Image error:', response.status, errorText);
        setImageError(
          `Nie znaleziono obrazka dla ${folderName}/${objectName} - ${identifier} (status: ${response.status})`
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

  const runAutomaticOCR = async (imageUrl: string) => {
    console.log('🤖 Automatic OCR for image:', imageUrl);

    try {
      const result = await processImage(imageUrl, {
        useColorSegmentation: false,
        preprocessImage: true, // Use grayscale preprocessing
        tesseractPSM: '6',
        characterWhitelist: '0123456789',
      });

      console.log('✅ OCR detected projects:', result.projectNumbers);
      setOcrDetectedNumbers(result.projectNumbers);

      if (result.projectNumbers.length > 0) {
        const maxProject = Math.max(...result.projectNumbers);
        setMaxProjectsFromOCR(maxProject);
        console.log(`🎯 Max projects from OCR: ${maxProject}`);
      } else {
        console.log('⚠️ OCR detected no numbers, using default value 50');
        setMaxProjectsFromOCR(50);
      }
    } catch (error) {
      console.error('❌ Automatic OCR error:', error);
      setMaxProjectsFromOCR(50); // Fallback to default
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

  const handleFolderChange = (value: string) => {
    setSelectedFolder(value);
    setSelectedObject('');
    setSelectedProduct('');
  };

  const handleObjectChange = (value: string) => {
    setSelectedObject(value);
    setSelectedProduct('');
  };

  const handleProductChange = (value: string) => {
    setSelectedProduct(value);
  };

  const handleContinue = () => {
    const currentProjectSelection = getCurrentProjectSelection();
    if (selectedFolder && selectedObject && selectedProduct && currentProjectSelection) {
      const selectedProductData = products.find(p => p.identifier === selectedProduct);

      // Build customization description
      let customizationDescription = `Produkt: ${selectedProductData?.name || selectedProduct.replace(/_/g, ' ').toUpperCase()}`;

      if (currentProjectSelection.selectedProjects) {
        customizationDescription += `\nProjekty: ${currentProjectSelection.selectedProjects}`;
      }

      if (currentProjectSelection.projectQuantities) {
        customizationDescription += `\nIlości: ${currentProjectSelection.projectQuantities}`;
      }

      if (currentProjectSelection.totalQuantity) {
        customizationDescription += `\nŁącznie: ${currentProjectSelection.totalQuantity} szt.`;
      }

      const clientData: ClientData = {
        clientName: selectedFolder,
        clientCompany: selectedObject,
        customizationDescription,
        specialInstructions: currentProjectSelection.productionNotes,
        folderName: selectedFolder,
        objectName: selectedObject,
        productIdentifier: selectedProduct,
        selectedProjects: currentProjectSelection.selectedProjects,
        projectQuantities: currentProjectSelection.projectQuantities,
        totalQuantity: currentProjectSelection.totalQuantity,
        productionNotes: currentProjectSelection.productionNotes,
        // Dodaj dane o produkcie i cenie dla order-wizard
        selectedProductData: selectedProductData,
      };

      onClientDataComplete(clientData);
    }
  };

  // Prepare options for comboboxes
  const folderOptions: ComboboxOption<FolderInfo>[] = folders.map(folder => ({
    value: folder.folderName,
    label: folder.folderName,
    data: folder,
  }));

  const objectOptions: ComboboxOption<ObjectInfo>[] = objects.map(obj => ({
    value: obj.name,
    label: obj.name,
    data: obj,
  }));

  const productOptions: ComboboxOption<EnhancedIndividualProduct>[] = products.map(product => ({
    value: product.identifier,
    label: product.name,
    data: product,
  }));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center justify-center gap-2">
          <Users className="h-6 w-6 text-blue-600" />
          Klienci indywidualni
        </h1>
        <p className="text-gray-600 mt-2">
          {folders.length === 1 && selectedFolder
            ? `Folder: ${selectedFolder} • Wybierz obiekt i produkt`
            : 'Wybierz klienta, obiekt i produkt'}
        </p>
      </div>

      {/* Folder selection - only show if multiple folders */}
      {folders.length > 1 && (
        <div className="max-w-6xl mx-auto mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Wybierz folder</span>
                <span className="text-sm font-normal text-gray-500">
                  Masz dostęp do {folders.length} folderów
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Combobox<FolderInfo>
                value={selectedFolder}
                onChange={handleFolderChange}
                options={folderOptions}
                placeholder="Wybierz folder klienta..."
                searchPlaceholder="Wyszukaj folder..."
                emptyMessage="Brak przypisanych folderów"
                loading={loading}
                disabled={loading}
                label="Folder klienta"
                error={error || undefined}
              />
            </CardContent>
          </Card>
        </div>
      )}

      <div
        className={`grid grid-cols-1 ${folders.length === 1 ? 'lg:grid-cols-2' : 'lg:grid-cols-2'} gap-6 max-w-6xl mx-auto`}
      >
        {/* Object Selection */}
        <Card>
          <CardHeader>
            <CardTitle>
              {folders.length === 1 ? '1. Wybierz obiekt' : '2. Wybierz obiekt'}
            </CardTitle>
            <CardDescription>Hotel, atrakcja, miejsce</CardDescription>
          </CardHeader>
          <CardContent>
            <Combobox<ObjectInfo>
              value={selectedObject}
              onChange={handleObjectChange}
              options={objectOptions}
              placeholder="Wybierz obiekt..."
              searchPlaceholder="Wyszukaj obiekt..."
              emptyMessage="Brak obiektów"
              loading={objectsLoading}
              disabled={!selectedFolder || objectsLoading}
              label="Obiekt"
              error={!selectedFolder ? 'Najpierw wybierz klienta' : objectError || undefined}
            />
          </CardContent>
        </Card>

        {/* Product Selection */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  {folders.length === 1 ? '2. Wybierz produkt' : '3. Wybierz produkt'}
                </CardTitle>
                <CardDescription>Typ produktu do zamówienia</CardDescription>
              </div>
              {selectedFolder && selectedObject && (
                <Button
                  onClick={() => fetchProducts(selectedFolder, selectedObject)}
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
            <Combobox<EnhancedIndividualProduct>
              value={selectedProduct}
              onChange={handleProductChange}
              options={productOptions}
              placeholder="Wybierz produkt..."
              searchPlaceholder="Wyszukaj produkt..."
              emptyMessage="Brak produktów"
              loading={productsLoading}
              disabled={!selectedObject || productsLoading}
              label="Produkt"
              error={!selectedObject ? 'Najpierw wybierz obiekt' : productError || undefined}
            />

            {productError && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">⚠️ {productError}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Product Preview */}
      {selectedFolder && selectedObject && selectedProduct && (
        <Card className="max-w-6xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {selectedFolder} → {selectedObject} → {selectedProduct}
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

                <div className="space-y-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm">
                    <strong>Klient:</strong> {selectedFolder}
                  </p>
                  <p className="text-sm">
                    <strong>Obiekt:</strong> {selectedObject}
                  </p>
                  <p className="text-sm">
                    <strong>Produkt:</strong> {selectedProduct}
                  </p>

                  {!ocrProcessing && (
                    <div className="text-sm text-amber-700">
                      ⚠️ Bez obrazka używam domyślnej wartości: {maxProjectsFromOCR} projektów
                    </div>
                  )}
                </div>
              </div>
            )}

            {productImage && !imageLoading && (
              <div className="space-y-4">
                <div className="relative w-full bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                  <Image
                    src={productImage}
                    alt={`${selectedFolder} - ${selectedObject} - ${selectedProduct}`}
                    width={800}
                    height={600}
                    className="w-full h-auto object-contain max-h-96 md:max-h-[500px]"
                    priority
                    onError={() => {
                      console.error('🖼️ Image component failed to load:', productImage);
                      setImageError(`Błąd wyświetlania obrazka`);
                      setProductImage('');
                    }}
                  />
                </div>

                <div className="space-y-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm">
                    <strong>Klient:</strong> {selectedFolder}
                  </p>
                  <p className="text-sm">
                    <strong>Obiekt:</strong> {selectedObject}
                  </p>
                  <p className="text-sm">
                    <strong>Produkt:</strong> {selectedProduct}
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
                      <p className="text-xs">Maksymalna liczba projektów: {maxProjectsFromOCR}</p>
                    </div>
                  )}

                  {!ocrProcessing && ocrDetectedNumbers.length === 0 && !imageLoading && (
                    <div className="text-sm text-amber-700">
                      ⚠️ OCR nie wykrył numerów projektów (używam domyślnej wartości: 50)
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Project Selector */}
      {showProjectSelector && selectedFolder && selectedObject && selectedProduct && (
        <div className="max-w-6xl mx-auto">
          <ProjectSelector
            ref={projectSelectorRef}
            maxProjects={maxProjectsFromOCR}
            disabled={ocrProcessing}
            onValidationChange={setIsProjectSelectorValid}
          />
        </div>
      )}

      {/* Continue Button */}
      {selectedFolder && selectedObject && selectedProduct && (
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
