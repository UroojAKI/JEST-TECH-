import { VehicleCategoryKey, VehicleCategoryConfig } from './types';
import { bikeConfig } from './bike.config';
import { privateCarConfig } from './private-car.config';
import { gcvConfig } from './gcv.config';
import { tractorConfig } from './tractor.config';
import { autoConfig } from './auto.config';
import { taxiConfig } from './taxi.config';
import { busConfig } from './bus.config';
import { miscConfig } from './misc.config';

export const ALL_CATEGORY_CONFIGS: Record<
  VehicleCategoryKey,
  VehicleCategoryConfig
> = {
  BIKE: bikeConfig,
  PRIVATE_CAR: privateCarConfig,
  GCV: gcvConfig,
  TRACTOR: tractorConfig,
  AUTO: autoConfig,
  TAXI: taxiConfig,
  BUS_COACH: busConfig,
  MISC_CLASS_D: miscConfig,
};

export function getCategoryConfig(
  category: VehicleCategoryKey,
): VehicleCategoryConfig {
  const config = ALL_CATEGORY_CONFIGS[category];
  if (!config) {
    return privateCarConfig;
  }
  return config;
}
