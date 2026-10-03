'use client';

import { useParams, useRouter } from 'next/navigation';
import { InspectionDialog } from '../../../../../../components/leads/motor-quote/InspectionDialog';

export default function VehicleInspectionPage() {
  const { quotationId } = useParams<{ quotationId: string }>();
  const router = useRouter();
  const returnToQueue = () => router.push('/workspace/operations/issuance');

  return (
    <InspectionDialog
      isOpen
      quotationId={quotationId}
      onClose={returnToQueue}
      onSuccess={returnToQueue}
    />
  );
}
