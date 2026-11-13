import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ConnectCallInput {
  /** Agent's phone — Exotel rings this first */
  agentNumber: string;
  /** Customer's phone — rung after the agent answers */
  customerNumber: string;
  /** Where Exotel sends the result when the call ends (Task 4) */
  statusCallbackUrl?: string;
  /** Our own reference, sent back to us in the callback */
  customField?: string;
}

export interface ConnectCallResult {
  callSid: string;
  status: string;
}

@Injectable()
export class ExotelClient {
  private readonly logger = new Logger(ExotelClient.name);

  constructor(private readonly config: ConfigService) {}

  /** True only when all Exotel settings exist in .env */
  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('EXOTEL_ACCOUNT_SID') &&
        this.config.get<string>('EXOTEL_API_KEY') &&
        this.config.get<string>('EXOTEL_API_TOKEN') &&
        this.config.get<string>('EXOTEL_CALLER_ID'),
    );
  }

  /** Asks Exotel to call the agent, then connect them to the customer */
  async connectCall(input: ConnectCallInput): Promise<ConnectCallResult> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException('Exotel is not configured');
    }

    const sid = this.config.get<string>('EXOTEL_ACCOUNT_SID') as string;
    const subdomain =
      this.config.get<string>('EXOTEL_SUBDOMAIN') ?? 'api.exotel.com';
    const apiKey = this.config.get<string>('EXOTEL_API_KEY') as string;
    const apiToken = this.config.get<string>('EXOTEL_API_TOKEN') as string;
    const callerId = this.config.get<string>('EXOTEL_CALLER_ID') as string;

    const url = `https://${subdomain}/v1/Accounts/${sid}/Calls/connect.json`;

    const body = new URLSearchParams({
      From: input.agentNumber,
      To: input.customerNumber,
      CallerId: callerId,
      Record: 'true',
    });
    if (input.statusCallbackUrl) {
      body.append('StatusCallback', input.statusCallbackUrl);
      body.append('StatusCallbackEvents[0]', 'terminal');
      body.append('StatusCallbackContentType', 'application/json');
    }
    if (input.customField) {
      body.append('CustomField', input.customField);
    }

    const auth = Buffer.from(`${apiKey}:${apiToken}`).toString('base64');

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body,
        signal: AbortSignal.timeout(15000),
      });
    } catch (err) {
      this.logger.error(`Exotel request failed: ${(err as Error).message}`);
      throw new BadGatewayException('Could not reach Exotel');
    }

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.Call?.Sid) {
      this.logger.error(
        `Exotel connect failed (${res.status}): ${JSON.stringify(
          data?.RestException ?? data,
        )}`,
      );
      throw new BadGatewayException('Exotel could not start the call');
    }

    return { callSid: data.Call.Sid, status: data.Call.Status };
  }
}
