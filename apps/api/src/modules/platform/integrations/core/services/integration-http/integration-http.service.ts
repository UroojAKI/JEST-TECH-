import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { catchError, lastValueFrom, retry } from 'rxjs';
import CircuitBreaker from 'opossum';

@Injectable()
export class IntegrationHttpClient {
  private readonly logger = new Logger(IntegrationHttpClient.name);
  private breakers: Map<string, CircuitBreaker> = new Map();

  constructor(private readonly httpService: HttpService) {}

  /**
   * Performs an HTTP GET request wrapped in a Circuit Breaker with retries.
   */
  async get<T>(url: string, config?: AxiosRequestConfig, providerName: string = 'default'): Promise<T> {
    return this.executeWithBreaker(providerName, () => {
      const request = this.httpService.get<T>(url, config).pipe(
        retry(3), // Exponential retry can be added here or via axios-retry
        catchError((error) => {
          this.logger.error(`HTTP GET ${url} failed`, error?.message);
          throw error;
        }),
      );
      return lastValueFrom(request).then(response => response.data);
    });
  }

  /**
   * Performs an HTTP POST request wrapped in a Circuit Breaker with retries.
   */
  async post<T>(url: string, data?: any, config?: AxiosRequestConfig, providerName: string = 'default'): Promise<T> {
    return this.executeWithBreaker(providerName, () => {
      const request = this.httpService.post<T>(url, data, config).pipe(
        retry(3),
        catchError((error) => {
          this.logger.error(`HTTP POST ${url} failed`, error?.message);
          throw error;
        }),
      );
      return lastValueFrom(request).then(response => response.data);
    });
  }

  private async executeWithBreaker<T>(providerName: string, action: () => Promise<T>): Promise<T> {
    let breaker = this.breakers.get(providerName);

    if (!breaker) {
      breaker = new CircuitBreaker(action, {
        timeout: 10000, // 10 seconds request timeout
        errorThresholdPercentage: 50, // Open circuit if 50% of requests fail
        resetTimeout: 30000, // Try again after 30 seconds
        name: providerName,
      });

      breaker.on('open', () => this.logger.warn(`Circuit Breaker OPEN for provider: ${providerName}`));
      breaker.on('halfOpen', () => this.logger.log(`Circuit Breaker HALF-OPEN for provider: ${providerName}`));
      breaker.on('close', () => this.logger.log(`Circuit Breaker CLOSED for provider: ${providerName}`));
      breaker.on('fallback', () => this.logger.warn(`Fallback triggered for provider: ${providerName}`));

      this.breakers.set(providerName, breaker);
    }

    return breaker.fire() as Promise<T>;
  }
}
