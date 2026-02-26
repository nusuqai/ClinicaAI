/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0B1F3A',
        accent: '#00C2CB',
        background: '#F0F4F8',
        text: '#1C1C1E',
      },
      fontFamily: {
        sans: ['Tajawal', 'sans-serif'],
        heading: ['Cairo', 'sans-serif'],
        serif: ['Amiri', 'serif'],
      },
    },
  },
  plugins: [],
}
