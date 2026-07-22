/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        syscom: {
          50: '#e8f0f7',
          100: '#c5d9eb',
          200: '#9ebfdf',
          300: '#76a5d2',
          400: '#5892c9',
          500: '#3a7fc0',
          600: '#264d73',
          700: '#023c79',
          800: '#022d5a',
          900: '#011e3c',
          950: '#000f1e',
        },
        accent: {
          50: '#fff0f3',
          100: '#ffd6e0',
          200: '#ffadc1',
          300: '#ff85a2',
          400: '#ff5c83',
          500: '#e74c3c',
          600: '#c0392b',
          700: '#a93226',
          800: '#922b21',
          900: '#7b241c',
        },
      },
      fontFamily: {
        sans: ['Rubik', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
