/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}'
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#050810',
          900: '#0a0e1a',
          800: '#111827',
          700: '#1a2035',
          600: '#243050'
        },
        teal: {
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488'
        }
      },
      fontFamily: {
        heading: ['"Cabinet Grotesk"', '"Plus Jakarta Sans"', 'sans-serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
