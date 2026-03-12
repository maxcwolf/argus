import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['cli/**/*.test.ts', 'src/**/*.test.ts'],
          exclude: ['src/hooks/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: ['src/hooks/**/*.test.ts'],
        },
      },
    ],
  },
})
