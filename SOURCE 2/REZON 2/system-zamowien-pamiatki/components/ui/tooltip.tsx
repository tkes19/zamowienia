'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';

interface TooltipProps {
  content: string | React.ReactNode;
  children?: React.ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  showIcon?: boolean;
  iconClassName?: string;
  disabled?: boolean;
}

export function Tooltip({
  content,
  children,
  placement = 'top',
  className = '',
  showIcon = true,
  iconClassName = '',
  disabled = false,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Detect mobile devices
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
    };
    checkMobile();
  }, []);

  // Handle click outside for mobile
  useEffect(() => {
    if (!isMobile || !isVisible) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsVisible(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobile, isVisible]);

  const handleMouseEnter = () => {
    if (!isMobile && !disabled) {
      setIsVisible(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isMobile && !disabled) {
      setIsVisible(false);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isMobile && !disabled) {
      setIsVisible(!isVisible);
    }
  };

  const renderTooltip = () => {
    if (!isVisible) return null;

    return (
      <div
        ref={tooltipRef}
        className={`
          absolute z-50 px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg shadow-sm
          transition-all duration-200 max-w-xs w-max
          ${placement === 'top' ? 'bottom-full mb-2 left-1/2 -translate-x-1/2' : ''}
          ${placement === 'bottom' ? 'top-full mt-2 left-1/2 -translate-x-1/2' : ''}
          ${placement === 'left' ? 'right-full mr-2 top-1/2 -translate-y-1/2' : ''}
          ${placement === 'right' ? 'left-full ml-2 top-1/2 -translate-y-1/2' : ''}
        `}
      >
        {content}

        {/* Arrow */}
        <div
          className={`
            absolute w-2 h-2 bg-gray-900 transform rotate-45
            ${placement === 'top' ? 'top-full left-1/2 -translate-x-1/2 -translate-y-1/2' : ''}
            ${placement === 'bottom' ? 'bottom-full left-1/2 -translate-x-1/2 translate-y-1/2' : ''}
            ${placement === 'left' ? 'left-full top-1/2 -translate-y-1/2 -translate-x-1/2' : ''}
            ${placement === 'right' ? 'right-full top-1/2 -translate-y-1/2 translate-x-1/2' : ''}
          `}
        />
      </div>
    );
  };

  const trigger =
    children ||
    (showIcon && (
      <Info className={`h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help ${iconClassName}`} />
    ));

  return (
    <div
      ref={triggerRef}
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {trigger}
      {renderTooltip()}
    </div>
  );
}
