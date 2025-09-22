import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, shared } from './Theme';

const placeholder = require('../assets/icon.png');

export default function Header({ title = 'Amba connect', onBack = null, onProfile = () => {}, user = null }) {
  const insets = useSafeAreaInsets();
  const topPad = (insets && insets.top) ? insets.top + 8 : 18;

  return (
    <View style={{ paddingTop: topPad, paddingBottom: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.card, borderBottomWidth: 1, borderColor: Colors.border }}>
      <View style={{ width: 40 }}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={{ padding: 6 }}>
            <Text style={{ color: Colors.primary, fontWeight: '700' }}>‹</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={{ flex: 1, alignItems: 'center' }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: Colors.primary }}>{title}</Text>
      </View>

      <TouchableOpacity onPress={onProfile} style={{ width: 40, alignItems: 'flex-end' }}>
        <Image source={(user && user.photo) ? { uri: user.photo } : placeholder} style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: Colors.border }} />
      </TouchableOpacity>
    </View>
  );
}
