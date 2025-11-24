'use client';

import React, { useState, useEffect } from 'react';
import { PublicLayout } from '@/components/public/PublicLayout';
import { categoryConfig } from '@/lib/categoryConfig';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Search } from 'lucide-react';

interface Product {
  id: string;
  identifier: string;
  index: string;
  description: string;
  price: number;
  imageUrl?: string;
  category: string;
  isActive: boolean;
  new: boolean;
}

export default function CategoryPage({ params }: { params: { category: string } }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const category = categoryConfig.categories.find(cat => cat.slug === params.category);

  useEffect(() => {
    fetchProducts();
  }, [params.category]);

  const fetchProducts = async () => {
    try {
      const response = await fetch(`/api/products?demo=true`);
      if (response.ok) {
        const data = await response.json();
        // Filtruj produkty według kategorii
        const filteredProducts = data.filter(
          (product: Product) => product.category === category?.id && product.isActive
        );
        setProducts(filteredProducts);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(
    product =>
      product.identifier.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!category) {
    return (
      <PublicLayout>
        <div className="flex-1 p-6">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Kategoria nie znaleziona</h1>
            <Link href="/katalog" className="text-blue-600 hover:text-blue-700">
              Powrót do katalogu
            </Link>
          </div>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="flex-1 p-6">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/katalog"
            className="flex items-center text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Powrót do katalogu
          </Link>

          <div className="flex items-center mb-4">
            <div className="relative h-16 w-16 mr-4 rounded-lg overflow-hidden">
              <Image src={category.image} alt={category.name} fill className="object-cover" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{category.name}</h1>
              <p className="text-gray-600">{category.description}</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Szukaj produktów..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Ładowanie produktów...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.length > 0 ? (
              filteredProducts.map(product => (
                <div
                  key={product.id}
                  className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
                >
                  <div className="relative h-48 bg-gray-100">
                    {product.imageUrl ? (
                      <Image
                        src={product.imageUrl}
                        alt={product.identifier}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400">
                        <span className="text-4xl">📦</span>
                      </div>
                    )}
                    {product.new && (
                      <div className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded">
                        NOWOŚĆ
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-800 mb-2">{product.identifier}</h3>
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{product.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-blue-600">
                        {product.price.toFixed(2)} zł
                      </span>
                      <span className="text-xs text-gray-500">Kod: {product.index}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  {searchTerm ? 'Brak wyników wyszukiwania' : 'Brak produktów w tej kategorii'}
                </h3>
                <p className="text-gray-600">
                  {searchTerm
                    ? `Nie znaleziono produktów dla "${searchTerm}"`
                    : 'Ta kategoria nie zawiera jeszcze żadnych produktów.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
