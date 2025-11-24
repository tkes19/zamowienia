import { UserRole, ProductCategory, OrderStatus, ProductSource } from '@prisma/client';

export { UserRole, ProductCategory, OrderStatus };

export { ProductSource };

export interface User {
  id: string;
  name?: string | null;
  email: string;
  role: UserRole;
  departmentId?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  department?: Department | null;
}

export interface Department {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  users?: User[];
  _count?: {
    users: number;
  };
}

export interface Product {
  id: string;
  identifier: string; // Identyfikator produktu
  index: string; // Indeks używany przez handlowców i sprzedaż
  slug?: string | null; // URL-friendly nazwa
  description?: string | null; // Opis produktu
  price: number; // Cena
  imageUrl?: string | null; // URL głównego zdjęcia
  images?: string[] | null; // Array URL-i wszystkich obrazów
  category: ProductCategory; // Kategoria
  productionPath?: string | null; // Ścieżka produkcyjna
  dimensions?: string | null; // Wymiary produktu z API
  isActive: boolean; // Czy aktywny
  new: boolean; // Czy produkt jest nowością
}

export interface Inventory {
  id: string;
  productId: string;
  stock: number; // Aktualny stan magazynowy
  stockReserved: number; // Zarezerwowany stan
  stockOptimal: number; // Optymalny stan
  stockOrdered: number; // Zamówione ilości
  reorderPoint: number; // Punkt ponownego zamówienia
  location?: string | null; // Lokalizacja magazynowa
  createdAt: Date;
  updatedAt: Date;
  product?: Product; // Opcjonalna relacja do produktu
}

export interface Customer {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  salesRepId: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  createdAt: Date;
  updatedAt: Date;
  status: OrderStatus;
  userId: string;
  customerId?: string | null;
  total: number;
  notes?: string | null;
  items: OrderItem[]; // deprecated - use OrderItem instead
  OrderItem?: OrderItem[]; // correct field from Prisma
  customer?: Customer | null; // deprecated - use Customer instead
  Customer?: Customer | null; // correct field from Prisma
  user?: User | null; // deprecated - use User instead
  User?: User | null; // correct field from Prisma
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  customization?: string | null;
  source: ProductSource;
  locationName?: string | null;
  projectName?: string | null;
  // Nowe pola dla systemu projektów
  selectedProjects?: string | null; // np. "1,2,3,4,5" lub "1-5"
  projectQuantities?: string | null; // np. "40,40,40,40,40" lub "po 40"
  totalQuantity?: number | null; // np. 200 (suma wszystkich projektów)
  productionNotes?: string | null; // Dodatkowy opis dla produkcji
  product?: Product | null; // deprecated - use Product instead
  Product?: Product | null; // correct field from Prisma
}

export interface CartItem {
  productId: string;
  quantity: number;
  customization?: string;
  source: ProductSource;
  locationName?: string;
  projectName?: string;
  // Nowe pola dla systemu projektów
  selectedProjects?: string; // np. "1,2,3,4,5" lub "1-5"
  projectQuantities?: string; // np. "40,40,40,40,40" lub "po 40"
  totalQuantity?: number; // np. 200 (suma wszystkich projektów)
  productionNotes?: string; // Dodatkowy opis dla produkcji
  product?: Product;
}

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrator',
  SALES_REP: 'Handlowiec',
  WAREHOUSE: 'Magazyn',
  SALES_DEPT: 'Dział Sprzedaży',
  NEW_USER: 'Nowy Użytkownik',
};

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  MAGNESY: 'Magnesy',
  BRELOKI: 'Breloki',
  OTWIERACZE: 'Otwieracze',
  CERAMIKA_I_SZKLO: 'Ceramika i Szkło',
  DLUGOPISY: 'Długopisy',
  CZAPKI_I_NAKRYCIA_GLOWY: 'Czapki i Nakrycia Głowy',
  BRANSOLETKI: 'Bransoletki',
  TEKSTYLIA: 'Tekstylia',
  OZDOBY_DOMOWE: 'Ozdoby Domowe',
  AKCESORIA_PODROZNE: 'Akcesoria Podróżne',
  DLA_DZIECI: 'Dla Dzieci',
  ZAPALNICZKI_I_POPIELNICZKI: 'Zapalniczki i Popielniczki',
  UPOMINKI_BIZNESOWE: 'Upominki Biznesowe',
  ZESTAWY: 'Zestawy',
};

export const PRODUCT_SOURCE_LABELS: Record<ProductSource, string> = {
  MIEJSCOWOSCI: 'Projekty Miejscowości',
  KLIENCI_INDYWIDUALNI: 'Klienci Indywidualni',
  IMIENNE: 'Imienne',
  HASLA: 'Hasła',
  OKOLICZNOSCIOWE: 'Okolicznościowe',
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  DRAFT: 'Roboczy',
  PENDING: 'Złożone',
  PROCESSING: 'W realizacji',
  SHIPPED: 'Wysłane',
  DELIVERED: 'Dostarczone',
  CANCELLED: 'Anulowane',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  PENDING: 'bg-blue-100 text-blue-800',
  PROCESSING: 'bg-yellow-100 text-yellow-800',
  SHIPPED: 'bg-purple-100 text-purple-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};
