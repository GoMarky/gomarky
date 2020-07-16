/*---------------------------------------------------------------------------------------------
 *  Color information
 *--------------------------------------------------------------------------------------------*/

export class ColorRGBA {
  /**
   * [EN] from 0 to 255
   */
  public readonly red: number;
  /**
   * [EN] from 0 to 255
   */
  public readonly green: number;
  /**
   * [EN] from 0 to 255
   */
  public readonly blue: number;
  /**
   * [EN] float from 0 to 1
   */
  public readonly alpha: number;

  constructor(red: number, green: number, blue: number, alpha = 1) {
    this.red = red;
    this.green = green;
    this.blue = blue;
    this.alpha = alpha;
  }

  public static equals(f: ColorRGBA, s: ColorRGBA): boolean {
    return f.red === s.red && f.blue === s.blue && f.green === s.green && f.alpha === s.alpha;
  }
}

export class ColorHSLA {
  /**
   * [EN] from 0 to 360
   */
  public readonly hue: number;
  /**
   * [EN] float from 0 to 1
   */
  public readonly saturation: number;
  /**
   * [EN] float from 0 to 1
   */
  public readonly luminosity: number;
  /**
   * [EN] float from 0 to 1
   */
  public readonly alpha: number;

  constructor(hue: number, saturation: number, luminosity: number, alpha: number) {
    this.hue = hue;
    this.saturation = saturation;
    this.luminosity = luminosity;
    this.alpha = alpha;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public static toRGBA(_color: ColorHSLA) {}

  public static fromRGBA(rgba: ColorRGBA): ColorHSLA {
    const r = rgba.red / 255;
    const g = rgba.green / 255;
    const b = rgba.blue / 255;
    const a = rgba.alpha;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (min + max) / 2;
    const chroma = max - min;

    if (chroma > 0) {
      s = Math.min(l <= 0.5 ? chroma / (2 * l) : chroma / (2 - 2 * l), 1);

      switch (max) {
        case r:
          h = (g - b) / chroma + (g < b ? 6 : 0);

          break;
        case g:
          h = (b - r) / chroma + 2;

          break;
        case b:
          h = (r - g) / chroma + 4;

          break;
      }

      h *= 60;
      h = Math.round(h);
    }

    return new ColorHSLA(h, s, l, a);
  }
}

export class ColorHSVA {
  /**
   * [EN] from 0 to 360
   */
  public readonly hue: number;
  /**
   * [EN] float from 0 to 1
   */
  public readonly saturation: number;
  /**
   * [EN] float from 0 to 1
   */
  public readonly value: number;
  /**
   * [EN] float from 0 to 1
   */
  public readonly alpha: number;

  constructor(hue: number, saturation: number, value: number, alpha: number) {
    this.hue = hue;
    this.saturation = saturation;
    this.value = value;
    this.alpha = alpha;
  }

  public static toRGBA(hsva: ColorHSVA) {
    const { hue, saturation, value, alpha } = hsva;

    const c = value * saturation;
    const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
    const m = value - c;

    let [red, green, blue] = [0, 0, 0];

    if (hue < 60) {
      red = c;
      green = x;
    } else if (hue < 120) {
      red = x;
      green = c;
    } else if (hue < 180) {
      green = c;
      blue = x;
    } else if (hue < 240) {
      green = x;
      blue = c;
    } else if (hue < 300) {
      red = x;
      blue = c;
    } else if (hue < 360) {
      red = c;
      blue = x;
    }

    red = Math.round((red + m) * 255);
    green = Math.round((green + m) * 255);
    blue = Math.round((blue + m) * 255);

    return new ColorRGBA(red, green, blue, alpha);
  }

  public static fromRGBA(rgba: ColorRGBA): ColorHSVA {
    const r = rgba.red / 255;
    const g = rgba.green / 255;
    const b = rgba.blue / 255;
    const cmax = Math.max(r, g, b);
    const cmin = Math.min(r, g, b);
    const delta = cmax - cmin;
    const s = cmax === 0 ? 0 : delta / cmax;
    let m: number;

    if (delta === 0) {
      m = 0;
      // tslint:disable-next-line:prefer-switch
    } else if (cmax === r) {
      m = ((((g - b) / delta) % 6) + 6) % 6;
    } else if (cmax === g) {
      m = (b - r) / delta + 2;
    } else {
      m = (r - g) / delta + 4;
    }

    return new ColorHSVA(Math.round(m * 60), s, cmax, rgba.alpha);
  }
}

export interface ISerializedRGBA {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

export class Color {
  readonly rgba: ColorRGBA;
  private readonly _hsla: ColorHSLA;
  private readonly _hsva: ColorHSVA;

  constructor(arg: ColorRGBA | ColorHSLA | ColorHSVA) {
    if (!arg) {
      throw new Error();
    } else if (arg instanceof ColorRGBA) {
      this.rgba = arg;
    } else if (arg instanceof ColorHSLA) {
      this._hsla = arg;
      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore
      this.rgba = ColorHSLA.toRGBA(arg);
    } else if (arg instanceof ColorHSVA) {
      this._hsva = arg;
      this.rgba = ColorHSVA.toRGBA(arg);
    }
  }

  public get digitHex(): number {
    let rgba: any = `rgba(${this.rgba.red}, ${this.rgba.green}, ${this.rgba.blue}, ${this.rgba.alpha})`;
    rgba = rgba.match(/^rgba?[\s+]?\([\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?/i);

    // tslint:disable-next-line:prefer-template
    return Number(
      rgba && rgba.length === 4
        ? '0x' +
            ('0' + parseInt(rgba[1], 10).toString(16)).slice(-2) +
            ('0' + parseInt(rgba[2], 10).toString(16)).slice(-2) +
            ('0' + parseInt(rgba[3], 10).toString(16)).slice(-2)
        : ''
    );
  }

  public get cssRGBA(): string {
    return `rgba(${this.rgba.red}, ${this.rgba.green}, ${this.rgba.blue}, ${this.rgba.alpha})`;
  }

  public get hsla(): ColorHSLA {
    if (this._hsla) {
      return this._hsla;
    }

    return ColorHSLA.fromRGBA(this.rgba);
  }

  public get hsva(): ColorHSVA {
    if (this._hsva) {
      return this._hsva;
    }

    return ColorHSVA.fromRGBA(this.rgba);
  }

  public static fromHEXDigit(hex: number | string, alpha = 1): ColorRGBA {
    if (typeof hex === 'number') {
      hex = hex.toString();
    }

    const [red, green, blue] = hex.match(/\w\w/g)!.map(x => parseInt(x, 16));

    return new ColorRGBA(red, green, blue, alpha);
  }

  public static RGBAtoDigitHEX(colorRGBA: ColorRGBA): number {
    let rgba: any = `rgba(${colorRGBA.red}, ${colorRGBA.green}, ${colorRGBA.blue}, ${colorRGBA.alpha})`;
    rgba = rgba.match(/^rgba?[\s+]?\([\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?,[\s+]?(\d+)[\s+]?/i);

    // tslint:disable-next-line:prefer-template
    return Number(
      rgba && rgba.length === 4
        ? '0x' +
            ('0' + parseInt(rgba[1], 10).toString(16)).slice(-2) +
            ('0' + parseInt(rgba[2], 10).toString(16)).slice(-2) +
            ('0' + parseInt(rgba[3], 10).toString(16)).slice(-2)
        : ''
    );
  }

  public static RGBAtoStringCSS(colorRGBA: ColorRGBA): string {
    return `rgba(${colorRGBA.red}, ${colorRGBA.green}, ${colorRGBA.blue}, ${colorRGBA.alpha})`;
  }

  public toJSON(): ISerializedRGBA {
    return {
      red: this.rgba.red,
      green: this.rgba.green,
      blue: this.rgba.blue,
      alpha: this.rgba.alpha,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public equals(_color: Color) {}
}
