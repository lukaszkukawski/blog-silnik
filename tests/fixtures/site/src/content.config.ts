import { definePosts } from '../../../../src/content.ts';
import config from '../site.config.mjs';

export const collections = definePosts(config, import.meta.url);
