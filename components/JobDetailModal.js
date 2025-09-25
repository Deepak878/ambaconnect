import React from 'react';
import { Modal, ScrollView, View, Text, Image, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, shared } from './Theme';
const placeholder = require('../assets/icon.png');
const jobPlaceholder = require('../assets/job.webp');

const { width } = Dimensions.get('window');

export default function JobDetailModal({ visibleJob, onClose, showContact, setShowContact, user, onDelete, onSeeOnMap }) {
  if (!visibleJob) return null;
  const isAccom = visibleJob.kind === 'accommodation';
  
  // Handle images based on job type

  let images = [];
  if (isAccom) {
    // For accommodations, use provided images or show placeholder if none
    images = visibleJob.images && visibleJob.images.length ? visibleJob.images : (visibleJob.image ? [visibleJob.image] : []);
  } else {
    // For jobs, use job.webp as default or provided images
    images = visibleJob.images && visibleJob.images.length ? visibleJob.images : [jobPlaceholder];
  }

  return (
    <Modal visible={!!visibleJob} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[shared.container, { backgroundColor: Colors.background || '#fff' }]}>
        {/* Header */}
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          paddingHorizontal: 16, 
          paddingVertical: 12, 
          borderBottomWidth: 1, 
          borderColor: Colors.border, 
          backgroundColor: Colors.card,
          elevation: 2,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        }}>
          <View style={{ width: 32 }} />
          <Text style={{ 
            fontWeight: '800', 
            fontSize: 18, 
            color: Colors.primary,
            textAlign: 'center',
            flex: 1
          }} numberOfLines={1}>
            {visibleJob.title}
          </Text>
          <TouchableOpacity 
            onPress={onClose} 
            style={{ 
              width: 32, 
              height: 32, 
              borderRadius: 16,
              alignItems: 'center', 
              justifyContent: 'center',
              backgroundColor: Colors.border + '30'
            }}
          >
            <Text style={{ fontSize: 18, color: Colors.primary, fontWeight: 'bold' }}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView 
          contentContainerStyle={{ 
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 32
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Image Section */}
          <View style={{ marginBottom: 20 }}>
            {images.length ? (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                style={{ marginBottom: 12 }}
                contentContainerStyle={{ paddingRight: 16 }}
              >
                {images.map((it, idx) => (
                  <Image 
                    key={idx} 
                    source={typeof it === 'string' ? { uri: it } : it} 
                    style={{ 
                      width: width * 0.75, 
                      height: 200, 
                      borderRadius: 12, 
                      marginRight: 12,
                      backgroundColor: Colors.border + '30'
                    }} 
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>
            ) : (
              <Image 
                source={isAccom ? placeholder : jobPlaceholder} 
                style={{ 
                  width: '100%', 
                  height: 180, 
                  borderRadius: 12, 
                  alignSelf: 'center', 
                  marginBottom: 12,
                  backgroundColor: Colors.border + '30'
                }} 
                resizeMode="cover"
              />
            )}
          </View>

          {/* Main Info Section */}
          <View style={[
            shared.card, 
            { 
              marginBottom: 20, 
              padding: 16, 
              borderRadius: 12,
              backgroundColor: Colors.card,
              elevation: 1,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 2,
            }
          ]}>
            <Text style={{ 
              fontWeight: '700', 
              fontSize: 20, 
              textAlign: 'center',
              marginBottom: 8,
              color: Colors.text || '#000'
            }}>
              {visibleJob.title}
            </Text>
            
            <Text style={{ 
              color: Colors.muted, 
              textAlign: 'center',
              fontSize: 16,
              marginBottom: 12
            }}>
              {isAccom ? visibleJob.location : `${visibleJob.type} • ${visibleJob.location}`}
            </Text>
            
            <View style={{
              backgroundColor: Colors.primary + '15',
              paddingVertical: 8,
              paddingHorizontal: 16,
              borderRadius: 8,
              alignSelf: 'center',
              marginBottom: 12
            }}>
              <Text style={{ 
                fontWeight: '700',
                fontSize: 18,
                color: Colors.primary,
                textAlign: 'center'
              }}>
                {isAccom 
                  ? `${visibleJob.currency || ''}${visibleJob.rent} /month`
                  : `${visibleJob.currency || ''}${visibleJob.salary} ${visibleJob.salaryType === 'hourly' ? '/hr' : '/week'}`
                }
              </Text>
            </View>

            {/* Posted by info */}
            {(visibleJob.createdBy && visibleJob.createdBy.name) || visibleJob.userPhone ? (
              <Text style={{ 
                color: Colors.muted, 
                textAlign: 'center',
                fontSize: 14,
                marginBottom: 4
              }}>
                Posted by {visibleJob.createdBy?.name || visibleJob.userPhone}
              </Text>
            ) : null}
            
            {visibleJob.createdAt ? (
              <Text style={{ 
                color: Colors.muted, 
                textAlign: 'center',
                fontSize: 12
              }}>
                {typeof visibleJob.createdAt === 'object' && visibleJob.createdAt.toDate 
                  ? visibleJob.createdAt.toDate().toLocaleDateString() 
                  : new Date(visibleJob.createdAt).toLocaleDateString()
                }
              </Text>
            ) : null}
          </View>

          {/* Description Section */}
          <View style={[
            shared.card,
            {
              marginBottom: 16,
              padding: 16,
              borderRadius: 12,
              backgroundColor: Colors.card
            }
          ]}>
            <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 8, color: Colors.text || '#000' }}>
              Description
            </Text>
            <Text style={{ 
              lineHeight: 20, 
              color: Colors.text || '#000',
              fontSize: 15
            }}>
              {visibleJob.description || 'No description provided'}
            </Text>
          </View>

          {/* Schedule Section */}
          {visibleJob.schedule && typeof visibleJob.schedule === 'object' && Object.keys(visibleJob.schedule).length ? (
            <View style={[
              shared.card,
              {
                marginBottom: 16,
                padding: 16,
                borderRadius: 12,
                backgroundColor: Colors.card
              }
            ]}>
              <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 12, color: Colors.text || '#000' }}>
                Schedule
              </Text>
              <View style={{ gap: 8 }}>
                {Object.keys(visibleJob.schedule).map(k => (
                  visibleJob.schedule[k] && visibleJob.schedule[k].enabled ? (
                    <View key={k} style={{ 
                      flexDirection: 'row', 
                      justifyContent: 'space-between',
                      paddingVertical: 4
                    }}>
                      <Text style={{ fontWeight: '600', color: Colors.text || '#000' }}>{k}</Text>
                      <Text style={{ color: Colors.muted }}>
                        {visibleJob.schedule[k].start} - {visibleJob.schedule[k].end}
                      </Text>
                    </View>
                  ) : null
                ))}
              </View>
            </View>
          ) : null}

          {/* Duration Section */}
          {visibleJob.duration ? (
            <View style={[
              shared.card,
              {
                marginBottom: 16,
                padding: 16,
                borderRadius: 12,
                backgroundColor: Colors.card
              }
            ]}>
              <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 8, color: Colors.text || '#000' }}>
                Duration
              </Text>
              <Text style={{ color: Colors.text || '#000', fontSize: 15 }}>
                {visibleJob.duration.start || 'N/A'} — {visibleJob.duration.end || 'N/A'}
              </Text>
            </View>
          ) : null}

          {/* Accommodation Specific Info */}
          {isAccom && (
            <View style={[
              shared.card, 
              { 
                marginBottom: 16,
                padding: 16,
                borderRadius: 12,
                backgroundColor: Colors.primary + '05',
                borderWidth: 1,
                borderColor: Colors.primary + '20'
              }
            ]}> 
              <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 12, color: Colors.text || '#000' }}>
                Accommodation Details
              </Text>
              <Text style={{ marginBottom: 8, color: Colors.text || '#000' }}>
                <Text style={{ fontWeight: '600' }}>Type:</Text> {visibleJob.accomType || 'Not specified'}
              </Text>
              <Text style={{ marginBottom: 8, color: Colors.text || '#000' }}>
                <Text style={{ fontWeight: '600' }}>Area:</Text> {visibleJob.location}
              </Text>
              {visibleJob.availability && (
                <Text style={{ marginBottom: 8, color: Colors.text || '#000' }}>
                  <Text style={{ fontWeight: '600' }}>Availability:</Text> {visibleJob.availability}
                </Text>
              )}
              <View style={{
                marginTop: 8,
                padding: 12,
                backgroundColor: Colors.warning + '20',
                borderRadius: 8,
                borderLeftWidth: 4,
                borderLeftColor: Colors.warning || '#ff9500'
              }}>
                <Text style={{ color: Colors.warning || '#ff9500', fontSize: 13, fontWeight: '500' }}>
                  ⚠️ Safety tip: Do not share your full home address until you've spoken with the poster directly.
                </Text>
              </View>
            </View>
          )}

          {/* Contact Section */}
          <View style={[
            shared.card,
            {
              marginBottom: 16,
              padding: 16,
              borderRadius: 12,
              backgroundColor: Colors.card
            }
          ]}>
            <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 8, color: Colors.text || '#000' }}>
              Contact Information
            </Text>
            {showContact ? (
              <View style={{
                backgroundColor: Colors.primary + '10',
                padding: 12,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: Colors.primary + '30'
              }}>
                <Text style={{ 
                  fontSize: 15, 
                  fontWeight: '500',
                  color: Colors.text || '#000'
                }}>
                  {visibleJob.contact || 'No contact information provided'}
                </Text>
              </View>
            ) : (
              <TouchableOpacity 
                onPress={() => setShowContact(true)} 
                style={{
                  backgroundColor: Colors.primary,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  alignItems: 'center'
                }}
              >
                <Text style={{ 
                  color: '#fff', 
                  fontWeight: '600',
                  fontSize: 15
                }}>
                  📞 Reveal Contact Info
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* See on Map Button */}
          {(visibleJob.lat && visibleJob.lng) || (visibleJob.latitude && visibleJob.longitude) ? (
            <View style={{ marginTop: 16 }}>
              <Text style={{ fontWeight: '700' }}>Location</Text>
              <TouchableOpacity 
                style={[
                  shared.card, 
                  { 
                    marginTop: 8, 
                    padding: 12, 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    backgroundColor: Colors.primary + '10',
                    borderColor: Colors.primary,
                    borderWidth: 1
                  }
                ]} 
                onPress={() => onSeeOnMap && onSeeOnMap(visibleJob)}
              >
                <Text style={{ fontSize: 18, marginRight: 8 }}>�️</Text>
                <Text style={{ color: Colors.primary, fontWeight: '700' }}>Open in Maps</Text>
              </TouchableOpacity>
              <Text style={{ color: Colors.muted, fontSize: 12, marginTop: 4, textAlign: 'center' }}>
                Opens location in your device's maps app
              </Text>
            </View>
          ) : (
            <View style={{ marginTop: 16 }}>
              <Text style={{ fontWeight: '700' }}>Location</Text>
              <Text style={{ color: Colors.muted, marginTop: 6 }}>
                {visibleJob.location || 'Location not specified'}
              </Text>
              <Text style={{ color: Colors.muted, fontSize: 12, marginTop: 4 }}>
                Exact coordinates not available for map view
              </Text>
            </View>
          )}

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
