import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Performance analytics utility
class PerformanceAnalytics {
  constructor() {
    this.metrics = {
      appLaunchTime: 0,
      screenLoadTimes: {},
      apiCallTimes: {},
      errorCounts: {},
      userInteractions: 0,
      memoryUsage: [],
    };
    this.startTime = Date.now();
  }

  // Track screen load time
  trackScreenLoad(screenName, startTime = Date.now()) {
    const loadTime = Date.now() - startTime;
    this.metrics.screenLoadTimes[screenName] = loadTime;
    this.saveMetrics();
    return loadTime;
  }

  // Track API call performance
  trackApiCall(endpoint, duration, success = true) {
    if (!this.metrics.apiCallTimes[endpoint]) {
      this.metrics.apiCallTimes[endpoint] = {
        totalTime: 0,
        callCount: 0,
        successRate: 0,
      };
    }
    
    const apiMetric = this.metrics.apiCallTimes[endpoint];
    apiMetric.totalTime += duration;
    apiMetric.callCount += 1;
    apiMetric.successRate = success 
      ? (apiMetric.successRate * (apiMetric.callCount - 1) + 1) / apiMetric.callCount
      : (apiMetric.successRate * (apiMetric.callCount - 1)) / apiMetric.callCount;
    
    this.saveMetrics();
  }

  // Track errors
  trackError(errorType, errorMessage) {
    if (!this.metrics.errorCounts[errorType]) {
      this.metrics.errorCounts[errorType] = {
        count: 0,
        lastOccurred: null,
        messages: [],
      };
    }
    
    this.metrics.errorCounts[errorType].count += 1;
    this.metrics.errorCounts[errorType].lastOccurred = new Date().toISOString();
    this.metrics.errorCounts[errorType].messages.push(errorMessage);
    
    // Keep only last 10 error messages
    if (this.metrics.errorCounts[errorType].messages.length > 10) {
      this.metrics.errorCounts[errorType].messages.shift();
    }
    
    this.saveMetrics();
  }

  // Track user interactions
  trackUserInteraction(actionType) {
    this.metrics.userInteractions += 1;
    this.saveMetrics();
  }

  // Track memory usage (simplified)
  trackMemoryUsage() {
    const memoryInfo = {
      timestamp: Date.now(),
      // In a real app, you'd get actual memory stats
      // For now, this is a placeholder
      usedMemory: Math.floor(Math.random() * 100) + 50,
    };
    
    this.metrics.memoryUsage.push(memoryInfo);
    
    // Keep only last 100 measurements
    if (this.metrics.memoryUsage.length > 100) {
      this.metrics.memoryUsage.shift();
    }
    
    this.saveMetrics();
  }

  // Get performance report
  getPerformanceReport() {
    const report = {
      appUptimeMs: Date.now() - this.startTime,
      averageScreenLoadTime: this.getAverageScreenLoadTime(),
      slowestScreens: this.getSlowestScreens(),
      apiPerformance: this.getApiPerformanceSummary(),
      errorSummary: this.getErrorSummary(),
      userEngagement: this.getUserEngagementMetrics(),
      recommendations: this.getPerformanceRecommendations(),
    };
    
    return report;
  }

  getAverageScreenLoadTime() {
    const loadTimes = Object.values(this.metrics.screenLoadTimes);
    if (loadTimes.length === 0) return 0;
    return loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length;
  }

  getSlowestScreens(limit = 5) {
    return Object.entries(this.metrics.screenLoadTimes)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([screen, time]) => ({ screen, loadTime: time }));
  }

  getApiPerformanceSummary() {
    const summary = {};
    Object.entries(this.metrics.apiCallTimes).forEach(([endpoint, metrics]) => {
      summary[endpoint] = {
        averageResponseTime: metrics.totalTime / metrics.callCount,
        totalCalls: metrics.callCount,
        successRate: metrics.successRate,
      };
    });
    return summary;
  }

  getErrorSummary() {
    const totalErrors = Object.values(this.metrics.errorCounts)
      .reduce((sum, error) => sum + error.count, 0);
    
    const mostCommonErrors = Object.entries(this.metrics.errorCounts)
      .sort(([,a], [,b]) => b.count - a.count)
      .slice(0, 5)
      .map(([type, data]) => ({ type, count: data.count, lastOccurred: data.lastOccurred }));

    return {
      totalErrors,
      mostCommonErrors,
      errorRate: totalErrors / Math.max(this.metrics.userInteractions, 1),
    };
  }

  getUserEngagementMetrics() {
    const uptimeMinutes = (Date.now() - this.startTime) / 60000;
    return {
      totalInteractions: this.metrics.userInteractions,
      interactionsPerMinute: this.metrics.userInteractions / Math.max(uptimeMinutes, 1),
      sessionDuration: uptimeMinutes,
    };
  }

  getPerformanceRecommendations() {
    const recommendations = [];
    
    // Check for slow screens
    const avgLoadTime = this.getAverageScreenLoadTime();
    if (avgLoadTime > 2000) {
      recommendations.push({
        type: 'performance',
        message: `Average screen load time is ${avgLoadTime}ms. Consider optimizing components or adding loading states.`,
        priority: 'high'
      });
    }

    // Check error rate
    const errorSummary = this.getErrorSummary();
    if (errorSummary.errorRate > 0.1) {
      recommendations.push({
        type: 'reliability',
        message: `Error rate is ${(errorSummary.errorRate * 100).toFixed(1)}%. Investigate common error patterns.`,
        priority: 'high'
      });
    }

    // Check API performance
    const apiSummary = this.getApiPerformanceSummary();
    Object.entries(apiSummary).forEach(([endpoint, metrics]) => {
      if (metrics.averageResponseTime > 5000) {
        recommendations.push({
          type: 'api',
          message: `${endpoint} API calls are slow (${metrics.averageResponseTime}ms avg). Consider optimization.`,
          priority: 'medium'
        });
      }
      if (metrics.successRate < 0.95) {
        recommendations.push({
          type: 'reliability',
          message: `${endpoint} has low success rate (${(metrics.successRate * 100).toFixed(1)}%). Check error handling.`,
          priority: 'high'
        });
      }
    });

    return recommendations;
  }

  async saveMetrics() {
    try {
      await AsyncStorage.setItem('@performance_metrics', JSON.stringify(this.metrics));
    } catch (error) {
      console.warn('Failed to save performance metrics:', error);
    }
  }

  async loadMetrics() {
    try {
      const stored = await AsyncStorage.getItem('@performance_metrics');
      if (stored) {
        this.metrics = { ...this.metrics, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.warn('Failed to load performance metrics:', error);
    }
  }

  // Reset all metrics
  async resetMetrics() {
    this.metrics = {
      appLaunchTime: 0,
      screenLoadTimes: {},
      apiCallTimes: {},
      errorCounts: {},
      userInteractions: 0,
      memoryUsage: [],
    };
    await this.saveMetrics();
  }
}

// Create singleton instance
export const performanceAnalytics = new PerformanceAnalytics();

// React hook for using performance analytics
export const usePerformanceTracking = (screenName) => {
  const [loadTime, setLoadTime] = useState(null);
  
  useEffect(() => {
    const startTime = Date.now();
    
    return () => {
      const duration = performanceAnalytics.trackScreenLoad(screenName, startTime);
      setLoadTime(duration);
    };
  }, [screenName]);

  const trackUserAction = (actionType) => {
    performanceAnalytics.trackUserInteraction(actionType);
  };

  const trackError = (errorType, errorMessage) => {
    performanceAnalytics.trackError(errorType, errorMessage);
  };

  return {
    loadTime,
    trackUserAction,
    trackError,
    getReport: () => performanceAnalytics.getPerformanceReport(),
  };
};

// HOC for automatic performance tracking
export const withPerformanceTracking = (WrappedComponent, screenName) => {
  return function PerformanceTrackedComponent(props) {
    usePerformanceTracking(screenName);
    return <WrappedComponent {...props} />;
  };
};