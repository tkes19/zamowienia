'use client';

import { useState, useEffect } from 'react';

interface OrdersStats {
  totalOrders: number;
  recentOrders: number;
  todayOrders: number;
  weeklyChange: number;
  clientsCount: number;
  newClientsCount: number;
}

export function useOrdersStats() {
  const [stats, setStats] = useState<OrdersStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/orders-debug');

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (mounted && data.success && data.stats) {
          setStats(data.stats);
        }
      } catch (err: any) {
        if (mounted) {
          console.error('useOrdersStats error:', err);
          setError(err.message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchStats();

    return () => {
      mounted = false;
    };
  }, []);

  return { stats, loading, error };
}
