import { Injectable } from '@nestjs/common';
import { DashboardAnalyticsService } from '../../analytics/services/dashboard-analytics.service';

@Injectable()
export class DashboardService {
  constructor(private readonly dashboardAnalytics: DashboardAnalyticsService) {}

  async getDashboard(role: string, userId: string) {
    const data = await this.dashboardAnalytics.getDashboardData(role, userId);

    // Widget layouts specifying grid area formatting per role (widget-driven)
    let layout: any[] = [];
    if (role === 'SUPER_ADMIN') {
      layout = [
        { id: 'apiHealth', gridArea: 'col-span-1' },
        { id: 'dbStatus', gridArea: 'col-span-1' },
        { id: 'redisStatus', gridArea: 'col-span-1' },
        { id: 'activeSessions', gridArea: 'col-span-1' },
        { id: 'systemUsers', gridArea: 'col-span-1' },
        { id: 'auditEvents', gridArea: 'col-span-1' },
        { id: 'funnelChart', gridArea: 'col-span-2' },
      ];
    } else if (role === 'ADMIN') {
      layout = [
        { id: 'revenue', gridArea: 'col-span-1' },
        { id: 'policiesCount', gridArea: 'col-span-1' },
        { id: 'claimsCount', gridArea: 'col-span-1' },
        { id: 'lossRatio', gridArea: 'col-span-1' },
        { id: 'funnelChart', gridArea: 'col-span-2' },
        { id: 'topInsurersChart', gridArea: 'col-span-1' },
      ];
    } else {
      layout = [
        { id: 'todayRevenue', gridArea: 'col-span-1' },
        { id: 'openLeads', gridArea: 'col-span-1' },
        { id: 'policiesIssued', gridArea: 'col-span-1' },
        { id: 'achievement', gridArea: 'col-span-1' },
        { id: 'funnelChart', gridArea: 'col-span-2' },
        { id: 'renewalsAlerts', gridArea: 'col-span-1' },
      ];
    }

    return {
      ...data,
      layout,
    };
  }
}
