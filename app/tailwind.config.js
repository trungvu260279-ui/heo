/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                primary: '#1A2B3C',
                accent: '#0D9488',
                'accent-hover': '#0B7A6E',
                'bg-light': '#F8FAFC',
                'bg-dark': '#0f172a',
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                serif: ['Lora', 'Georgia', 'serif'],
                handwriting: ['"Dancing Script"', 'cursive'],
            },
            borderRadius: {
                DEFAULT: '0.25rem',
                lg: '0.5rem',
                xl: '0.75rem',
                '2xl': '1rem',
                full: '9999px',
            },
        },
    },
    plugins: [],
}
