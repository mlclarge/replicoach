/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fdf2f4',
          100: '#fce7ea',
          200: '#f9d2d9',
          300: '#f4adb9',
          400: '#ec7d93',
          500: '#e04e6e',
          600: '#c41e3a',
          700: '#8b1538',
          800: '#761632',
          900: '#661730',
          950: '#3a0817',
        },
        gold: {
          50: '#fdfaeb',
          100: '#faf2c7',
          200: '#f5e48a',
          300: '#f0d24e',
          400: '#e9be24',
          500: '#d4af37',
          600: '#b7860f',
          700: '#926210',
          800: '#794e14',
          900: '#674017',
        },
        dark: '#1A1A2E',
        darker: '#0F0F1A',
      },
      fontFamily: {
        display: ['Playfair Display', 'serif'],
        sans: ['Source Sans 3', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
