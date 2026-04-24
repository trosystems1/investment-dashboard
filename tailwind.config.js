/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        gold: { DEFAULT: '#C49C48', light: '#E8C96E', dark: '#8B6E2A' },
        dark: { 900: '#0D0F14', 800: '#13161E', 700: '#1A1E2A', 600: '#232736', 500: '#2E3347' },
      },
    },
  },
  plugins: [],
}
