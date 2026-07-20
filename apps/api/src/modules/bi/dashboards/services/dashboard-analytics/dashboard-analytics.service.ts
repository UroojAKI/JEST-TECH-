import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../../database/prisma.service';

@Injectable()
export class DashboardAnalyticsService {
  private readonly logger = new Logger(DashboardAnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fetches data for a specific dashboard configuration.
   * Dashboards are composed of Widgets, which define the queries.
   */
  async getDashboardData(dashboardId: string) {
    const dashboard = await this.prisma.dashboard.findUnique({
      where: { id: dashboardId },
      include: {
        widgets: {
          include: { widget: true }
        }
      }
    });

    if (!dashboard) {
      throw new NotFoundException('Dashboard not found');
    }

    const results = [];

    // In a real scenario, this would use a robust query builder translating JSON config to SQL.
    for (const dashboardWidget of dashboard.widgets) {
      const widget = dashboardWidget.widget;
      let data = null;

      try {
        const config = JSON.parse(widget.config);
        
        // Naive query executor for MVP demonstration
        if (config.metric === 'TOTAL_REVENUE') {
          const res = await this.prisma.factRevenue.aggregate({ _sum: { amount: true } });
          data = res._sum.amount;
        } else if (config.metric === 'CLAIMS_PAID') {
          const res = await this.prisma.factClaim.aggregate({ _sum: { amountSettled: true } });
          data = res._sum.amountSettled;
        }

      } catch (e) {
        this.logger.error(`Failed to process widget ${widget.id}: ${e.message}`);
      }

      results.push({
        widgetId: widget.id,
        name: widget.name,
        type: widget.type,
        layout: { x: dashboardWidget.x, y: dashboardWidget.y, w: dashboardWidget.w, h: dashboardWidget.h },
        data
      });
    }

    return {
      dashboardId: dashboard.id,
      name: dashboard.name,
      widgets: results
    };
  }
}
