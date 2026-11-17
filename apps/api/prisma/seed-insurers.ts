import { PrismaClient } from '@prisma/client';

export const PARTNER_INSURERS = [
  // Standalone Health Insurers (SAHI)
  { name: 'Star Health and Allied Insurance', code: 'STAR_HEALTH', irdaiRegistrationNumber: '129', isActive: true },
  { name: 'Care Health Insurance', code: 'CARE_HEALTH', irdaiRegistrationNumber: '148', isActive: true },
  { name: 'Niva Bupa Health Insurance', code: 'NIVA_BUPA', irdaiRegistrationNumber: '145', isActive: true },
  { name: 'Aditya Birla Health Insurance', code: 'ADITYA_BIRLA_HEALTH', irdaiRegistrationNumber: '153', isActive: true },
  { name: 'ManipalCigna Health Insurance', code: 'MANIPAL_CIGNA_HEALTH', irdaiRegistrationNumber: '151', isActive: true },

  // Leading General & Health Insurers
  { name: 'HDFC ERGO General Insurance', code: 'HDFC_ERGO', irdaiRegistrationNumber: '146', isActive: true },
  { name: 'ICICI Lombard General Insurance', code: 'ICICI_LOMBARD', irdaiRegistrationNumber: '115', isActive: true },
  { name: 'Bajaj Allianz General Insurance', code: 'BAJAJ_ALLIANZ', irdaiRegistrationNumber: '113', isActive: true },
  { name: 'Tata AIG General Insurance', code: 'TATA_AIG', irdaiRegistrationNumber: '108', isActive: true },
  { name: 'New India Assurance', code: 'NEW_INDIA', irdaiRegistrationNumber: '190', isActive: true },
  { name: 'United India Insurance', code: 'UNITED_INDIA', irdaiRegistrationNumber: '545', isActive: true },
  { name: 'National Insurance', code: 'NATIONAL_INSURANCE', irdaiRegistrationNumber: '58', isActive: true },
  { name: 'Oriental Insurance', code: 'ORIENTAL_INSURANCE', irdaiRegistrationNumber: '556', isActive: true },
  { name: 'SBI General Insurance', code: 'SBI_GENERAL', irdaiRegistrationNumber: '144', isActive: true },
  { name: 'Reliance General Insurance', code: 'RELIANCE_GENERAL', irdaiRegistrationNumber: '103', isActive: true },
  { name: 'Go Digit General Insurance', code: 'GO_DIGIT', irdaiRegistrationNumber: '158', isActive: true },
  { name: 'Cholamandalam MS General Insurance', code: 'CHOLAMANDALAM_MS', irdaiRegistrationNumber: '123', isActive: true },
  { name: 'Royal Sundaram General Insurance', code: 'ROYAL_SUNDARAM', irdaiRegistrationNumber: '102', isActive: true },
  { name: 'Shriram General Insurance', code: 'SHRIRAM_GENERAL', irdaiRegistrationNumber: '137', isActive: true },
  { name: 'Future Generali India Insurance', code: 'FUTURE_GENERALI', irdaiRegistrationNumber: '132', isActive: true },
];

export async function seedPartnerInsurers(client: any) {
  console.log('Seeding partner insurers master...');
  for (const ins of PARTNER_INSURERS) {
    await client.insurer.upsert({
      where: { code: ins.code },
      update: {
        name: ins.name,
        isActive: ins.isActive,
        irdaiRegistrationNumber: ins.irdaiRegistrationNumber,
      },
      create: {
        name: ins.name,
        code: ins.code,
        irdaiRegistrationNumber: ins.irdaiRegistrationNumber,
        isActive: ins.isActive,
      },
    });
  }
  console.log('- Seeded partner insurers master.');
}
