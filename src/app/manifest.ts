import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Chronos: Focus & Screen Time Economy',
    short_name: 'Chronos',
    description:
      'Earn recreation credits through deep work and unlock distracted domains intentionally.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0B0B0C',
    theme_color: '#0B0B0C',
  };
}
