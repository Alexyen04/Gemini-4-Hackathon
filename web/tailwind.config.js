/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { paper: '#F8F6F0', ink: '#0A0A0A', court: '#FF5A1F', clutch: '#E11D48' },
      fontFamily: {
        display: ['Anton', 'Impact', 'sans-serif'],
        sfx: ['Bangers', 'Impact', 'cursive'],
        ui: ['Space Grotesk', 'system-ui', 'sans-serif'],
        quote: ['Comic Neue', 'cursive'],
      },
    },
  },
  plugins: [],
}
