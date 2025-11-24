'use client';

import { useState, useEffect } from 'react';

interface RecentOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  total: number;
  status: string;
  createdAt: string;
  salesRep?: string;
}

interface RecentOrdersResponse {
  success: boolean;
  orders: RecentOrder[];
  error?: string;
}

export function useRecentOrders() {
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchRecentOrders = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/recent-orders');

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data: RecentOrdersResponse = await response.json();

        if (mounted) {
          if (data.success && data.orders) {
            setOrders(data.orders);
          } else {
            setError(data.error || 'Failed to load orders');
          }
        }
      } catch (err: any) {
        if (mounted) {
          console.error('useRecentOrders error:', err);
          setError(err.message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchRecentOrders();

    return () => {
      mounted = false;
    };
  }, []);

  return { orders, loading, error };
}
