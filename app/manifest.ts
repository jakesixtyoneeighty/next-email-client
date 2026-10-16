import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'sixtyoneeighty Mail',
    short_name: '6180 Mail',
    description: 'Your conversations, in one place.',
    start_url: '/f/inbox',
    display: 'standalone',
    background_color: '#111113',
    theme_color: '#0b0b0d',
    icons: [
      {
        src: '/brand/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
