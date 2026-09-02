/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1b2430',      // dark navy background
        cloud: '#edeef1',    // light panel/text background
        slate: '#4a4e55',    // secondary text
        rust: '#c97c2e',     // primary accent orange
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'sans-serif'],
        nunito: ['Nunito', 'sans-serif'],
        serif: ['"Source Serif 4"', 'serif'],
      },
    },
  },
  plugins: [],
}
