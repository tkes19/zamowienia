import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CartItem } from './types';

// Dodajemy nowe typy dla systemu zamówień
interface OrderItem extends CartItem {
  id: string;
}

interface SavedOrder {
  id: string;
  orderNumber: string;
  items: OrderItem[];
  selectedCustomerId: string | null;
  createdAt: Date;
  isFavorite: boolean;
  favoriteName?: string; // Nazwa dla ulubionych
  totalPrice: number;
  totalItems: number;
}

interface OrderStore {
  // Aktywne zamówienie
  activeOrder: SavedOrder | null;
  // Zapisane zamówienia
  savedOrders: SavedOrder[];

  // Zarządzanie aktywnym zamówieniem
  createNewOrder: () => Promise<void>;
  setActiveOrder: (order: SavedOrder | null) => void;
  addItemToActiveOrder: (item: CartItem) => void;
  removeItemFromActiveOrder: (itemId: string) => void;
  updateItemInActiveOrder: (itemId: string, updates: Partial<CartItem>) => void;
  setCustomerForActiveOrder: (customerId: string | null) => void;
  clearActiveOrder: () => void;

  // Zarządzanie zapisanymi zamówieniami
  saveActiveOrder: (favoriteName?: string) => void;
  loadSavedOrder: (orderId: string) => void;
  copySavedOrder: (orderId: string) => void;
  deleteSavedOrder: (orderId: string) => void;
  toggleOrderFavorite: (orderId: string, favoriteName?: string) => void;

  // Pomocnicze funkcje
  getTotalPrice: () => number;
  getTotalItems: () => number;
  getGroupedItems: () => Record<string, OrderItem[]>;
  clearTemporaryOrders: () => void;
}

export const useOrderStore = create<OrderStore>()(
  persist(
    (set, get) => ({
      activeOrder: null,
      savedOrders: [],

      createNewOrder: async () => {
        try {
          // Tworzymy zamówienie bezpośrednio w bazie z prawidłowym numerem
          const response = await fetch('/api/orders/create-draft', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            throw new Error('Nie udało się utworzyć zamówienia');
          }

          const draftOrder = await response.json();

          const newOrder: SavedOrder = {
            id: draftOrder.id,
            orderNumber: draftOrder.orderNumber,
            items: [],
            selectedCustomerId: null,
            createdAt: new Date(draftOrder.createdAt),
            isFavorite: false,
            totalPrice: 0,
            totalItems: 0,
          };

          set({ activeOrder: newOrder });
        } catch (error) {
          console.error('Error creating new order:', error);
          // Nie tworzymy fallback zamówienia - użytkownik musi spróbować ponownie
          throw new Error('Nie udało się utworzyć zamówienia. Spróbuj ponownie.');
        }
      },

      setActiveOrder: order => {
        set({ activeOrder: order });
      },

      addItemToActiveOrder: newItem => {
        const { activeOrder } = get();
        if (!activeOrder) {
          get().createNewOrder();
          return get().addItemToActiveOrder(newItem);
        }

        const orderItem: OrderItem = {
          ...newItem,
          id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        };

        // Look for existing item with same properties
        const existingItemIndex = activeOrder.items.findIndex(
          item =>
            item.productId === newItem.productId &&
            item.source === newItem.source &&
            item.locationName === newItem.locationName &&
            item.projectName === newItem.projectName &&
            item.customization === newItem.customization &&
            item.selectedProjects === newItem.selectedProjects &&
            item.projectQuantities === newItem.projectQuantities &&
            item.totalQuantity === newItem.totalQuantity &&
            item.productionNotes === newItem.productionNotes
        );

        let updatedItems;
        if (existingItemIndex >= 0) {
          updatedItems = [...activeOrder.items];
          updatedItems[existingItemIndex] = {
            ...updatedItems[existingItemIndex],
            quantity: updatedItems[existingItemIndex].quantity + newItem.quantity,
          };
        } else {
          updatedItems = [...activeOrder.items, orderItem];
        }

        const totalPrice = updatedItems.reduce(
          (sum, item) => sum + (item.product?.price || 0) * item.quantity,
          0
        );
        const totalItems = updatedItems.reduce((sum, item) => sum + item.quantity, 0);

        set({
          activeOrder: {
            ...activeOrder,
            items: updatedItems,
            totalPrice,
            totalItems,
          },
        });
      },

      removeItemFromActiveOrder: itemId => {
        const { activeOrder } = get();
        if (!activeOrder) return;

        const updatedItems = activeOrder.items.filter(item => item.id !== itemId);
        const totalPrice = updatedItems.reduce(
          (sum, item) => sum + (item.product?.price || 0) * item.quantity,
          0
        );
        const totalItems = updatedItems.reduce((sum, item) => sum + item.quantity, 0);

        set({
          activeOrder: {
            ...activeOrder,
            items: updatedItems,
            totalPrice,
            totalItems,
          },
        });
      },

      updateItemInActiveOrder: (itemId, updates) => {
        const { activeOrder } = get();
        if (!activeOrder) return;

        const updatedItems = activeOrder.items.map(item =>
          item.id === itemId ? { ...item, ...updates } : item
        );

        const totalPrice = updatedItems.reduce(
          (sum, item) => sum + (item.product?.price || 0) * item.quantity,
          0
        );
        const totalItems = updatedItems.reduce((sum, item) => sum + item.quantity, 0);

        set({
          activeOrder: {
            ...activeOrder,
            items: updatedItems,
            totalPrice,
            totalItems,
          },
        });
      },

      setCustomerForActiveOrder: customerId => {
        const { activeOrder } = get();
        if (!activeOrder) return;

        set({
          activeOrder: {
            ...activeOrder,
            selectedCustomerId: customerId,
          },
        });
      },

      clearActiveOrder: () => {
        set({ activeOrder: null });
      },

      saveActiveOrder: favoriteName => {
        const { activeOrder, savedOrders } = get();
        if (!activeOrder || activeOrder.items.length === 0) return;

        const savedOrder: SavedOrder = {
          ...activeOrder,
          isFavorite: !!favoriteName,
          favoriteName,
          createdAt: new Date(),
        };

        set({
          savedOrders: [...savedOrders, savedOrder],
          activeOrder: null,
        });
      },

      loadSavedOrder: orderId => {
        const { savedOrders } = get();
        const order = savedOrders.find(o => o.id === orderId);
        if (order) {
          set({ activeOrder: { ...order } });
        }
      },

      copySavedOrder: orderId => {
        const { savedOrders } = get();
        const order = savedOrders.find(o => o.id === orderId);
        if (order) {
          const copiedOrder: SavedOrder = {
            ...order,
            id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            orderNumber: `TEMP_${Date.now()}`,
            createdAt: new Date(),
            items: order.items.map(item => ({
              ...item,
              id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            })),
          };
          set({ activeOrder: copiedOrder });
        }
      },

      deleteSavedOrder: orderId => {
        const { savedOrders } = get();
        set({
          savedOrders: savedOrders.filter(order => order.id !== orderId),
        });
      },

      toggleOrderFavorite: (orderId, favoriteName) => {
        const { savedOrders } = get();
        set({
          savedOrders: savedOrders.map(order =>
            order.id === orderId
              ? {
                  ...order,
                  isFavorite: !order.isFavorite,
                  favoriteName: !order.isFavorite ? favoriteName : undefined,
                }
              : order
          ),
        });
      },

      getTotalPrice: () => {
        const { activeOrder } = get();
        return activeOrder?.totalPrice || 0;
      },

      getTotalItems: () => {
        const { activeOrder } = get();
        return activeOrder?.totalItems || 0;
      },

      getGroupedItems: () => {
        const { activeOrder } = get();
        if (!activeOrder) return {};

        const grouped: Record<string, OrderItem[]> = {};
        activeOrder.items.forEach(item => {
          const key = `${item.source}`;
          if (!grouped[key]) {
            grouped[key] = [];
          }
          grouped[key].push(item);
        });

        return grouped;
      },

      clearTemporaryOrders: () => {
        const { activeOrder, savedOrders } = get();

        // Usuń aktywne zamówienie jeśli jest typu ROBOCZE_ lub TEMP_
        let newActiveOrder = activeOrder;
        if (
          activeOrder &&
          (activeOrder.orderNumber.startsWith('ROBOCZE_') ||
            activeOrder.orderNumber.startsWith('TEMP_') ||
            activeOrder.id.startsWith('local_'))
        ) {
          newActiveOrder = null;
        }

        // Usuń zapisane zamówienia typu ROBOCZE_ lub TEMP_
        const filteredSavedOrders = savedOrders.filter(
          order =>
            !order.orderNumber.startsWith('ROBOCZE_') &&
            !order.orderNumber.startsWith('TEMP_') &&
            !order.id.startsWith('local_')
        );

        set({
          activeOrder: newActiveOrder,
          savedOrders: filteredSavedOrders,
        });
      },
    }),
    {
      name: 'order-storage',
    }
  )
);

// Zachowujemy kompatybilność wsteczną
export const useCartStore = useOrderStore;
