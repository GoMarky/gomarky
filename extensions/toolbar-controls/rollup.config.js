const typescript = require('rollup-plugin-typescript');

export default {
  input: './main.ts',
  output: {
    file: 'build/main.js',
    format: 'cjs',
  },
  plugins: [typescript({ target: 'es5' })],
};
