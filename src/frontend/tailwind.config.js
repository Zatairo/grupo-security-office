/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Grupo Security — Paleta oficial de marca (#CE0203 / #484748)
        security: {
          50: '#FFF5F5',
          100: '#FFE0E0',
          200: '#FFB8B8',
          300: '#FF8A8A',
          400: '#FF5252',
          500: '#CE0203',  // PRIMARY — rojo institucional
          600: '#AD0102',
          700: '#8B0102',
          800: '#6A0101',
          900: '#480101',
          950: '#240000',
        },

        neutral: {
          50: '#FFFFFF',
          100: '#F5F5F5',
          200: '#E5E5E5',
          300: '#D4D4D4',
          400: '#A0A0A0',
          500: '#737373',
          600: '#5C5B5C',
          700: '#525152',
          800: '#484748',  // PRIMARY — gris oscuro institucional
          900: '#3A393A',
        },
        brand: {
          primary: '#CE0203',
          'primary-hover': '#AD0102',
          'primary-light': '#FFF5F5',
          'primary-subtle': '#FFE0E0',
          success: '#059669',
          'success-light': '#ECFDF5',
          warning: '#D97706',
          'warning-light': '#FFFBEB',
          error: '#DC2626',
          'error-light': '#FEF2F2',
        },
      },
      fontFamily: {
        sans: ['Roboto', 'system-ui', '-apple-system', 'sans-serif'],
        condensed: ['Roboto Condensed', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        'h1': ['2rem', { lineHeight: '1.2', fontWeight: '700' }],
        'h2': ['1.5rem', { lineHeight: '1.3', fontWeight: '600' }],
        'h3': ['1.25rem', { lineHeight: '1.4', fontWeight: '600' }],
      },
    },
  },
  plugins: [],
}