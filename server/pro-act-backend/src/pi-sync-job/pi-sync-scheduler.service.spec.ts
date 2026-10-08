import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ShutdownCoordinator } from '../common/scheduling/shutdown-coordinator.service';
import { PiLegacyJobLink } from '../integration/pi/pi-legacy-job-link';
import { PIConnection } from '../pi-connection/pi-connection.entity';
import { PISyncWatermark } from '../pi-sync-watermark/pi-sync-watermark.entity';
import { PISyncJob } from './pi-sync-job.entity';
import { PISyncSchedulerService } from './pi-sync-scheduler.service';

function dueJob(id: string): PISyncJob {
  return {
    id,
    tenantId: 'tenant-1',
    isActive: true,
    jobType: 'pi-event-sync',
    lastRunTime: null,
    nextRunTime: null,
    jobConfig: null,
    schedule: null,
  } as unknown as PISyncJob;
}

describe('PISyncSchedulerService shutdown behaviour', () => {
  let service: PISyncSchedulerService;
  let shutdown: ShutdownCoordinator;
  const jobRepository = { find: jest.fn(), update: jest.fn() };
  const connectionRepository = { findOne: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        PISyncSchedulerService,
        ShutdownCoordinator,
        { provide: getRepositoryToken(PISyncJob), useValue: jobRepository },
        { provide: getRepositoryToken(PISyncWatermark), useValue: {} },
        {
          provide: getRepositoryToken(PIConnection),
          useValue: connectionRepository,
        },
        { provide: PiLegacyJobLink, useValue: {} },
      ],
    }).compile();
    service = moduleRef.get(PISyncSchedulerService);
    shutdown = moduleRef.get(ShutdownCoordinator);
  });

  it('does not look for due jobs once a shutdown has started', async () => {
    await shutdown.beforeApplicationShutdown('SIGTERM');

    await service.handleScheduledSyncs();

    expect(jobRepository.find).not.toHaveBeenCalled();
  });

  it('finishes the running job but starts no further job after a shutdown signal', async () => {
    jobRepository.find.mockResolvedValue([dueJob('job-1'), dueJob('job-2')]);
    const runJob = jest
      .spyOn(service, 'runJob')
      .mockImplementation(async () => {
        await shutdown.beforeApplicationShutdown('SIGTERM');
      });

    await service.handleScheduledSyncs();

    expect(runJob).toHaveBeenCalledTimes(1);
    expect(runJob).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'job-1' }),
    );
  });

  it('registers each run with the shutdown coordinator while it is in flight', async () => {
    let inFlightDuringRun = -1;
    // Sample on the next macrotask: the run is tracked as soon as its promise is returned
    // (first await inside executeJob), and stays tracked while this "query" is pending.
    connectionRepository.findOne.mockImplementation(
      () =>
        new Promise((resolve) =>
          setImmediate(() => {
            inFlightDuringRun = shutdown.inFlightCount;
            resolve(null); // "No active PI connection" -> handled error path, still a complete run
          }),
        ),
    );
    jobRepository.update.mockResolvedValue(undefined);

    await service.runJob(dueJob('job-1'));

    expect(inFlightDuringRun).toBe(1);
    expect(shutdown.inFlightCount).toBe(0);
    expect(jobRepository.update).toHaveBeenCalledWith(
      'job-1',
      expect.objectContaining({ status: 'error' }),
    );
  });
});
