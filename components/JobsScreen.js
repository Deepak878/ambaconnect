import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, FlatList } from 'react-native';
import JobItem from './JobItem';
import { Colors, shared } from './Theme';

export default function JobsScreen({ jobs, onOpenJob, onSaveJob, savedIds, filters }) {
  const [query, setQuery] = useState('');
  const [partTimeOnly, setPartTimeOnly] = useState(filters?.partTimeOnly || false);

  const filtered = jobs.filter(j => {
    const matchQuery = (j.title + ' ' + (j.description || '') + ' ' + (j.location || '')).toLowerCase().includes(query.toLowerCase());
    const matchType = partTimeOnly ? (j.type || '').toLowerCase().includes('part') : true;
    return matchQuery && matchType;
  });

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', padding: 12, alignItems: 'center' }}>
        <TextInput placeholder="Search jobs or location" value={query} onChangeText={setQuery} style={[shared.input, { flex: 1 }]} />
        <TouchableOpacity style={[shared.smallButton, { marginLeft: 8, backgroundColor: partTimeOnly ? Colors.primary : Colors.card, borderColor: partTimeOnly ? Colors.primary : Colors.border }]} onPress={() => setPartTimeOnly(!partTimeOnly)}>
          <Text style={{ color: partTimeOnly ? Colors.card : Colors.muted }}>Part-time</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={({ item }) => (
          <View key={item.id} style={{ paddingHorizontal: 12 }}>
            <JobItem item={item} onOpen={onOpenJob} onSave={onSaveJob} saved={savedIds.includes(item.id)} />
          </View>
        )}
        contentContainerStyle={{ paddingVertical: 12 }}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20, color: Colors.muted }}>No jobs found</Text>}
      />
    </View>
  );
}
