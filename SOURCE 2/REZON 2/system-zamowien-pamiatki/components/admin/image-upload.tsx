'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, Link, X, Image as ImageIcon } from 'lucide-react';
import { toast } from 'react-hot-toast';
import Image from 'next/image';

interface ImageUploadProps {
  currentImageUrl?: string;
  onImageUrlChange: (url: string) => void;
}

export function ImageUpload({ currentImageUrl, onImageUrlChange }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [externalUrl, setExternalUrl] = useState(currentImageUrl || '');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/r2/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.success) {
        onImageUrlChange(result.imageUrl);
        toast.success('Zdjęcie zostało przesłane pomyślnie do R2');
        console.log('Upload success:', result);
      } else {
        console.error('Upload failed:', result);
        toast.error(result.message || 'Błąd podczas przesyłania pliku do R2');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Błąd podczas przesyłania pliku do R2');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);

    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleFileUpload(file);
    } else {
      toast.error('Proszę wybrać plik obrazu');
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
  };

  const handleExternalUrlSubmit = () => {
    if (externalUrl) {
      onImageUrlChange(externalUrl);
      toast.success('URL zdjęcia został zaktualizowany');
    }
  };

  const handleRemoveImage = () => {
    onImageUrlChange('');
    setExternalUrl('');
    toast.success('Zdjęcie zostało usunięte');
  };

  return (
    <div className="space-y-4">
      <Label>Zdjęcie produktu</Label>

      {/* Current Image Preview */}
      {currentImageUrl && (
        <div className="relative w-32 h-32 border border-gray-200 rounded-lg overflow-hidden">
          <Image
            src={currentImageUrl}
            alt="Podgląd produktu"
            fill
            className="object-cover"
            onError={() => {
              toast.error('Nie można załadować zdjęcia');
              handleRemoveImage();
            }}
          />
          <Button
            size="sm"
            variant="destructive"
            className="absolute top-1 right-1 h-6 w-6 p-0"
            onClick={handleRemoveImage}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload">Prześlij plik</TabsTrigger>
          <TabsTrigger value="url">Link zewnętrzny</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-4">
          <Card>
            <CardContent className="p-4">
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300'
                } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/*"
                  className="hidden"
                  disabled={isUploading}
                />

                {isUploading ? (
                  <div className="flex flex-col items-center space-y-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="text-sm text-gray-500">Przesyłanie pliku...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center space-y-2 cursor-pointer">
                    <Upload className="h-8 w-8 text-gray-400" />
                    <p className="text-sm font-medium text-gray-700">
                      Przeciągnij i upuść lub kliknij aby wybrać plik
                    </p>
                    <p className="text-xs text-gray-500">JPG, PNG, WebP, GIF - maksymalnie 5MB</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="url" className="mt-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex space-x-2">
                <div className="flex-1">
                  <Input
                    placeholder="https://example.com/image.jpg"
                    value={externalUrl}
                    onChange={e => setExternalUrl(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && handleExternalUrlSubmit()}
                  />
                </div>
                <Button onClick={handleExternalUrlSubmit} disabled={!externalUrl} size="sm">
                  <Link className="h-4 w-4 mr-1" />
                  Użyj
                </Button>
              </div>
              <p className="text-xs text-gray-500">Wklej bezpośredni link do zdjęcia z internetu</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Usage Tips */}
      <div className="text-xs text-gray-500 space-y-1">
        <p>
          <strong>Wskazówki:</strong>
        </p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Najlepsze wymiary: 400x400px lub większe (kwadratowe)</li>
          <li>Format JPG zapewnia najmniejszy rozmiar pliku</li>
          <li>PNG obsługuje przezroczystość tła</li>
        </ul>
      </div>
    </div>
  );
}
