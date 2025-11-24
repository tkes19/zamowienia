'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  CheckCircle2,
  Hash,
  Calculator,
  FileText,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  parseProjects,
  parseQuantities,
  syncProjectFields,
  formatQuantitiesDisplay,
} from '@/lib/project-utils';
import { Tooltip } from '@/components/ui/tooltip';

export interface ProjectSelection {
  selectedProjects: string; // np. "1,2,3,4,5" lub "1-5"
  projectQuantities: string; // np. "40,40,40,40,40" lub "po 40"
  totalQuantity: number; // np. 200
  productionNotes: string; // Dodatkowy opis dla produkcji
  parsedProjects: number[]; // [1, 2, 3, 4, 5]
  parsedQuantities: number[]; // [40, 40, 40, 40, 40]
}

export interface ProjectSelectorProps {
  maxProjects?: number;
  initialSelection?: Partial<ProjectSelection>;
  disabled?: boolean;
  onValidationChange?: (isValid: boolean) => void;
}

export interface ProjectSelectorRef {
  getCurrentSelection: () => ProjectSelection | null;
  isValid: boolean;
  validation: any;
}

export const ProjectSelector = React.forwardRef<ProjectSelectorRef, ProjectSelectorProps>(
  (
    {
      maxProjects = 100,
      initialSelection,
      disabled = false,
      onValidationChange,
    }: ProjectSelectorProps,
    ref
  ) => {
    const [selectedProjects, setSelectedProjects] = useState(
      initialSelection?.selectedProjects || ''
    );
    const [projectQuantities, setProjectQuantities] = useState(
      initialSelection?.projectQuantities || ''
    );
    const [totalQuantity, setTotalQuantity] = useState<string>(
      initialSelection?.totalQuantity?.toString() || ''
    );
    const [productionNotes, setProductionNotes] = useState(initialSelection?.productionNotes || '');

    // Walidacja i parsing za pomocą useMemo - oblicza się tylko przy zmianie danych
    const validation = useMemo(() => {
      const result = {
        projectErrors: [] as string[],
        quantityErrors: [] as string[],
        isValid: false,
        parsedProjects: [] as number[],
        parsedQuantities: [] as number[],
        actualTotalQuantity: 0,
      };

      // Walidacja projektów
      if (!selectedProjects.trim()) {
        result.projectErrors.push('Podaj numery projektów');
        return result;
      }

      const projectResult = parseProjects(selectedProjects);
      if (!projectResult.success) {
        result.projectErrors.push(projectResult.error || 'Błąd projektów');
        return result;
      }

      if (projectResult.projects.length > maxProjects) {
        result.projectErrors.push(`Maksymalnie ${maxProjects} projektów w jednym zamówieniu`);
        return result;
      }

      result.parsedProjects = projectResult.projects;

      // Walidacja ilości
      const totalQty = parseInt(totalQuantity) || 0;

      if (totalQty > 0 && !projectQuantities.trim()) {
        // Mamy tylko całkowitą ilość - podziel równo
        const quantityPerProject = Math.ceil(totalQty / result.parsedProjects.length);
        result.parsedQuantities = new Array(result.parsedProjects.length).fill(quantityPerProject);
        result.actualTotalQuantity = quantityPerProject * result.parsedProjects.length;
        result.isValid = true;
        return result;
      }

      if (projectQuantities.trim()) {
        // Mamy szczegółowe ilości
        const quantityResult = parseQuantities(projectQuantities, result.parsedProjects.length);
        if (quantityResult.success) {
          result.parsedQuantities = quantityResult.quantities;
          result.actualTotalQuantity = quantityResult.totalQuantity;
          result.isValid = true;
          return result;
        } else {
          result.quantityErrors.push(quantityResult.error || 'Błąd ilości');
          return result;
        }
      }

      // Brak danych o ilościach
      result.quantityErrors.push('Podaj ilości projektów lub całkowitą liczbę sztuk');
      return result;
    }, [selectedProjects, projectQuantities, totalQuantity, maxProjects]);

    // Callback do powiadamiania o zmianie walidacji
    React.useEffect(() => {
      if (onValidationChange) {
        onValidationChange(validation.isValid);
      }
    }, [validation.isValid, onValidationChange]);

    // Expose funkcję do pobierania aktualnego stanu - dla ref
    React.useImperativeHandle(ref, () => ({
      getCurrentSelection: (): ProjectSelection | null => {
        if (!validation.isValid) return null;

        // Jeśli projectQuantities jest puste ale mamy parsedQuantities, wygeneruj string
        const finalProjectQuantities =
          projectQuantities.trim() ||
          (validation.parsedQuantities.length > 0 ? validation.parsedQuantities.join(',') : '');

        return {
          selectedProjects,
          projectQuantities: finalProjectQuantities,
          totalQuantity: validation.actualTotalQuantity,
          productionNotes,
          parsedProjects: validation.parsedProjects,
          parsedQuantities: validation.parsedQuantities,
        };
      },
      isValid: validation.isValid,
      validation,
    }));

    // Funkcje pomocnicze
    const handleAllProjects = () => {
      setSelectedProjects(`1-${maxProjects}`);
    };

    const handleQuickRange = (range: string) => {
      setSelectedProjects(range);
    };

    const handleTotalQuantityChange = (value: string) => {
      setTotalQuantity(value);
      // Wyczyść szczegółowe ilości żeby pokazać automatyczny podział
      if (value && parseInt(value) > 0) {
        setProjectQuantities('');
      }
    };

    const clearAll = () => {
      setSelectedProjects('');
      setProjectQuantities('');
      setTotalQuantity('');
      setProductionNotes('');
    };

    // Funkcja zapobiegająca przeładowaniu strony przy naciskaniu Enter
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
      }
    };

    return (
      <Card className={disabled ? 'opacity-50' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5 text-blue-600" />
            Wybór projektów
          </CardTitle>
          <p className="text-sm text-muted-foreground">Określ numery projektów i ich ilości</p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* 1. Wybór projektów */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="selectedProjects" className="text-sm font-semibold">
                  Numery projektów
                </Label>
                <Tooltip
                  content={
                    <div>
                      <p className="font-medium mb-2">Przykłady formatów:</p>
                      <p>
                        • <code className="bg-gray-800 px-1 rounded">1,2,3,4,5</code> - konkretne
                        numery
                      </p>
                      <p>
                        • <code className="bg-gray-800 px-1 rounded">1-5</code> - zakres od 1 do 5
                      </p>
                      <p>
                        • <code className="bg-gray-800 px-1 rounded">1,3,5-8</code> - kombinacja
                        numerów i zakresu
                      </p>
                    </div>
                  }
                  placement="top"
                />
              </div>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickRange('1-5')}
                  disabled={disabled}
                  className="text-xs"
                >
                  1-5
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickRange('1-10')}
                  disabled={disabled}
                  className="text-xs"
                >
                  1-10
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAllProjects}
                  disabled={disabled}
                  className="text-xs"
                >
                  Wszystkie
                </Button>
              </div>
            </div>

            <Input
              id="selectedProjects"
              placeholder="np. 1,2,3,4,5 lub 1-5 lub 1,3,5-8"
              value={selectedProjects}
              onChange={e => setSelectedProjects(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              autoComplete="off"
              className={
                validation.projectErrors.length > 0 ? 'border-red-300 focus:border-red-500' : ''
              }
            />

            {/* Błędy projektów */}
            {validation.projectErrors.length > 0 && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="text-red-700 text-sm space-y-1">
                  {validation.projectErrors.map((error, index) => (
                    <p key={index}>{error}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Podgląd wybranych projektów */}
            {validation.parsedProjects.length > 0 && (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
                <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                <div className="text-green-700 text-sm flex-1">
                  <p className="font-medium">
                    Wybrane projekty ({validation.parsedProjects.length}):
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {validation.parsedProjects.map((project, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {project}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2. Ilości */}
          {validation.parsedProjects.length > 0 && (
            <div className="space-y-3 border-t pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Całkowita ilość */}
                <div className="space-y-2">
                  <Label
                    htmlFor="totalQuantity"
                    className="text-sm font-semibold flex items-center gap-1"
                  >
                    <Calculator className="h-4 w-4" />
                    Łącznie sztuk
                    {validation.actualTotalQuantity > 0 &&
                      validation.actualTotalQuantity.toString() !== totalQuantity && (
                        <span className="text-xs text-green-600 font-normal">
                          (rzeczywista suma: {validation.actualTotalQuantity})
                        </span>
                      )}
                  </Label>
                  <Input
                    id="totalQuantity"
                    type="number"
                    placeholder="np. 200"
                    value={totalQuantity}
                    onChange={e => handleTotalQuantityChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={disabled}
                    min="1"
                    autoComplete="off"
                  />
                </div>

                {/* Szczegółowe ilości */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="projectQuantities" className="text-sm font-semibold">
                      Ilość na projekt
                    </Label>
                    <Tooltip
                      content={
                        <div>
                          <p className="font-medium mb-2">Sposoby określania ilości:</p>
                          <p>• Wpisz całkowitą liczbę - system podzieli równo</p>
                          <p>
                            • Lub wpisz <code className="bg-gray-800 px-1 rounded">po 40</code> -
                            jednakowe ilości
                          </p>
                          <p>
                            • Lub wpisz{' '}
                            <code className="bg-gray-800 px-1 rounded">40,40,40,40,40</code> - różne
                            ilości
                          </p>
                        </div>
                      }
                      placement="top"
                    />
                  </div>
                  <Input
                    id="projectQuantities"
                    placeholder="np. po 40 lub 40,40,40,40,40"
                    value={projectQuantities}
                    onChange={e => setProjectQuantities(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={disabled}
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* Błędy ilości */}
              {validation.quantityErrors.length > 0 && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                  <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="text-red-700 text-sm space-y-1">
                    {validation.quantityErrors.map((error, index) => (
                      <p key={index}>{error}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Podgląd ilości */}
              {validation.parsedQuantities.length > 0 && (
                <div className="space-y-2 p-3 bg-green-50 border border-green-200 rounded-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-green-700 font-medium text-sm">
                        Ilości na projekt ({validation.actualTotalQuantity} sztuk łącznie)
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 mt-2">
                    {validation.parsedProjects.map((project, index) => (
                      <div
                        key={project}
                        className="flex items-center justify-between text-xs bg-white rounded px-2 py-1 border"
                      >
                        <span className="font-medium text-gray-600">Proj. {project}:</span>
                        <span className="font-bold text-green-700">
                          {validation.parsedQuantities[index]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. Dodatkowy opis dla produkcji */}
          {validation.parsedProjects.length > 0 && (
            <div className="space-y-3 border-t pt-4">
              <Label
                htmlFor="productionNotes"
                className="text-sm font-semibold flex items-center gap-1"
              >
                <FileText className="h-4 w-4" />
                Dodatkowy opis dla produkcji (opcjonalnie)
              </Label>
              <Textarea
                id="productionNotes"
                placeholder="np. Standardowe kolory, bez opakowania, przyspieszony termin..."
                value={productionNotes}
                onChange={e => setProductionNotes(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                className="resize-none"
                rows={3}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Tutaj możesz podać nietypowe wymagania produkcyjne
              </p>
            </div>
          )}

          {/* Akcje */}
          {(selectedProjects || projectQuantities || totalQuantity || productionNotes) && (
            <div className="flex justify-end border-t pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={clearAll}
                disabled={disabled}
                className="flex items-center gap-1"
              >
                <Trash2 className="h-4 w-4" />
                Wyczyść
              </Button>
            </div>
          )}

          {/* Status walidacji */}
          {validation.isValid && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-green-700 font-medium text-sm">
                ✓ Dane projektów są poprawne i gotowe do dodania
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
);

ProjectSelector.displayName = 'ProjectSelector';
