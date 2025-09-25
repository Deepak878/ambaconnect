import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Colors, shared } from './Theme';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={[shared.container, shared.center, { padding: 20 }]}>
          <Text style={{ fontSize: 48, marginBottom: 20 }}>😵</Text>
          <Text style={[shared.heading2, { textAlign: 'center', marginBottom: 12 }]}>
            Oops! Something went wrong
          </Text>
          <Text style={[shared.bodyTextSecondary, { textAlign: 'center', marginBottom: 24 }]}>
            The app encountered an unexpected error. Please try restarting.
          </Text>
          <TouchableOpacity 
            style={shared.primaryButton}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={shared.primaryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;