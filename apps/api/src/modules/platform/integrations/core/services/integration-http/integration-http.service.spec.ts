import { Test, TestingModule } from '@nestjs/testing';
import { IntegrationHttpClient } from './integration-http.service';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';

describe('IntegrationHttpClient', () => {
  let service: IntegrationHttpClient;
  let httpService: HttpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationHttpClient,
        {
          provide: HttpService,
          useValue: {
            get: jest.fn(),
            post: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<IntegrationHttpClient>(IntegrationHttpClient);
    httpService = module.get<HttpService>(HttpService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should successfully make a GET request', async () => {
    const responseData = { data: 'test_data' };
    (httpService.get as jest.Mock).mockReturnValue(of({ data: responseData }));

    const result = await service.get('http://test.com', {}, 'test_provider');

    expect(httpService.get).toHaveBeenCalledWith('http://test.com', {});
    expect(result).toEqual(responseData);
  });

  it('should retry a failed GET request and then throw', async () => {
    (httpService.get as jest.Mock).mockReturnValue(
      throwError(() => new Error('Network Error')),
    );

    await expect(
      service.get('http://fail.com', {}, 'test_provider'),
    ).rejects.toThrow('Network Error');
    // Note: Since retry(3) is used, it actually retries 3 times internally before failing.
    // The opossum circuit breaker will record this failure.
  });
});
