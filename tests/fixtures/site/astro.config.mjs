import { defineConfig } from 'astro/config';
import blogSilnik from '../../../src/integration.mjs';
import config from './site.config.mjs';

export default defineConfig({ output: 'static', trailingSlash: 'always', build: { format: 'directory' }, integrations: [blogSilnik(config)] });
