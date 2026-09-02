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
        gold: {
          DEFAULT: '#c4a35a',
          bright: '#e8d5a3',
          deep: '#8d6e32',
        },
        cyan: {
          DEFAULT: '#6ec9d0',
          bright: '#9ee7ec',
        },
        studio: {
          bg: '#07080b',
          elev: '#0c0e14',
          card: '#0a0c11',
          text: '#efeae0',
        },
        primary: {
          50: '#f7f1e4',
          100: '#ead9b3',
          200: '#e8d5a3',
          300: '#c4a35a',
          400: '#c4a35a',
          500: '#c4a35a',
          600: '#8d6e32',
          700: '#8d6e32',
          800: '#3d3016',
          900: '#07080b',
        }
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Outfit', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
