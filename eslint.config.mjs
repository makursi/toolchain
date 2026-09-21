import antfu from '@antfu/eslint-config'

export default antfu(
  {
    type: 'lib',
    typescript: {
      tsconfigPath: 'tsconfig.json',
    },
    ignores: [
      'dist',
      'node_modules',
      '*.md',
    ],
  },
  {
    files: ['**/*.ts'],
    rules: {
      'no-console': 'warn',
    },
  },
)