import * as PIXI from 'pixi.js';
import { Disposable } from '@/gm/base/common/lifecycle';
import { Application, IGLPlugin } from '@/core';

export class FPSPlugin extends Disposable implements IGLPlugin {
  private currentFPSInfo: PIXI.Text;
  private _ticker: PIXI.ticker.Ticker;
  private _container: PIXI.Container;

  constructor(private readonly stage: Application) {
    super();
  }

  public run(): void {
    const { ticker, stage } = this.stage.app;

    this._container = new PIXI.Container();
    this.currentFPSInfo = new PIXI.Text('', { fill: 0x000000, fontSize: 16, align: 'center' });
    this.currentFPSInfo.position.set(10, 10);

    this._ticker = ticker.add(() => {
      this.currentFPSInfo.text = `${ticker.FPS.toFixed()} FPS`;
    });

    this._container.addChild(this.currentFPSInfo);
    stage.addChild(this._container);
  }

  public stop(): void {
    this._ticker.destroy();
    this.stage.app.stage.removeChild(this._container);
  }

  public async dispose(): Promise<void> {
    this.stop();

    super.dispose();
  }
}
