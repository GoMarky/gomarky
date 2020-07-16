export function mark(text: string): void {
  const message = `perf:mark ${text} - ${Date.now()}`;

  console.log(message);
}
