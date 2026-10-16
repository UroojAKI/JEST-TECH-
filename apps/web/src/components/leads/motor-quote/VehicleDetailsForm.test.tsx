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

  it('shows no trailer fields when trailerCount is 0', () => {
    render(
      <VehicleDetailsForm
        category="TRACTOR"
        data={{ vehicleStatus: 'EXISTING', trailerCount: '0' }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText(/Trailer 1 Registration Number/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Trailer 2 Registration Number/)).not.toBeInTheDocument();
  });

  it('shows only Trailer 1 field and makes it required when trailerCount is 1', () => {
    render(
      <VehicleDetailsForm
        category="TRACTOR"
        data={{ vehicleStatus: 'EXISTING', trailerCount: '1' }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/Trailer 1 Registration Number/)).toBeRequired();
    expect(screen.queryByLabelText(/Trailer 2 Registration Number/)).not.toBeInTheDocument();
  });

  it('shows BOTH Trailer 1 and Trailer 2 fields and makes both required when trailerCount is 2', () => {
    render(
      <VehicleDetailsForm
        category="TRACTOR"
        data={{ vehicleStatus: 'EXISTING', trailerCount: '2' }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/Trailer 1 Registration Number/)).toBeRequired();
    expect(screen.getByLabelText(/Trailer 2 Registration Number/)).toBeRequired();
  });

  it('preserves Trailer 1 registration when trailerCount is increased from 1 to 2', () => {
    const onChange = vi.fn();
    render(
      <VehicleDetailsForm
        category="TRACTOR"
        data={{
          vehicleStatus: 'EXISTING',
          trailerCount: '1',
          trailer1RegistrationNumber: 'KA01TR1111',
        }}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Number of Attached Trailers/), {
      target: { value: '2' },
    });

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      trailerCount: '2',
      trailer1RegistrationNumber: 'KA01TR1111',
    }));
  });
});
