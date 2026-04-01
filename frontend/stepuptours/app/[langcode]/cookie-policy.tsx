// app/[langcode]/cookie-policy.tsx
// Cookie Policy legal page

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

export default function CookiePolicyScreen() {
  const { t } = useTranslation();

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
      >
        <PageBanner icon="document-text" iconBgColor="#6366F1" title={t('legal.cookiePolicy')} />
        <View style={styles.inner}>

          <Text style={styles.lastUpdated}>Last updated: March 2026</Text>

          {/* Section 1 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. What Are Cookies?</Text>
            <Text style={styles.body}>
              Cookies are small text files that are placed on your device when you visit a website
              or use a web application. They are widely used to make websites work, or work more
              efficiently, as well as to provide information to the owners of the site.
            </Text>
            <Text style={styles.body}>
              Cookies may be stored on your device by the website you visit ("first-party cookies")
              or by third-party services that the website uses ("third-party cookies"). Cookies can
              be "session cookies" that expire when you close your browser, or "persistent cookies"
              that remain on your device for a set period of time.
            </Text>
          </View>

          {/* Section 2 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Why We Use Cookies</Text>
            <Text style={styles.body}>
              StepUp Tours uses cookies and similar technologies to:
            </Text>
            <View style={styles.list}>
              <Text style={styles.listItem}>
                • Keep you signed in across pages and sessions so you do not have to log in repeatedly.
              </Text>
              <Text style={styles.listItem}>
                • Remember your language preferences so that the app is displayed in your chosen language.
              </Text>
              <Text style={styles.listItem}>
                • Track your tour progress so you can resume where you left off.
              </Text>
              <Text style={styles.listItem}>
                • Understand how users interact with our platform to improve features and performance.
              </Text>
              <Text style={styles.listItem}>
                • Detect and prevent fraudulent activity and ensure the security of your account.
              </Text>
            </View>
          </View>

          {/* Section 3 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Types of Cookies We Use</Text>

            <Text style={styles.subTitle}>Strictly Necessary Cookies</Text>
            <Text style={styles.body}>
              These cookies are essential for the platform to function correctly. Without them,
              services such as authentication and tour progress tracking cannot be provided.
              These cookies do not require your consent under applicable law.
            </Text>

            <Text style={styles.subTitle}>Functional Cookies</Text>
            <Text style={styles.body}>
              These cookies allow us to remember choices you make — such as your preferred language
              or currency — and provide enhanced, personalised features. Disabling these may affect
              the quality of your experience.
            </Text>

            <Text style={styles.subTitle}>Analytics Cookies</Text>
            <Text style={styles.body}>
              We may use analytics cookies (e.g., aggregated usage statistics) to understand how
              visitors use our platform. This data is collected in anonymised or aggregated form and
              helps us prioritise improvements. We do not sell this data to third parties.
            </Text>

            <Text style={styles.subTitle}>Payment Cookies</Text>
            <Text style={styles.body}>
              When you make a donation or purchase a subscription, our payment processor (Stripe)
              may set cookies to manage the payment session and detect fraudulent transactions.
              These are governed by Stripe's own privacy policy.
            </Text>
          </View>

          {/* Section 4 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. Managing and Disabling Cookies</Text>
            <Text style={styles.body}>
              You can control and manage cookies in several ways:
            </Text>
            <View style={styles.list}>
              <Text style={styles.listItem}>
                • <Text style={styles.bold}>Browser settings:</Text> Most web browsers allow you
                to view, manage, and delete cookies through your browser settings menu. Note that
                disabling cookies may prevent certain features from working correctly.
              </Text>
              <Text style={styles.listItem}>
                • <Text style={styles.bold}>In-app consent:</Text> You can withdraw your consent
                at any time by clearing your browser's local storage or app data. The cookie
                consent banner will reappear on your next visit.
              </Text>
              <Text style={styles.listItem}>
                • <Text style={styles.bold}>Opt-out tools:</Text> For analytics cookies, you may
                use tools provided by the relevant third-party services to opt out of tracking.
              </Text>
            </View>
            <Text style={styles.body}>
              Please note that restricting strictly necessary cookies may impact the core
              functionality of the platform.
            </Text>
          </View>

          {/* Section 5 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5. Changes to This Policy</Text>
            <Text style={styles.body}>
              We may update this Cookie Policy from time to time to reflect changes in technology,
              legislation, or our data practices. When we make material changes, we will update the
              "Last updated" date at the top of this page and, where appropriate, notify you through
              the platform.
            </Text>
          </View>

          {/* Section 6 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>6. Contact Us</Text>
            <Text style={styles.body}>
              If you have any questions about our use of cookies or this Cookie Policy, please
              contact us at:
            </Text>
            <Text style={styles.contactBlock}>
              StepUp Tours{'\n'}
              privacy@stepuptours.com{'\n'}
              https://stepuptours.com
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
    marginBottom: 24,
    fontStyle: 'italic',
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
    fontFamily: 'monospace',
  },
});
