// components/tour/CompletionPopup.tsx
// Modal shown when a tour is completed

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { StarRating } from './StarRating';

const AMBER = '#F59E0B';

interface CompletionPopupProps {
  visible: boolean;
  tourName: string;
  xp: number;
  isFirstCompletion: boolean;
  onRate: (rating: number) => void;
  onDonate: (amount: number) => void;
  onClose: () => void;
  langcode: string;
}

export function CompletionPopup({
  visible,
  tourName,
  xp,
  isFirstCompletion,
  onRate,
  onDonate,
  onClose,
  langcode,
}: CompletionPopupProps) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(0);
  const [donationAmount, setDonationAmount] = useState('1');

  const handleRate = (value: number) => {
    setRating(value);
    onRate(value);
  };

  const handleDonate = () => {
    const amount = parseFloat(donationAmount);
    if (!isNaN(amount) && amount > 0) {
      onDonate(amount);
    }
  };

  const parsedAmount = parseFloat(donationAmount);
  const isDonationValid = !isNaN(parsedAmount) && parsedAmount > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Trophy icon */}
          <View style={styles.iconContainer}>
            <Ionicons name="trophy" size={48} color={AMBER} />
          </View>

          {isFirstCompletion ? (
            <>
              {/* First completion — full experience */}
              <Text style={styles.title}>
                {t('popup.tourCompleted', { tourName })}
              </Text>

              <View style={styles.xpBadge}>
                <Ionicons name="flash" size={18} color={AMBER} />
                <Text style={styles.xpText}>
                  {t('popup.xpEarned', { xp })}
                </Text>
              </View>

              {/* Star Rating */}
              <View style={styles.ratingSection}>
                <StarRating
                  value={rating}
                  interactive
                  onRate={handleRate}
                  size={32}
                />
              </View>
            </>
          ) : (
            <>
              {/* Subsequent completion — simplified */}
              <Text style={styles.title}>{t('popup.alreadyCompleted')}</Text>
            </>
          )}

          {/* Donation section */}
          <View style={styles.donationSection}>
            <View style={styles.donationInputRow}>
              <Text style={styles.currencySymbol}>EUR</Text>
              <TextInput
                style={styles.donationInput}
                value={donationAmount}
                onChangeText={setDonationAmount}
                keyboardType="decimal-pad"
                selectTextOnFocus
              />
            </View>

            <TouchableOpacity
              style={[
                styles.donateButton,
                !isDonationValid && styles.donateButtonDisabled,
              ]}
              onPress={handleDonate}
              activeOpacity={0.8}
              disabled={!isDonationValid}
            >
              <Ionicons name="heart" size={18} color="#FFFFFF" />
              <Text style={styles.donateButtonText}>{t('popup.donate')}</Text>
            </TouchableOpacity>
          </View>

          {/* Go to Home */}
          <TouchableOpacity
            style={styles.homeButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.homeButtonText}>{t('popup.goHome')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
  },
  xpText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#D97706',
  },
  ratingSection: {
    marginBottom: 24,
  },
  donationSection: {
    width: '100%',
    gap: 12,
    marginBottom: 16,
  },
  donationInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    overflow: 'hidden',
  },
  currencySymbol: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  donationInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  donateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: AMBER,
    borderRadius: 10,
  },
  donateButtonDisabled: {
    opacity: 0.5,
  },
  donateButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  homeButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  homeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
});
