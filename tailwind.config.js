/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      keyframes: {
        pop: {
          '0%': { transform: 'scale(0.85)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        highlight: {
          '0%': { backgroundColor: 'rgb(253 224 71)' },
          '100%': { backgroundColor: 'transparent' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-4px)' },
          '75%': { transform: 'translateX(4px)' },
        },
      },
      animation: {
        pop: 'pop 150ms ease-out',
        highlight: 'highlight 1.2s ease-out',
        shake: 'shake 200ms ease-in-out',
      },
    },
  },
  plugins: [],
};
