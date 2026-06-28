/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0F1B2D',
          900: '#0F1B2D',
          800: '#162236',
        },
        teal: {
          DEFAULT: '#00C2A8',
          400: '#00C2A8',
          500: '#00C2A8',
        },
        success: '#22C55E',
        warning: '#F59E0B',
        error: '#EF4444',
        'text-secondary': '#8FA3B1',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
