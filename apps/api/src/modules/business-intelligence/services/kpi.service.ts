import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class KpiService {
  constructor(private readonly prisma: PrismaService) {}

  async listKpis() {
    return this.prisma.kpiDefinition.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async createKpi(data: {
    name: string;
    key: string;
    description?: string;
    formula: string;
    category: string;
    unit: string;
    displayOrder?: number;
    userId: string;
  }) {
    return this.prisma.kpiDefinition.create({
      data: {
        name: data.name,
        key: data.key,
        description: data.description,
        formula: data.formula,
        category: data.category,
        unit: data.unit as any,
        displayOrder: data.displayOrder ?? 0,
        createdById: data.userId,
      },
    });
  }

  async updateKpi(id: string, data: Partial<{ name: string; description: string; formula: string; unit: string; displayOrder: number; isActive: boolean }>) {
    const kpi = await this.prisma.kpiDefinition.findUnique({ where: { id } });
    if (!kpi) throw new NotFoundException('KPI not found');
    return this.prisma.kpiDefinition.update({ where: { id }, data: data as any });
  }

  async deleteKpi(id: string) {
    return this.prisma.kpiDefinition.update({ where: { id }, data: { isActive: false } });
  }

  // Seed default KPIs on first run
  async seedDefaultKpis(userId: string) {
    const existing = await this.prisma.kpiDefinition.count();
    if (existing > 0) return { seeded: false, message: 'KPIs already exist' };

    const defaults = [
      { name: 'Lead Conversion Rate', key: 'conversion_rate', formula: 'leads_converted / leads_total * 100', category: 'sales', unit: 'PERCENTAGE', displayOrder: 1, description: 'Percentage of leads that converted to policies' },
      { name: 'Revenue This Month', key: 'revenue_this_month', formula: 'revenue_this_month', category: 'revenue', unit: 'CURRENCY', displayOrder: 2, description: 'Total premium revenue collected this month' },
      { name: 'MoM Revenue Growth', key: 'revenue_mom_growth', formula: 'revenue_mom_growth', category: 'revenue', unit: 'PERCENTAGE', displayOrder: 3, description: 'Month-over-month revenue growth percentage' },
      { name: 'Loss Ratio', key: 'loss_ratio', formula: 'loss_ratio', category: 'claims', unit: 'PERCENTAGE', displayOrder: 4, description: 'Claims paid as a percentage of premium collected' },
      { name: 'Renewals Expiring (45d)', key: 'renewals_expiring_45', formula: 'renewals_expiring_45', category: 'renewals', unit: 'COUNT', displayOrder: 5, description: 'Number of policies expiring within 45 days' },
      { name: 'Renewal Conversion Rate', key: 'renewal_conversion_rate', formula: 'renewal_conversion_rate', category: 'renewals', unit: 'PERCENTAGE', displayOrder: 6, description: 'Percentage of expiring policies successfully renewed' },
      { name: 'Policies Issued (Month)', key: 'policies_issued_this_month', formula: 'policies_issued_this_month', category: 'sales', unit: 'COUNT', displayOrder: 7, description: 'Policies issued in the current month' },
      { name: 'Policy MoM Growth', key: 'policies_mom_growth', formula: 'policies_mom_growth', category: 'sales', unit: 'PERCENTAGE', displayOrder: 8, description: 'Month-over-month policy issuance growth' },
    ];

    await Promise.all(
      defaults.map((d) =>
        this.prisma.kpiDefinition.create({
          data: { ...d, unit: d.unit as any, isActive: true, createdById: userId },
        }),
      ),
    );

    return { seeded: true, count: defaults.length };
  }
}
