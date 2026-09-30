// Bundles the React UI into dist/app.js + dist/app.css (plain script, works from file:// inside PyWebView).
import { build, context } from 'esbuild'
import { copyFileSync } from 'node:fs'

const opts = {
  entryPoints: ['src/main.jsx'],
  bundle: true, minify: true, format: 'iife', target: 'es2020',
  outfile: 'dist/app.js',
  loader: { '.png': 'dataurl' },
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  nodePaths: process.env.NODE_PATH ? [process.env.NODE_PATH] : [],
  logLevel: 'info',
}
copyFileSync('index.html', 'dist/index.html')
if (process.argv.includes('--watch')) {
  const ctx = await context(opts); await ctx.watch(); console.log('watching…')
} else { await build(opts) }
