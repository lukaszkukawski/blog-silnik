import { defineConfig } from 'astro/config';
import blogSilnik from '../../../src/integration.mjs';
import config from './site.config.mjs';

export default defineConfig({ integrations: [blogSilnik(config)] });
