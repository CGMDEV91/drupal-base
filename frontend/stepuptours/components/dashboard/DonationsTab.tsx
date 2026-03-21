// components/dashboard/DonationsTab.tsx
// Professional dashboard donations — delegates to shared DonationsView

import React from 'react';
import { DonationsView } from '../shared/DonationsView';

interface DonationsTabProps {
  userId: string;
}

export function DonationsTab({ userId }: DonationsTabProps) {
  return <DonationsView mode="professional" userId={userId} />;
}
