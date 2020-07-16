export type Class = { new (...args: any[]): any };

export type Writeable<T> = { -readonly [P in keyof T]: T[P] };
