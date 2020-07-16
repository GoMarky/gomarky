/*---------------------------------------------------------------------------------------------
 * Uniform Resource Identifier https://tools.ietf.org/html/rfc3986
 *--------------------------------------------------------------------------------------------*/

import { isLinux, isWindows } from '@/gm/base/platform';
import { CharCode } from '@/gm/base/common/charCode';
import { Schemas } from '@/gm/base/common/network';
import { equalsIgnoreCase } from '@/gm/base/common/string';
import * as extpath from '@/gm/base/common/extpath';
import * as path from 'path';

/**
 * The following are two example URIs and their component parts:
 *       foo://example.com:8042/over/there?name=ferret#nose
 *       \_/   \______________/\_________/ \_________/ \__/
 *        |           |            |            |        |
 *     scheme     authority       path        query   fragment
 *        |   _____________________|__
 *       / \ /                        \
 *       urn:example:animal:ferret:nose
 */

export interface UriComponents {
  scheme: string;
  authority: string;
  path: string;
  query: string;
  fragment: string;
}

export type ReservedURIGeneralDelimeters = ':' | '/' | '?' | '#' | '[' | ']' | '@';

export type ReservedURISubDelimeters =
  | '!'
  | '$'
  | '&'
  | "'"
  | '('
  | ')'
  | '*'
  | '+'
  | ','
  | ';'
  | '=';

const empty_string = '';
const slash = '/';
const _regexp = /^(([^:/?#]+?):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?/;

export class URI implements UriComponents {
  public readonly scheme: string;
  public readonly authority: string;
  public readonly path: string;
  public readonly query: string;
  public readonly fragment: string;

  protected constructor(
    scheme: string,
    authority?: string,
    path?: string,
    query?: string,
    fragment?: string,
    _strict?: boolean
  );
  protected constructor(components: UriComponents);
  protected constructor(
    schemeOrData: string | UriComponents,
    authority?: string,
    path?: string,
    query?: string,
    fragment?: string,
    _strict = false
  ) {
    if (typeof schemeOrData === 'object') {
      this.scheme = schemeOrData.scheme || empty_string;
      this.authority = schemeOrData.authority || empty_string;
      this.path = schemeOrData.path || empty_string;
      this.query = schemeOrData.query || empty_string;
      this.fragment = schemeOrData.fragment || empty_string;
    } else {
      this.scheme = schemeOrData;
      this.authority = authority || empty_string;
      this.path = _referenceResolution(this.scheme, path || empty_string);
      this.query = query || empty_string;
      this.fragment = fragment || empty_string;
    }
  }

  public static isURI(thing: any): thing is URI {
    if (!thing) {
      return false;
    }
    if (thing instanceof URI) {
      return true;
    }

    return false;
  }

  public get fsPath(): string {
    return _makeFsPath(this);
  }

  public static empty(): URI {
    return new URI('file');
  }

  public static file(path: string): URI {
    let authority = empty_string;
    let _path = path;

    if (isWindows) {
      _path = path.replace(/\\/g, slash);
    }

    if (path[0] === slash && path[1] === slash) {
      const idx = path.indexOf(slash, 2);
      if (idx === -1) {
        authority = path.substring(2);
        _path = slash;
      } else {
        authority = path.substring(2, idx);
        _path = path.substring(idx) || slash;
      }
    }

    return new URI('file', authority, _path, empty_string, empty_string);
  }

  public static parse(value: string, strict = false): URI {
    const match = _regexp.exec(value);

    if (!match) {
      return new URI(empty_string, empty_string, empty_string, empty_string, empty_string);
    }

    return new URI(
      match[2] || empty_string,
      decodeURIComponent(match[4] || empty_string),
      decodeURIComponent(match[5] || empty_string),
      decodeURIComponent(match[7] || empty_string),
      decodeURIComponent(match[9] || empty_string),
      strict
    );
  }

  public with(change: {
    scheme?: string;
    authority?: string | null;
    path?: string | null;
    query?: string | null;
    fragment?: string | null;
  }): URI {
    if (!change) {
      return this;
    }

    let { scheme, authority, path, query, fragment } = change;

    switch (scheme) {
      case undefined:
        scheme = this.scheme;
        break;
      case null:
        scheme = empty_string;
        break;
    }

    switch (authority) {
      case undefined:
        authority = this.authority;
        break;
      case null:
        authority = empty_string;
        break;
    }

    switch (path) {
      case undefined:
        path = this.path;
        break;
      case null:
        path = empty_string;
        break;
    }

    switch (query) {
      case undefined:
        query = this.query;
        break;
      case null:
        query = empty_string;
        break;
    }

    switch (fragment) {
      case undefined:
        fragment = this.fragment;
        break;
      case null:
        fragment = empty_string;
        break;
    }

    if (
      scheme === this.scheme &&
      authority === this.authority &&
      path === this.path &&
      query === this.query &&
      fragment === this.fragment
    ) {
      return this;
    }

    return new URI(scheme, authority, path, query, fragment);
  }

  public [Symbol.toPrimitive](hint: string): string | number | boolean {
    if (hint === 'string') {
      return this.path;
    }

    return true;
  }

  public toString(_skipEncoding = false): string {
    // TODO: incorrect working with PathIterator
    // return _asFormatted(this, skipEncoding);

    return Object.toString();
  }

  public toString2(skipEncoding = false): string {
    return _asFormatted(this, skipEncoding);
  }
}

const encodeTable: { [ch: number]: string } = {
  [CharCode.Colon]: '%3A', // gen-delims
  [CharCode.Slash]: '%2F',
  [CharCode.QuestionMark]: '%3F',
  [CharCode.Hash]: '%23',
  [CharCode.OpenSquareBracket]: '%5B',
  [CharCode.CloseSquareBracket]: '%5D',
  [CharCode.AtSign]: '%40',

  [CharCode.ExclamationMark]: '%21', // sub-delims
  [CharCode.DollarSign]: '%24',
  [CharCode.Ampersand]: '%26',
  [CharCode.SingleQuote]: '%27',
  [CharCode.OpenParen]: '%28',
  [CharCode.CloseParen]: '%29',
  [CharCode.Asterisk]: '%2A',
  [CharCode.Plus]: '%2B',
  [CharCode.Comma]: '%2C',
  [CharCode.Semicolon]: '%3B',
  [CharCode.Equals]: '%3D',

  [CharCode.Space]: '%20',
};

function encodeURIComponentFast(uriComponent: string, allowSlash: boolean): string {
  let res: string | undefined;
  let nativeEncodePos = -1;

  for (let pos = 0; pos < uriComponent.length; pos++) {
    const code = uriComponent.charCodeAt(pos);

    // unreserved characters: https://tools.ietf.org/html/rfc3986#section-2.3
    if (
      (code >= CharCode.a && code <= CharCode.z) ||
      (code >= CharCode.A && code <= CharCode.Z) ||
      (code >= CharCode.Digit0 && code <= CharCode.Digit9) ||
      code === CharCode.Dash ||
      code === CharCode.Period ||
      code === CharCode.Underline ||
      code === CharCode.Tilde ||
      (allowSlash && code === CharCode.Slash)
    ) {
      if (nativeEncodePos !== -1) {
        res += encodeURIComponent(uriComponent.substring(nativeEncodePos, pos));
        nativeEncodePos = -1;
      }

      if (res !== undefined) {
        res += uriComponent.charAt(pos);
      }
    } else {
      if (res === undefined) {
        res = uriComponent.substr(0, pos);
      }

      const escaped = encodeTable[code];
      if (escaped !== undefined) {
        if (nativeEncodePos !== -1) {
          res += encodeURIComponent(uriComponent.substring(nativeEncodePos, pos));
          nativeEncodePos = -1;
        }

        res += escaped;
      } else if (nativeEncodePos === -1) {
        nativeEncodePos = pos;
      }
    }
  }

  if (nativeEncodePos !== -1) {
    res += encodeURIComponent(uriComponent.substring(nativeEncodePos));
  }

  return res !== undefined ? res : uriComponent;
}

function encodeURIComponentMinimal(path: string): string {
  let res: string | undefined;

  for (let pos = 0; pos < path.length; pos++) {
    const code = path.charCodeAt(pos);
    // tslint:disable-next-line:prefer-switch
    if (code === CharCode.Hash || code === CharCode.QuestionMark) {
      if (res === undefined) {
        res = path.substr(0, pos);
      }
      res += encodeTable[code];
    } else {
      if (res !== undefined) {
        res += path[pos];
      }
    }
  }

  return res !== undefined ? res : path;
}

function _asFormatted(uri: URI, skipEncoding: boolean): string {
  const encoder = !skipEncoding ? encodeURIComponentFast : encodeURIComponentMinimal;

  let res = '';
  let { authority, path } = uri;
  const { scheme, query, fragment } = uri;

  if (scheme) {
    res += scheme;
    res += ':';
  }

  if (authority || scheme === 'file') {
    res += slash;
    res += slash;
  }

  if (authority) {
    let idx = authority.indexOf('@');
    if (idx !== -1) {
      // <user>@<auth>
      const userinfo = authority.substr(0, idx);
      authority = authority.substr(idx + 1);
      idx = userinfo.indexOf(':');
      if (idx === -1) {
        res += encoder(userinfo, false);
      } else {
        // <user>:<pass>@<auth>
        res += encoder(userinfo.substr(0, idx), false);
        res += ':';
        res += encoder(userinfo.substr(idx + 1), false);
      }
      res += '@';
    }
    authority = authority.toLowerCase();
    idx = authority.indexOf(':');
    if (idx === -1) {
      res += encoder(authority, false);
    } else {
      res += encoder(authority.substr(0, idx), false);
      res += authority.substr(idx);
    }
  }

  if (path) {
    if (
      path.length >= 3 &&
      path.charCodeAt(0) === CharCode.Slash &&
      path.charCodeAt(2) === CharCode.Colon
    ) {
      const code = path.charCodeAt(1);
      if (code >= CharCode.A && code <= CharCode.Z) {
        path = `/${String.fromCharCode(code + 32)}:${path.substr(3)}`;
      }
    } else if (path.length >= 2 && path.charCodeAt(1) === CharCode.Colon) {
      const code = path.charCodeAt(0);
      if (code >= CharCode.A && code <= CharCode.Z) {
        path = `${String.fromCharCode(code + 32)}:${path.substr(2)}`;
      }
    }
    res += encoder(path, true);
  }

  if (query) {
    res += '?';
    res += encoder(query, false);
  }

  if (fragment) {
    res += '#';
    res += !skipEncoding ? encodeURIComponentFast(fragment, false) : fragment;
  }

  return res;
}

function _referenceResolution(scheme: string, path: string): string {
  let _path = path;

  switch (scheme) {
    case 'https':
    case 'http':
    case 'file':
      if (!path) {
        _path = slash;
      } else if (path[0] !== slash) {
        _path = slash + path;
      }
      break;
  }

  return _path;
}

function _makeFsPath(uri: URI): string {
  let value: string;
  if (uri.authority && uri.path.length > 1 && uri.scheme === 'file') {
    // unc path: file://shares/c$/far/boo
    value = `//${uri.authority}${uri.path}`;
  } else if (
    uri.path.charCodeAt(0) === CharCode.Slash &&
    ((uri.path.charCodeAt(1) >= CharCode.A && uri.path.charCodeAt(1) <= CharCode.Z) ||
      (uri.path.charCodeAt(1) >= CharCode.a && uri.path.charCodeAt(1) <= CharCode.z)) &&
    uri.path.charCodeAt(2) === CharCode.Colon
  ) {
    // windows drive letter: file:///c:/far/boo
    value = uri.path[1].toLowerCase() + uri.path.substr(2);
  } else {
    // other path
    value = uri.path;
  }
  if (isWindows) {
    value = value.replace(/\//g, '\\');
  }

  return value;
}

export function encodeURIComponents(data: string): string {
  return encodeURIComponent(data);
}

export function decodeURIComponents(data: string): string {
  return decodeURIComponent(data);
}

export function isEqualAuthority(a1: string, a2: string) {
  return a1 === a2 || equalsIgnoreCase(a1, a2);
}

export function isEqual(
  first: URI | undefined,
  second: URI | undefined,
  ignoreCase = hasToIgnoreCase(first)
): boolean {
  if (first === second) {
    return true;
  }

  if (!first || !second) {
    return false;
  }

  if (first.scheme !== second.scheme || !isEqualAuthority(first.authority, second.authority)) {
    return false;
  }

  const p1 = first.path || '/';
  const p2 = second.path || '/';

  return p1 === p2 || (ignoreCase && equalsIgnoreCase(p1 || '/', p2 || '/'));
}

export function isEqualOrParent(
  base: URI,
  parentCandidate: URI,
  ignoreCase = hasToIgnoreCase(base)
): boolean {
  if (base.scheme === parentCandidate.scheme) {
    if (base.scheme === Schemas.file) {
      return extpath.isEqualOrParent(
        originalFSPath(base),
        originalFSPath(parentCandidate),
        ignoreCase
      );
    }

    if (isEqualAuthority(base.authority, parentCandidate.authority)) {
      return extpath.isEqualOrParent(base.path, parentCandidate.path, ignoreCase, '/');
    }
  }

  return false;
}

export function hasToIgnoreCase(resource: URI | undefined): boolean {
  return resource && resource.scheme === Schemas.file ? !isLinux : true;
}

export function joinPath(resource: URI, ...pathFragment: string[]): URI {
  let joinedPath: string;
  if (resource.scheme === Schemas.file) {
    joinedPath = URI.file(path.join(originalFSPath(resource), ...pathFragment)).path;
  } else {
    joinedPath = path.posix.join(resource.path || '/', ...pathFragment);
  }

  return resource.with({
    path: joinedPath,
  });
}

export function joinFile(resource: URI, pathFragment: string): URI {
  const joinedPath: string = URI.file(`${originalFSPath(resource)}.${pathFragment}`).path;

  return resource.with({
    path: joinedPath,
  });
}

/**
 * Returns true if the URI path is absolute.
 */
export function isAbsolutePath(resource: URI): boolean {
  return !!resource.path && resource.path[0] === '/';
}

export function dirname(resource: URI): URI {
  if (resource.path.length === 0) {
    return resource;
  }
  if (resource.scheme === Schemas.file) {
    return URI.file(path.dirname(originalFSPath(resource)));
  }
  let dirname = path.posix.dirname(resource.path);
  if (resource.authority && dirname.length && dirname.charCodeAt(0) !== CharCode.Slash) {
    console.error(`dirname("${resource.toString})) resulted in a relative path`);
    dirname = '/'; // If a URI contains an authority component, then the path component must either be empty or begin with a CharCode.Slash ("/") character
  }

  return resource.with({
    path: dirname,
  });
}

export function basename(resource: URI): string {
  return path.posix.basename(resource.path);
}

export function originalFSPath(uri: URI): string {
  let value: string;
  const uriPath = uri.path;
  if (uri.authority && uriPath.length > 1 && uri.scheme === Schemas.file) {
    // unc path: file://shares/c$/far/boo
    value = `//${uri.authority}${uriPath}`;
  } else if (
    isWindows &&
    uriPath.charCodeAt(0) === CharCode.Slash &&
    uriPath.charCodeAt(2) === CharCode.Colon
  ) {
    value = uriPath.substr(1);
  } else {
    // other path
    value = uriPath;
  }
  if (isWindows) {
    value = value.replace(/\//g, '\\');
  }

  return value;
}
