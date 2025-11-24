'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useOrderDraft, OrderDraft } from '@/hooks/useOrderDraft';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { ShoppingCart, ArrowRight, X } from 'lucide-react';

interface OrderDraftContextType {
  draft: OrderDraft | null;
  isLoading: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  createDraft: (data: Partial<OrderDraft>) => Promise<OrderDraft>;
  completeDraft: () => Promise<any>;
  showResumeNotification: boolean;
  dismissResumeNotification: () => void;
}

const OrderDraftContext = createContext<OrderDraftContextType | null>(null);

export const useOrderDraftContext = () => {
  const context = useContext(OrderDraftContext);
  if (!context) {
    throw new Error('useOrderDraftContext must be used within OrderDraftProvider');
  }
  return context;
};

const ResumeOrderNotification: React.FC<{
  draft: OrderDraft;
  onResume: () => void;
  onDismiss: () => void;
}> = ({ draft, onResume, onDismiss }) => {
  return (
    <Card className="border-orange-200 bg-orange-50 mb-6">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <ShoppingCart className="h-5 w-5 text-orange-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-orange-900 mb-1">Masz niezakończone zamówienie</h3>
              <p className="text-sm text-orange-700 mb-3">
                Zamówienie ma {draft.items.length} pozycji o wartości {draft.totalValue.toFixed(2)}{' '}
                zł
                {draft.locationName && (
                  <span className="ml-2">
                    ({draft.clientType === 'PM' ? 'Miejscowość' : 'Folder'}: {draft.locationName})
                  </span>
                )}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={onResume}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  <ArrowRight className="h-4 w-4 mr-1" />
                  Wznów zamówienie
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onDismiss}
                  className="border-orange-300 text-orange-700 hover:bg-orange-100"
                >
                  Ukryj powiadomienie
                </Button>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="text-orange-600 hover:text-orange-700 hover:bg-orange-100"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
};

export const OrderDraftProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const orderDraft = useOrderDraft();
  const [showResumeNotification, setShowResumeNotification] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [notificationDismissed, setNotificationDismissed] = useState(false);
  const router = useRouter();

  // Sprawdzenie czy pokazać notyfikację o wznawianiu
  useEffect(() => {
    if (
      orderDraft.draft &&
      orderDraft.draft.items.length > 0 &&
      !notificationDismissed &&
      !orderDraft.isLoading
    ) {
      const lastVisit = localStorage.getItem('lastOrderDraftVisit');
      const draftUpdated = new Date(orderDraft.draft.updatedAt).getTime();

      if (!lastVisit || draftUpdated > parseInt(lastVisit)) {
        setShowResumeNotification(true);
      }
    }
  }, [orderDraft.draft, orderDraft.isLoading, notificationDismissed]);

  // Śledzenie niezapisanych zmian
  useEffect(() => {
    setHasUnsavedChanges(orderDraft.isSaving);
  }, [orderDraft.isSaving]);

  // Ostrzeżenie przed opuszczeniem strony
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'Masz niezapisane zmiany w zamówieniu. Czy na pewno chcesz opuścić stronę?';
      }
    };

    const handleRouteChange = () => {
      if (hasUnsavedChanges) {
        return confirm('Masz niezapisane zmiany w zamówieniu. Czy na pewno chcesz opuścić stronę?');
      }
      return true;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  const dismissResumeNotification = () => {
    setShowResumeNotification(false);
    setNotificationDismissed(true);
    localStorage.setItem('lastOrderDraftVisit', Date.now().toString());
  };

  const resumeOrder = () => {
    setShowResumeNotification(false);
    setNotificationDismissed(true);
    localStorage.setItem('lastOrderDraftVisit', Date.now().toString());

    // Przejście do strony zamówień lub wyświetlenie tabeli
    router.push('/nowe-zamowienie');

    toast.success('Wznowiono zamówienie');
  };

  const handleCompleteDraft = async () => {
    try {
      const result = await orderDraft.completeDraft();

      if (result?.orderId) {
        toast.success(
          <div className="flex flex-col gap-2">
            <p className="font-medium">Zamówienie zostało złożone!</p>
            <p className="text-sm text-muted-foreground">Numer: {result.orderNumber}</p>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => router.push(`/zamowienia/${result.orderId}`)}
              className="self-start"
            >
              Zobacz szczegóły
            </Button>
          </div>,
          { duration: 10000 }
        );

        // Przekierowanie na stronę zamówień po 2 sekundach
        setTimeout(() => {
          router.push('/zamowienia');
        }, 2000);
      }

      return result;
    } catch (error) {
      console.error('Error completing draft:', error);
      throw error;
    }
  };

  return (
    <OrderDraftContext.Provider
      value={{
        draft: orderDraft.draft,
        isLoading: orderDraft.isLoading,
        isSaving: orderDraft.isSaving,
        hasUnsavedChanges,
        createDraft: orderDraft.createDraft,
        completeDraft: handleCompleteDraft,
        showResumeNotification,
        dismissResumeNotification,
      }}
    >
      {/* Powiadomienie o wznowieniu zamówienia */}
      {showResumeNotification && orderDraft.draft && (
        <div className="container mx-auto px-4 py-4">
          <ResumeOrderNotification
            draft={orderDraft.draft}
            onResume={resumeOrder}
            onDismiss={dismissResumeNotification}
          />
        </div>
      )}

      {children}
    </OrderDraftContext.Provider>
  );
};
