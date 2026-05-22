const config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        'ai-dark': {
          primary: '#818cf8',
          'primary-content': '#ffffff',
          secondary: '#22d3ee',
          'secondary-content': '#0a0a1a',
          accent: '#f59e0b',
          'accent-content': '#000000',
          neutral: '#1e1b4b',
          'neutral-content': '#e2e8f0',
          'base-100': '#0a0a1a',
          'base-200': '#0f0f24',
          'base-300': '#1a1a2e',
          'base-content': '#e2e8f0',
          info: '#38bdf8',
          success: '#4ade80',
          warning: '#f59e0b',
          error: '#f87171',
        },
      },
      {
        'ai-light': {
          primary: '#4f46e5',
          'primary-content': '#ffffff',
          secondary: '#0891b2',
          'secondary-content': '#ffffff',
          accent: '#d97706',
          'accent-content': '#ffffff',
          neutral: '#dddcf0',
          'neutral-content': '#1e1e3a',
          'base-100': '#f0efff',
          'base-200': '#e8e7f8',
          'base-300': '#dddcf0',
          'base-content': '#1e1e3a',
          info: '#0ea5e9',
          success: '#22c55e',
          warning: '#d97706',
          error: '#ef4444',
        },
      },
    ],
    darkTheme: 'ai-dark',
    base: true,
    styled: true,
    utils: true,
    logs: false,
  },
}

export default config
