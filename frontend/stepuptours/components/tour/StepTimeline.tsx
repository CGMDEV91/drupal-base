// components/tour/StepTimeline.tsx
// Vertical timeline with step circles and expandable content

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { StepContent } from './StepContent';
import type { TourStep } from '../../types';

const GREEN = '#22C55E';
const ORANGE = '#F59E0B';
const GREY = '#D1D5DB';

type StepState = 'completed' | 'active' | 'pending';

interface StepTimelineProps {
  steps: TourStep[];
  stepsCompleted: string[];
  onCompleteStep: (stepId: string) => void;
  langcode: string;
}

export function StepTimeline({
  steps,
  stepsCompleted,
  onCompleteStep,
  langcode,
}: StepTimelineProps) {
  const { t } = useTranslation();

  const getStepState = (step: TourStep, index: number): StepState => {
    if (stepsCompleted.includes(step.id)) return 'completed';
    // Active = first step not in stepsCompleted
    const firstIncompleteIndex = steps.findIndex(
      (s) => !stepsCompleted.includes(s.id),
    );
    if (index === firstIncompleteIndex) return 'active';
    return 'pending';
  };

  // Find the active step index to auto-expand it
  const activeIndex = steps.findIndex((s) => !stepsCompleted.includes(s.id));

  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(() => {
    const initial = new Set<number>();
    if (activeIndex >= 0) initial.add(activeIndex);
    return initial;
  });

  const toggleStep = (index: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const getStateColor = (state: StepState): string => {
    switch (state) {
      case 'completed':
        return GREEN;
      case 'active':
        return ORANGE;
      case 'pending':
        return GREY;
    }
  };

  const getStatePill = (state: StepState): { label: string; bg: string; text: string } => {
    switch (state) {
      case 'completed':
        return { label: t('step.completed'), bg: '#DCFCE7', text: GREEN };
      case 'active':
        return { label: t('step.inProgress'), bg: '#FEF3C7', text: '#D97706' };
      case 'pending':
        return { label: t('step.pending'), bg: '#F3F4F6', text: '#6B7280' };
    }
  };

  return (
    <View style={styles.container}>
      {steps.map((step, index) => {
        const state = getStepState(step, index);
        const color = getStateColor(state);
        const pill = getStatePill(state);
        const isExpanded = expandedSteps.has(index);
        const isLast = index === steps.length - 1;

        return (
          <View key={step.id} style={styles.stepRow}>
            {/* Timeline column */}
            <View style={styles.timelineCol}>
              {/* Circle */}
              <View
                style={[
                  styles.circle,
                  { borderColor: color },
                  state === 'completed' && { backgroundColor: color },
                ]}
              >
                {state === 'completed' ? (
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                ) : (
                  <Text
                    style={[
                      styles.circleNumber,
                      { color: state === 'active' ? color : '#9CA3AF' },
                    ]}
                  >
                    {index + 1}
                  </Text>
                )}
              </View>

              {/* Connecting line */}
              {!isLast && (
                <View
                  style={[
                    styles.line,
                    {
                      backgroundColor:
                        state === 'completed' ? GREEN : '#E5E7EB',
                    },
                  ]}
                />
              )}
            </View>

            {/* Content column */}
            <View style={[styles.contentCol, !isLast && styles.contentColSpacing]}>
              <TouchableOpacity
                style={styles.stepHeader}
                onPress={() => toggleStep(index)}
                activeOpacity={0.7}
              >
                <View style={styles.stepHeaderLeft}>
                  <Text style={styles.stepTitle} numberOfLines={isExpanded ? undefined : 1}>
                    {step.title}
                  </Text>
                  <View style={[styles.pill, { backgroundColor: pill.bg }]}>
                    <Text style={[styles.pillText, { color: pill.text }]}>
                      {pill.label}
                    </Text>
                  </View>
                </View>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#9CA3AF"
                />
              </TouchableOpacity>

              {isExpanded && (
                <StepContent
                  step={step}
                  isCompleted={state === 'completed'}
                  isActive={state === 'active'}
                  onComplete={() => onCompleteStep(step.id)}
                  langcode={langcode}
                />
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
  },
  stepRow: {
    flexDirection: 'row',
  },
  timelineCol: {
    width: 32,
    alignItems: 'center',
  },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  circleNumber: {
    fontSize: 12,
    fontWeight: '700',
  },
  line: {
    flex: 1,
    width: 2,
    minHeight: 20,
  },
  contentCol: {
    flex: 1,
    marginLeft: 12,
  },
  contentColSpacing: {
    paddingBottom: 16,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  stepHeaderLeft: {
    flex: 1,
    marginRight: 8,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
