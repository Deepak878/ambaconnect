import React from 'react';
import { Modal, ScrollView, View, Text, Image, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, shared } from './Theme';
const placeholder = require('../assets/icon.png');

const { width } = Dimensions.get('window');

export default function JobDetailModal({ visibleJob, onClose, showContact, setShowContact, user, onDelete }) {
  if (!visibleJob) return null;
  const isAccom = visibleJob.kind === 'accommodation';
  const images = visibleJob.images && visibleJob.images.length ? visibleJob.images : (visibleJob.image ? [visibleJob.image] : []);

  return (
    <Modal visible={!!visibleJob} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={shared.container}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card }}>
          <View style={{ width: 40 }} />
          <Text style={{ fontWeight: '800', fontSize: 16, color: Colors.primary }}>{visibleJob.title}</Text>
          <TouchableOpacity onPress={onClose} style={{ width: 40, alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 20, color: Colors.primary }}>✕</Text>
          </TouchableOpacity>
        </View>

  <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {images.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {images.map((it, idx) => (
                <Image key={idx} source={typeof it === 'string' ? { uri: it } : it} style={{ width: width * 0.8, height: 180, borderRadius: 8, marginRight: 8 }} />
              ))}
            </ScrollView>
          ) : (
            <Image source={placeholder} style={{ width: 140, height: 100, borderRadius: 8, alignSelf: 'center', marginBottom: 12 }} />
          )}

          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontWeight: '700', fontSize: 18 }}>{visibleJob.title}</Text>
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

            {/* show createdBy / userPhone if present */}
            {visibleJob.createdBy && visibleJob.createdBy.name ? (
              <Text style={{ color: Colors.muted, marginTop: 6 }}>Posted by {visibleJob.createdBy.name}{visibleJob.userPhone ? ` • ${visibleJob.userPhone}` : ''}</Text>
            ) : visibleJob.userPhone ? (
              <Text style={{ color: Colors.muted, marginTop: 6 }}>Posted by {visibleJob.userPhone}</Text>
            ) : null}
            {visibleJob.createdAt ? (
              <Text style={{ color: Colors.muted, marginTop: 4, fontSize: 12 }}>Posted: {typeof visibleJob.createdAt === 'object' && visibleJob.createdAt.toDate ? visibleJob.createdAt.toDate().toLocaleString() : String(visibleJob.createdAt)}</Text>
            ) : null}
          </View>

          <View style={{ marginTop: 16 }}>
            <Text style={{ fontWeight: '700' }}>Description</Text>
            <Text style={{ marginTop: 6 }}>{visibleJob.description || 'No description provided'}</Text>
          </View>

          {visibleJob.schedule && typeof visibleJob.schedule === 'object' && Object.keys(visibleJob.schedule).length ? (
            <View style={{ marginTop: 12 }}>
              <Text style={{ fontWeight: '700' }}>Schedule</Text>
              {Object.keys(visibleJob.schedule).map(k => (
                visibleJob.schedule[k] && visibleJob.schedule[k].enabled ? (
                  <Text key={k} style={{ marginTop: 6 }}>{k}: {visibleJob.schedule[k].start} - {visibleJob.schedule[k].end}</Text>
                ) : null
              ))}
            </View>
          ) : null}

          {visibleJob.duration ? (
            <View style={{ marginTop: 12 }}>
              <Text style={{ fontWeight: '700' }}>Duration</Text>
              <Text style={{ marginTop: 6 }}>{visibleJob.duration.start || 'N/A'} — {visibleJob.duration.end || 'N/A'}</Text>
            </View>
          ) : null}

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
            {showContact ? (
              <Text style={{ marginTop: 6 }}>{visibleJob.contact || 'No contact'}</Text>
            ) : (
              <TouchableOpacity onPress={() => setShowContact(true)} style={{ marginTop: 8 }}>
                <Text style={{ color: Colors.primary }}>Reveal contact info</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={[shared.primaryButton, { marginTop: 24, paddingVertical: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]} onPress={onClose}>
            <Text style={[shared.primaryButtonText, { marginRight: 8, fontSize: 16 }]}>✕</Text>
            <Text style={shared.primaryButtonText}>Close</Text>
          </TouchableOpacity>

          {user && user.id && visibleJob.owner === user.id ? (
            <TouchableOpacity style={[{ marginTop: 12, backgroundColor: Colors.danger, padding: 12, borderRadius: 8, alignItems: 'center' }]} onPress={() => onDelete(visibleJob)}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Delete</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
