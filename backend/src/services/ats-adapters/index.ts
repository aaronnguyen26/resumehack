import { AtsType } from '../../types/ats.js';
import { AtsAdapter } from './types.js';
import { GreenhouseAdapter } from './greenhouse-adapter.js';
import { LeverAdapter } from './lever-adapter.js';
import { AshbyAdapter } from './ashby-adapter.js';
import { SmartRecruitersAdapter } from './smartrecruiters-adapter.js';

export * from './types.js';
export * from './normalize-helpers.js';
export * from './greenhouse-adapter.js';
export * from './lever-adapter.js';
export * from './ashby-adapter.js';
export * from './smartrecruiters-adapter.js';

const adapters: Record<AtsType, AtsAdapter> = {
  greenhouse: new GreenhouseAdapter(),
  lever: new LeverAdapter(),
  ashby: new AshbyAdapter(),
  smartrecruiters: new SmartRecruitersAdapter(),
  custom: new GreenhouseAdapter(), // fallback for custom boards
};

export function getAtsAdapter(atsType: AtsType): AtsAdapter {
  const adapter = adapters[atsType];
  if (!adapter) {
    throw new Error(`Unsupported ATS type: ${atsType}`);
  }
  return adapter;
}
