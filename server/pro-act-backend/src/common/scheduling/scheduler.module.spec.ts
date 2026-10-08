import { Injectable } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PiLegacyJobLink } from '../../integration/pi/pi-legacy-job-link';
import { PIConnection } from '../../pi-connection/pi-connection.entity';
import { PISyncJob } from '../../pi-sync-job/pi-sync-job.entity';
import { PISyncSchedulerService } from '../../pi-sync-job/pi-sync-scheduler.service';
import { PISyncWatermark } from '../../pi-sync-watermark/pi-sync-watermark.entity';
import { getProcessRole, ProcessRole } from './process-role';
import { SchedulerModule } from './scheduler.module';
import { ShutdownCoordinator } from './shutdown-coordinator.service';

/** Fires every second when (and only when) ScheduleModule is active; proves decorator inertness. */
@Injectable()
class EverySecondProbe {
  ticks = 0;

  @Cron(CronExpression.EVERY_SECOND)
  tick(): void {
    this.ticks += 1;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('SchedulerModule (PROCESS_ROLE gating)', () => {
  let app: TestingModule;
  let findActiveJobs: jest.Mock;

  async function boot(role: ProcessRole): Promise<TestingModule> {
    findActiveJobs = jest.fn().mockResolvedValue([]);
    const moduleRef = await Test.createTestingModule({
      imports: [SchedulerModule.register(role)],
      providers: [
        EverySecondProbe,
        ShutdownCoordinator,
        // The real PI scheduler with its persistence and PI client stubbed out: no database needed
        PISyncSchedulerService,
        {
          provide: getRepositoryToken(PISyncJob),
          useValue: { find: findActiveJobs },
        },
        { provide: getRepositoryToken(PISyncWatermark), useValue: {} },
        { provide: getRepositoryToken(PIConnection), useValue: {} },
        { provide: PiLegacyJobLink, useValue: {} },
      ],
    }).compile();
    // init() runs onModuleInit (ScheduleExplorer) and onApplicationBootstrap (cron mount)
    return moduleRef.init();
  }

  afterEach(async () => {
    await app?.close();
  });

  describe('role api', () => {
    it('registers no scheduler and never invokes @Cron methods', async () => {
      app = await boot('api');

      expect(() => app.get(SchedulerRegistry)).toThrow();

      // EVERY_SECOND crosses at least one second boundary in this window
      await sleep(1200);
      expect(app.get(EverySecondProbe).ticks).toBe(0);
      expect(findActiveJobs).not.toHaveBeenCalled();
    });
  });

  describe.each<ProcessRole>(['worker', 'all'])('role %s', (role) => {
    it('registers the PI sync cron (every minute) and the probe', async () => {
      app = await boot(role);
      const registry = app.get(SchedulerRegistry);
      const jobs = [...registry.getCronJobs().values()];

      expect(jobs).toHaveLength(2);
      const piJob = jobs.find(
        (job) => job.cronTime.source === CronExpression.EVERY_MINUTE,
      );
      expect(piJob).toBeDefined();
      expect(piJob?.isActive).toBe(true);

      // Firing the registered job reaches PISyncSchedulerService.handleScheduledSyncs
      await piJob?.fireOnTick();
      await sleep(0);
      expect(findActiveJobs).toHaveBeenCalledWith({
        where: { isActive: true },
      });
    });
  });

  describe('register() without an argument', () => {
    const original = process.env.PROCESS_ROLE;

    afterEach(() => {
      if (original === undefined) delete process.env.PROCESS_ROLE;
      else process.env.PROCESS_ROLE = original;
    });

    it('reads PROCESS_ROLE from the environment', async () => {
      process.env.PROCESS_ROLE = 'api';
      app = await Test.createTestingModule({
        imports: [SchedulerModule.register()],
      })
        .compile()
        .then((moduleRef) => moduleRef.init());
      expect(() => app.get(SchedulerRegistry)).toThrow();
    });
  });
});

describe('getProcessRole', () => {
  it('defaults to "all" when PROCESS_ROLE is unset or blank', () => {
    expect(getProcessRole({})).toBe('all');
    expect(getProcessRole({ PROCESS_ROLE: '  ' })).toBe('all');
  });

  it('accepts api, worker and all case-insensitively', () => {
    expect(getProcessRole({ PROCESS_ROLE: 'api' })).toBe('api');
    expect(getProcessRole({ PROCESS_ROLE: ' Worker ' })).toBe('worker');
    expect(getProcessRole({ PROCESS_ROLE: 'ALL' })).toBe('all');
  });

  it('rejects unknown values instead of silently running a default', () => {
    expect(() => getProcessRole({ PROCESS_ROLE: 'scheduler' })).toThrow(
      /PROCESS_ROLE must be one of/,
    );
  });
});
