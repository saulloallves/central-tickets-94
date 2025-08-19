import { useEffect, useRef } from 'react';

interface PerformanceMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  action: string;
  ticketId?: string;
}

export const usePerformanceMetrics = () => {
  const metricsRef = useRef<PerformanceMetrics[]>([]);

  const startMetric = (action: string, ticketId?: string): string => {
    const metricId = `${action}-${Date.now()}-${Math.random()}`;
    const metric: PerformanceMetrics = {
      startTime: performance.now(),
      action,
      ticketId
    };
    
    metricsRef.current.push(metric);
    console.log(`🚀 Performance Start: ${action}`, ticketId ? `(Ticket: ${ticketId})` : '');
    
    return metricId;
  };

  const endMetric = (metricId: string, success: boolean = true) => {
    const metricIndex = metricsRef.current.findIndex(m => 
      `${m.action}-${m.startTime}-${m.ticketId || ''}`.includes(metricId.split('-')[0])
    );
    
    if (metricIndex >= 0) {
      const metric = metricsRef.current[metricIndex];
      metric.endTime = performance.now();
      metric.duration = metric.endTime - metric.startTime;
      
      const icon = success ? '✅' : '❌';
      const status = success ? 'Success' : 'Failed';
      
      console.log(`${icon} Performance End: ${metric.action} - ${metric.duration.toFixed(2)}ms (${status})`);
      
      // Log warning for slow operations (> 1000ms)
      if (metric.duration > 1000) {
        console.warn(`🐌 Slow operation detected: ${metric.action} took ${metric.duration.toFixed(2)}ms`);
      }
      
      // Keep only last 100 metrics
      if (metricsRef.current.length > 100) {
        metricsRef.current = metricsRef.current.slice(-100);
      }
    }
  };

  const getMetrics = () => {
    const completed = metricsRef.current.filter(m => m.duration);
    
    if (completed.length === 0) return null;

    const stats = {
      totalOperations: completed.length,
      averageDuration: completed.reduce((acc, m) => acc + (m.duration || 0), 0) / completed.length,
      p95Duration: calculatePercentile(completed.map(m => m.duration || 0), 95),
      p99Duration: calculatePercentile(completed.map(m => m.duration || 0), 99),
      slowOperations: completed.filter(m => (m.duration || 0) > 1000).length
    };

    return stats;
  };

  const logPerformanceSummary = () => {
    const stats = getMetrics();
    if (!stats) {
      console.log('📊 No performance metrics available');
      return;
    }

    console.group('📊 Performance Summary');
    console.log(`Total Operations: ${stats.totalOperations}`);
    console.log(`Average Duration: ${stats.averageDuration.toFixed(2)}ms`);
    console.log(`P95 Duration: ${stats.p95Duration.toFixed(2)}ms`);
    console.log(`P99 Duration: ${stats.p99Duration.toFixed(2)}ms`);
    console.log(`Slow Operations (>1s): ${stats.slowOperations}`);
    console.groupEnd();
  };

  // Auto-log summary every 30 seconds in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const interval = setInterval(logPerformanceSummary, 30000);
      return () => clearInterval(interval);
    }
  }, []);

  return {
    startMetric,
    endMetric,
    getMetrics,
    logPerformanceSummary
  };
};

// Helper function to calculate percentiles
const calculatePercentile = (values: number[], percentile: number): number => {
  const sorted = values.sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index] || 0;
};
