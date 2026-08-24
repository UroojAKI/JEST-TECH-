import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding motor configuration...');

  const configs = [
    {
      key: 'tp_rates',
      value: {
        pc: {
          "upto_1000cc": 2094,
          "1001_to_1500cc": 3416,
          "above_1500cc": 7897
        },
        tw: {
          "upto_75cc": 538,
          "76_to_150cc": 714,
          "151_to_350cc": 1366,
          "above_350cc": 2804
        },
        cv: {
          "upto_7500kg": 16049,
          "7501_to_12000kg": 27186,
          "12001_to_20000kg": 35313,
          "20001_to_40000kg": 43950,
          "above_40000kg": 44242
        }
      },
      description: 'TP rates by CC/GVW',
      valueType: 'JSON'
    },
    {
      key: 'cpa_premium',
      value: '788',
      description: 'Compulsory PA cover premium',
      valueType: 'STRING'
    },
    {
      key: 'ncb_slabs',
      value: '[0, 20, 25, 35, 45, 50]',
      description: 'Standard NCB slabs',
      valueType: 'JSON'
    }
  ];

  for (const config of configs) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: {
        value: typeof config.value === 'string' ? config.value : JSON.stringify(config.value),
        description: config.description,
        valueType: config.valueType,
        updatedAt: new Date(),
      },
      create: {
        key: config.key,
        value: typeof config.value === 'string' ? config.value : JSON.stringify(config.value),
        description: config.description,
        valueType: config.valueType,
      }
    });
  }

  console.log('Motor configuration seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
