import * as iconv from 'iconv-lite';
import { Readable, Writable } from 'stream';

export const UTF8 = 'utf8';
export const UTF8_with_bom = 'utf8bom';
export const UTF16be = 'utf16be';
export const UTF16le = 'utf16le';

export type UTF_ENCODING = typeof UTF8 | typeof UTF8_with_bom | typeof UTF16be | typeof UTF16le;

export function isUTFEncoding(encoding: string): encoding is UTF_ENCODING {
  return [UTF8, UTF8_with_bom, UTF16be, UTF16le].some(utfEncoding => utfEncoding === encoding);
}

export const UTF16be_BOM = [0xfe, 0xff];
export const UTF16le_BOM = [0xff, 0xfe];
export const UTF8_BOM = [0xef, 0xbb, 0xbf];

const ZERO_BYTE_DETECTION_BUFFER_MAX_LEN = 512;
const NO_ENCODING_GUESS_MIN_BYTES = 512;
const AUTO_ENCODING_GUESS_MIN_BYTES = 512 * 8;
const AUTO_ENCODING_GUESS_MAX_BYTES = 512 * 128;

export interface IDecodeStreamOptions {
  guessEncoding: boolean;
  minBytesRequiredForDetection?: number;

  overwriteEncoding(detectedEncoding: string | null): string;
}

export interface IDecodeStreamResult {
  stream: NodeJS.ReadableStream;
  detected: IDetectedEncodingResult;
}

export function toDecodeStream(
  readable: Readable,
  options: IDecodeStreamOptions
): Promise<IDecodeStreamResult> {
  if (!options.minBytesRequiredForDetection) {
    options.minBytesRequiredForDetection = options.guessEncoding
      ? AUTO_ENCODING_GUESS_MIN_BYTES
      : NO_ENCODING_GUESS_MIN_BYTES;
  }

  return new Promise<IDecodeStreamResult>((resolve, reject) => {
    const writer = new (class extends Writable {
      private decodeStream: NodeJS.ReadWriteStream | undefined;
      private decodeStreamPromise: Promise<void> | undefined;

      private bufferedChunks: Buffer[] = [];
      private bytesBuffered = 0;

      _write(
        chunk: Buffer,
        _encoding: string,
        callback: (error: Error | null | undefined) => void
      ): void {
        if (!Buffer.isBuffer(chunk)) {
          return callback(new Error('toDecodeStream(): data must be a buffer'));
        }

        if (this.decodeStream) {
          this.decodeStream.write(chunk, callback);

          return;
        }

        this.bufferedChunks.push(chunk);
        this.bytesBuffered += chunk.byteLength;

        if (this.decodeStreamPromise) {
          this.decodeStreamPromise.then(
            () => callback(null),
            error => callback(error)
          );
        } else if (
          typeof options.minBytesRequiredForDetection === 'number' &&
          this.bytesBuffered >= options.minBytesRequiredForDetection
        ) {
          this._startDecodeStream(callback);
        } else {
          callback(null);
        }
      }

      _startDecodeStream(callback: (error: Error | null | undefined) => void): void {
        this.decodeStreamPromise = Promise.resolve(
          detectEncodingFromBuffer(
            {
              buffer: Buffer.concat(this.bufferedChunks),
              bytesRead: this.bytesBuffered,
            },
            options.guessEncoding
          )
        ).then(
          detected => {
            detected.encoding = options.overwriteEncoding(detected.encoding);

            this.decodeStream = decodeStream(detected.encoding);
            this.decodeStream.write(Buffer.concat(this.bufferedChunks), callback);
            this.bufferedChunks.length = 0;

            resolve({ detected, stream: this.decodeStream });
          },
          error => {
            this.emit('error', error);

            callback(error);
          }
        );
      }

      _final(callback: () => void) {
        if (this.decodeStream) {
          this.decodeStream.end(callback);
        } else {
          this._startDecodeStream(() => {
            if (this.decodeStream) {
              this.decodeStream.end(callback);
            }
          });
        }
      }
    })();

    readable.on('error', reject);

    readable.pipe(writer);
  });
}

export function decode(buffer: Buffer, encoding: string): string {
  return iconv.decode(buffer, toNodeEncoding(encoding));
}

export function encode(
  content: string | Buffer,
  encoding: string,
  options?: { addBOM?: boolean }
): Buffer {
  return iconv.encode(
    content as string /* TODO report into upstream typings */,
    toNodeEncoding(encoding),
    options
  );
}

export function encodingExists(encoding: string): boolean {
  return iconv.encodingExists(toNodeEncoding(encoding));
}

function decodeStream(encoding: string | null): NodeJS.ReadWriteStream {
  return iconv.decodeStream(toNodeEncoding(encoding));
}

export function encodeStream(
  encoding: string,
  options?: { addBOM?: boolean }
): NodeJS.ReadWriteStream {
  return iconv.encodeStream(toNodeEncoding(encoding), options);
}

function toNodeEncoding(enc: string | null): string {
  // tslint:disable-next-line:prefer-switch
  if (enc === UTF8_with_bom || enc === null) {
    return UTF8;
  }

  return enc;
}

export function detectEncodingByBOMFromBuffer(
  buffer: Buffer | null,
  bytesRead: number
): typeof UTF8_with_bom | typeof UTF16le | typeof UTF16be | null {
  if (!buffer || bytesRead < UTF16be_BOM.length) {
    return null;
  }

  const b0 = buffer.readUInt8(0);
  const b1 = buffer.readUInt8(1);

  if (b0 === UTF16be_BOM[0] && b1 === UTF16be_BOM[1]) {
    return UTF16be;
  }

  if (b0 === UTF16le_BOM[0] && b1 === UTF16le_BOM[1]) {
    return UTF16le;
  }

  if (bytesRead < UTF8_BOM.length) {
    return null;
  }

  const b2 = buffer.readUInt8(2);

  if (b0 === UTF8_BOM[0] && b1 === UTF8_BOM[1] && b2 === UTF8_BOM[2]) {
    return UTF8_with_bom;
  }

  return null;
}

const IGNORE_ENCODINGS = ['ascii', 'utf-16', 'utf-32'];

async function guessEncodingByBuffer(buffer: Buffer): Promise<string | null> {
  const jschardet = require('jschardet');

  const guessed = jschardet.detect(buffer.slice(0, AUTO_ENCODING_GUESS_MAX_BYTES));
  if (!guessed || !guessed.encoding) {
    return null;
  }

  const enc = guessed.encoding.toLowerCase();
  if (0 <= IGNORE_ENCODINGS.indexOf(enc)) {
    return null;
  }

  return toIconvLiteEncoding(guessed.encoding);
}

const JSCHARDET_TO_ICONV_ENCODINGS: { [name: string]: string } = {
  ibm866: 'cp866',
  big5: 'cp950',
};

function toIconvLiteEncoding(encodingName: string): string {
  const normalizedEncodingName = encodingName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const mapped = JSCHARDET_TO_ICONV_ENCODINGS[normalizedEncodingName];

  return mapped || normalizedEncodingName;
}

export function toCanonicalName(enc: string): string {
  switch (enc) {
    case 'shiftjis':
      return 'shift-jis';
    case 'utf16le':
      return 'utf-16le';
    case 'utf16be':
      return 'utf-16be';
    case 'big5hkscs':
      return 'big5-hkscs';
    case 'eucjp':
      return 'euc-jp';
    case 'euckr':
      return 'euc-kr';
    case 'koi8r':
      return 'koi8-r';
    case 'koi8u':
      return 'koi8-u';
    case 'macroman':
      return 'x-mac-roman';
    case 'utf8bom':
      return 'utf8';
    default:
      // eslint-disable-next-line no-case-declarations
      const m = enc.match(/windows(\d+)/);
      if (m) {
        return `windows-${m[1]}`;
      }

      return enc;
  }
}

export interface IDetectedEncodingResult {
  encoding: string | null;
  seemsBinary: boolean;
}

export interface IReadResult {
  buffer: Buffer | null;
  bytesRead: number;
}

export function detectEncodingFromBuffer(
  readResult: IReadResult,
  autoGuessEncoding?: false
): IDetectedEncodingResult;
export function detectEncodingFromBuffer(
  readResult: IReadResult,
  autoGuessEncoding?: boolean
): Promise<IDetectedEncodingResult>;
export function detectEncodingFromBuffer(
  { buffer, bytesRead }: IReadResult,
  autoGuessEncoding?: boolean
): Promise<IDetectedEncodingResult> | IDetectedEncodingResult {
  let encoding = detectEncodingByBOMFromBuffer(buffer, bytesRead);
  let seemsBinary = false;
  if (encoding !== UTF16be && encoding !== UTF16le && buffer) {
    let couldBeUTF16LE = true;
    let couldBeUTF16BE = true;
    let containsZeroByte = false;
    for (let i = 0; i < bytesRead && i < ZERO_BYTE_DETECTION_BUFFER_MAX_LEN; i++) {
      const isEndian = i % 2 === 1;
      const isZeroByte = buffer.readInt8(i) === 0;

      if (isZeroByte) {
        containsZeroByte = true;
      }

      if (couldBeUTF16LE && ((isEndian && !isZeroByte) || (!isEndian && isZeroByte))) {
        couldBeUTF16LE = false;
      }

      if (couldBeUTF16BE && ((isEndian && isZeroByte) || (!isEndian && !isZeroByte))) {
        couldBeUTF16BE = false;
      }

      if (isZeroByte && !couldBeUTF16LE && !couldBeUTF16BE) {
        break;
      }
    }

    if (containsZeroByte) {
      if (couldBeUTF16LE) {
        encoding = UTF16le;
      } else if (couldBeUTF16BE) {
        encoding = UTF16be;
      } else {
        seemsBinary = true;
      }
    }
  }

  if (autoGuessEncoding && !seemsBinary && !encoding && buffer) {
    return guessEncodingByBuffer(buffer.slice(0, bytesRead)).then(guessedEncoding => {
      return {
        seemsBinary: false,
        encoding: guessedEncoding,
      };
    });
  }

  return { seemsBinary, encoding };
}
