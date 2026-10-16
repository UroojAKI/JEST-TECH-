export interface RtoSeedItem {
  code: string;
  state: string;
  district: string;
  rtoOfficeName: string;
  rtoZone: 'ZONE_A' | 'ZONE_B';
  isActive: boolean;
}

export const KARNATAKA_RTO_DATA: RtoSeedItem[] = [
  // Bengaluru Urban (Zone A for Motor Insurance Tariff)
  { code: 'KA01', state: 'Karnataka', district: 'Bengaluru Urban', rtoOfficeName: 'Bangalore Central (Koramangala)', rtoZone: 'ZONE_A', isActive: true },
  { code: 'KA02', state: 'Karnataka', district: 'Bengaluru Urban', rtoOfficeName: 'Bangalore West (Rajajinagar)', rtoZone: 'ZONE_A', isActive: true },
  { code: 'KA03', state: 'Karnataka', district: 'Bengaluru Urban', rtoOfficeName: 'Bangalore East (Indiranagar)', rtoZone: 'ZONE_A', isActive: true },
  { code: 'KA04', state: 'Karnataka', district: 'Bengaluru Urban', rtoOfficeName: 'Bangalore North (Yeshwanthpur)', rtoZone: 'ZONE_A', isActive: true },
  { code: 'KA05', state: 'Karnataka', district: 'Bengaluru Urban', rtoOfficeName: 'Bangalore South (Jayanagar)', rtoZone: 'ZONE_A', isActive: true },
  { code: 'KA41', state: 'Karnataka', district: 'Bengaluru Urban', rtoOfficeName: 'Bangalore West (Jnanabharathi / Kengeri)', rtoZone: 'ZONE_A', isActive: true },
  { code: 'KA50', state: 'Karnataka', district: 'Bengaluru Urban', rtoOfficeName: 'Bangalore North (Yelahanka)', rtoZone: 'ZONE_A', isActive: true },
  { code: 'KA51', state: 'Karnataka', district: 'Bengaluru Urban', rtoOfficeName: 'Bangalore South (Electronics City / Bannerghatta)', rtoZone: 'ZONE_A', isActive: true },
  { code: 'KA53', state: 'Karnataka', district: 'Bengaluru Urban', rtoOfficeName: 'Bangalore East (K.R. Puram)', rtoZone: 'ZONE_A', isActive: true },
  { code: 'KA57', state: 'Karnataka', district: 'Bengaluru Urban', rtoOfficeName: 'Bangalore Central (Shanthinagar)', rtoZone: 'ZONE_A', isActive: true },
  { code: 'KA58', state: 'Karnataka', district: 'Bengaluru Urban', rtoOfficeName: 'Bangalore South (Banashankari)', rtoZone: 'ZONE_A', isActive: true },
  { code: 'KA59', state: 'Karnataka', district: 'Bengaluru Urban', rtoOfficeName: 'Bangalore South (Chandapura / Anekal)', rtoZone: 'ZONE_A', isActive: true },
  { code: 'KA68', state: 'Karnataka', district: 'Bengaluru Urban', rtoOfficeName: 'Bangalore West (R.R. Nagar)', rtoZone: 'ZONE_A', isActive: true },
  { code: 'KA69', state: 'Karnataka', district: 'Bengaluru Urban', rtoOfficeName: 'Bangalore East (Ramamurthy Nagar)', rtoZone: 'ZONE_A', isActive: true },

  // Bengaluru Rural & Other Karnataka Districts (Zone B)
  { code: 'KA06', state: 'Karnataka', district: 'Tumakuru', rtoOfficeName: 'Tumakuru (Tumkur)', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA07', state: 'Karnataka', district: 'Kolar', rtoOfficeName: 'Kolar', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA08', state: 'Karnataka', district: 'Kolar', rtoOfficeName: 'Kolar Gold Fields (KGF)', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA09', state: 'Karnataka', district: 'Mysuru', rtoOfficeName: 'Mysuru West', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA10', state: 'Karnataka', district: 'Chamarajanagar', rtoOfficeName: 'Chamarajanagar', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA11', state: 'Karnataka', district: 'Mandya', rtoOfficeName: 'Mandya', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA12', state: 'Karnataka', district: 'Kodagu', rtoOfficeName: 'Madikeri (Kodagu)', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA13', state: 'Karnataka', district: 'Hassan', rtoOfficeName: 'Hassan', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA14', state: 'Karnataka', district: 'Shivamogga', rtoOfficeName: 'Shivamogga (Shimoga)', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA15', state: 'Karnataka', district: 'Shivamogga', rtoOfficeName: 'Sagar', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA16', state: 'Karnataka', district: 'Chitradurga', rtoOfficeName: 'Chitradurga', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA17', state: 'Karnataka', district: 'Davanagere', rtoOfficeName: 'Davanagere', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA18', state: 'Karnataka', district: 'Chikkamagaluru', rtoOfficeName: 'Chikkamagaluru', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA19', state: 'Karnataka', district: 'Dakshina Kannada', rtoOfficeName: 'Mangaluru', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA20', state: 'Karnataka', district: 'Udupi', rtoOfficeName: 'Udupi', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA21', state: 'Karnataka', district: 'Dakshina Kannada', rtoOfficeName: 'Puttur', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA22', state: 'Karnataka', district: 'Belagavi', rtoOfficeName: 'Belagavi (Belgaum)', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA23', state: 'Karnataka', district: 'Belagavi', rtoOfficeName: 'Chikkodi', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA24', state: 'Karnataka', district: 'Belagavi', rtoOfficeName: 'Bailhongal', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA25', state: 'Karnataka', district: 'Dharwad', rtoOfficeName: 'Dharwad', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA26', state: 'Karnataka', district: 'Gadag', rtoOfficeName: 'Gadag', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA27', state: 'Karnataka', district: 'Haveri', rtoOfficeName: 'Haveri', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA28', state: 'Karnataka', district: 'Vijayapura', rtoOfficeName: 'Vijayapura (Bijapur)', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA29', state: 'Karnataka', district: 'Bagalkot', rtoOfficeName: 'Bagalkot', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA30', state: 'Karnataka', district: 'Uttara Kannada', rtoOfficeName: 'Karwar', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA31', state: 'Karnataka', district: 'Uttara Kannada', rtoOfficeName: 'Sirsi', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA32', state: 'Karnataka', district: 'Kalaburagi', rtoOfficeName: 'Kalaburagi (Gulbarga)', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA33', state: 'Karnataka', district: 'Yadgir', rtoOfficeName: 'Yadgir', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA34', state: 'Karnataka', district: 'Ballari', rtoOfficeName: 'Ballari (Bellary)', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA35', state: 'Karnataka', district: 'Vijayanagara', rtoOfficeName: 'Hospet (Vijayanagara)', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA36', state: 'Karnataka', district: 'Raichur', rtoOfficeName: 'Raichur', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA37', state: 'Karnataka', district: 'Koppal', rtoOfficeName: 'Koppal', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA38', state: 'Karnataka', district: 'Bidar', rtoOfficeName: 'Bidar', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA39', state: 'Karnataka', district: 'Bidar', rtoOfficeName: 'Bhalki', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA40', state: 'Karnataka', district: 'Chikkaballapur', rtoOfficeName: 'Chikkaballapur', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA42', state: 'Karnataka', district: 'Ramanagara', rtoOfficeName: 'Ramanagara', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA43', state: 'Karnataka', district: 'Bengaluru Rural', rtoOfficeName: 'Devanahalli (Bengaluru Rural)', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA44', state: 'Karnataka', district: 'Tumakuru', rtoOfficeName: 'Tiptur', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA45', state: 'Karnataka', district: 'Mysuru', rtoOfficeName: 'Hunsur', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA46', state: 'Karnataka', district: 'Dakshina Kannada', rtoOfficeName: 'Moodabidri', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA47', state: 'Karnataka', district: 'Uttara Kannada', rtoOfficeName: 'Honnavar', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA48', state: 'Karnataka', district: 'Bagalkot', rtoOfficeName: 'Jamkhandi', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA49', state: 'Karnataka', district: 'Belagavi', rtoOfficeName: 'Gokak', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA52', state: 'Karnataka', district: 'Bengaluru Rural', rtoOfficeName: 'Nelamangala (Bengaluru Rural)', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA54', state: 'Karnataka', district: 'Mandya', rtoOfficeName: 'Nagamangala', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA55', state: 'Karnataka', district: 'Mysuru', rtoOfficeName: 'Mysuru East', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA56', state: 'Karnataka', district: 'Bidar', rtoOfficeName: 'Basavakalyan', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA60', state: 'Karnataka', district: 'Haveri', rtoOfficeName: 'Ranebennur', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA61', state: 'Karnataka', district: 'Bagalkot', rtoOfficeName: 'Ilkal', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA62', state: 'Karnataka', district: 'Dakshina Kannada', rtoOfficeName: 'Surathkal', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA63', state: 'Karnataka', district: 'Dharwad', rtoOfficeName: 'Hubballi (Hubli)', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA64', state: 'Karnataka', district: 'Tumakuru', rtoOfficeName: 'Madhugiri', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA65', state: 'Karnataka', district: 'Uttara Kannada', rtoOfficeName: 'Dandeli', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA66', state: 'Karnataka', district: 'Chikkamagaluru', rtoOfficeName: 'Tarikere', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA67', state: 'Karnataka', district: 'Chikkaballapur', rtoOfficeName: 'Chintamani', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA70', state: 'Karnataka', district: 'Dakshina Kannada', rtoOfficeName: 'Bantwal', rtoZone: 'ZONE_B', isActive: true },
  { code: 'KA71', state: 'Karnataka', district: 'Belagavi', rtoOfficeName: 'Athani', rtoZone: 'ZONE_B', isActive: true },

  // Key National Metro RTOs (Zone A) for Test Compatibility & National Coverage
  { code: 'DL01', state: 'Delhi', district: 'North Delhi', rtoOfficeName: 'Delhi North (Mall Road)', rtoZone: 'ZONE_A', isActive: true },
  { code: 'DL02', state: 'Delhi', district: 'New Delhi', rtoOfficeName: 'New Delhi (Tilak Marg)', rtoZone: 'ZONE_A', isActive: true },
  { code: 'DL03', state: 'Delhi', district: 'South Delhi', rtoOfficeName: 'Delhi South (Sheikh Sarai)', rtoZone: 'ZONE_A', isActive: true },
  { code: 'DL04', state: 'Delhi', district: 'West Delhi', rtoOfficeName: 'Delhi West (Janakpuri)', rtoZone: 'ZONE_A', isActive: true },
  { code: 'MH01', state: 'Maharashtra', district: 'Mumbai City', rtoOfficeName: 'Mumbai South (Tardeo)', rtoZone: 'ZONE_A', isActive: true },
  { code: 'MH02', state: 'Maharashtra', district: 'Mumbai Suburban', rtoOfficeName: 'Mumbai West (Andheri)', rtoZone: 'ZONE_A', isActive: true },
  { code: 'MH03', state: 'Maharashtra', district: 'Mumbai Suburban', rtoOfficeName: 'Mumbai East (Wadala)', rtoZone: 'ZONE_A', isActive: true },
  { code: 'MH04', state: 'Maharashtra', district: 'Thane', rtoOfficeName: 'Thane', rtoZone: 'ZONE_A', isActive: true },
  { code: 'MH12', state: 'Maharashtra', district: 'Pune', rtoOfficeName: 'Pune Central', rtoZone: 'ZONE_A', isActive: true },
];

export async function seedKarnatakaRtos(prisma: any) {
  console.log(`- Seeding ${KARNATAKA_RTO_DATA.length} authoritative RTO master records...`);
  let count = 0;
  for (const rto of KARNATAKA_RTO_DATA) {
    await prisma.rtoMaster.upsert({
      where: { code: rto.code },
      update: {
        state: rto.state,
        district: rto.district,
        rtoOfficeName: rto.rtoOfficeName,
        rtoZone: rto.rtoZone,
        isActive: rto.isActive,
      },
      create: rto,
    });
    count++;
  }
  console.log(`✅ Successfully seeded/updated ${count} RTO master records.`);
  return count;
}

if (require.main === module) {
  const { PrismaClient } = require('@prisma/client');
  const client = new PrismaClient();
  seedKarnatakaRtos(client)
    .then(() => client.$disconnect())
    .catch((err: any) => {
      console.error(err);
      client.$disconnect();
      process.exit(1);
    });
}
