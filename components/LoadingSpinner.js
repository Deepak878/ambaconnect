import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { Colors } from './Theme';

export const LoadingSpinner = ({ message = "Loading..." }) => (
  <View style={{ 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center',
    padding: 20 
  }}>
    <ActivityIndicator size="large" color={Colors.primary} />
    <Text style={{ 
      marginTop: 12, 
      color: Colors.muted, 
      textAlign: 'center' 
    }}>
      {message}
    </Text>
  </View>
);

export const InlineSpinner = ({ size = "small", color = Colors.primary }) => (
  <ActivityIndicator size={size} color={color} />
);