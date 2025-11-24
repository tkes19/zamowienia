'use client';

import { useState } from 'react';
import { useOrderDraft } from '@/hooks/useOrderDraft';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Edit2, Check, X, Trash2, ShoppingCart, Package } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';

interface EditableCellProps {
  value: string | number;
  type?: 'text' | 'number' | 'textarea';
  onSave: (value: string | number) => void;
  onCancel: () => void;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  placeholder?: string;
}

const EditableCell: React.FC<EditableCellProps> = ({
  value,
  type = 'text',
  onSave,
  onCancel,
  isEditing,
  setIsEditing,
  disabled = false,
  min,
  max,
  placeholder,
}) => {
  const [currentValue, setCurrentValue] = useState(value);

  const handleSave = () => {
    if (type === 'number') {
      const numValue = Number(currentValue);
      if (min !== undefined && numValue < min) {
        toast.error(`Wartość nie może być mniejsza niż ${min}`);
        return;
      }
      if (max !== undefined && numValue > max) {
        toast.error(`Wartość nie może być większa niż ${max}`);
        return;
      }
    }

    onSave(currentValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setCurrentValue(value);
    setIsEditing(false);
    onCancel();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && type !== 'textarea') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (!isEditing) {
    return (
      <div
        className={`cursor-pointer hover:bg-muted p-2 rounded transition-colors min-h-[40px] flex items-center ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
        onClick={() => !disabled && setIsEditing(true)}
        title={disabled ? 'Pole nie może być edytowane' : 'Kliknij aby edytować'}
      >
        {type === 'number'
          ? value !== null && value !== undefined
            ? Number(value).toFixed(2)
            : '0.00'
          : value || placeholder || 'Brak danych'}
        {!disabled && (
          <Edit2 className="h-3 w-3 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
    );
  }

  const InputComponent = type === 'textarea' ? Textarea : Input;

  return (
    <div className="flex items-center gap-1">
      <InputComponent
        type={type === 'number' ? 'number' : 'text'}
        value={currentValue}
        onChange={e => setCurrentValue(e.target.value)}
        onKeyDown={handleKeyPress}
        className="h-8 text-sm"
        min={min}
        max={max}
        placeholder={placeholder}
        autoFocus
      />
      <Button
        size="sm"
        variant="ghost"
        className="h-8 w-8 p-0"
        onClick={handleSave}
        title="Zapisz zmiany"
      >
        <Check className="h-3 w-3 text-green-600" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-8 w-8 p-0"
        onClick={handleCancel}
        title="Anuluj zmiany"
      >
        <X className="h-3 w-3 text-red-600" />
      </Button>
    </div>
  );
};

export const EditableOrderTable = () => {
  const { draft, updateItem, removeItem } = useOrderDraft();
  const [editingItems, setEditingItems] = useState<Record<string, string>>({});

  if (!draft || draft.items.length === 0) {
    return (
      <Card className="p-8">
        <div className="text-center text-muted-foreground">
          <ShoppingCart className="h-16 w-16 mx-auto mb-4 opacity-30" />
          <h3 className="text-lg font-medium mb-2">Brak pozycji w zamówieniu</h3>
          <p className="text-sm">
            Dodaj produkty z dostępnych modułów:{' '}
            <span className="font-medium">PM, KI, IM, HA, OK</span>
          </p>
        </div>
      </Card>
    );
  }

  const setItemEditing = (itemId: string, field: string, editing: boolean) => {
    const key = `${itemId}-${field}`;
    setEditingItems(prev => {
      if (editing) {
        return { ...prev, [key]: field };
      } else {
        const { [key]: removed, ...rest } = prev;
        return rest;
      }
    });
  };

  const isFieldEditing = (itemId: string, field: string) => {
    return editingItems[`${itemId}-${field}`] !== undefined;
  };

  const getSourceBadge = (source: string) => {
    const sourceConfig = {
      PM: { label: 'PM', variant: 'default' as const, title: 'Projekty Miejscowości' },
      KI: { label: 'KI', variant: 'secondary' as const, title: 'Klienci Indywidualni' },
      IM: { label: 'Im', variant: 'outline' as const, title: 'Imienne' },
      HA: { label: 'H', variant: 'destructive' as const, title: 'Hasła' },
      OK: { label: 'Ok', variant: 'default' as const, title: 'Okolicznościowe' },
    };

    const config = sourceConfig[source as keyof typeof sourceConfig] || {
      label: source,
      variant: 'outline' as const,
      title: source,
    };

    return (
      <Badge variant={config.variant} className="text-xs" title={config.title}>
        {config.label}
      </Badge>
    );
  };

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-16">Źródło</TableHead>
              <TableHead className="min-w-[200px]">Produkt</TableHead>
              <TableHead className="min-w-[150px]">Personalizacja</TableHead>
              <TableHead className="w-24">Ilość</TableHead>
              <TableHead className="w-28">Cena jedn.</TableHead>
              <TableHead className="w-28">Razem</TableHead>
              <TableHead className="w-20">Akcje</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {draft.items.map((item, index) => (
              <TableRow key={item.id} className="group hover:bg-muted/25 transition-colors">
                <TableCell>{getSourceBadge(item.source)}</TableCell>

                <TableCell>
                  <div className="flex items-start gap-3">
                    {item.product?.imageUrl && (
                      <div className="relative w-10 h-10 rounded-md overflow-hidden bg-muted flex-shrink-0">
                        <Image
                          src={item.product.imageUrl}
                          alt={item.product.identifier || 'Produkt'}
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm">
                        {item.product?.identifier || 'Nieznany produkt'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Index: {item.product?.index || 'N/A'}
                      </div>
                      {item.projects && item.projects.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          Projekty: {item.projects.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>

                <TableCell>
                  <EditableCell
                    value={item.customization || ''}
                    type="textarea"
                    placeholder="Dodaj personalizację..."
                    onSave={value => updateItem(item.id, { customization: String(value) })}
                    onCancel={() => {}}
                    isEditing={isFieldEditing(item.id, 'customization')}
                    setIsEditing={editing => setItemEditing(item.id, 'customization', editing)}
                  />
                </TableCell>

                <TableCell>
                  <EditableCell
                    value={item.quantity}
                    type="number"
                    min={1}
                    max={9999}
                    onSave={value => updateItem(item.id, { quantity: Number(value) })}
                    onCancel={() => {}}
                    isEditing={isFieldEditing(item.id, 'quantity')}
                    setIsEditing={editing => setItemEditing(item.id, 'quantity', editing)}
                  />
                </TableCell>

                <TableCell>
                  <div className="text-sm text-right">{item.unitPrice.toFixed(2)} zł</div>
                </TableCell>

                <TableCell>
                  <div className="font-medium text-sm text-right">
                    {item.totalPrice.toFixed(2)} zł
                  </div>
                </TableCell>

                <TableCell>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => removeItem(item.id)}
                    title="Usuń pozycję"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}

            {/* Wiersz podsumowania */}
            <TableRow className="bg-muted/50 font-medium border-t-2">
              <TableCell colSpan={5} className="text-right">
                <div className="flex justify-between">
                  <span>Pozycji: {draft.items.length}</span>
                  <span>Wartość całkowita:</span>
                </div>
              </TableCell>
              <TableCell className="font-bold text-lg">{draft.totalValue.toFixed(2)} zł</TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};
