import { Registry } from '@/gm/platform/registry/common/registry';
import {
  BrandedService,
  IInstantiationService,
  IServicesAccessor,
} from '@/gm/platform/instantiation/common/instantiation';
import { ILifecycleService, LifePhase } from '@/gm/platform/lifecycle/common/lifecycle';
import { IdleDeadline, runWhenIdle } from '@/gm/base/common/async';
import { ILogService } from '@/gm/platform/log/common/log';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IWorkbenchContribution {
  // Marker Interface
}

export namespace Extensions {
  export const Workbench = 'workbench.contributions.kind';
}

type IWorkbenchContributionSignature<Service extends BrandedService[]> = new (
  ...services: Service
) => IWorkbenchContribution;

export interface IWorkbenchContributionsRegistry {
  registerWorkbenchContribution<Services extends BrandedService[]>(
    contribution: IWorkbenchContributionSignature<Services>,
    phase: LifePhase
  ): void;

  start(accessor: IServicesAccessor): void;
}

class WorkbenchContributionsRegistry implements IWorkbenchContributionsRegistry {
  private instantiationService: IInstantiationService | undefined;
  private lifecycleService: ILifecycleService | undefined;

  private readonly toBeInstantiated: Map<LifePhase, any> = new Map<LifePhase, any[]>();

  public registerWorkbenchContribution<Services extends BrandedService[]>(
    ctor: { new (...services: Services): IWorkbenchContribution },
    phase: LifePhase = LifePhase.Starting
  ): void {
    // Instantiate directly if we are already matching the provided phase

    if (
      this.instantiationService &&
      this.lifecycleService &&
      this.lifecycleService.phase >= phase
    ) {
      this.instantiationService.createInstance(ctor);
    }

    // Otherwise keep contributions by lifecycle phase
    else {
      let toBeInstantiated = this.toBeInstantiated.get(phase);
      if (!toBeInstantiated) {
        toBeInstantiated = [];
        this.toBeInstantiated.set(phase, toBeInstantiated);
      }

      toBeInstantiated.push(ctor);
    }
  }

  public start(accessor: IServicesAccessor): void {
    const logService = accessor.get(ILogService);

    logService.info('WorkbenchContributionRegistry#start');

    const instantiationService = (this.instantiationService = accessor.get(IInstantiationService));
    const lifecycleService = (this.lifecycleService = accessor.get(ILifecycleService));

    [LifePhase.Starting, LifePhase.Ready, LifePhase.Eventually].forEach(phase => {
      this.instantiateByPhase(instantiationService, lifecycleService, phase);
    });
  }

  private instantiateByPhase(
    instantiationService: IInstantiationService,
    lifecycleService: ILifecycleService,
    phase: LifePhase
  ): void {
    // Instantiate contributions directly when phase is already reached

    if (lifecycleService.phase >= phase) {
      this.doInstantiateByPhase(instantiationService, phase);
    }

    // Otherwise wait for phase to be reached
    else {
      lifecycleService.when(phase).then(() => {
        return this.doInstantiateByPhase(instantiationService, phase);
      });
    }
  }

  private doInstantiateByPhase(
    instantiationService: IInstantiationService,
    phase: LifePhase
  ): void {
    const toBeInstantiated = this.toBeInstantiated.get(phase);

    if (toBeInstantiated) {
      this.toBeInstantiated.delete(phase);
      if (phase !== LifePhase.Eventually) {
        // instantiate everything synchronously and blocking
        for (const ctor of toBeInstantiated) {
          this.safeCreateInstance(instantiationService, ctor); // catch error so that other contributions are still considered
        }
      } else {
        // for the Eventually-phase we instantiate contributions
        // only when idle. this might take a few idle-busy-cycles
        // but will finish within the timeouts
        const forcedTimeout = 3000;
        let i = 0;
        const instantiateSome = (idle: IdleDeadline) => {
          while (i < toBeInstantiated.length) {
            const ctor = toBeInstantiated[i++];
            this.safeCreateInstance(instantiationService, ctor); // catch error so that other contributions are still considered
            if (idle.timeRemaining() < 1) {
              // time is up -> reschedule
              runWhenIdle(instantiateSome, forcedTimeout);
              break;
            }
          }
        };
        runWhenIdle(instantiateSome, forcedTimeout);
      }
    }
  }

  private safeCreateInstance(instantiationService: IInstantiationService, ctor: any): void {
    try {
      instantiationService.createInstance(ctor);
    } catch (error) {
      console.error(`Unable to instantiate workbench contribution ${(ctor as any).name}.`, error);
    }
  }
}

Registry.add(Extensions.Workbench, new WorkbenchContributionsRegistry());
