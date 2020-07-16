import { Registry } from '@/gm/platform/registry/common/registry';
import {
  Extensions as WorkbenchExtensions,
  IWorkbenchContributionsRegistry,
} from '@/gm/workbench/common/contributions';
import { SceneAutoSave } from '@/gm/workbench/parts/scene/sceneAutoSave';
import { LifePhase } from '@/gm/platform/lifecycle/common/lifecycle';

Registry.as<IWorkbenchContributionsRegistry>(
  WorkbenchExtensions.Workbench
).registerWorkbenchContribution<any>(SceneAutoSave, LifePhase.Ready);
