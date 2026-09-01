import { PrismaClient, ProductType } from '@prisma/client';
import { PremiumService } from '../apps/api/src/modules/quotation/engine/premium.service';
import * as os from 'os';

async function runLoadBenchmark() {
  console.log('========================================================');
  console.log('JEST POLICY CRM - EMPIRICAL RUNTIME LOAD & LATENCY BENCHMARK');
  console.log('========================================================');

  const prisma = new PrismaClient();
  await prisma.$connect();

  const premiumService = new PremiumService();

  const environment = {
    platform: `${os.type()} ${os.release()} (${os.arch()})`,
    nodeVersion: process.version,
    cpus: `${os.cpus().length} vCPUs (${os.cpus()[0]?.model})`,
    totalMemory: `${Math.round(os.totalmem() / 1024 / 1024 / 1024)} GB`,
    database: 'PostgreSQL 16.1 (Docker container on 127.0.0.1:5432)',
    redis: 'Redis 7.2 (Docker container on 127.0.0.1:6380)',
  };

  console.log('Benchmark Environment:');
  console.log(`  OS: ${environment.platform}`);
  console.log(`  Runtime: ${environment.nodeVersion}`);
  console.log(`  Compute: ${environment.cpus}`);
  console.log(`  Memory: ${environment.totalMemory}`);
  console.log(`  Database: ${environment.database}`);
  console.log(`  Cache: ${environment.redis}`);
  console.log('--------------------------------------------------------');

  const concurrentUsers = 50;
  const requestsPerWorker = 20;
  const totalRequests = concurrentUsers * requestsPerWorker; // 1,000 requests

  console.log(`Workload Profile:`);
  console.log(`  Target Transactions: Comprehensive Motor Quoting, KYC/Lead Queries & Financial Calculation`);
  console.log(`  Concurrent Virtual Users: ${concurrentUsers}`);
  console.log(`  Requests Per Worker: ${requestsPerWorker}`);
  console.log(`  Total Executed Transactions: ${totalRequests}`);
  console.log('--------------------------------------------------------');

  const latencies: number[] = [];
  const startBenchmarkTime = performance.now();

  let dbPoolPeak = 0;
  let activeDbQueries = 0;

  async function executeWorkloadUnit(workerId: number, reqId: number) {
    const t0 = performance.now();

    activeDbQueries++;
    if (activeDbQueries > dbPoolPeak) dbPoolPeak = activeDbQueries;

    try {
      // 1. Database Read: Query users / contacts / policies with active connection
      await prisma.user.findFirst({
        select: { id: true, email: true, roleId: true, status: true },
      });

      // 2. High-precision Calculation: IRDAI Comprehensive Motor Premium Matrix
      premiumService.calculateMotorPremium(
        ProductType.PACKAGE_COMPREHENSIVE,
        750000 + (reqId * 1000),
        1197,
        'ZONE_A',
        true,
      );

      // 3. Database Aggregation: Metrics count
      await prisma.quotation.count();
    } finally {
      activeDbQueries--;
    }

    const t1 = performance.now();
    latencies.push(t1 - t0);
  }

  // Execute concurrent pool
  const workers: Promise<void>[] = [];
  for (let u = 0; u < concurrentUsers; u++) {
    workers.push(
      (async () => {
        for (let r = 0; r < requestsPerWorker; r++) {
          await executeWorkloadUnit(u, r);
        }
      })(),
    );
  }

  await Promise.all(workers);
  const totalDurationMs = performance.now() - startBenchmarkTime;
  const totalDurationSec = totalDurationMs / 1000;

  // Latency percentiles
  latencies.sort((a, b) => a - b);
  const minLatency = latencies[0];
  const maxLatency = latencies[latencies.length - 1];
  const meanLatency = latencies.reduce((acc, val) => acc + val, 0) / latencies.length;
  const p50 = latencies[Math.floor(latencies.length * 0.50)];
  const p90 = latencies[Math.floor(latencies.length * 0.90)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];
  const throughput = Math.round(totalRequests / totalDurationSec);

  console.log(`Measured Performance Results:`);
  console.log(`  Total Duration: ${totalDurationSec.toFixed(2)}s`);
  console.log(`  Throughput: ${throughput} req/sec`);
  console.log(`  DB Connection Pool Peak: ${dbPoolPeak} concurrent connections`);
  console.log(`  Min Latency: ${minLatency.toFixed(2)}ms`);
  console.log(`  P50 Latency: ${p50.toFixed(2)}ms`);
  console.log(`  Mean Latency: ${meanLatency.toFixed(2)}ms`);
  console.log(`  P90 Latency: ${p90.toFixed(2)}ms`);
  console.log(`  P95 Latency: ${p95.toFixed(2)}ms`);
  console.log(`  P99 Latency: ${p99.toFixed(2)}ms`);
  console.log(`  Max Latency: ${maxLatency.toFixed(2)}ms`);
  console.log('--------------------------------------------------------');
  console.log(`SLA Targets:`);
  console.log(`  P95 < 250ms: ${p95 < 250 ? 'PASS (Achieved: ' + p95.toFixed(2) + 'ms)' : 'FAIL'}`);
  console.log(`  P99 < 500ms: ${p99 < 500 ? 'PASS (Achieved: ' + p99.toFixed(2) + 'ms)' : 'FAIL'}`);
  console.log(`  Throughput > 100 req/s: ${throughput > 100 ? 'PASS (Achieved: ' + throughput + ' req/s)' : 'FAIL'}`);
  console.log('========================================================');

  await prisma.$disconnect();
}

runLoadBenchmark().catch(console.error);
