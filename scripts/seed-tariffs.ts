import { PrismaClient, VehicleCategory } from '@prisma/client';

const prisma = new PrismaClient();

const TARIFFS: Array<{
  vehicleCategory: VehicleCategory;
  policyType: string;
  engineCcMin?: number;
  engineCcMax?: number;
  annualPremium: number;
  source: string;
  version: string;
}> = [
  // PRIVATE_CAR - PACKAGE
  { vehicleCategory: VehicleCategory.PRIVATE_CAR, policyType: 'PACKAGE', engineCcMin: 0, engineCcMax: 1000, annualPremium: 2094, source: 'IRDAI 2024-25', version: '2024-25' },
  { vehicleCategory: VehicleCategory.PRIVATE_CAR, policyType: 'PACKAGE', engineCcMin: 1001, engineCcMax: 1500, annualPremium: 3416, source: 'IRDAI 2024-25', version: '2024-25' },
  { vehicleCategory: VehicleCategory.PRIVATE_CAR, policyType: 'PACKAGE', engineCcMin: 1501, engineCcMax: undefined, annualPremium: 7897, source: 'IRDAI 2024-25', version: '2024-25' },
  { vehicleCategory: VehicleCategory.PRIVATE_CAR, policyType: 'PACKAGE', engineCcMin: undefined, engineCcMax: undefined, annualPremium: 3416, source: 'IRDAI 2024-25 Default', version: '2024-25' },

  // PRIVATE_CAR - TP_ONLY
  { vehicleCategory: VehicleCategory.PRIVATE_CAR, policyType: 'TP_ONLY', engineCcMin: 0, engineCcMax: 1000, annualPremium: 2094, source: 'IRDAI 2024-25', version: '2024-25' },
  { vehicleCategory: VehicleCategory.PRIVATE_CAR, policyType: 'TP_ONLY', engineCcMin: 1001, engineCcMax: 1500, annualPremium: 3416, source: 'IRDAI 2024-25', version: '2024-25' },
  { vehicleCategory: VehicleCategory.PRIVATE_CAR, policyType: 'TP_ONLY', engineCcMin: 1501, engineCcMax: undefined, annualPremium: 7897, source: 'IRDAI 2024-25', version: '2024-25' },
  { vehicleCategory: VehicleCategory.PRIVATE_CAR, policyType: 'TP_ONLY', engineCcMin: undefined, engineCcMax: undefined, annualPremium: 3416, source: 'IRDAI 2024-25 Default', version: '2024-25' },

  // BIKE - PACKAGE
  { vehicleCategory: VehicleCategory.BIKE, policyType: 'PACKAGE', engineCcMin: 0, engineCcMax: 75, annualPremium: 538, source: 'IRDAI 2024-25', version: '2024-25' },
  { vehicleCategory: VehicleCategory.BIKE, policyType: 'PACKAGE', engineCcMin: 76, engineCcMax: 150, annualPremium: 714, source: 'IRDAI 2024-25', version: '2024-25' },
  { vehicleCategory: VehicleCategory.BIKE, policyType: 'PACKAGE', engineCcMin: 151, engineCcMax: 350, annualPremium: 1366, source: 'IRDAI 2024-25', version: '2024-25' },
  { vehicleCategory: VehicleCategory.BIKE, policyType: 'PACKAGE', engineCcMin: 351, engineCcMax: undefined, annualPremium: 2804, source: 'IRDAI 2024-25', version: '2024-25' },
  { vehicleCategory: VehicleCategory.BIKE, policyType: 'PACKAGE', engineCcMin: undefined, engineCcMax: undefined, annualPremium: 714, source: 'IRDAI 2024-25 Default', version: '2024-25' },

  // BIKE - TP_ONLY
  { vehicleCategory: VehicleCategory.BIKE, policyType: 'TP_ONLY', engineCcMin: 0, engineCcMax: 75, annualPremium: 538, source: 'IRDAI 2024-25', version: '2024-25' },
  { vehicleCategory: VehicleCategory.BIKE, policyType: 'TP_ONLY', engineCcMin: 76, engineCcMax: 150, annualPremium: 714, source: 'IRDAI 2024-25', version: '2024-25' },
  { vehicleCategory: VehicleCategory.BIKE, policyType: 'TP_ONLY', engineCcMin: 151, engineCcMax: 350, annualPremium: 1366, source: 'IRDAI 2024-25', version: '2024-25' },
  { vehicleCategory: VehicleCategory.BIKE, policyType: 'TP_ONLY', engineCcMin: 351, engineCcMax: undefined, annualPremium: 2804, source: 'IRDAI 2024-25', version: '2024-25' },
  { vehicleCategory: VehicleCategory.BIKE, policyType: 'TP_ONLY', engineCcMin: undefined, engineCcMax: undefined, annualPremium: 714, source: 'IRDAI 2024-25 Default', version: '2024-25' },

  // COMMERCIAL VEHICLES - PACKAGE & TP_ONLY
  { vehicleCategory: VehicleCategory.GCV, policyType: 'PACKAGE', annualPremium: 15746, source: 'IRDAI 2024-25', version: '2024-25' },
  { vehicleCategory: VehicleCategory.GCV, policyType: 'TP_ONLY', annualPremium: 15746, source: 'IRDAI 2024-25', version: '2024-25' },
  { vehicleCategory: VehicleCategory.TRACTOR, policyType: 'PACKAGE', annualPremium: 8432, source: 'IRDAI 2024-25', version: '2024-25' },
  { vehicleCategory: VehicleCategory.TRACTOR, policyType: 'TP_ONLY', annualPremium: 8432, source: 'IRDAI 2024-25', version: '2024-25' },
  { vehicleCategory: VehicleCategory.AUTO, policyType: 'PACKAGE', annualPremium: 2539, source: 'IRDAI 2024-25', version: '2024-25' },
  { vehicleCategory: VehicleCategory.AUTO, policyType: 'TP_ONLY', annualPremium: 2539, source: 'IRDAI 2024-25', version: '2024-25' },
  { vehicleCategory: VehicleCategory.TAXI, policyType: 'PACKAGE', annualPremium: 5528, source: 'IRDAI 2024-25', version: '2024-25' },
  { vehicleCategory: VehicleCategory.TAXI, policyType: 'TP_ONLY', annualPremium: 5528, source: 'IRDAI 2024-25', version: '2024-25' },
  { vehicleCategory: VehicleCategory.BUS_COACH, policyType: 'PACKAGE', annualPremium: 14321, source: 'IRDAI 2024-25', version: '2024-25' },
  { vehicleCategory: VehicleCategory.BUS_COACH, policyType: 'TP_ONLY', annualPremium: 14321, source: 'IRDAI 2024-25', version: '2024-25' },
  { vehicleCategory: VehicleCategory.MISC_CLASS_D, policyType: 'PACKAGE', annualPremium: 8800, source: 'IRDAI 2024-25', version: '2024-25' },
  { vehicleCategory: VehicleCategory.MISC_CLASS_D, policyType: 'TP_ONLY', annualPremium: 8800, source: 'IRDAI 2024-25', version: '2024-25' },
];

async function seed() {
  console.log('Seeding statutory MotorTariff rates...');
  const effectiveFrom = new Date('2020-01-01');

  for (const item of TARIFFS) {
    await prisma.motorTariff.create({
      data: {
        vehicleCategory: item.vehicleCategory,
        policyType: item.policyType,
        engineCcMin: item.engineCcMin ?? null,
        engineCcMax: item.engineCcMax ?? null,
        annualPremium: item.annualPremium,
        effectiveFrom,
        effectiveTo: null,
        source: item.source,
        version: item.version,
        isActive: true,
        isVerified: true,
        verificationNote: 'IRDAI Statutory Schedule',
      },
    });
  }

  console.log(`Successfully seeded ${TARIFFS.length} statutory motor tariff rows.`);
  await prisma.$disconnect();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
