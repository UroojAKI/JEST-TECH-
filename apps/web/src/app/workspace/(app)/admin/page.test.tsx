import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AdminWorkspacePage from './page';

vi.mock('../../../../components/dashboard/workspaces/ManagingDirectorDashboard', () => ({
  default: () => (
    <div data-testid="managing-director-dashboard">
      <h2>Admin Executive Dashboard</h2>
      <div>Total Premium Written (MTD)</div>
      <div>Policies Issued</div>
      <div>Renewal Retention Rate</div>
      <div>Regional Branch Performance</div>
    </div>
  ),
}));

describe('AdminWorkspacePage (/workspace/admin)', () => {
  it('mounts the ManagingDirectorDashboard executive component under the Admin access model', () => {
    render(<AdminWorkspacePage />);
    expect(screen.getByTestId('managing-director-dashboard')).toBeInTheDocument();
    expect(screen.getByText('Admin Executive Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Total Premium Written (MTD)')).toBeInTheDocument();
    expect(screen.getByText('Regional Branch Performance')).toBeInTheDocument();
  });
});
