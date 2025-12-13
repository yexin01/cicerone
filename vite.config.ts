import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Use a safe cast for process.cwd() to avoid TypeScript issues in some environments
  const env = loadEnv(mode, (process as any).cwd(), '');

  // Helper to resolve env value from loaded .env or system process.env (Vercel)
  const getEnv = (key: string) => JSON.stringify(env[key] || process.env[key] || '');

  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
      sourcemap: true
    },
    define: {
      // Define global constants for environment variables to be injected during build
      'process.env.API_KEY': getEnv('API_KEY'),
      'process.env.SUPABASE_URL': getEnv('SUPABASE_URL'),
      'process.env.SUPABASE_ANON_KEY': getEnv('SUPABASE_ANON_KEY'),
      'process.env.NEXT_PUBLIC_SUPABASE_URL': getEnv('NEXT_PUBLIC_SUPABASE_URL'),
      'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    }
  };
});