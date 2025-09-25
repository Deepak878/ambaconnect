import React from 'react';
import { View, Animated } from 'react-native';
import { Colors } from './Theme';

const SkeletonItem = ({ width = '100%', height = 20, borderRadius = 4 }) => {
  const animatedValue = new Animated.Value(0);
  
  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const backgroundColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.bg, '#e8e8e8'],
  });

  return (
    <Animated.View
      style={{
        width,
        height,
        backgroundColor,
        borderRadius,
        marginVertical: 4,
      }}
    />
  );
};

export const JobItemSkeleton = () => (
  <View style={{ 
    padding: 16, 
    marginHorizontal: 12, 
    marginVertical: 6,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border
  }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <SkeletonItem width="70%" height={18} />
      <SkeletonItem width={60} height={16} borderRadius={8} />
    </View>
    <SkeletonItem width="50%" height={14} />
    <SkeletonItem width="80%" height={14} />
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
      <SkeletonItem width="40%" height={14} />
      <SkeletonItem width={24} height={24} borderRadius={12} />
    </View>
  </View>
);

export const ListSkeleton = ({ count = 5 }) => (
  <View>
    {Array.from({ length: count }).map((_, index) => (
      <JobItemSkeleton key={index} />
    ))}
  </View>
);