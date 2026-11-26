import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';

let registered = false;

export function ensureChronosEases() {
  if (registered || typeof window === 'undefined') return;
  gsap.registerPlugin(CustomEase);
  try {
    CustomEase.create('chronosSilk', 'M0,0 C0.16,1 0.3,1 1,1');
  } catch {
    // already exists
  }
  try {
    CustomEase.create('chronosSnap', '0.85, 0, 0.15, 1');
  } catch {
    // already exists
  }
  registered = true;
}
