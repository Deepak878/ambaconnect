import React, { memo } from 'react';
import { Image, View } from 'react-native';

const OptimizedImage = memo(({ 
  source, 
  style, 
  defaultSource, 
  resizeMode = 'cover',
  ...props 
}) => {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  return (
    <View style={style}>
      <Image
        source={error ? defaultSource : source}
        style={[style, { position: error ? 'relative' : 'absolute' }]}
        resizeMode={resizeMode}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={() => {
          setError(true);
          setLoading(false);
        }}
        {...props}
      />
      {loading && (
        <View style={[
          style, 
          { 
            backgroundColor: '#f0f0f0',
            justifyContent: 'center',
            alignItems: 'center'
          }
        ]}>
          {/* Placeholder while loading */}
        </View>
      )}
    </View>
  );
});

export default OptimizedImage;