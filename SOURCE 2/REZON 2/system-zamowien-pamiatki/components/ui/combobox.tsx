'use client';

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, ChevronDown, Search, Loader2 } from 'lucide-react';

export interface ComboboxOption<T = any> {
  value: string;
  label: string;
  disabled?: boolean;
  data?: T;
}

interface ComboboxProps<T = any> {
  value?: string;
  onChange: (value: string, option?: ComboboxOption<T>) => void;
  options: ComboboxOption<T>[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  loading?: boolean;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
  label?: string;
  description?: string;
  error?: string;
  onSearch?: (query: string) => void;
  debounceMs?: number;
}

export function Combobox<T = any>({
  value = '',
  onChange,
  options = [],
  placeholder = 'Wybierz opcję...',
  searchPlaceholder = 'Wyszukaj...',
  emptyMessage = 'Brak wyników',
  loading = false,
  disabled = false,
  clearable = true,
  className,
  label,
  description,
  error,
  onSearch,
  debounceMs = 300,
}: ComboboxProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Znajdź wybraną opcję
  const selectedOption = options.find(option => option.value === value);
  const displayValue = selectedOption ? selectedOption.label : '';

  // Filtruj opcje
  const filteredOptions = options.filter(
    option =>
      option.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      option.value.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Debounced search
  useEffect(() => {
    if (!onSearch) return;

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      onSearch(searchQuery);
    }, debounceMs);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, onSearch, debounceMs]);

  // Zarządzanie klawiaturą
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;

    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        if (isOpen) {
          if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
            const option = filteredOptions[highlightedIndex];
            if (!option.disabled) {
              onChange(option.value, option);
              setIsOpen(false);
              setSearchQuery('');
            }
          } else if (filteredOptions.length === 1 && !filteredOptions[0].disabled) {
            onChange(filteredOptions[0].value, filteredOptions[0]);
            setIsOpen(false);
            setSearchQuery('');
          }
        } else {
          setIsOpen(true);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSearchQuery('');
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setHighlightedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (isOpen) {
          setHighlightedIndex(prev => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
        }
        break;
      case 'Tab':
        if (isOpen && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          event.preventDefault();
          const option = filteredOptions[highlightedIndex];
          if (!option.disabled) {
            onChange(option.value, option);
            setIsOpen(false);
            setSearchQuery('');
          }
        }
        break;
    }
  };

  // Scroll to highlighted item
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listRef.current) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({
          block: 'nearest',
        });
      }
    }
  }, [highlightedIndex, isOpen]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleClear = () => {
    onChange('');
    setSearchQuery('');
    inputRef.current?.focus();
  };

  const handleOptionClick = (option: ComboboxOption<T>) => {
    if (option.disabled) return;
    onChange(option.value, option);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className={cn('space-y-2', className)}>
      {label && <Label className="text-sm font-medium text-gray-700">{label}</Label>}

      {description && <p className="text-sm text-gray-600">{description}</p>}

      <div className="relative" ref={containerRef}>
        <div className="relative">
          <Input
            ref={inputRef}
            placeholder={isOpen ? searchPlaceholder : placeholder}
            value={isOpen ? searchQuery : displayValue}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => !disabled && setIsOpen(true)}
            disabled={disabled}
            className={cn(
              'pr-20 cursor-pointer',
              error && 'border-red-500 focus:border-red-500 focus:ring-red-500'
            )}
            autoComplete="off"
          />

          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {loading && <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />}

            {clearable && value && !loading && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-gray-100"
                onClick={handleClear}
              >
                <X className="h-3 w-3" />
              </Button>
            )}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-gray-100"
              onClick={() => !disabled && setIsOpen(!isOpen)}
            >
              <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
            </Button>
          </div>
        </div>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
            {loading ? (
              <div className="p-3 text-center text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                Ładowanie...
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-gray-500">
                {emptyMessage}
                {searchQuery && <div className="text-sm mt-1">dla: "{searchQuery}"</div>}
              </div>
            ) : (
              <ul ref={listRef}>
                {filteredOptions.map((option, index) => (
                  <li key={option.value}>
                    <button
                      type="button"
                      className={cn(
                        'w-full text-left px-3 py-2 text-sm transition-colors',
                        'hover:bg-gray-100 focus:bg-gray-100',
                        highlightedIndex === index && 'bg-gray-100',
                        option.disabled && 'opacity-50 cursor-not-allowed',
                        value === option.value && 'bg-blue-50 text-blue-700 font-medium'
                      )}
                      onClick={() => handleOptionClick(option)}
                      disabled={option.disabled}
                    >
                      {option.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
