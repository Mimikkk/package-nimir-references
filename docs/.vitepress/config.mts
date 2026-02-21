import { defineConfig } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';

export default withMermaid(defineConfig({
  title: '@nimir/references',
  description: 'Type-safe nested reference resolver for TypeScript resource graphs',
  base: '/package-nimir-references/',
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/package-nimir-references/logo.svg' }]],
  vite: {
    optimizeDeps: {
      include: ['mermaid', 'dayjs'],
    },
  },
  themeConfig: {
    nav: [
      { text: 'Why', link: '/guide/why' },
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API', link: '/api/node' },
      {
        text: 'v1.0.0',
        items: [
          { text: 'npm', link: 'https://www.npmjs.com/package/@nimir/references' },
          { text: 'Changelog', link: 'https://github.com/Mimikkk/package-nimir-references/releases' },
        ],
      },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Why @nimir/references', link: '/guide/why' },
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'How Resolution Works', link: '/guide/resolution' },
          ],
        },
        {
          text: 'Configuration',
          items: [
            { text: 'Sources', link: '/guide/sources' },
            { text: 'Caching', link: '/guide/caching' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Node API', link: '/api/node' },
            { text: 'React API', link: '/api/react' },
          ],
        },
      ],
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/Mimikkk/package-nimir-references' }],
    search: { provider: 'local' },
    editLink: {
      pattern: 'https://github.com/Mimikkk/package-nimir-references/edit/main/docs/:path',
    },
  },
}));
