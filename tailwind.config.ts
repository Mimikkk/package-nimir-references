import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/samples/**/*.{html,ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [daisyui],
};

export default config;
