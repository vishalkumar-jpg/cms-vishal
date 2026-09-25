/**
 * Compile-time checks that public family accessors preserve literal types.
 * Included by package `tsc --noEmit` (not under `__tests__` exclusion).
 */
import { getComponentFamily } from "./component-families";

type Expect<T extends true> = T;
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

type HeroVariant0 = ReturnType<
  typeof getComponentFamily<"hero">
>["config"]["variants"][0];

type _AssertHeroVariant0IsHomepage = Expect<Equal<HeroVariant0, "homepage">>;

// Fails `tsc` if inference widens to `string`.
const _heroVariant0: "homepage" =
  getComponentFamily("hero").config.variants[0];

void _heroVariant0;
export type _ComponentFamiliesLiteralTypecheck = _AssertHeroVariant0IsHomepage;
