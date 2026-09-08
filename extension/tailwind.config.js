/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5', // Primary Iris Token from Stitch MCP
          700: '#4338CA',
          800: '#3730A3',
          900: '#312E81',
        },
        emerald: {
          500: '#10B981', // Secondary Success Token from Stitch MCP
          600: '#059669',
        },
        amber: {
          500: '#F59E0B', // Accent / Warning Token from Stitch MCP
          600: '#D97706',
        },
        slate: {
          950: '#0B0F19', // Stitch Dark Mode Base Canvas
          900: '#0F172A', // Neutral Dark / Surface Card
          850: '#172033', // Elevated Surface
          800: '#1E293B', // Subcard / Input / Pill
          700: '#334155', // Borders / Dividers
          600: '#475569',
          500: '#64748B',
          400: '#94A3B8', // Muted text in Dark Mode
          200: '#E2E8F0',
          100: '#F1F5F9',
          50: '#F8FAFC',
        }
      },
      fontFamily: {
        headline: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        'stitch': '8px',
      }
    },
  },
  plugins: [],
}
