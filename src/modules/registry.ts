import type { ModuleManifest } from '@/core/module-system/types';
import { dealershipManifest } from './dealership/manifest';

/**
 * Business type → module. Lives outside core (core never imports modules); the app layer reads it.
 * A new dealership business needs no change here; a new business *type* adds one line.
 */
const manifests: Record<string, ModuleManifest> = {
  [dealershipManifest.type]: dealershipManifest,
};

export function getModuleManifest(type: string): ModuleManifest | undefined {
  return manifests[type];
}
