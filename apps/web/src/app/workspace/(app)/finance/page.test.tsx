import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FinanceWorkspacePage from './page';

// Mock the child components and hooks so the test is isolated and deterministic
vi.mock('../../../../components/finance/FinanceOperationsHub', () => ({
  FinanceOperationsHub: () => (
    <div data-testid="finance-operations-hub">
      <h1>Finance, Accounting & Commission Operations Hub</h1>
      <nav>
        <button>Finance Hub</button>
        <button>Reconciliation Queue</button>
        <button>Receipts Register</button>
        <button>Payment Register</button>
        <button>Double-Entry Ledger</button>
        <button>Commission Engine</button>
        <button>Employee Incentives</button>
        <button>Insurer Settlements</button>
      </nav>
    </div>
  ),
}));

describe('FinanceWorkspacePage (/workspace/finance)', () => {
  it('mounts the authoritative FinanceOperationsHub rather than DynamicWorkspace', () => {
    render(<FinanceWorkspacePage />);
    expect(screen.getByTestId('finance-operations-hub')).toBeInTheDocument();
    expect(
      screen.getByText('Finance, Accounting & Commission Operations Hub')
    ).toBeInTheDocument();
    expect(screen.getByText('Reconciliation Queue')).toBeInTheDocument();
    expect(screen.getByText('Commission Engine')).toBeInTheDocument();
    expect(screen.getByText('Employee Incentives')).toBeInTheDocument();
  });
});
