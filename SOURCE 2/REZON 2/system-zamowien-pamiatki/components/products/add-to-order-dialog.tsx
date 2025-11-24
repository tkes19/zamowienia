'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Product, ProductSource } from '@/lib/types';
// import { useOrderStore } from '@/lib/cart';
import { Package } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';

interface AddToOrderDialogProps {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCustomization?: string;
  source?: ProductSource;
  locationName?: string;
  projectName?: string;
  // Nowe props dla systemu projektów
  selectedProjects?: string;
  projectQuantities?: string;
  totalQuantity?: number;
  productionNotes?: string;
}

export function AddToOrderDialog({
  product,
  open,
  onOpenChange,
  initialCustomization,
  source = 'MIEJSCOWOSCI',
  locationName,
  projectName,
  selectedProjects,
  projectQuantities,
  totalQuantity,
  productionNotes,
}: AddToOrderDialogProps) {
  const [customization, setCustomization] = useState(initialCustomization || '');
  const [selectedProj, setSelectedProj] = useState(selectedProjects || '');
  const [projectsQuantity, setProjectsQuantity] = useState(projectQuantities || '');
  const [prodNotes, setProdNotes] = useState(productionNotes || '');

  // Oblicz automatycznie łączną ilość na podstawie projektów
  const calculateTotalQuantity = () => {
    if (!projectsQuantity) return 0;

    const quantities = projectsQuantity.split(',').map(q => {
      const parsed = parseInt(q.trim());
      return isNaN(parsed) ? 0 : parsed;
    });

    return quantities.reduce((sum, q) => sum + q, 0);
  };

  // Funkcje do zarządzania zamówieniem w localStorage (spójne z OrderWizard)
  const getCurrentOrder = () => {
    try {
      const saved = localStorage.getItem('currentOrder');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  };

  const saveCurrentOrder = (order: any) => {
    localStorage.setItem('currentOrder', JSON.stringify(order));
    window.dispatchEvent(new CustomEvent('currentOrderChanged'));
  };

  // Funkcja zapobiegająca przeładowaniu strony przy naciskaniu Enter
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  };

  // Aktualizuj customization gdy się zmienia initialCustomization
  useEffect(() => {
    if (initialCustomization) {
      setCustomization(initialCustomization);
    }
  }, [initialCustomization]);

  const handleAddToOrder = () => {
    const calculatedTotalQuantity = calculateTotalQuantity();
    const quantity = calculatedTotalQuantity || 1;

    // Stwórz nowy item zamówienia w formacie spójnym z OrderWizard
    const newItem = {
      id: `${Date.now()}_${Math.random()}`,
      component: 'MIEJSCOWOŚCI' as const, // Domyślnie miejscowości dla katalogu
      product: {
        id: product.id,
        identifier: product.identifier,
        index: product.index || '',
        description: product.description || '',
        price: product.price,
        imageUrl: product.imageUrl,
        category: product.category,
        productionPath: product.productionPath || '',
        isActive: product.isActive,
        new: product.new || false,
      },
      customization: customization || '',
      locationData: locationName
        ? {
            locationName,
            productIdentifier: product.identifier,
            projectNumber: projectName,
            selectedProjects: selectedProj,
            projectQuantities: projectsQuantity,
            totalQuantity: quantity,
            productionNotes: prodNotes,
          }
        : undefined,
      clientData: undefined,
      quantity,
      totalPrice: product.price * quantity,
    };

    // Pobierz obecne zamówienie lub stwórz nowe
    const currentOrder = getCurrentOrder() || {
      items: [],
      selectedCustomer: '',
      lastUpdated: new Date().toISOString(),
    };

    // Dodaj nowy item
    const updatedOrder = {
      ...currentOrder,
      items: [...currentOrder.items, newItem],
      lastUpdated: new Date().toISOString(),
    };

    // Zapisz do localStorage
    saveCurrentOrder(updatedOrder);

    toast.success('Produkt dodany do zamówienia!');
    onOpenChange(false);
    setCustomization('');
    setSelectedProj('');
    setProjectsQuantity('');
    setProdNotes('');
  };

  // Określ które kategorie wymagają personalizacji
  const categoriesRequiringCustomization = ['MAGNESY', 'BRELOKI', 'DLUGOPISY', 'TEKSTYLIA'];
  const needsCustomization = categoriesRequiringCustomization.includes(product.category);

  const getCustomizationLabel = () => {
    switch (product.category) {
      case 'MAGNESY':
        return 'Nazwa miejscowości';
      case 'BRELOKI':
        return 'Opis personalizacji';
      case 'DLUGOPISY':
        return 'Imię lub hasło';
      case 'TEKSTYLIA':
        return 'Tekst do nadruku';
      default:
        return 'Personalizacja';
    }
  };

  const getCustomizationPlaceholder = () => {
    switch (product.category) {
      case 'MAGNESY':
        return 'np. Kraków, Zakopane, Gdańsk...';
      case 'BRELOKI':
        return 'Opisz jak ma wyglądać personalizacja...';
      case 'DLUGOPISY':
        return 'np. Anna, Marek, "Najlepszy tata"...';
      case 'TEKSTYLIA':
        return 'np. "Najlepszy papa", "Team 2024"...';
      default:
        return 'Dodaj personalizację...';
    }
  };

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

  // Konwersja identyfikatora produktu na format pliku (spacje -> podkreślniki, małe litery)
  const convertIdentifierToFileFormat = (identifier: string): string => {
    return (
      identifier
        .toLowerCase()
        .replace(/\s+/g, '_')
        // Obsługa polskich znaków
        .replace(/koło/g, 'kolo')
        .replace(/krąg/g, 'kreg')
        .replace(/trzyma/g, 'trzma')
    );
  };

  // URL zdjęcia z projektami z CloudFlare R2 - poprawiona logika
  const projectImageUrl =
    locationName && product.identifier
      ? (() => {
          const filePrefix = getLocationFilePrefix(locationName);
          const identifierForFile = convertIdentifierToFileFormat(product.identifier);
          const imagePath = `PROJEKTY MIEJSCOWOŚCI/${locationName}/${filePrefix}_${identifierForFile}.jpg`;

          // Kodowanie każdej części ścieżki osobno, zachowując ukośniki
          const pathParts = imagePath.split('/');
          const encodedPath = pathParts.map(part => encodeURIComponent(part)).join('/');

          return `/api/r2/file/${encodedPath}`;
        })()
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Dodaj do zamówienia</DialogTitle>
          <DialogDescription>
            {product.identifier} [{product.index}] - {product.price.toFixed(2)} zł
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Zdjęcie z projektami z R2 */}
          {projectImageUrl && (
            <div className="space-y-2">
              <Label>Dostępne projekty</Label>
              <div className="relative w-full h-64 bg-gray-100 rounded-lg overflow-hidden">
                <Image
                  src={projectImageUrl}
                  alt={`Projekty dla ${product.identifier} - ${locationName}`}
                  fill
                  className="object-contain"
                  onError={e => {
                    // Ukryj obrazek jeśli się nie załaduje
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            </div>
          )}

          {/* Wybór projektów */}
          <div className="space-y-2">
            <Label htmlFor="selectedProjects">Wybrane projekty</Label>
            <Input
              id="selectedProjects"
              value={selectedProj}
              onChange={e => setSelectedProj(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="np. 1,2,3,4,5 lub 1-5"
              className="font-mono"
            />
            <p className="text-xs text-gray-500">
              Wpisz numery projektów oddzielone przecinkami (np. 1,2,3,4,5) lub jako zakres (np.
              1-5)
            </p>
          </div>

          {/* Ilość na projekt */}
          <div className="space-y-2">
            <Label htmlFor="projectQuantities">Ilość na projekt</Label>
            <Input
              id="projectQuantities"
              value={projectsQuantity}
              onChange={e => setProjectsQuantity(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="np. 40,40,40,40,40 lub po 40"
            />
            <p className="text-xs text-gray-500">Podaj ilości dla każdego projektu</p>
          </div>

          {/* Automatyczne obliczanie łącznej ilości na podstawie projektów */}
          {projectsQuantity && (
            <div className="space-y-2">
              <Label>Łączna ilość (obliczona automatycznie)</Label>
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-lg font-bold text-blue-600">
                  {calculateTotalQuantity()} sztuk
                </div>
                <div className="text-sm text-gray-600">Na podstawie podanych ilości projektów</div>
              </div>
            </div>
          )}

          {needsCustomization && (
            <div className="space-y-2">
              <Label htmlFor="customization">{getCustomizationLabel()}</Label>
              <Input
                id="customization"
                value={customization}
                onChange={e => setCustomization(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={getCustomizationPlaceholder()}
              />
              {product.category === 'MAGNESY' && (
                <p className="text-xs text-gray-500">
                  Wprowadź nazwę miejscowości, którą chcesz umieścić na produkcie
                </p>
              )}
            </div>
          )}

          {/* Uwagi produkcyjne */}
          <div className="space-y-2">
            <Label htmlFor="productionNotes">Uwagi produkcyjne (opcjonalne)</Label>
            <Input
              id="productionNotes"
              value={prodNotes}
              onChange={e => setProdNotes(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Dodatkowe informacje dla produkcji..."
            />
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="font-medium">Razem:</span>
              <span className="text-xl font-bold text-blue-600">
                {(product.price * (calculateTotalQuantity() || 1)).toFixed(2)} zł
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex space-x-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button onClick={handleAddToOrder} className="flex items-center space-x-2">
            <Package className="h-4 w-4" />
            <span>Dodaj do zamówienia</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
