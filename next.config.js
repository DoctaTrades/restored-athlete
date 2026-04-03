/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
}
module.exports = nextConfig
