/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#FAFAFA',
          100: '#F4F4F5',
          200: '#E4E4E7',
          300: '#D4D4D8',
          400: '#A1A1AA',
          500: '#71717A',
          600: '#52525B',
          700: '#3F3F46',
          800: '#27272A',
          900: '#18181B',
          950: '#09090B',
        },
        surface: '#09090B',
        'surface-dim': '#09090B',
        'surface-bright': '#27272A',
        'surface-container-lowest': '#000000',
        'surface-container-low': '#121215',
        'surface-container': '#18181B',
        'surface-container-high': '#27272A',
        'surface-container-highest': '#3F3F46',
        'on-surface': '#F4F4F5',
        'on-surface-variant': '#A1A1AA',
        outline: '#27272A',
        'outline-variant': '#3F3F46',
        primary: '#FAFAFA',
        'on-primary': '#09090B',
        secondary: '#10B981',
        'on-secondary': '#000000',
        tertiary: '#F59E0B',
        'on-tertiary': '#000000',
        error: '#F43F5E',
        'on-error': '#FFFFFF',
        slate: {
          950: '#09090B',
          900: '#121215',
          850: '#18181B',
          800: '#27272A',
          750: '#323238',
          700: '#3F3F46',
          400: '#A1A1AA',
        }
      },
      fontFamily: {
        headline: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        'stitch': '8px',
      }
    },
  },
  plugins: [],
};
