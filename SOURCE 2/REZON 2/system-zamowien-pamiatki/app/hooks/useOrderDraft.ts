'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

export interface OrderDraft {
  id: string;
  userId: string;
  clientType: 'PM' | 'KI' | 'IM' | 'HA' | 'OK';
  clientId?: string;
  locationName?: string;
  customClientData?: any;
  totalValue: number;
  status: 'draft' | 'active' | 'completed';
  sessionId?: string;
  notes?: string;
  items: OrderDraftItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderDraftItem {
  id: string;
  draftId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  customization?: string;
  projects?: string[];
  projectsDetails?: any;
  source: 'PM' | 'KI' | 'IM' | 'HA' | 'OK';
  sortOrder: number;
  product?: {
    id: string;
    identifier: string;
    index: string;
    description: string;
    price: number;
    category: string;
    imageUrl?: string;
  };
  isEditing?: boolean;
  originalValues?: Partial<OrderDraftItem>;
}

export const useOrderDraft = () => {
  const [draft, setDraft] = useState<OrderDraft | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generowanie session ID
  const sessionId = useCallback(() => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Załadowanie aktywnego draftu
  const loadActiveDraft = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/order-drafts');
      if (response.ok) {
        const data = await response.json();
        if (data) {
          // Konwersja stringów dat na obiekty Date
          data.createdAt = new Date(data.createdAt);
          data.updatedAt = new Date(data.updatedAt);
          if (data.items) {
            data.items.forEach((item: any) => {
              item.createdAt = new Date(item.createdAt);
              item.updatedAt = new Date(item.updatedAt);
              item.unitPrice = Number(item.unitPrice);
              item.totalPrice = Number(item.totalPrice);
            });
          }
          data.totalValue = Number(data.totalValue);

          setDraft(data);
          // Zapisz do sessionStorage jako backup
          sessionStorage.setItem('orderDraft', JSON.stringify(data));
        }
      } else if (response.status !== 404) {
        throw new Error('Failed to load draft');
      }
    } catch (err) {
      console.error('Error loading draft:', err);
      setError('Nie udało się załadować zamówienia');

      // Spróbuj odzyskać z sessionStorage
      const savedDraft = sessionStorage.getItem('orderDraft');
      if (savedDraft) {
        try {
          const parsedDraft = JSON.parse(savedDraft);
          // Konwersja stringów dat na obiekty Date
          parsedDraft.createdAt = new Date(parsedDraft.createdAt);
          parsedDraft.updatedAt = new Date(parsedDraft.updatedAt);
          if (parsedDraft.items) {
            parsedDraft.items.forEach((item: any) => {
              item.createdAt = new Date(item.createdAt);
              item.updatedAt = new Date(item.updatedAt);
            });
          }

          setDraft(parsedDraft);
          toast.warning('Przywrócono zamówienie z sesji lokalnej');
        } catch (parseError) {
          console.error('Error parsing saved draft:', parseError);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced zapis do bazy danych
  const debouncedSave = useCallback(async (draftData: OrderDraft) => {
    try {
      setIsSaving(true);

      const response = await fetch('/api/order-drafts', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(draftData),
      });

      if (!response.ok) {
        throw new Error('Failed to save draft');
      }

      const updatedDraft = await response.json();

      // Konwersja danych
      updatedDraft.createdAt = new Date(updatedDraft.createdAt);
      updatedDraft.updatedAt = new Date(updatedDraft.updatedAt);
      if (updatedDraft.items) {
        updatedDraft.items.forEach((item: any) => {
          item.createdAt = new Date(item.createdAt);
          item.updatedAt = new Date(item.updatedAt);
          item.unitPrice = Number(item.unitPrice);
          item.totalPrice = Number(item.totalPrice);
        });
      }
      updatedDraft.totalValue = Number(updatedDraft.totalValue);

      setDraft(updatedDraft);
      sessionStorage.setItem('orderDraft', JSON.stringify(updatedDraft));
    } catch (err) {
      console.error('Error saving draft:', err);
      toast.error('Błąd podczas zapisywania zamówienia');
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Utworzenie nowego draftu
  const createDraft = useCallback(
    async (draftData: Partial<OrderDraft>) => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/order-drafts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...draftData,
            sessionId: sessionId(),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create draft');
        }

        const newDraft = await response.json();

        // Konwersja danych
        newDraft.createdAt = new Date(newDraft.createdAt);
        newDraft.updatedAt = new Date(newDraft.updatedAt);
        newDraft.totalValue = Number(newDraft.totalValue);

        setDraft(newDraft);
        sessionStorage.setItem('orderDraft', JSON.stringify(newDraft));

        toast.success('Rozpoczęto nowe zamówienie');
        return newDraft;
      } catch (err) {
        console.error('Error creating draft:', err);
        setError(err instanceof Error ? err.message : 'Nie udało się utworzyć zamówienia');
        toast.error('Błąd podczas tworzenia zamówienia');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId]
  );

  // Dodanie pozycji do zamówienia
  const addItem = useCallback(
    async (
      itemData: Omit<
        OrderDraftItem,
        'id' | 'draftId' | 'totalPrice' | 'sortOrder' | 'createdAt' | 'updatedAt'
      >
    ) => {
      if (!draft) {
        throw new Error('No active draft');
      }

      try {
        const totalPrice = itemData.quantity * itemData.unitPrice;

        const response = await fetch('/api/order-drafts/items', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...itemData,
            draftId: draft.id,
            totalPrice,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to add item');
        }

        const newItem = await response.json();

        // Konwersja danych
        newItem.createdAt = new Date(newItem.createdAt);
        newItem.updatedAt = new Date(newItem.updatedAt);
        newItem.unitPrice = Number(newItem.unitPrice);
        newItem.totalPrice = Number(newItem.totalPrice);

        const updatedDraft = {
          ...draft,
          items: [...draft.items, newItem],
          totalValue: draft.totalValue + totalPrice,
        };

        setDraft(updatedDraft);
        sessionStorage.setItem('orderDraft', JSON.stringify(updatedDraft));

        toast.success('Dodano pozycję do zamówienia');
        return newItem;
      } catch (err) {
        console.error('Error adding item:', err);
        toast.error('Błąd podczas dodawania pozycji');
        throw err;
      }
    },
    [draft]
  );

  // Aktualizacja pozycji
  const updateItem = useCallback(
    async (itemId: string, updates: Partial<OrderDraftItem>) => {
      if (!draft) return;

      try {
        const itemIndex = draft.items.findIndex(item => item.id === itemId);
        if (itemIndex === -1) return;

        const currentItem = draft.items[itemIndex];
        const updatedItem = { ...currentItem, ...updates };

        // Przelicz totalPrice jeśli zmieniono quantity lub unitPrice
        if (updates.quantity !== undefined || updates.unitPrice !== undefined) {
          updatedItem.totalPrice = updatedItem.quantity * updatedItem.unitPrice;
        }

        const response = await fetch(`/api/order-drafts/items/${itemId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          throw new Error('Failed to update item');
        }

        const responseItem = await response.json();

        // Konwersja danych
        responseItem.unitPrice = Number(responseItem.unitPrice);
        responseItem.totalPrice = Number(responseItem.totalPrice);

        const newItems = [...draft.items];
        newItems[itemIndex] = responseItem;

        const newTotalValue = newItems.reduce((sum, item) => sum + item.totalPrice, 0);

        const updatedDraft = {
          ...draft,
          items: newItems,
          totalValue: newTotalValue,
        };

        setDraft(updatedDraft);
        sessionStorage.setItem('orderDraft', JSON.stringify(updatedDraft));
      } catch (err) {
        console.error('Error updating item:', err);
        toast.error('Błąd podczas aktualizacji pozycji');
      }
    },
    [draft]
  );

  // Usunięcie pozycji
  const removeItem = useCallback(
    async (itemId: string) => {
      if (!draft) return;

      try {
        const response = await fetch(`/api/order-drafts/items/${itemId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Failed to remove item');
        }

        const newItems = draft.items.filter(item => item.id !== itemId);
        const newTotalValue = newItems.reduce((sum, item) => sum + item.totalPrice, 0);

        const updatedDraft = {
          ...draft,
          items: newItems,
          totalValue: newTotalValue,
        };

        setDraft(updatedDraft);
        sessionStorage.setItem('orderDraft', JSON.stringify(updatedDraft));

        toast.success('Usunięto pozycję z zamówienia');
      } catch (err) {
        console.error('Error removing item:', err);
        toast.error('Błąd podczas usuwania pozycji');
      }
    },
    [draft]
  );

  // Finalizacja zamówienia
  const completeDraft = useCallback(async () => {
    if (!draft || draft.items.length === 0) {
      toast.error('Zamówienie jest puste');
      return;
    }

    try {
      setIsLoading(true);

      const response = await fetch('/api/order-drafts/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          draftId: draft.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to complete order');
      }

      const result = await response.json();

      // Wyczyść draft z pamięci
      setDraft(null);
      sessionStorage.removeItem('orderDraft');

      toast.success('Zamówienie zostało złożone pomyślnie');

      return result;
    } catch (err) {
      console.error('Error completing draft:', err);
      toast.error('Błąd podczas składania zamówienia');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [draft]);

  // Anulowanie draftu
  const cancelDraft = useCallback(async () => {
    if (!draft) return;

    try {
      const response = await fetch(`/api/order-drafts?id=${draft.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to cancel draft');
      }

      setDraft(null);
      sessionStorage.removeItem('orderDraft');

      toast.success('Zamówienie zostało anulowane');
    } catch (err) {
      console.error('Error canceling draft:', err);
      toast.error('Błąd podczas anulowania zamówienia');
    }
  }, [draft]);

  // Ładowanie draftu przy inicjalizacji
  useEffect(() => {
    loadActiveDraft();
  }, [loadActiveDraft]);

  return {
    draft,
    isLoading,
    isSaving,
    error,
    createDraft,
    addItem,
    updateItem,
    removeItem,
    completeDraft,
    cancelDraft,
    loadActiveDraft,
  };
};
