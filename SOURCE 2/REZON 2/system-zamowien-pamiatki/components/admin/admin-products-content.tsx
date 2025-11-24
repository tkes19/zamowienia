'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Package, Plus, Edit, Trash2, Search, EyeOff, Eye } from 'lucide-react';
import { Product, PRODUCT_CATEGORY_LABELS } from '@/lib/types';
import { toast } from 'react-hot-toast';
import Image from 'next/image';
import { ImageUpload } from './image-upload';
import { APIProductSyncModule } from './api-product-sync-module';
import { BulkSyncModule } from './bulk-sync-module';

interface ProductFormData {
  identifier: string;
  index: string;
  description: string;
  price: string;
  imageUrl: string;
  category: string;
  productionPath: string;
}

export function AdminProductsContent() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductFormData>({
    identifier: '',
    index: '',
    description: '',
    price: '',
    imageUrl: '',
    category: '',
    productionPath: '',
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products?includeInactive=true');
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      }
    } catch (error) {
      toast.error('Błąd ładowania produktów');
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = async () => {
    if (!formData.identifier || !formData.index || !formData.price || !formData.category) {
      toast.error('Wypełnij wszystkie wymagane pola');
      return;
    }

    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          price: parseFloat(formData.price),
        }),
      });

      if (response.ok) {
        toast.success('Produkt dodany pomyślnie');
        setIsAddDialogOpen(false);
        resetForm();
        fetchProducts();
      } else {
        toast.error('Błąd dodawania produktu');
      }
    } catch (error) {
      toast.error('Błąd dodawania produktu');
    }
  };

  const handleEditClick = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      identifier: product.identifier,
      index: product.index,
      description: product.description || '',
      price: product.price.toString(),
      imageUrl: product.imageUrl || '',
      category: product.category,
      productionPath: product.productionPath || '',
    });
    setIsEditDialogOpen(true);
  };

  const handleToggleActiveClick = async (product: Product) => {
    const action = product.isActive ? 'deactivate' : 'activate';
    const actionText = product.isActive ? 'dezaktywować' : 'aktywować';

    if (!confirm(`Czy na pewno chcesz ${actionText} produkt "${product.identifier}"?`)) return;

    try {
      const response = await fetch(`/api/products/${product.id}?action=${action}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success(`Produkt ${product.isActive ? 'dezaktywowany' : 'aktywowany'}`);
        fetchProducts();
      } else {
        toast.error(`Błąd ${product.isActive ? 'dezaktywacji' : 'aktywacji'} produktu`);
      }
    } catch (error) {
      toast.error(`Błąd ${product.isActive ? 'dezaktywacji' : 'aktywacji'} produktu`);
    }
  };

  const handleDeleteClick = async (product: Product) => {
    if (
      !confirm(
        `UWAGA! Czy na pewno chcesz TRWALE USUNĄĆ produkt "${product.identifier}" z bazy danych? Ta operacja jest nieodwracalna!`
      )
    )
      return;
    if (!confirm(`Potwierdź ponownie - czy na pewno usunąć "${product.identifier}" na zawsze?`))
      return;

    try {
      const response = await fetch(`/api/products/${product.id}?action=delete`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Produkt trwale usunięty z bazy danych');
        fetchProducts();
      } else {
        toast.error('Błąd usuwania produktu');
      }
    } catch (error) {
      toast.error('Błąd usuwania produktu');
    }
  };

  const resetForm = () => {
    setFormData({
      identifier: '',
      index: '',
      description: '',
      price: '',
      imageUrl: '',
      category: '',
      productionPath: '',
    });
  };

  const filteredProducts = products.filter(
    product =>
      product.identifier.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.index.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Zarządzanie produktami</h1>
          <p className="text-gray-600">Dodawaj, edytuj i usuwaj produkty z katalogu</p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Dodaj produkt
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          placeholder="Szukaj produktów..."
          className="pl-10"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          autoComplete="off"
        />
      </div>

      {/* Bulk Sync Module */}
      <BulkSyncModule onSyncCompleted={fetchProducts} />

      {/* API Product Sync Module */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600" />
            Synchronizacja Pojedynczego Produktu
          </CardTitle>
          <CardDescription>
            Zaktualizuj lub dodaj konkretny produkt na podstawie danych z API Rezon
          </CardDescription>
        </CardHeader>
        <CardContent>
          <APIProductSyncModule onProductUpdated={fetchProducts} />
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista produktów ({filteredProducts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Ładowanie...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zdjęcie</TableHead>
                  <TableHead>Identyfikator</TableHead>
                  <TableHead>Indeks</TableHead>
                  <TableHead>Kategoria</TableHead>
                  <TableHead>Cena</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map(product => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="relative w-12 h-12">
                        <Image
                          src={product.imageUrl || '/images/placeholder-product.png'}
                          alt={product.identifier}
                          fill
                          className="object-cover rounded"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{product.identifier}</TableCell>
                    <TableCell className="font-mono text-sm">{product.index}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{PRODUCT_CATEGORY_LABELS[product.category]}</Badge>
                    </TableCell>
                    <TableCell>{product.price.toFixed(2)} zł</TableCell>
                    <TableCell>
                      <Badge variant={product.isActive ? 'default' : 'destructive'}>
                        {product.isActive ? 'Aktywny' : 'Nieaktywny'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditClick(product)}
                          title="Edytuj produkt"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleActiveClick(product)}
                          title={product.isActive ? 'Dezaktywuj produkt' : 'Aktywuj produkt'}
                        >
                          {product.isActive ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteClick(product)}
                          title="USUŃ TRWALE z bazy danych"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Product Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
          <DialogHeader className="flex-shrink-0 pb-4">
            <DialogTitle>Dodaj nowy produkt</DialogTitle>
            <DialogDescription>
              Wypełnij formularz aby dodać nowy produkt do katalogu
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 px-1">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="identifier">Identyfikator *</Label>
                <Input
                  id="identifier"
                  value={formData.identifier}
                  onChange={e => setFormData({ ...formData, identifier: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="index">Indeks *</Label>
                <Input
                  id="index"
                  value={formData.index}
                  onChange={e => setFormData({ ...formData, index: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Opis</Label>
              <Textarea
                id="description"
                rows={3}
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="price">Cena (zł) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={e => setFormData({ ...formData, price: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="category">Kategoria *</Label>
                <Select
                  value={formData.category}
                  onValueChange={value => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz kategorię" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRODUCT_CATEGORY_LABELS).map(([category, label]) => (
                      <SelectItem key={category} value={category}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Zdjęcie produktu</Label>
              <ImageUpload
                currentImageUrl={formData.imageUrl}
                onImageUrlChange={url => setFormData({ ...formData, imageUrl: url })}
              />
            </div>

            <div>
              <Label htmlFor="productionPath">Ścieżka produkcyjna</Label>
              <Textarea
                id="productionPath"
                rows={2}
                placeholder="np. Druk → Laminacja → Krojenie → Montaż"
                value={formData.productionPath}
                onChange={e => setFormData({ ...formData, productionPath: e.target.value })}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter className="flex-shrink-0 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Anuluj
            </Button>
            <Button onClick={handleAddProduct}>Dodaj produkt</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Product Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
          <DialogHeader className="flex-shrink-0 pb-4">
            <DialogTitle>Edytuj produkt</DialogTitle>
            <DialogDescription>Zaktualizuj informacje o produkcie</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 px-1">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-identifier">Identyfikator *</Label>
                <Input
                  id="edit-identifier"
                  value={formData.identifier}
                  onChange={e => setFormData({ ...formData, identifier: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-index">Indeks *</Label>
                <Input
                  id="edit-index"
                  value={formData.index}
                  onChange={e => setFormData({ ...formData, index: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit-description">Opis</Label>
              <Textarea
                id="edit-description"
                rows={3}
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-price">Cena (zł) *</Label>
                <Input
                  id="edit-price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={e => setFormData({ ...formData, price: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-category">Kategoria *</Label>
                <Select
                  value={formData.category}
                  onValueChange={value => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz kategorię" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRODUCT_CATEGORY_LABELS).map(([category, label]) => (
                      <SelectItem key={category} value={category}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Zdjęcie produktu</Label>
              <ImageUpload
                currentImageUrl={formData.imageUrl}
                onImageUrlChange={url => setFormData({ ...formData, imageUrl: url })}
              />
            </div>

            <div>
              <Label htmlFor="edit-productionPath">Ścieżka produkcyjna</Label>
              <Textarea
                id="edit-productionPath"
                rows={2}
                placeholder="np. Druk → Laminacja → Krojenie → Montaż"
                value={formData.productionPath}
                onChange={e => setFormData({ ...formData, productionPath: e.target.value })}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter className="flex-shrink-0 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                resetForm();
              }}
            >
              Anuluj
            </Button>
            <Button
              onClick={async () => {
                if (
                  !editingProduct ||
                  !formData.identifier ||
                  !formData.index ||
                  !formData.price ||
                  !formData.category
                ) {
                  toast.error('Wypełnij wszystkie wymagane pola');
                  return;
                }

                try {
                  const response = await fetch(`/api/products/${editingProduct.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      ...formData,
                      price: parseFloat(formData.price),
                    }),
                  });

                  if (response.ok) {
                    toast.success('Produkt zaktualizowany pomyślnie');
                    setIsEditDialogOpen(false);
                    setEditingProduct(null);
                    resetForm();
                    fetchProducts();
                  } else {
                    toast.error('Błąd aktualizacji produktu');
                  }
                } catch (error) {
                  toast.error('Błąd aktualizacji produktu');
                }
              }}
            >
              Zapisz zmiany
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
