import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getApplicationInfo() {
    return {
      application: 'JEST Policy CRM',
      version: '1.0.0',
      status: 'running',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    };
  }
}
