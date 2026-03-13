/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        corp: {
          navy: '#0f2042',
          blue: '#0052cc',
          light: '#f4f5f7',
          gray: '#5e6c84',
          dark: '#172b4d',
          border: '#dfe1e6',
          hover: '#ebecf0'
        }
      },
    },
  },
  plugins: [],
}
