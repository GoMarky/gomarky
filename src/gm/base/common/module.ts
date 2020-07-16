export function requireDynamically(path: string) {
  path = path.split('\\').join('/'); // Normalize windows slashes
  return eval(`require('${path}');`); // Ensure Webpack does not analyze the require statement
}
