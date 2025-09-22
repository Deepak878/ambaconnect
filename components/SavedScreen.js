import React from 'react';
import { View, Text, FlatList, TouchableOpacity, Image } from 'react-native';
import { shared, Colors } from './Theme';
const placeholder = require('../assets/icon.png');

export default function SavedScreen({ savedJobs, onOpen, onSave }) {
  if (!savedJobs.length) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
  <Text style={{ color: Colors.muted }}>No saved jobs yet.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={savedJobs}
      keyExtractor={i => i.id}
      contentContainerStyle={{ padding: 12 }}
      renderItem={({ item }) => (
        <TouchableOpacity key={item.id} style={[shared.card, { flexDirection: 'row', alignItems: 'center', marginBottom: 10 }]} onPress={() => onOpen(item)}>
          <Image source={(item.images && item.images[0]) ? (typeof item.images[0] === 'string' ? { uri: item.images[0] } : item.images[0]) : placeholder} style={{ width: 56, height: 56, borderRadius: 28, marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700' }}>{item.title}</Text>
            <Text style={{ color: Colors.muted, marginTop: 4 }}>{item.type} • {item.location}</Text>
          </View>
          {onSave ? (
            <TouchableOpacity onPress={() => onSave(item)} style={{ padding: 8, borderRadius: 8, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.primary }}>
              <Text style={{ color: Colors.primary, fontWeight: '700' }}>Unsave</Text>
            </TouchableOpacity>
          ) : null}
        </TouchableOpacity>
      )}
    />
  );
}
