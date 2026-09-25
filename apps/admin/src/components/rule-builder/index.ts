/**
 * Reusable visual rule-builder (backlog #33). Field/operator/value conditions
 * with AND/OR groups. Import from "@/components/rule-builder".
 */
export { RuleBuilder, type RuleBuilderProps } from "./RuleBuilder";
export {
  RULE_OPERATORS,
  OPERATOR_LABELS,
  VALUELESS_OPERATORS,
  operatorsForType,
  newCondition,
  newGroup,
  type RuleField,
  type RuleCondition,
  type RuleGroup,
  type RuleNode,
  type RuleOperator,
} from "./types";
export {
  conditionalToGroup,
  groupToConditional,
  type FormsConditional,
} from "./forms-adapter";
