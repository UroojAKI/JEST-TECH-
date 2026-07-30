'use client';

import React from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { MotorProposalWizard } from '../../../components/sales/MotorProposalWizard';

export default function MotorProposalWizardPage() {
  return (
    <AppShell>
      <MotorProposalWizard />
    </AppShell>
  );
}
