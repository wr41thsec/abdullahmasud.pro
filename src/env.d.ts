/// <reference types="astro/client" />

import type { ArcEngine } from './scripts/arc';

declare global {
  interface Window {
    /** The running arc engine, so the detail panel can hold the ring still. */
    __arc?: ArcEngine;
  }
}

export {};
