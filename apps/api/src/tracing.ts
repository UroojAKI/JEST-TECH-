import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

export const otelSDK = new NodeSDK({
  traceExporter:
    new (require('@opentelemetry/sdk-trace-base').ConsoleSpanExporter)(),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false }, // Reduce noise
    }),
  ],
});

process.on('SIGTERM', () => {
  otelSDK
    .shutdown()
    .then(() => console.log('Tracing terminated'))
    .catch((error) => console.log('Error terminating tracing', error))
    .finally(() => process.exit(0));
});
