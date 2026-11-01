/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: {
          950: '#07090f',
          900: '#0b0e16',
          850: '#0f131d',
          800: '#141926',
          750: '#1a2130',
          700: '#222b3d',
          600: '#2e3a50',
        },
        accent: {
          DEFAULT: '#5b8cff',
          soft: '#7aa2ff',
          deep: '#3f6fe0',
        },
        teal: '#3ddc97',
        amber: '#f5b64a',
        rose: '#f26d7d',
        violet: '#a78bfa',
      },
      fontFamily: {
        sans: ['Segoe UI', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Cascadia Code', 'Consolas', 'JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        panel: '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.35)',
        glow: '0 0 0 1px rgba(91,140,255,0.35), 0 0 24px rgba(91,140,255,0.18)',
      },
      keyframes: {
        pulseSoft: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.45' } },
        slideIn: { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: {
        'pulse-soft': 'pulseSoft 1.6s ease-in-out infinite',
        'slide-in': 'slideIn 160ms ease-out',
      },
    },
  },
  plugins: [],
};
