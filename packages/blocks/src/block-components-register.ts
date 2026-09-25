/**
 * Registers blocks that depend on `render-layout` / `registry` back onto
 * `blockComponents`. Kept in a separate module so ESM import hoisting cannot
 * run these side effects before `blockComponents` is initialized.
 */
import { blockComponents } from "./block-components";
import { Repeater } from "./blocks/repeater";
import { Experiment } from "./blocks/experiment";
import { ReusableBlock } from "./blocks/reusable";

blockComponents.Repeater = Repeater;
blockComponents.Experiment = Experiment;
blockComponents["Reusable Block"] = ReusableBlock;
