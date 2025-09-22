import React from 'react';
import { Modal, ScrollView, View, Text, Image, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, shared } from './Theme';
const placeholder = require('../assets/icon.png');

export default function JobDetailModal({ visibleJob, onClose, showContact, setShowContact, user, onDelete }) {
  if (!visibleJob) return null;
  const isAccom = visibleJob.kind === 'accommodation';
  return (
    <Modal visible={!!visibleJob} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={shared.container}>
        <View style={{ padding: 16 }}>
          <View style={{ alignItems: 'center' }}>
            <TouchableOpacity onPress={() => setShowContact(true)}>
              {visibleJob.images && visibleJob.images.length ? (
                <FlatList horizontal data={visibleJob.images} keyExtractor={(i, idx) => (i.uri || i) + idx} renderItem={({ item }) => (
                  <Image source={typeof item === 'string' ? { uri: item } : item} style={{ width: 200, height: 120, borderRadius: 8, marginRight: 8 }} />
                )} />
              ) : (
                <Image source={visibleJob.image || placeholder} style={{ width: 120, height: 90, borderRadius: 8 }} />
              )}
            </TouchableOpacity>
            <Text style={{ marginTop: 8, fontWeight: '700', fontSize: 18 }}>{visibleJob.title}</Text>
            {isAccom ? (
              <Text style={{ color: Colors.muted, marginTop: 6 }}>{visibleJob.location}</Text>
            ) : (
              <Text style={{ color: Colors.muted, marginTop: 6 }}>{visibleJob.type} • {visibleJob.location}</Text>
            )}
            {isAccom ? (
              <Text style={{ marginTop: 8, fontWeight: '700' }}>Rent: {visibleJob.rent} {visibleJob.currency ? visibleJob.currency : ''}</Text>
            ) : (
              <Text style={{ marginTop: 8 }}>{visibleJob.salary} {visibleJob.currency ? visibleJob.currency : ''} {visibleJob.salaryType === 'hourly' ? '/hr' : '/week'}</Text>
            )}
          </View>

          <View style={{ marginTop: 16 }}>
            <Text style={{ fontWeight: '700' }}>Description</Text>
            <Text style={{ marginTop: 6 }}>{visibleJob.description}</Text>
          </View>

          {isAccom && (
            <View style={[shared.card, { marginTop: 12 }]}> 
              <Text style={{ fontWeight: '700' }}>Sharing / Address</Text>
              <Text style={{ marginTop: 6, color: Colors.muted }}>Street/Area: {visibleJob.location}</Text>
              {visibleJob.availability ? <Text style={{ marginTop: 6 }}>Availability: {visibleJob.availability}</Text> : null}
              <Text style={{ marginTop: 8, color: Colors.danger }}>Do not share full home address until you speak with the poster.</Text>
            </View>
          )}

          <View style={{ marginTop: 16 }}>
            <Text style={{ fontWeight: '700' }}>Contact</Text>
            <Text style={{ marginTop: 6 }}>{showContact ? (visibleJob.contact || 'No contact') : 'Tap image to reveal contact info'}</Text>
          </View>

          <TouchableOpacity style={[shared.primaryButton, { marginTop: 24 }]} onPress={onClose}>
            <Text style={shared.primaryButtonText}>Close</Text>
          </TouchableOpacity>
          {user && user.id && visibleJob.owner === user.id ? (
            <TouchableOpacity style={[{ marginTop: 12, backgroundColor: Colors.danger, padding: 12, borderRadius: 8, alignItems: 'center' }]} onPress={() => onDelete(visibleJob)}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Delete</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
