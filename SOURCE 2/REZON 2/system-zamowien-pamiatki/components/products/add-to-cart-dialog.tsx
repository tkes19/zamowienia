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
import { Product, ProductSource } from '@/lib/types';
import { useOrderStore } from '@/lib/cart';
import { ShoppingCart, Plus, Minus } from 'lucide-react';
import { toast } from 'sonner';

interface AddToCartDialogProps {
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

export function AddToCartDialog({
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
}: AddToCartDialogProps) {
  const [quantity, setQuantity] = useState(1);
  const [customization, setCustomization] = useState(initialCustomization || '');
  const addItemToActiveOrder = useOrderStore(state => state.addItemToActiveOrder);

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

  const handleAddToCart = () => {
    addItemToActiveOrder({
      productId: product.id,
      quantity,
      customization: customization || undefined,
      source,
      locationName,
      projectName,
      // Nowe pola dla systemu projektów
      selectedProjects,
      projectQuantities,
      totalQuantity,
      productionNotes,
      product,
    });

    toast.success('Produkt dodany do zamówienia!');
    onOpenChange(false);
    setQuantity(1);
    setCustomization('');
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dodaj do koszyka</DialogTitle>
          <DialogDescription>
            {product.identifier} [{product.index}] - {product.price.toFixed(2)} zł
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quantity">Ilość</Label>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                onKeyDown={handleKeyDown}
                className="text-center w-20"
              />
              <Button variant="outline" size="icon" onClick={() => setQuantity(quantity + 1)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

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

          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="font-medium">Razem:</span>
              <span className="text-xl font-bold text-blue-600">
                {(product.price * quantity).toFixed(2)} zł
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex space-x-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button onClick={handleAddToCart} className="flex items-center space-x-2">
            <ShoppingCart className="h-4 w-4" />
            <span>Dodaj do koszyka</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
