/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        border: 'var(--border)',
        text: 'var(--text)',
        'text-muted': 'var(--text-muted)',

        primary: 'var(--primary)',
        'primary-soft': 'var(--primary-soft)',
        'primary-text': 'var(--primary-text)',
        'primary-border': 'var(--primary-border)',
        'primary-hover': 'var(--primary-hover)',

        'mod-uretim': 'var(--mod-uretim)',
        'mod-uretim-soft': 'var(--mod-uretim-soft)',
        'mod-uretim-text': 'var(--mod-uretim-text)',
        'mod-uretim-border': 'var(--mod-uretim-border)',

        'mod-stok': 'var(--mod-stok)',
        'mod-stok-soft': 'var(--mod-stok-soft)',
        'mod-stok-text': 'var(--mod-stok-text)',
        'mod-stok-border': 'var(--mod-stok-border)',

        'mod-satis': 'var(--mod-satis)',
        'mod-satis-soft': 'var(--mod-satis-soft)',
        'mod-satis-text': 'var(--mod-satis-text)',
        'mod-satis-border': 'var(--mod-satis-border)',

        'mod-finans': 'var(--mod-finans)',
        'mod-finans-soft': 'var(--mod-finans-soft)',
        'mod-finans-text': 'var(--mod-finans-text)',
        'mod-finans-border': 'var(--mod-finans-border)',

        success: 'var(--success)',
        'success-soft': 'var(--success-soft)',
        'success-text': 'var(--success-text)',
        'success-border': 'var(--success-border)',

        warning: 'var(--warning)',
        'warning-soft': 'var(--warning-soft)',
        'warning-text': 'var(--warning-text)',
        'warning-border': 'var(--warning-border)',

        danger: 'var(--danger)',
        'danger-soft': 'var(--danger-soft)',
        'danger-text': 'var(--danger-text)',
        'danger-border': 'var(--danger-border)',
        'danger-hover': 'var(--danger-hover)',
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.06)',
      },
    },
  },
  plugins: [],
}
