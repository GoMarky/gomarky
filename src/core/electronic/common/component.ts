import { Disposable } from '@/gm/base/common/lifecycle';

export abstract class ElectronicComponent extends Disposable {
  public abstract maxVoltage: number;
}
