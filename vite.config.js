import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',        // 정적 호스팅 어디에 올려도 동작하도록 상대 경로
  server: { open: true },
});
