/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        agri: {
          900: '#1e3d1a',
          800: '#2d5a27', // vert forêt — couleur de marque principale
          600: '#458b3a',
          400: '#72b01d',
          50:  '#f4f8f4',
        },
        gold: {
          500: '#f2b33d', // accent doré — focus, highlights
        },
      },
      keyframes: {
        'pulse-green': {
          '0%':   { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(45,90,39,0.7)' },
          '70%':  { transform: 'scale(1)',    boxShadow: '0 0 0 15px rgba(45,90,39,0)' },
          '100%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(45,90,39,0)' },
        },
      },
      animation: {
        'pulse-green': 'pulse-green 2s infinite',
      },
    },
  },
  plugins: [],
}