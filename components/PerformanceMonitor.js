import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Colors } from './Theme';

// Simple performance monitor for debugging load times
export const PerformanceMonitor = ({ onLoadTime, screenName = 'Screen' }) => {
  const [loadTime, setLoadTime] = useState(null);
  const [startTime] = useState(Date.now());

  useEffect(() => {
    const endTime = Date.now();
    const duration = endTime - startTime;
    setLoadTime(duration);
    
    if (onLoadTime) {
      onLoadTime(duration);
    }
    
    // Log performance for debugging
    console.log(`${screenName} load time: ${duration}ms`);
  }, [startTime, onLoadTime, screenName]);

  // Only show in development
  if (__DEV__ && loadTime) {
    return (
      <View style={{
        position: 'absolute',
        top: 50,
        right: 10,
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: 4,
        borderRadius: 4,
        zIndex: 1000
      }}>
        <Text style={{ color: 'white', fontSize: 10 }}>
          {screenName}: {loadTime}ms
        </Text>
      </View>
    );
  }

  return null;
};

export default PerformanceMonitor;