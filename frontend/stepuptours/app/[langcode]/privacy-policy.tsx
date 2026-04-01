// app/[langcode]/privacy-policy.tsx
// Privacy Policy legal page

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import PageBanner from '../../components/layout/PageBanner';
import Footer from '../../components/layout/Footer';

const AMBER = '#F59E0B';

export default function PrivacyPolicyScreen() {
  const { t } = useTranslation();

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
      >
        <PageBanner icon="shield-checkmark" iconBgColor="#10B981" title={t('legal.privacyPolicy')} />
        <View style={styles.inner}>

          <Text style={styles.lastUpdated}>Last updated: March 2026</Text>

          <Text style={styles.intro}>
            StepUp Tours ("we", "us", or "our") is committed to protecting your personal data.
            This Privacy Policy explains what information we collect, how we use it, and the rights
            you have in relation to it. This policy applies to all users of the StepUp Tours
            platform, including our mobile application and website.
          </Text>

          {/* Section 1 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. Data We Collect</Text>
            <Text style={styles.body}>
              We collect personal data in the following categories:
            </Text>

            <Text style={styles.subTitle}>Account Information</Text>
            <View style={styles.list}>
              <Text style={styles.listItem}>• Username and email address (required for registration)</Text>
              <Text style={styles.listItem}>• Password (stored as a cryptographic hash; never in plain text)</Text>
              <Text style={styles.listItem}>• Profile information you choose to provide</Text>
            </View>

            <Text style={styles.subTitle}>Tour Activity Data</Text>
            <View style={styles.list}>
              <Text style={styles.listItem}>• Tours you start, complete, or mark as a favourite</Text>
              <Text style={styles.listItem}>• XP points earned and ranking position</Text>
              <Text style={styles.listItem}>• Ratings and reviews you submit</Text>
            </View>

            <Text style={styles.subTitle}>Payment Information</Text>
            <View style={styles.list}>
              <Text style={styles.listItem}>
                • Donations you make to tour guides (amount and timestamp)
              </Text>
              <Text style={styles.listItem}>
                • Subscription plan details (plan type and renewal date)
              </Text>
              <Text style={styles.listItem}>
                • We do not store card numbers or bank details — payments are processed by Stripe.
              </Text>
            </View>

            <Text style={styles.subTitle}>Usage and Technical Data</Text>
            <View style={styles.list}>
              <Text style={styles.listItem}>• Device type, operating system, and browser</Text>
              <Text style={styles.listItem}>• IP address (used for security and fraud prevention)</Text>
              <Text style={styles.listItem}>• Pages visited and interactions within the platform</Text>
            </View>
          </View>

          {/* Section 2 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. How We Use Your Data</Text>
            <Text style={styles.body}>
              We process your personal data on the following legal bases and for the following
              purposes:
            </Text>
            <View style={styles.list}>
              <Text style={styles.listItem}>
                • <Text style={styles.bold}>Contract performance:</Text> To create and manage your
                account, process payments, and deliver the services you have requested.
              </Text>
              <Text style={styles.listItem}>
                • <Text style={styles.bold}>Legitimate interests:</Text> To improve our platform,
                detect fraud, ensure security, and provide customer support.
              </Text>
              <Text style={styles.listItem}>
                • <Text style={styles.bold}>Legal obligation:</Text> To comply with applicable laws
                including tax, accounting, and anti-fraud regulations.
              </Text>
              <Text style={styles.listItem}>
                • <Text style={styles.bold}>Consent:</Text> To send you optional communications
                such as newsletters or promotional offers, where you have opted in.
              </Text>
            </View>
          </View>

          {/* Section 3 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Data Sharing</Text>
            <Text style={styles.body}>
              We do not sell your personal data. We may share data with trusted third parties
              strictly as necessary:
            </Text>
            <View style={styles.list}>
              <Text style={styles.listItem}>
                • <Text style={styles.bold}>Stripe:</Text> Payment processing. Governed by
                Stripe's own Privacy Policy and GDPR Data Processing Addendum.
              </Text>
              <Text style={styles.listItem}>
                • <Text style={styles.bold}>Hosting and infrastructure providers:</Text> To operate
                our servers and databases. All providers are bound by data processing agreements.
              </Text>
              <Text style={styles.listItem}>
                • <Text style={styles.bold}>Legal authorities:</Text> Where required by law or to
                protect the rights and safety of our users.
              </Text>
            </View>
            <Text style={styles.body}>
              Public profile data — such as your username, XP total, and ranking position — may
              be visible to other users of the platform.
            </Text>
          </View>

          {/* Section 4 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. Your Rights</Text>
            <Text style={styles.body}>
              Under applicable data protection law (including the GDPR for users in the EEA and UK),
              you have the following rights:
            </Text>
            <View style={styles.list}>
              <Text style={styles.listItem}>
                • <Text style={styles.bold}>Access:</Text> Request a copy of the personal data we
                hold about you.
              </Text>
              <Text style={styles.listItem}>
                • <Text style={styles.bold}>Rectification:</Text> Ask us to correct inaccurate or
                incomplete data.
              </Text>
              <Text style={styles.listItem}>
                • <Text style={styles.bold}>Erasure:</Text> Request deletion of your personal data
                ("right to be forgotten"), subject to legal retention obligations.
              </Text>
              <Text style={styles.listItem}>
                • <Text style={styles.bold}>Restriction:</Text> Ask us to limit how we process
                your data in certain circumstances.
              </Text>
              <Text style={styles.listItem}>
                • <Text style={styles.bold}>Portability:</Text> Receive your data in a structured,
                machine-readable format.
              </Text>
              <Text style={styles.listItem}>
                • <Text style={styles.bold}>Objection:</Text> Object to processing based on
                legitimate interests or for direct marketing purposes.
              </Text>
              <Text style={styles.listItem}>
                • <Text style={styles.bold}>Withdraw consent:</Text> Where processing is based on
                consent, you may withdraw it at any time without affecting the lawfulness of prior
                processing.
              </Text>
            </View>
            <Text style={styles.body}>
              To exercise any of these rights, contact us at privacy@stepuptours.com. We will
              respond within 30 days.
            </Text>
          </View>

          {/* Section 5 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5. Data Retention</Text>
            <Text style={styles.body}>
              We retain your personal data for as long as your account is active or as needed to
              provide our services. If you delete your account, we will delete or anonymise your
              personal data within 30 days, except where we are required to retain it by law (for
              example, financial records may be retained for up to 7 years).
            </Text>
          </View>

          {/* Section 6 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>6. Security</Text>
            <Text style={styles.body}>
              We implement appropriate technical and organisational measures to protect your
              personal data against unauthorised access, disclosure, alteration, or destruction.
              These measures include:
            </Text>
            <View style={styles.list}>
              <Text style={styles.listItem}>• Encrypted connections (HTTPS/TLS) for all data in transit</Text>
              <Text style={styles.listItem}>• Passwords stored using industry-standard hashing algorithms</Text>
              <Text style={styles.listItem}>• Access controls limiting data access to authorised personnel</Text>
              <Text style={styles.listItem}>• Regular security reviews and dependency updates</Text>
            </View>
            <Text style={styles.body}>
              Despite our best efforts, no method of transmission over the internet is 100% secure.
              We encourage you to use a strong, unique password for your account.
            </Text>
          </View>

          {/* Section 7 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>7. Changes to This Policy</Text>
            <Text style={styles.body}>
              We may update this Privacy Policy from time to time. When we make material changes,
              we will update the "Last updated" date at the top of this page and notify you through
              the platform where required. We encourage you to review this policy periodically.
            </Text>
          </View>

          {/* Section 8 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>8. Contact Us</Text>
            <Text style={styles.body}>
              For questions, requests, or complaints regarding this Privacy Policy or our data
              practices, please contact our Data Protection team at:
            </Text>
            <Text style={styles.contactBlock}>
              StepUp Tours — Data Protection{'\n'}
              privacy@stepuptours.com{'\n'}
              https://stepuptours.com
            </Text>
            <Text style={styles.body}>
              You also have the right to lodge a complaint with your local data protection authority
              if you believe we have not handled your data in accordance with applicable law.
            </Text>
          </View>

        </View>
        <Footer />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    ...(Platform.OS === 'web' ? { height: '100vh' as any, overflow: 'hidden' as any } : {}),
  },

  // Scroll content: centred on desktop
  inner: {
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 24,
  },

  lastUpdated: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 8,
    fontStyle: 'italic',
  },

  intro: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 24,
    marginBottom: 24,
    borderLeftWidth: 3,
    borderLeftColor: AMBER,
    paddingLeft: 14,
  },

  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  subTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
    marginTop: 12,
    marginBottom: 6,
  },
  body: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 24,
    marginBottom: 10,
  },
  bold: {
    fontWeight: '700',
  },
  list: {
    gap: 8,
    marginBottom: 10,
  },
  listItem: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 24,
    paddingLeft: 4,
  },
  contactBlock: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 24,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 14,
    marginTop: 6,
    marginBottom: 12,
    fontFamily: 'monospace',
  },
});
