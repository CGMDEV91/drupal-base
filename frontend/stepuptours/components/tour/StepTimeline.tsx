// components/tour/StepTimeline.tsx

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  ScrollView,
  Modal,
  SafeAreaView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { StepContent } from './StepContent';
import type { TourStep } from '../../types';

const GREEN  = '#22C55E';
const ORANGE = '#F59E0B';
const GREY   = '#D1D5DB';

type StepState = 'completed' | 'active' | 'pending';

interface StepTimelineProps {
  steps: TourStep[];
  stepsCompleted: string[];
  onCompleteStep: (stepId: string) => void;
  langcode: string;
  tourTitle?: string;
  scrollViewRef?: React.RefObject<ScrollView>;
}

export function StepTimeline({
                               steps,
                               stepsCompleted,
                               onCompleteStep,
                               langcode,
                               tourTitle,
                               scrollViewRef,
                             }: StepTimelineProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isMobile = Platform.OS !== 'web' || width < 768;

  const [manualActiveIndex, setManualActiveIndex] = useState<number | null>(null);
  const [expandedSteps, setExpandedSteps]         = useState<Set<number>>(new Set());
  const [modalStepIndex, setModalStepIndex]       = useState<number | null>(null);

  const expandAnims  = useRef<Map<number, Animated.Value>>(new Map());
  const circleAnims  = useRef<Map<number, Animated.Value>>(new Map());
  const stepRowRefs  = useRef<Map<number, View | null>>(new Map());

  const getExpandAnim = (index: number): Animated.Value => {
    if (!expandAnims.current.has(index)) {
      expandAnims.current.set(index, new Animated.Value(0));
    }
    return expandAnims.current.get(index)!;
  };

  const getCircleAnim = (index: number): Animated.Value => {
    if (!circleAnims.current.has(index)) {
      circleAnims.current.set(index, new Animated.Value(1));
    }
    return circleAnims.current.get(index)!;
  };

  const getStepState = (step: TourStep, index: number): StepState => {
    if (stepsCompleted.includes(step.id)) return 'completed';
    if (manualActiveIndex !== null) {
      return index === manualActiveIndex ? 'active' : 'pending';
    }
    const firstIncompleteIndex = steps.findIndex((s) => !stepsCompleted.includes(s.id));
    return index === firstIncompleteIndex ? 'active' : 'pending';
  };

  const animateExpand = (index: number, open: boolean) => {
    Animated.timing(getExpandAnim(index), {
      toValue: open ? 1 : 0,
      duration: open ? 300 : 250,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: false,
    }).start();
  };

  const toggleStep = (index: number) => {
    if (isMobile) {
      // Mobile: open full-screen modal
      setModalStepIndex(index);
      if (!stepsCompleted.includes(steps[index].id)) {
        setManualActiveIndex(index);
      }
      return;
    }
    // Web: existing inline expand/collapse logic
    const isCurrentlyOpen = expandedSteps.has(index);
    const willOpen        = !isCurrentlyOpen;

    setExpandedSteps((prev) => {
      const next = new Set<number>();
      // Collapse ALL others, only keep this one if opening
      if (willOpen) next.add(index);
      return next;
    });

    // Animate close for every previously open step except current
    expandedSteps.forEach((openIndex) => {
      if (openIndex !== index) animateExpand(openIndex, false);
    });

    animateExpand(index, willOpen);

    if (willOpen && !stepsCompleted.includes(steps[index].id)) {
      setManualActiveIndex(index);
    }
  };

  const closeModal = () => {
    setModalStepIndex(null);
    setManualActiveIndex(null);
    scrollViewRef?.current?.scrollTo({ y: 0, animated: true });
  };

  const handleModalComplete = (stepId: string) => {
    onCompleteStep(stepId);
    setModalStepIndex(null);
    setManualActiveIndex(null);
    scrollViewRef?.current?.scrollTo({ y: 0, animated: true });
  };

  const prevCompletedCount = useRef(stepsCompleted.length);

  useEffect(() => {
    if (stepsCompleted.length > prevCompletedCount.current) {
      const justCompletedId    = stepsCompleted[stepsCompleted.length - 1];
      const justCompletedIndex = steps.findIndex((s) => s.id === justCompletedId);

      if (justCompletedIndex >= 0) {
        setExpandedSteps((prev) => {
          const next = new Set(prev);
          next.delete(justCompletedIndex);
          return next;
        });
        animateExpand(justCompletedIndex, false);

        const circleAnim = getCircleAnim(justCompletedIndex);
        Animated.sequence([
          Animated.timing(circleAnim, { toValue: 1.4, duration: 150, useNativeDriver: true }),
          Animated.spring(circleAnim, { toValue: 1, friction: 3, tension: 200, useNativeDriver: true }),
        ]).start();

        // Scroll to the next step after the collapse animation finishes
        const nextIndex = justCompletedIndex + 1;
        if (nextIndex < steps.length && scrollViewRef?.current) {
          setTimeout(() => {
            const nextRef = stepRowRefs.current.get(nextIndex);
            if (nextRef && scrollViewRef.current) {
              nextRef.measureLayout(
                scrollViewRef.current as any,
                (_x: number, y: number) => {
                  scrollViewRef.current!.scrollTo({ y: Math.max(0, y - 16), animated: true });
                },
                () => {},
              );
            }
          }, 350); // wait for collapse animation to finish
        }
      }

      setManualActiveIndex(null);
    }
    prevCompletedCount.current = stepsCompleted.length;
  }, [stepsCompleted.length]);

  const getStateColor = (state: StepState): string => {
    switch (state) {
      case 'completed': return GREEN;
      case 'active':    return ORANGE;
      case 'pending':   return GREY;
    }
  };

  const getStatePill = (state: StepState): { label: string; bg: string; text: string } => {
    switch (state) {
      case 'completed': return { label: t('step.completed'),  bg: '#DCFCE7', text: GREEN      };
      case 'active':    return { label: t('step.inProgress'), bg: '#FEF3C7', text: '#D97706'  };
      case 'pending':   return { label: t('step.pending'),    bg: '#F3F4F6', text: '#6B7280'  };
    }
  };

  return (
    <View style={styles.container}>
      {steps.map((step, index) => {
        const state      = getStepState(step, index);
        const color      = getStateColor(state);
        const pill       = getStatePill(state);
        const isExpanded = expandedSteps.has(index);
        const isLast     = index === steps.length - 1;
        const expandAnim = getExpandAnim(index);
        const circleAnim = getCircleAnim(index);

        return (
          <View
            key={step.id}
            style={styles.stepRow}
            ref={(r) => stepRowRefs.current.set(index, r)}
          >
            {/* Timeline column */}
            <View style={styles.timelineCol}>
              <Animated.View style={{ transform: [{ scale: circleAnim }] }}>
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
                    <Text style={[styles.circleNumber, { color: state === 'active' ? color : '#9CA3AF' }]}>
                      {index + 1}
                    </Text>
                  )}
                </View>
              </Animated.View>

              {!isLast && (
                <View style={[styles.line, { backgroundColor: state === 'completed' ? GREEN : '#E5E7EB' }]} />
              )}
            </View>

            {/* Content column */}
            <View style={[styles.contentCol, !isLast && styles.contentColSpacing]}>
              <View
                style={[
                  styles.stepCard,
                  state === 'completed' && styles.stepCardCompleted,
                  state === 'active'    && styles.stepCardActive,
                ]}
              >
                <TouchableOpacity
                  style={styles.stepHeader}
                  onPress={() => toggleStep(index)}
                  activeOpacity={0.7}
                >
                  <View style={styles.stepHeaderLeft}>
                    <Text
                      style={[styles.stepTitle, state === 'completed' && styles.stepTitleCompleted]}
                      numberOfLines={isExpanded ? undefined : 1}
                    >
                      {step.title}
                    </Text>
                    <View style={[styles.pill, { backgroundColor: pill.bg }]}>
                      <Text style={[styles.pillText, { color: pill.text }]}>{pill.label}</Text>
                    </View>
                  </View>
                  <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#9CA3AF" />
                </TouchableOpacity>

                <Animated.View
                  style={{
                    maxHeight: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1200] }),
                    opacity:   expandAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0, 1] }),
                    // 'hidden' clips during animation on native.
                    // On web 'hidden' creates a scroll-capturing context that blocks
                    // wheel events from reaching the parent ScrollView — use 'visible' instead.
                    // opacity:0 hides overflow during the animation's early phase.
                    overflow: Platform.OS === 'web' ? 'visible' : 'hidden',
                  }}
                >
                  <StepContent
                    step={step}
                    isCompleted={state === 'completed'}
                    isActive={state === 'active'}
                    isExpanded={isExpanded}
                    onComplete={() => onCompleteStep(step.id)}
                    langcode={langcode}
                    tourTitle={tourTitle}
                  />
                </Animated.View>
              </View>
            </View>
          </View>
        );
      })}

      {/* Full-screen step modal — mobile only */}
      {isMobile && modalStepIndex !== null && (
        <Modal
          visible
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={closeModal}
        >
          <SafeAreaView style={styles.modalSafeArea}>
            {/* Modal header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle} numberOfLines={2}>
                {steps[modalStepIndex].title}
              </Text>
              <TouchableOpacity onPress={closeModal} style={styles.modalCloseBtn} activeOpacity={0.7}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>
            {/* Scrollable content */}
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
              <StepContent
                step={steps[modalStepIndex]}
                isCompleted={stepsCompleted.includes(steps[modalStepIndex].id)}
                isActive={getStepState(steps[modalStepIndex], modalStepIndex) === 'active'}
                isExpanded
                onComplete={() => handleModalComplete(steps[modalStepIndex].id)}
                langcode={langcode}
                tourTitle={tourTitle}
              />
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}
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
  stepCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    marginBottom: 4,
  },
  stepCardCompleted: {
    backgroundColor: '#F0FFF4',
    borderColor: '#BBF7D0',
  },
  stepCardActive: {
    borderColor: '#F59E0B',
    borderWidth: 1.5,
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
  stepTitleCompleted: {
    textDecorationLine: 'line-through',
    opacity: 0.65,
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
  modalSafeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  modalHeaderTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginRight: 12,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
});
