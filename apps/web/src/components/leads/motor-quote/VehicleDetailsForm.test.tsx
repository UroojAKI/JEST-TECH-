import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VehicleDetailsForm } from './VehicleDetailsForm';

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: [] }),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: { get: vi.fn() },
}));

describe('VehicleDetailsForm tractor trailer registration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows only the selected Trailer 1 field and makes it required', () => {
    render(
      <VehicleDetailsForm
        category="TRACTOR"
        data={{ vehicleStatus: 'EXISTING', attachmentUsed: 'Trailer 1' }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Trailer 1 Registration Number')).toBeRequired();
    expect(screen.queryByLabelText('Trailer 2 Registration Number')).not.toBeInTheDocument();
  });

  it('shows only the selected Trailer 2 field and makes it required', () => {
    render(
      <VehicleDetailsForm
        category="TRACTOR"
        data={{ vehicleStatus: 'EXISTING', attachmentUsed: 'Trailer 2' }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Trailer 2 Registration Number')).toBeRequired();
    expect(screen.queryByLabelText('Trailer 1 Registration Number')).not.toBeInTheDocument();
  });

  it('clears the inactive trailer number when the selected attachment changes', () => {
    const onChange = vi.fn();
    render(
      <VehicleDetailsForm
        category="TRACTOR"
        data={{
          vehicleStatus: 'EXISTING',
          attachmentUsed: 'Trailer 1',
          trailer1RegistrationNumber: 'KA01TR1111',
          trailer2RegistrationNumber: 'KA01TR2222',
        }}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Attachment Used'), {
      target: { value: 'Trailer 2' },
    });

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      attachmentUsed: 'Trailer 2',
      trailer1RegistrationNumber: '',
    }));
  });
});
