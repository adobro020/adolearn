import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Static frontend served from the root path.
export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss()]
});
