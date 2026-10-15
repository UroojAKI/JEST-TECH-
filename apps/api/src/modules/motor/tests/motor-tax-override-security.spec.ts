import { Reflector } from '@nestjs/core';
import { MotorCalculationController } from '../controllers/motor-calculation.controller';
import { MotorCalculationService } from '../services/motor-calculation.service';
import { RoleType } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('PR-05: Controlled Tax/Tariff Override Security & Role Enforcement (D-03, T-08, T-09)', () => {
  let controller: MotorCalculationController;
  let service: {
    calculate: jest.Mock;
    calculateWithOverride: jest.Mock;
  };
  const reflector = new Reflector();

  beforeEach(() => {
    service = {
      calculate: jest.fn(),
      calculateWithOverride: jest.fn(),
    };
    controller = new MotorCalculationController(service as any);
  });

  describe('T-08: Role enforcement on calculate vs override', () => {
    it('allows AGENT, BACK_OFFICE, and ADMIN on standard calculate endpoint', () => {
      const roles = reflector.get<RoleType[]>('roles', controller.calculate);
      expect(roles).toEqual([RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT]);
    });

    it('strictly forbids AGENT from calling tax/tariff override endpoint (ADMIN and BACK_OFFICE only)', () => {
      const roles = reflector.get<RoleType[]>('roles', controller.calculateWithOverride);
      expect(roles).toEqual([RoleType.ADMIN, RoleType.BACK_OFFICE]);
      expect(roles).not.toContain(RoleType.AGENT);
    });
  });

  describe('T-08 & T-09: calculateWithOverride validation and audit trail', () => {
    it('delegates to calculation service with actor context and returns override details', async () => {
      const mockResult = {
        outputs: {
          totalPremium: 15000,
          totalGst: 2288.14,
        },
        overrideDetails: {
          approvalReference: 'TAX-OVR-2026-001',
          approvedBy: 'Admin User',
          overrideReason: 'Special exemption under notification XYZ',
        },
      };

      service.calculateWithOverride.mockResolvedValue(mockResult);

      const payload: any = {
        approvalReference: 'TAX-OVR-2026-001',
        approvedBy: 'Admin User',
        overrideReason: 'Special exemption under notification XYZ',
        customGstRate: 5,
        calculationInput: {
          vehicleCategory: 'PRIVATE_CAR',
          policyType: 'PACKAGE_COMPREHENSIVE',
        },
      };

      const req = { user: { userId: 'admin-1', role: RoleType.ADMIN } };
      const res = await controller.calculateWithOverride(payload, req);

      expect(service.calculateWithOverride).toHaveBeenCalledWith(payload, req.user);
      expect(res).toEqual(mockResult);
    });
  });
});
