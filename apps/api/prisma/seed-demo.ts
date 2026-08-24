import { PrismaClient, ContactType, LeadSource, LeadStatus, PolicyStatus, QuotationStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function seedDemoData() {
  console.log("🌱 Starting client demo data seeding for JEST POLICY CRM...");

  // 1. Fetch default Admin/Agent user for ownership relationships
  let user = await prisma.user.findFirst({
    where: { email: "superadmin@jest.com" },
  });
  if (!user) {
    user = await prisma.user.findFirst({ where: { deletedAt: null } });
  }
  if (!user) {
    console.error("❌ No active user found in DB. Run base seed first.");
    process.exit(1);
  }

  console.log(`👤 Attaching mock demo CRM data to User: ${user.email} (${user.id})`);

  // 2. Seed 10 Realistic Indian Customer Contacts
  const contactsData = [
    {
      contactCode: "CUST-VIP-01",
      type: ContactType.INDIVIDUAL,
      firstName: "Vikramaditya",
      lastName: "Singhania",
      phone: "9820012345",
      email: "vikram@singhania-group.com",
      companyName: "Singhania Enterprises",
      panNumber: "ABEPS1234K",
      aadhaarNumber: "987654321011",
      occupation: "Industrialist & Director",
    },
    {
      contactCode: "CUST-CORP-01",
      type: ContactType.CORPORATE,
      firstName: "Aditya Birla",
      lastName: "Logistics",
      phone: "9821123456",
      email: "fleet.admin@adityabirla-logx.in",
      companyName: "Aditya Birla Logistics & Fleet Ltd",
      panNumber: "AAACA5678R",
      gstNumber: "27AAACA5678R1Z1",
      occupation: "Logistics Fleet Transport",
    },
    {
      contactCode: "CUST-VIP-02",
      type: ContactType.INDIVIDUAL,
      firstName: "Priya",
      lastName: "Nair",
      phone: "9845012345",
      email: "priya.nair@techventures.ai",
      companyName: "Tech Ventures India",
      panNumber: "BVPPT8910M",
      aadhaarNumber: "887766554433",
      occupation: "VP Engineering",
    },
    {
      contactCode: "CUST-VIP-03",
      type: ContactType.INDIVIDUAL,
      firstName: "Rajeshwar",
      lastName: "Rao",
      phone: "9848012345",
      email: "r.rao@raoinfra.in",
      companyName: "Rao Infrastructure & Roads",
      panNumber: "ACQRR3456P",
      occupation: "Managing Director",
    },
    {
      contactCode: "CUST-VIP-04",
      type: ContactType.INDIVIDUAL,
      firstName: "Ananya",
      lastName: "Sharma",
      phone: "9810012345",
      email: "dr.ananya@medanta.org",
      companyName: "Medanta Healthcare",
      panNumber: "AFKPS6789W",
      occupation: "Senior Cardiologist",
    },
    {
      contactCode: "CUST-CORP-02",
      type: ContactType.CORPORATE,
      firstName: "Reliance",
      lastName: "Fast Commerce",
      phone: "9820054321",
      email: "insurance.operations@reliancecommerce.com",
      companyName: "Reliance Fast Commerce Group",
      panNumber: "AAACR1234A",
      gstNumber: "27AAACR1234A1Z5",
      occupation: "Retail Delivery Network",
    },
    {
      contactCode: "CUST-VIP-05",
      type: ContactType.INDIVIDUAL,
      firstName: "Sunil Kumar",
      lastName: "Verma",
      phone: "9825012345",
      email: "s.verma@vermasolar.co",
      companyName: "Verma Solar Systems",
      panNumber: "BNOPV4567S",
      occupation: "Founder & CEO",
    },
    {
      contactCode: "CUST-VIP-06",
      type: ContactType.INDIVIDUAL,
      firstName: "Srinivasan",
      lastName: "Ramanathan",
      phone: "9840012345",
      email: "srini@rama-architects.in",
      companyName: "Ramanathan Architects & Urban Planning",
      panNumber: "AGHPR9876Q",
      occupation: "Principal Architect",
    },
    {
      contactCode: "CUST-VIP-07",
      type: ContactType.INDIVIDUAL,
      firstName: "Meenakshi",
      lastName: "Sundaram",
      phone: "9843012345",
      email: "meenakshi@kovai-textiles.com",
      companyName: "Kovai Cotton & Textiles",
      panNumber: "AIKMS3456L",
      occupation: "Managing Partner",
    },
    {
      contactCode: "CUST-CORP-03",
      type: ContactType.CORPORATE,
      firstName: "Mahindra",
      lastName: "Solar Transports",
      phone: "9822012345",
      email: "ev.fleet@mahindra-solar-trans.in",
      companyName: "Mahindra Solar Transports Ltd",
      panNumber: "AAACM9876X",
      gstNumber: "27AAACM9876X1Z8",
      occupation: "EV Public Transit",
    }
  ];

  const contactMap = new Map<string, string>(); // code -> id

  for (const c of contactsData) {
    const upserted = await prisma.contact.upsert({
      where: { contactCode: c.contactCode },
      update: { ...c },
      create: { ...c },
    });
    contactMap.set(c.contactCode, upserted.id);
  }
  console.log(`✅ Seeded ${contactsData.length} high-profile customer records.`);

  // 3. Seed 10 Dynamic Sales Pipeline Leads
  const leadsData = [
    {
      leadCode: "LEAD-2026-001",
      title: "Aditya Birla Fleet - 25 Commercial Trucks Renewal",
      source: LeadSource.REFERRAL,
      status: LeadStatus.QUALIFIED,
      description: "Immediate requirement to renew 25 commercial haulers across Maharashtra and Gujarat routes.",
      contactCode: "CUST-CORP-01",
      estimatedPremium: 480000,
      score: 95,
      priority: "HIGH",
      slaStatus: "IN_SLA",
    },
    {
      leadCode: "LEAD-2026-002",
      title: "Vikramaditya Singhania - Porsche 911 Carrera GTS Comprehensive",
      source: LeadSource.DIGITAL,
      status: LeadStatus.NEW,
      description: "High-value brand new luxury vehicle registration in Mumbai RTO (MH-01). Requested zero depreciation and engine protect add-on.",
      contactCode: "CUST-VIP-01",
      estimatedPremium: 320000,
      score: 90,
      priority: "HIGH",
      slaStatus: "IN_SLA",
    },
    {
      leadCode: "LEAD-2026-003",
      title: "Priya Nair - Mercedes Benz C-Class Zero-Dep",
      source: LeadSource.CAMPAIGN,
      status: LeadStatus.QUOTE_PREPARED,
      description: "Proposal generated comparing ICICI Lombard, Tata AIG, and Bajaj Allianz.",
      contactCode: "CUST-VIP-02",
      estimatedPremium: 95000,
      score: 85,
      priority: "MEDIUM",
      slaStatus: "IN_SLA",
    },
    {
      leadCode: "LEAD-2026-004",
      title: "Rajeshwar Rao - Tata Signa Dumpers Fleet Policy",
      source: LeadSource.OTHER,
      status: LeadStatus.QUALIFIED,
      description: "8 construction tipper heavy vehicles requiring comprehensive worksite transit insurance.",
      contactCode: "CUST-VIP-03",
      estimatedPremium: 210000,
      score: 88,
      priority: "HIGH",
      slaStatus: "IN_SLA",
    },
    {
      leadCode: "LEAD-2026-005",
      title: "Ananya Sharma - BMW X5 Comprehensive + Engine Protect",
      source: LeadSource.ADVISOR,
      status: LeadStatus.NEW,
      description: "Doctor association referral discount applicable. Vehicle based out of South Delhi.",
      contactCode: "CUST-VIP-04",
      estimatedPremium: 145000,
      score: 82,
      priority: "MEDIUM",
      slaStatus: "IN_SLA",
    },
    {
      leadCode: "LEAD-2026-006",
      title: "Reliance Fast Commerce - 50 Mahindra Electric Vans",
      source: LeadSource.OTHER,
      status: LeadStatus.CONVERTED,
      description: "Major corporate deal closed. Policy under issuance for PAN-India electric delivery vans.",
      contactCode: "CUST-CORP-02",
      estimatedPremium: 850000,
      score: 99,
      priority: "HIGH",
      slaStatus: "COMPLETED",
    },
    {
      leadCode: "LEAD-2026-007",
      title: "Sunil Kumar Verma - Toyota Fortuner Legender Renewal",
      source: LeadSource.REFERRAL,
      status: LeadStatus.QUALIFIED,
      description: "No claim bonus 35% retention requested from previous insurer.",
      contactCode: "CUST-VIP-05",
      estimatedPremium: 82000,
      score: 80,
      priority: "MEDIUM",
      slaStatus: "IN_SLA",
    },
    {
      leadCode: "LEAD-2026-008",
      title: "Srinivasan Ramanathan - Volvo XC90 Ultimate",
      source: LeadSource.DIGITAL,
      status: LeadStatus.NEW,
      description: "Hybrid SUV comprehensive motor insurance inquiry from Chennai architecture agency.",
      contactCode: "CUST-VIP-06",
      estimatedPremium: 165000,
      score: 78,
      priority: "MEDIUM",
      slaStatus: "IN_SLA",
    },
    {
      leadCode: "LEAD-2026-009",
      title: "Meenakshi Sundaram - Textile Factory Fleet 10 Trucks",
      source: LeadSource.OTHER,
      status: LeadStatus.NEGOTIATION,
      description: "Negotiating fleet fleet discount on third party + own damage combo cover.",
      contactCode: "CUST-VIP-07",
      estimatedPremium: 350000,
      score: 92,
      priority: "HIGH",
      slaStatus: "IN_SLA",
    },
    {
      leadCode: "LEAD-2026-010",
      title: "Mahindra Solar Transports - 20 EV Buses Commercial Cover",
      source: LeadSource.ADVISOR,
      status: LeadStatus.QUOTE_PREPARED,
      description: "Comprehensive public transit insurance with maximum battery replacement protection.",
      contactCode: "CUST-CORP-03",
      estimatedPremium: 620000,
      score: 94,
      priority: "HIGH",
      slaStatus: "IN_SLA",
    }
  ];

  for (const l of leadsData) {
    const contactId = contactMap.get(l.contactCode)!;
    await prisma.lead.upsert({
      where: { leadCode: l.leadCode },
      update: {
        title: l.title,
        source: l.source,
        status: l.status,
        description: l.description,
        estimatedPremium: l.estimatedPremium,
        score: l.score,
        priority: l.priority,
        slaStatus: l.slaStatus,
        assignedToId: user.id,
        createdById: user.id,
      },
      create: {
        leadCode: l.leadCode,
        title: l.title,
        source: l.source,
        status: l.status,
        description: l.description,
        contactId,
        estimatedPremium: l.estimatedPremium,
        score: l.score,
        priority: l.priority,
        slaStatus: l.slaStatus,
        assignedToId: user.id,
        createdById: user.id,
      },
    });
  }
  console.log(`✅ Seeded ${leadsData.length} sales opportunities & leads.`);

  // 4. Seed Active Quotations & Issued Policies for Dashboard Metrics
  const quotesAndPolicies = [
    {
      quotationCode: "QT-2026-001",
      title: "Commercial Fleet Cover - Aditya Birla Logistics",
      contactCode: "CUST-CORP-01",
      insurerName: "ICICI Lombard",
      productType: "Commercial Fleet Motor",
      sumInsured: 15000000,
      basePremium: 406779,
      gstAmount: 73221,
      totalPremium: 480000,
      policyNumber: "POL-ICICI-FLT-202601",
      effectiveDate: new Date("2026-01-01"),
      expiryDate: new Date("2027-01-01"),
    },
    {
      quotationCode: "QT-2026-002",
      title: "Porsche 911 Carrera GTS - Comprehensive",
      contactCode: "CUST-VIP-01",
      insurerName: "Tata AIG General Insurance",
      productType: "Private Car Comprehensive",
      sumInsured: 12000000,
      basePremium: 271186,
      gstAmount: 48814,
      totalPremium: 320000,
      policyNumber: "POL-TATA-PRV-202602",
      effectiveDate: new Date("2026-02-01"),
      expiryDate: new Date("2027-02-01"),
    },
    {
      quotationCode: "QT-2026-003",
      title: "Mercedes Benz C-Class - Zero Depreciation",
      contactCode: "CUST-VIP-02",
      insurerName: "Bajaj Allianz General Insurance",
      productType: "Private Car Zero-Dep",
      sumInsured: 4500000,
      basePremium: 80508,
      gstAmount: 14492,
      totalPremium: 95000,
      policyNumber: "POL-BAJ-PRV-202603",
      effectiveDate: new Date("2026-03-01"),
      expiryDate: new Date("2027-03-01"),
    },
    {
      quotationCode: "QT-2026-004",
      title: "Tata Signa Tipper Fleet - Works Cover",
      contactCode: "CUST-VIP-03",
      insurerName: "HDFC ERGO General Insurance",
      productType: "Commercial Goods Carrier",
      sumInsured: 8000000,
      basePremium: 177966,
      gstAmount: 32034,
      totalPremium: 210000,
      policyNumber: "POL-HDFC-COM-202604",
      effectiveDate: new Date("2026-02-15"),
      expiryDate: new Date("2027-02-15"),
    },
    {
      quotationCode: "QT-2026-005",
      title: "PAN-India Electric Delivery Vans - Reliance Commerce",
      contactCode: "CUST-CORP-02",
      insurerName: "New India Assurance Co. Ltd.",
      productType: "EV Commercial Fleet",
      sumInsured: 35000000,
      basePremium: 720339,
      gstAmount: 129661,
      totalPremium: 850000,
      policyNumber: "POL-NIA-EV-202605",
      effectiveDate: new Date("2026-01-15"),
      expiryDate: new Date("2027-01-15"),
    }
  ];

  for (const q of quotesAndPolicies) {
    const contactId = contactMap.get(q.contactCode)!;
    
    // Upsert Quotation
    const quotation = await prisma.quotation.upsert({
      where: { quotationCode: q.quotationCode },
      update: {
        title: q.title,
        status: QuotationStatus.APPROVED,
        insurerName: q.insurerName,
        productType: q.productType,
        sumInsured: q.sumInsured,
        basePremium: q.basePremium,
        gstAmount: q.gstAmount,
        totalPremium: q.totalPremium,
        expiryDate: q.expiryDate,
        createdById: user.id,
      },
      create: {
        quotationCode: q.quotationCode,
        title: q.title,
        status: QuotationStatus.APPROVED,
        contactId,
        insurerName: q.insurerName,
        productType: q.productType,
        sumInsured: q.sumInsured,
        basePremium: q.basePremium,
        gstAmount: q.gstAmount,
        totalPremium: q.totalPremium,
        expiryDate: q.expiryDate,
        createdById: user.id,
      },
    });

    // Upsert Policy
    await prisma.policy.upsert({
      where: { policyNumber: q.policyNumber },
      update: {
        status: PolicyStatus.ACTIVE,
        premiumAmount: q.totalPremium,
        effectiveDate: q.effectiveDate,
        expiryDate: q.expiryDate,
        createdById: user.id,
      },
      create: {
        policyNumber: q.policyNumber,
        status: PolicyStatus.ACTIVE,
        quotationId: quotation.id,
        contactId,
        premiumAmount: q.totalPremium,
        effectiveDate: q.effectiveDate,
        expiryDate: q.expiryDate,
        createdById: user.id,
      },
    });
  }
  console.log(`✅ Seeded ${quotesAndPolicies.length} quotations and active policies.`);

  console.log("🌟 Demo data seeding completed successfully! Ready for client demo.");
}

seedDemoData()
  .catch((err) => {
    console.error("❌ Seeding error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
