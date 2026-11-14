import { redirect } from 'next/navigation';

export default function CrmDashboardRedirect() {
  redirect('/crm/contacts');
}

