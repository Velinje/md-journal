import { defineConfig } from 'rolldown';

// The default compile task isn't strictly production, so we only minify if specified, 
// but we'll default to minify = true for the `package` script via the cross-platform check.
const isProduction = process.argv.includes('--minify');

export default defineConfig({
    input: 'src/extension.ts',
    output: {
        dir: 'dist',
        entryFileNames: 'extension.js',
        format: 'cjs',
        sourcemap: !isProduction,
    },
    resolve: {
        conditionNames: ['node', 'import', 'require'],
    },
    external: [
        'vscode',
        'fs',
        'path',
        'os',
        'crypto',
        'events'
    ],
    // Natively uses oxc-minify
    minify: isProduction,
});
