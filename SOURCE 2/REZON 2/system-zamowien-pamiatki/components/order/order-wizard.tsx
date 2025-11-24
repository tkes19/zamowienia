'use client';

import React, { useState, useEffect } from 'react';
import { OrderComponent } from './component-selector';
import { LocationOrder, LocationData } from './location-order';
import { IndividualClientOrder, ClientData } from './individual-client-order';
import { Product, Customer } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MapPin,
  User,
  Type,
  Hash,
  Calendar,
  ArrowLeft,
  Trash2,
  ShoppingCart,
  Save,
  Loader2,
  Edit2,
  Check,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocationsPreload } from '@/hooks/use-locations-preload';
import { toast } from 'sonner';
// import { useOrderDraft } from '@/hooks/useOrderDraft';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Mapowanie komponentów UI na wartości enum bazy danych
const mapComponentToSource = (component: OrderComponent): string => {
  switch (component) {
    case 'MIEJSCOWOŚCI':
      return 'MIEJSCOWOSCI';
    case 'KLIENCI_INDYWIDUALNI':
      return 'KLIENCI_INDYWIDUALNI';
    case 'IMIENNE':
      return 'IMIENNE';
    case 'HASŁA':
      return 'HASLA';
    case 'OKOLICZNOŚCIOWE':
      return 'OKOLICZNOSCIOWE';
    default:
      return 'MIEJSCOWOSCI';
  }
};

interface OrderItem {
  id: string;
  component: OrderComponent;
  product: Product;
  customization: string;
  locationData?: LocationData;
  clientData?: ClientData;
  quantity: number;
  totalPrice: number;
}

export function OrderWizard() {
  const [activeTab, setActiveTab] = useState<string>('miejscowosci');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [customersLoading, setCustomersLoading] = useState(true);
  const [customersError, setCustomersError] = useState<string | null>(null);

  // State z persystencją w localStorage
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Stan edycji pozycji
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ quantity: number; customization: string }>({
    quantity: 1,
    customization: '',
  });

  // Załaduj zamówienie z localStorage przy inicjalizacji
  useEffect(() => {
    const savedOrder = localStorage.getItem('currentOrder');
    if (savedOrder) {
      try {
        const parsedOrder = JSON.parse(savedOrder);
        if (parsedOrder.items && Array.isArray(parsedOrder.items)) {
          setOrderItems(parsedOrder.items);
        }
        if (parsedOrder.selectedCustomer) {
          setSelectedCustomer(parsedOrder.selectedCustomer);
        }
      } catch (error) {
        console.error('Błąd podczas ładowania zamówienia z localStorage:', error);
        localStorage.removeItem('currentOrder');
      }
    }
  }, []);

  // Zapisz zamówienie do localStorage przy każdej zmianie
  useEffect(() => {
    if (orderItems.length > 0 || selectedCustomer) {
      const orderData = {
        items: orderItems,
        selectedCustomer,
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem('currentOrder', JSON.stringify(orderData));
    } else {
      localStorage.removeItem('currentOrder');
    }

    // Powiadom inne komponenty o zmianie
    window.dispatchEvent(new CustomEvent('currentOrderChanged'));
  }, [orderItems, selectedCustomer]);

  // Mock Draft Orders hooka dla sprawdzenia
  const draft =
    orderItems.length > 0
      ? {
          id: 'mock',
          items: orderItems.map(item => ({
            id: item.id,
            productId: item.product.id,
            quantity: item.quantity,
            unitPrice: item.product.price,
            totalPrice: item.totalPrice,
            customization: item.customization,
            source: 'PM' as const,
            product: item.product,
          })),
          totalValue: orderItems.reduce((sum, item) => sum + item.totalPrice, 0),
          status: 'active' as const,
        }
      : null;

  const isLoading = false;
  const isSaving = isSubmitting;

  // Preload danych miejscowości w tle
  useLocationsPreload();

  // Pobierz klientów
  useEffect(() => {
    const fetchCustomers = async () => {
      setCustomersLoading(true);
      setCustomersError(null);

      try {
        let response = await fetch('/api/customers');

        // If unauthorized, try demo mode
        if (response.status === 401) {
          console.log('No authorization, switching to demo mode for customers');
          response = await fetch('/api/customers?demo=true');
        }

        if (response.ok) {
          const data = await response.json();
          setCustomers(data);
          console.log(
            'Customers loaded successfully:',
            data?.length || 0,
            data[0]?.notes?.includes('baza danych niedostępna') ? '(fallback mode)' : ''
          );
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error('Failed to fetch customers:', response.status, errorData);
          setCustomersError(`Błąd ${response.status}: ${errorData.message || 'Nieznany błąd'}`);
        }
      } catch (error) {
        console.error('Błąd podczas pobierania klientów:', error);
        setCustomersError('Błąd połączenia z serwerem');
      } finally {
        setCustomersLoading(false);
      }
    };
    fetchCustomers();
  }, []);

  const handleTabChange = (tabKey: string) => {
    setActiveTab(tabKey);
  };

  const getActiveComponent = (): OrderComponent => {
    switch (activeTab) {
      case 'miejscowosci':
        return 'MIEJSCOWOŚCI';
      case 'klienci':
        return 'KLIENCI_INDYWIDUALNI';
      case 'imienne':
        return 'IMIENNE';
      case 'hasla':
        return 'HASŁA';
      case 'okolicznosciowe':
        return 'OKOLICZNOŚCIOWE';
      default:
        return 'MIEJSCOWOŚCI';
    }
  };

  const handleLocationProductSelected = (product: Product, locData: LocationData) => {
    addOrderItem(product, getActiveComponent(), locData);
  };

  const handleClientDataComplete = (cliData: ClientData) => {
    // Wyciągnij prawdziwą nazwę produktu z customizationDescription
    const productNameMatch = cliData.customizationDescription.match(/Produkt:\s*(.+)/);
    const productName = productNameMatch
      ? productNameMatch[1].split('\n')[0].trim()
      : cliData.productIdentifier || 'Zamówienie indywidualne';

    // Pobierz cenę z selectedProductData
    const productPrice = cliData.selectedProductData?.price || 0;
    const productCategory = (cliData.selectedProductData?.category as any) || 'BRELOKI';

    // KRYTYCZNE: Użyj prawdziwego ID produktu z bazy danych!
    const databaseProduct = cliData.selectedProductData?.databaseProduct;
    const productId = databaseProduct?.id;

    console.log(
      `💰 Creating order item with price: ${productPrice} zł for product: ${productName}`
    );
    console.log(
      `🔗 Database product ID: ${productId}`,
      databaseProduct ? '✅ Found' : '❌ Not found'
    );

    if (!productId) {
      toast.error('Nie można dodać produktu: brak dopasowania w bazie danych');
      console.error('❌ Cannot create order: no database product ID for', productName);
      return;
    }

    // Tworzymy product object z prawdziwym ID z bazy danych
    const product: Product = {
      id: productId, // PRAWDZIWY ID Z BAZY DANYCH!
      identifier: databaseProduct.identifier,
      index: databaseProduct.index || `CLIENT-${Date.now().toString().slice(-6)}`,
      description: databaseProduct.description || '',
      price: productPrice, // Użyj prawdziwej ceny z R2/bazy danych!
      imageUrl:
        cliData.selectedProductData?.imageUrl ||
        databaseProduct.imageUrl ||
        '/placeholder-custom.jpg',
      category: productCategory,
      productionPath: `KLIENCI_INDYWIDUALNI/${cliData.clientName.replace(/\s+/g, '_')}`,
      isActive: databaseProduct.isActive ?? true,
      new: databaseProduct.new ?? false,
    };

    addOrderItem(product, getActiveComponent(), undefined, cliData);
  };

  const addOrderItem = (
    product: Product,
    component: OrderComponent,
    locationData?: LocationData,
    clientData?: ClientData
  ) => {
    // Poprawka ilości - użyj totalQuantity z właściwego źródła danych
    const quantity = locationData?.totalQuantity || clientData?.totalQuantity || 1;
    const customization = getCustomizationText(component, locationData, clientData);

    const newItem: OrderItem = {
      id: `${Date.now()}_${Math.random()}`,
      component,
      product,
      customization,
      locationData,
      clientData,
      quantity,
      totalPrice: product.price * quantity,
    };

    setOrderItems(prev => [...prev, newItem]);
    toast.success('Pozycja dodana do zamówienia!');
  };

  const removeOrderItem = (itemId: string) => {
    setOrderItems(prev => prev.filter(item => item.id !== itemId));
    toast.success('Pozycja usunięta z zamówienia');
  };

  const updateOrderItem = (
    itemId: string,
    updates: { quantity?: number; customization?: string }
  ) => {
    setOrderItems(prev =>
      prev.map(item => {
        if (item.id === itemId) {
          const updatedItem = { ...item, ...updates };
          // Przelicz totalPrice jeśli zmieniła się ilość
          if (updates.quantity !== undefined) {
            updatedItem.totalPrice = item.product.price * updates.quantity;
          }
          return updatedItem;
        }
        return item;
      })
    );
  };

  const startEditing = (item: OrderItem) => {
    setEditingItemId(item.id);
    setEditValues({
      quantity: item.quantity,
      customization: item.customization,
    });
  };

  const cancelEditing = () => {
    setEditingItemId(null);
    setEditValues({ quantity: 1, customization: '' });
  };

  const saveEditing = () => {
    if (editingItemId) {
      updateOrderItem(editingItemId, editValues);
      setEditingItemId(null);
      toast.success('Pozycja zaktualizowana');
    }
  };

  const clearOrder = () => {
    setOrderItems([]);
    setSelectedCustomer('');
    localStorage.removeItem('currentOrder');
    window.dispatchEvent(new CustomEvent('currentOrderChanged'));
    toast.success('Zamówienie zostało wyczyszczone');
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'miejscowosci':
        return (
          <LocationOrder
            onBack={() => {}} // Nie potrzebujemy back - mamy tabs
            onProductSelect={handleLocationProductSelected}
          />
        );

      case 'klienci':
        return (
          <IndividualClientOrder
            onBack={() => {}} // Nie potrzebujemy back - mamy tabs
            onClientDataComplete={handleClientDataComplete}
          />
        );

      case 'imienne':
      case 'hasla':
      case 'okolicznosciowe':
        return (
          <div className="p-6 text-center">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 max-w-md mx-auto">
              <Calendar className="h-12 w-12 text-yellow-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                Funkcja w przygotowaniu
              </h3>
              <p className="text-yellow-700">
                Ten typ personalizacji będzie dostępny wkrótce. Skorzystaj z dostępnych opcji:
                Miejscowości lub Klienci indywidualni.
              </p>
            </div>
          </div>
        );

      default:
        return (
          <div className="p-6 text-center">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 max-w-md mx-auto">
              <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Wybierz typ personalizacji
              </h3>
              <p className="text-gray-600">Użyj zakładek powyżej aby wybrać typ zamówienia.</p>
            </div>
          </div>
        );
    }
  };

  const getCustomizationText = (
    component: OrderComponent,
    locationData?: LocationData,
    clientData?: ClientData
  ) => {
    if (component === 'MIEJSCOWOŚCI' && locationData) {
      // Tylko nazwa miejscowości + szczegóły projektów (bez "Miejscowość:" i "Identyfikator:")
      let customization = locationData.locationName;

      // Dodaj informacje o projektach jeśli są dostępne
      if (locationData.selectedProjects) {
        customization += `\nProjekty: ${locationData.selectedProjects}`;
      }
      if (locationData.projectQuantities) {
        customization += `\nIlości: ${locationData.projectQuantities}`;
      }
      // Usunięto "Łącznie:" - to już jest w kolumnie "Ilość"

      return customization;
    } else if (component === 'KLIENCI_INDYWIDUALNI' && clientData) {
      // Tylko nazwa obiektu/firmy + szczegóły projektów (BEZ duplikowania informacji o produkcie!)
      let customization = '';

      if (clientData.clientCompany) {
        customization = clientData.clientCompany;
      } else {
        customization = clientData.clientName;
      }

      // Dodaj informacje o projektach (bez "Produkt: ..." - to już jest w kolumnie "Produkt")
      if (clientData.selectedProjects) {
        customization += `\nProjekty: ${clientData.selectedProjects}`;
      }
      if (clientData.projectQuantities) {
        customization += `\nIlości: ${clientData.projectQuantities}`;
      }
      if (clientData.totalQuantity) {
        customization += `\nŁącznie: ${clientData.totalQuantity} szt.`;
      }
      if (clientData.specialInstructions) {
        customization += `\nUwagi: ${clientData.specialInstructions}`;
      }

      return customization;
    }
    return '';
  };

  const submitOrder = async () => {
    if (orderItems.length === 0) {
      toast.error('Dodaj co najmniej jedną pozycję do zamówienia');
      return;
    }

    if (!selectedCustomer) {
      toast.error('Wybierz klienta przed wysłaniem zamówienia');
      return;
    }

    setIsSubmitting(true);
    try {
      const orderData = {
        customerId: selectedCustomer,
        total: getTotalOrderValue(),
        items: orderItems.map(item => ({
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: item.product.price,
          customization: item.customization,
          source: mapComponentToSource(item.component),
          locationName: item.locationData?.locationName || item.clientData?.folderName,
          projectName: item.locationData?.projectNumber,
          selectedProjects:
            item.locationData?.selectedProjects || item.clientData?.selectedProjects,
          projectQuantities:
            item.locationData?.projectQuantities || item.clientData?.projectQuantities,
          totalQuantity: item.locationData?.totalQuantity || item.clientData?.totalQuantity,
          productionNotes: item.locationData?.productionNotes || item.clientData?.productionNotes,
        })),
      };

      console.log('=== SENDING ORDER ===');
      console.log('Customer ID:', selectedCustomer);
      console.log('Items count:', orderItems.length);

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API Error:', response.status, errorData);
        throw new Error(`API Error ${response.status}: ${errorData.message || 'Unknown error'}`);
      }

      const result = await response.json();
      toast.success(`Zamówienie ${result.orderNumber} zostało wysłane!`);

      // Wyczyść zamówienie po wysłaniu
      setOrderItems([]);
      setSelectedCustomer('');
      setActiveTab('miejscowosci');
      localStorage.removeItem('currentOrder');
    } catch (error) {
      console.error('Błąd wysyłania zamówienia:', error);
      toast.error('Błąd podczas wysyłania zamówienia');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getComponentIcon = (componentType: OrderComponent) => {
    switch (componentType) {
      case 'MIEJSCOWOŚCI':
        return <MapPin className="h-4 w-4" />;
      case 'KLIENCI_INDYWIDUALNI':
        return <User className="h-4 w-4" />;
      case 'IMIENNE':
        return <Type className="h-4 w-4" />;
      case 'HASŁA':
        return <Hash className="h-4 w-4" />;
      case 'OKOLICZNOŚCIOWE':
        return <Calendar className="h-4 w-4" />;
    }
  };

  const getComponentName = (componentType: OrderComponent, clientData?: ClientData) => {
    switch (componentType) {
      case 'MIEJSCOWOŚCI':
        return 'Miejscowości';
      case 'KLIENCI_INDYWIDUALNI':
        if (clientData && clientData.folderName) {
          return `Indywidualni (${clientData.folderName})`;
        }
        return 'Indywidualni';
      case 'IMIENNE':
        return 'Imienne';
      case 'HASŁA':
        return 'Hasła';
      case 'OKOLICZNOŚCIOWE':
        return 'Okolicznościowe';
    }
  };

  const getTotalOrderValue = () => {
    return orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
  };

  return (
    <div>
      {/* Wskaźnik stanu draftu */}
      {draft && (
        <Card className="mb-6 bg-blue-50 border-blue-200">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-blue-600" />
                  <span className="font-medium">Bieżące zamówienie</span>
                  <Badge variant="default" className="bg-blue-600">
                    {draft.status === 'active' ? 'Aktywne' : 'Projekt'}
                  </Badge>
                </div>

                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">{draft.items.length}</span> pozycji |
                  <span className="font-medium ml-1">{draft.totalValue.toFixed(2)} zł</span>
                </div>

                {isSaving && (
                  <div className="flex items-center gap-1 text-sm text-blue-600">
                    <Save className="h-3 w-3 animate-pulse" />
                    <span>Zapisywanie...</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={clearOrder}
                  variant="outline"
                  size="sm"
                  disabled={draft.items.length === 0}
                >
                  Wyczyść
                </Button>
                <Button
                  onClick={submitOrder}
                  disabled={isSaving || !draft || draft.items.length === 0 || !selectedCustomer}
                  size="sm"
                >
                  {draft.items.length === 0 ? 'Brak pozycji' : 'Złóż zamówienie'}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Header z tytułem */}
      <div className="text-center p-6 pb-0">
        <h1 className="text-3xl font-bold text-gray-900">Nowe zamówienie</h1>
        <p className="text-lg text-gray-600 mt-2">
          Wybierz typ personalizacji dla Twojego zamówienia
        </p>
      </div>

      {/* Poziomy pasek przycisków (tabs) */}
      <nav className="personalization-tabs" role="tablist">
        {[
          { key: 'miejscowosci', label: 'Miejscowości', icon: <MapPin className="h-4 w-4" /> },
          { key: 'klienci', label: 'Klienci indywidualni', icon: <User className="h-4 w-4" /> },
          {
            key: 'imienne',
            label: 'Imienne',
            comingSoon: true,
            icon: <Type className="h-4 w-4" />,
          },
          { key: 'hasla', label: 'Hasła', comingSoon: true, icon: <Hash className="h-4 w-4" /> },
          {
            key: 'okolicznosciowe',
            label: 'Okolicznościowe',
            comingSoon: true,
            icon: <Calendar className="h-4 w-4" />,
          },
        ].map(tab => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            className={cn('tab', {
              'tab--active': activeTab === tab.key,
              'tab--disabled': tab.comingSoon,
            })}
            disabled={tab.comingSoon}
            onClick={() => !tab.comingSoon && handleTabChange(tab.key)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
            {tab.comingSoon && <span className="tag">Wkrótce</span>}
          </button>
        ))}
      </nav>

      {/* Zawartość aktywnego tab */}
      <section className="tab-content">{renderActiveTab()}</section>

      {/* Tabelka z pozycjami zamówienia */}
      {draft && draft.items.length > 0 && (
        <div className="mt-8 px-6">
          <div className="bg-white rounded-lg border shadow-sm">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">Pozycje zamówienia</h3>
              <p className="text-sm text-muted-foreground">
                {draft.items.length} pozycji • Wartość: {getTotalOrderValue().toFixed(2)} zł
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                      Rodzaj
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                      Produkt
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                      Szczegóły
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Ilość</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Cena</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Razem</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Akcje</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {orderItems.map(item => (
                    <tr key={item.id}>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          {getComponentIcon(item.component)}
                          <span className="text-sm font-medium text-gray-900">
                            {getComponentName(item.component, item.clientData)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {item.product.identifier}
                        </div>
                        <div className="text-sm text-gray-500">
                          {item.product.index ? `[${item.product.index}]` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {editingItemId === item.id ? (
                          <Input
                            value={editValues.customization}
                            onChange={e =>
                              setEditValues(prev => ({ ...prev, customization: e.target.value }))
                            }
                            placeholder="Szczegóły personalizacji..."
                            className="text-sm"
                          />
                        ) : (
                          <div className="text-sm text-gray-600 max-w-xs">
                            {item.customization.split('\n').map((line, idx) => (
                              <div key={idx}>{line}</div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900">
                        {editingItemId === item.id ? (
                          <Input
                            type="number"
                            value={editValues.quantity}
                            onChange={e =>
                              setEditValues(prev => ({
                                ...prev,
                                quantity: parseInt(e.target.value) || 0,
                              }))
                            }
                            className="w-20 text-sm"
                            min="1"
                          />
                        ) : (
                          item.quantity
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900">
                        {item.product.price.toFixed(2)} zł
                      </td>
                      <td className="px-4 py-4 text-sm font-medium text-gray-900">
                        {item.totalPrice.toFixed(2)} zł
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1">
                          {editingItemId === item.id ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={saveEditing}
                                className="text-green-600 hover:text-green-800 hover:bg-green-50"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={cancelEditing}
                                className="text-gray-600 hover:text-gray-800 hover:bg-gray-50"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => startEditing(item)}
                                className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeOrderItem(item.id)}
                                className="text-red-600 hover:text-red-800 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 border-t bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">Łącznie: {orderItems.length} pozycji</div>
                <div className="flex items-center gap-4">
                  <div className="text-lg font-bold text-gray-900">
                    Wartość zamówienia: {getTotalOrderValue().toFixed(2)} zł
                  </div>
                  <div className="flex items-center gap-3">
                    <Select
                      value={selectedCustomer}
                      onValueChange={setSelectedCustomer}
                      disabled={customersLoading}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue
                          placeholder={
                            customersLoading
                              ? 'Ładowanie...'
                              : customersError
                                ? 'Błąd ładowania'
                                : customers.length === 0
                                  ? 'Brak klientów'
                                  : 'Wybierz klienta'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {customersError ? (
                          <SelectItem value="error" disabled>
                            {customersError}
                          </SelectItem>
                        ) : customers.length === 0 ? (
                          <SelectItem value="no-customers" disabled>
                            Brak dostępnych klientów
                          </SelectItem>
                        ) : (
                          customers.map(customer => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.name}
                              {customer.notes?.includes('baza danych niedostępna') && (
                                <span className="text-xs text-orange-600 ml-2">(tryb offline)</span>
                              )}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={submitOrder}
                      disabled={isSubmitting || orderItems.length === 0 || !selectedCustomer}
                      className="flex items-center gap-2"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      {isSubmitting ? 'Wysyłanie...' : 'Wyślij zamówienie'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
