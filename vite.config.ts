import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');

	return {
		test: {
			include: ['src/**/*.test.ts']
		},
		server: {
			allowedHosts: [
				'songshare',
				...(env.ALLOWED_HOSTS ?? '')
					.split(',')
					.map((host) => host.trim())
					.filter(Boolean)
			]
		},
		plugins: [
			tailwindcss(),
			sveltekit({
				compilerOptions: {
					runes: ({ filename }) =>
						filename.split(/[/\\]/).includes('node_modules') ? undefined : true
				},

				adapter: adapter(),

				typescript: {
					config: (config) => {
						config.include.push('../drizzle.config.ts');
					}
				}
			}),

			paraglideVitePlugin({
				project: './project.inlang',
				outdir: './src/lib/paraglide',
				emitTsDeclarations: true
			})
		]
	};
});
