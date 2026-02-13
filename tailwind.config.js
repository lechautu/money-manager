/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: '#136dec',
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
            borderRadius: {
                DEFAULT: '8px', // roundness: ROUND_EIGHT
            },
        },
    },
    plugins: [],
    darkMode: 'class',
}
