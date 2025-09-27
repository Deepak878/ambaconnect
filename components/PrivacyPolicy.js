import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { shared, Colors } from './Theme';

export default function PrivacyPolicy({ visible, onClose }) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[shared.container, { padding: 0 }]}>
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: Colors.border,
          backgroundColor: Colors.card,
        }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.text }}>
            Privacy Policy
          </Text>
          <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          <Text style={{ fontSize: 14, color: Colors.muted, marginBottom: 16 }}>
            Last updated: {new Date().toLocaleDateString()}
          </Text>

          <View style={[shared.card, { marginBottom: 16 }]}>
            <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 12, color: Colors.text }}>
              1. Information We Collect
            </Text>
            <Text style={{ fontSize: 14, lineHeight: 20, color: Colors.text, marginBottom: 12 }}>
              We collect information you provide directly to us, such as when you create an account, post a job, or contact us:
            </Text>
            <Text style={{ fontSize: 14, lineHeight: 20, color: Colors.text, marginLeft: 12 }}>
              • Personal information (name, phone number, email address)
              • Profile information and photos
              • Job postings and accommodation listings
              • Location data (when you enable location services)
              • Communications with other users
            </Text>
          </View>

          <View style={[shared.card, { marginBottom: 16 }]}>
            <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 12, color: Colors.text }}>
              2. How We Use Your Information
            </Text>
            <Text style={{ fontSize: 14, lineHeight: 20, color: Colors.text, marginBottom: 12 }}>
              We use the information we collect to:
            </Text>
            <Text style={{ fontSize: 14, lineHeight: 20, color: Colors.text, marginLeft: 12 }}>
              • Provide, maintain, and improve our services
              • Connect job seekers with employers
              • Send you technical notices and security alerts
              • Respond to your comments and questions
              • Analyze usage patterns to improve user experience
              • Prevent fraud and ensure platform safety
            </Text>
          </View>

          <View style={[shared.card, { marginBottom: 16 }]}>
            <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 12, color: Colors.text }}>
              3. Information Sharing
            </Text>
            <Text style={{ fontSize: 14, lineHeight: 20, color: Colors.text, marginBottom: 12 }}>
              We do not sell, trade, or otherwise transfer your personal information to third parties except:
            </Text>
            <Text style={{ fontSize: 14, lineHeight: 20, color: Colors.text, marginLeft: 12 }}>
              • With your consent
              • To comply with legal obligations
              • To protect our rights and prevent fraud
              • In connection with a business transfer
              • With service providers who assist our operations (under strict confidentiality)
            </Text>
          </View>

          <View style={[shared.card, { marginBottom: 16 }]}>
            <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 12, color: Colors.text }}>
              4. Data Security
            </Text>
            <Text style={{ fontSize: 14, lineHeight: 20, color: Colors.text }}>
              We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet is 100% secure.
            </Text>
          </View>

          <View style={[shared.card, { marginBottom: 16 }]}>
            <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 12, color: Colors.text }}>
              5. Location Information
            </Text>
            <Text style={{ fontSize: 14, lineHeight: 20, color: Colors.text }}>
              When you enable location services, we may collect and use your location data to provide location-based features such as finding nearby jobs and showing your approximate location to potential employers or clients. You can disable location sharing at any time through your device settings.
            </Text>
          </View>

          <View style={[shared.card, { marginBottom: 16 }]}>
            <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 12, color: Colors.text }}>
              6. Photos and Media
            </Text>
            <Text style={{ fontSize: 14, lineHeight: 20, color: Colors.text }}>
              Profile photos and job-related images you upload are stored securely and may be visible to other users as part of your profile or job listings. You can delete or change your photos at any time through your profile settings.
            </Text>
          </View>

          <View style={[shared.card, { marginBottom: 16 }]}>
            <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 12, color: Colors.text }}>
              7. Data Retention
            </Text>
            <Text style={{ fontSize: 14, lineHeight: 20, color: Colors.text }}>
              We retain your personal information for as long as necessary to provide our services and fulfill the purposes described in this policy. You may request deletion of your account and personal data at any time through your profile settings.
            </Text>
          </View>

          <View style={[shared.card, { marginBottom: 16 }]}>
            <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 12, color: Colors.text }}>
              8. Your Rights
            </Text>
            <Text style={{ fontSize: 14, lineHeight: 20, color: Colors.text, marginBottom: 12 }}>
              You have the right to:
            </Text>
            <Text style={{ fontSize: 14, lineHeight: 20, color: Colors.text, marginLeft: 12 }}>
              • Access and update your personal information
              • Delete your account and personal data
              • Opt out of certain communications
              • Request a copy of your data
              • Report privacy concerns
            </Text>
          </View>

          <View style={[shared.card, { marginBottom: 16 }]}>
            <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 12, color: Colors.text }}>
              9. Children's Privacy
            </Text>
            <Text style={{ fontSize: 14, lineHeight: 20, color: Colors.text }}>
              Our services are not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13.
            </Text>
          </View>

          <View style={[shared.card, { marginBottom: 16 }]}>
            <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 12, color: Colors.text }}>
              10. Changes to This Policy
            </Text>
            <Text style={{ fontSize: 14, lineHeight: 20, color: Colors.text }}>
              We may update this privacy policy from time to time. We will notify you of any changes by posting the new policy within the app and updating the "last updated" date.
            </Text>
          </View>

          <View style={[shared.card, { marginBottom: 32 }]}>
            <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 12, color: Colors.text }}>
              11. Contact Us
            </Text>
            <Text style={{ fontSize: 14, lineHeight: 20, color: Colors.text }}>
              If you have any questions about this privacy policy or our privacy practices, please contact us through the app's support feature or reach out to our team.
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}