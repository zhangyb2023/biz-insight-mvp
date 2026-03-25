import { gasgooFlashStrategy } from "./gasgooFlashStrategy";
import { autosarNewsStrategy } from "./autosarNewsStrategy";
import { thundersoftNewsStrategy } from "./thundersoftNewsStrategy";
import { huaweiAutoNewsStrategy } from "./huaweiAutoNewsStrategy";
import { hirainNewsStrategy } from "./hirainNewsStrategy";
import { reachautoNewsStrategy } from "./reachautoNewsStrategy";
import { etasNewsStrategy } from "./etasNewsStrategy";
import { vectorNewsStrategy } from "./vectorNewsStrategy";
import { semidriveNewsStrategy } from "./semidriveNewsStrategy";
import { elektrobitNewsStrategy } from "./elektrobitNewsStrategy";
import { blackSesameNewsStrategy } from "./blackSesameNewsStrategy";
import { tttechAutoNewsStrategy } from "./tttechAutoNewsStrategy";
import { createStrategyRegistry, type StrategyRegistry } from "./types";

export const strategyRegistry: StrategyRegistry = createStrategyRegistry([
  gasgooFlashStrategy,
  autosarNewsStrategy,
  thundersoftNewsStrategy,
  huaweiAutoNewsStrategy,
  hirainNewsStrategy,
  reachautoNewsStrategy,
  etasNewsStrategy,
  vectorNewsStrategy,
  semidriveNewsStrategy,
  elektrobitNewsStrategy,
  blackSesameNewsStrategy,
  tttechAutoNewsStrategy
]);

export function findStrategyForUrl(url: string) {
  return strategyRegistry.findStrategy(url);
}

export function getAllStrategies() {
  return strategyRegistry.strategies;
}

export { gasgooFlashStrategy } from "./gasgooFlashStrategy";
export { autosarNewsStrategy } from "./autosarNewsStrategy";
export { thundersoftNewsStrategy } from "./thundersoftNewsStrategy";
export { huaweiAutoNewsStrategy } from "./huaweiAutoNewsStrategy";
export { hirainNewsStrategy } from "./hirainNewsStrategy";
export { reachautoNewsStrategy } from "./reachautoNewsStrategy";
export { etasNewsStrategy } from "./etasNewsStrategy";
export { vectorNewsStrategy } from "./vectorNewsStrategy";
export { semidriveNewsStrategy } from "./semidriveNewsStrategy";
export { elektrobitNewsStrategy } from "./elektrobitNewsStrategy";
export { blackSesameNewsStrategy } from "./blackSesameNewsStrategy";
export { tttechAutoNewsStrategy } from "./tttechAutoNewsStrategy";
export type { CrawlStrategy, CrawlStrategyOptions, CrawlStrategyResult, ExtractedItem } from "./types";
