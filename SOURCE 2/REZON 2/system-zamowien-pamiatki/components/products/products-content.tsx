'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AddToOrderDialog } from '@/components/products/add-to-order-dialog';
import { Product, PRODUCT_CATEGORY_LABELS, ProductCategory } from '@/lib/types';
import { Search, Package, Plus } from 'lucide-react';
import Image from 'next/image';

export function ProductsContent() {
  const { data: session } = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isAddToCartOpen, setIsAddToCartOpen] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products');
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(product => {
    // Rozdziel wyszukiwane słowa po spacjach i usuń puste
    const searchWords = searchTerm
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0);

    // Jeśli nie ma słów do wyszukania, pokaż wszystkie produkty
    const matchesSearch =
      searchWords.length === 0 ||
      searchWords.every(word => {
        const identifier = product.identifier?.toLowerCase() || '';
        const index = product.index?.toLowerCase() || '';

        // Każde słowo musi być znalezione w identifier lub index
        return identifier.includes(word) || index.includes(word);
      });

    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleAddToOrder = (product: Product) => {
    setSelectedProduct(product);
    setIsAddToCartOpen(true);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-48 bg-gray-200 rounded-t-lg"></div>
              <CardContent className="p-4">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 rounded mb-4"></div>
                <div className="h-8 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Katalog produktów</h1>
          <p className="text-gray-600">Przeglądaj i dodawaj produkty do zamówienia</p>
        </div>
      </div>

      {/* Filtry */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Szukaj produktów..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10"
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="lg:w-64">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz kategorię" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie kategorie</SelectItem>
                  {Object.entries(PRODUCT_CATEGORY_LABELS).map(([category, label]) => (
                    <SelectItem key={category} value={category}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Produkty */}
      {filteredProducts.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Brak produktów</h3>
            <p className="text-gray-600">
              Nie znaleziono produktów spełniających kryteria wyszukiwania.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map(product => (
            <Card key={product.id} className="group hover:shadow-lg transition-shadow">
              <div className="relative aspect-square overflow-hidden rounded-t-lg bg-gray-100">
                <Image
                  src={product.imageUrl || '/placeholder-product.jpg'}
                  alt={product.identifier}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform"
                />
              </div>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {PRODUCT_CATEGORY_LABELS[product.category]}
                    </Badge>
                    <div className="text-xs text-gray-500 font-mono">{product.index}</div>
                  </div>
                  <h3 className="font-semibold text-gray-900 line-clamp-2">{product.identifier}</h3>
                  <p className="text-sm text-gray-600 line-clamp-2">{product.description}</p>
                  {product.productionPath && (
                    <div className="text-xs text-gray-500 border-t pt-2 mt-2">
                      <strong>Ścieżka produkcyjna:</strong>
                      <br />
                      <span className="font-mono">{product.productionPath}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-lg font-bold text-blue-600">
                      {product.price.toFixed(2)} zł
                    </span>
                    {session?.user?.role === 'SALES_REP' && (
                      <Button size="sm" onClick={() => handleAddToOrder(product)} className="ml-2">
                        <Plus className="h-4 w-4 mr-1" />
                        Do zamówienia
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog dodawania do zamówienia */}
      {selectedProduct && (
        <AddToOrderDialog
          product={selectedProduct}
          open={isAddToCartOpen}
          onOpenChange={setIsAddToCartOpen}
        />
      )}
    </div>
  );
}
