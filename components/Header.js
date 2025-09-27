import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, shared } from './Theme';

const placeholder = require('../assets/icon.png');

export default function Header({ title = 'Amba connect', onBack = null, onProfile = () => {}, user = null, locationLabel = null }) {

  const hasBack = typeof onBack === 'function';
  const resolvedLocation = locationLabel || 'Location off';

  return (
    <View style={{ paddingVertical: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderBottomWidth: 1, borderColor: Colors.border, position: 'relative' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 12, minWidth: 120 }}>
        {hasBack && (
          <TouchableOpacity onPress={onBack} style={{ padding: 6, marginRight: 6 }}>
            <Ionicons name="chevron-back" size={22} color={Colors.primary} />
          </TouchableOpacity>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
          <Ionicons name="location-outline" size={16} color={Colors.primary} style={{ marginRight: 6 }} />
          <Text numberOfLines={1} style={{ color: Colors.text, fontSize: 12, fontWeight: '500', width: 120 }}>
            {resolvedLocation}
          </Text>
        </View>
      </View>
      
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: Colors.primary }} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <TouchableOpacity onPress={onProfile} style={{ width: 40, alignItems: 'flex-end', justifyContent: 'center', marginLeft: 'auto' }}>
        <Image
          source={(user && user.photo) ? { uri: user.photo } : placeholder}
          style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: Colors.border }}
        />
      </TouchableOpacity>
    </View>
  );
}
