'use client';

import { useState } from 'react';
import { useOrderDraft } from '@/hooks/useOrderDraft';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, ShoppingCart, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Product {
  id: string;
  identifier: string;
  index: string;
  description?: string;
  price: number;
  category: string;
  imageUrl?: string;
}

interface QuickAddToOrderProps {
  product: Product;
  source: 'PM' | 'KI' | 'IM' | 'HA' | 'OK';
  locationName?: string;
  className?: string;
}

export const QuickAddToOrder: React.FC<QuickAddToOrderProps> = ({
  product,
  source,
  locationName,
  className,
}) => {
  const { draft, addItem, createDraft } = useOrderDraft();
  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [customization, setCustomization] = useState('');
  const [projects, setProjects] = useState('');

  const handleAddToOrder = async () => {
    try {
      setIsAdding(true);

      // Jeśli nie ma aktywnego draftu, stwórz nowy
      let activeDraft = draft;
      if (!activeDraft) {
        activeDraft = await createDraft({
          clientType: source,
          locationName: locationName,
          status: 'active',
        });
      }

      // Przetwórz projekty na array
      const projectsArray = projects.trim()
        ? projects
            .split(',')
            .map(p => p.trim())
            .filter(p => p)
        : [];

      await addItem({
        productId: product.id,
        quantity,
        unitPrice: product.price,
        customization: customization.trim() || undefined,
        projects: projectsArray,
        projectsDetails:
          projectsArray.length > 0
            ? {
                list: projectsArray,
                description: projects.trim(),
              }
            : null,
        source,
      });

      setIsOpen(false);
      setQuantity(1);
      setCustomization('');
      setProjects('');

      toast.success(`Dodano ${product.identifier} do zamówienia`);
    } catch (error) {
      console.error('Error adding item to order:', error);
      toast.error('Błąd podczas dodawania do zamówienia');
    } finally {
      setIsAdding(false);
    }
  };

  const getSourceBadge = (source: string) => {
    const config = {
      PM: { label: 'PM', variant: 'default' as const },
      KI: { label: 'KI', variant: 'secondary' as const },
      IM: { label: 'Im', variant: 'outline' as const },
      HA: { label: 'H', variant: 'destructive' as const },
      OK: { label: 'Ok', variant: 'default' as const },
    };
    return config[source as keyof typeof config] || { label: source, variant: 'outline' as const };
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className={className} title="Dodaj do bieżącego zamówienia">
          <Plus className="h-4 w-4 mr-1" />
          Dodaj do zamówienia
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Dodaj do zamówienia
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Informacje o produkcie */}
          <Card className="p-3 bg-muted/50">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">{product.identifier}</span>
              <Badge variant={getSourceBadge(source).variant}>{getSourceBadge(source).label}</Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              Index: {product.index} | Cena: {product.price.toFixed(2)} zł
            </div>
            {locationName && (
              <div className="text-sm text-muted-foreground mt-1">
                {source === 'PM' ? 'Miejscowość' : 'Folder'}: {locationName}
              </div>
            )}
          </Card>

          {/* Formularz */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quantity">Ilość</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                max="9999"
                value={quantity}
                onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
            <div>
              <Label>Wartość</Label>
              <div className="h-9 px-3 py-2 bg-muted rounded-md text-sm">
                {(quantity * product.price).toFixed(2)} zł
              </div>
            </div>
          </div>

          {source === 'PM' && (
            <div>
              <Label htmlFor="projects">Projekty (oddzielone przecinkami)</Label>
              <Input
                id="projects"
                placeholder="np. 1, 2, 3, 4, 5"
                value={projects}
                onChange={e => setProjects(e.target.value)}
              />
              <div className="text-xs text-muted-foreground mt-1">Przykład: 1, 2, 3 lub 1-5</div>
            </div>
          )}

          <div>
            <Label htmlFor="customization">Personalizacja</Label>
            <Textarea
              id="customization"
              placeholder="Dodatkowe uwagi, personalizacja..."
              value={customization}
              onChange={e => setCustomization(e.target.value)}
              rows={3}
            />
          </div>

          {/* Status bieżącego zamówienia */}
          {draft && (
            <Card className="p-3 bg-blue-50 border-blue-200">
              <div className="text-sm">
                <div className="font-medium text-blue-900">
                  Bieżące zamówienie: {draft.items.length} pozycji
                </div>
                <div className="text-blue-700">Wartość: {draft.totalValue.toFixed(2)} zł</div>
              </div>
            </Card>
          )}

          {/* Przyciski */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isAdding}>
              Anuluj
            </Button>
            <Button onClick={handleAddToOrder} disabled={isAdding || quantity < 1}>
              {isAdding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Dodaj do zamówienia
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
