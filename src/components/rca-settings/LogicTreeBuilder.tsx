/**
 * Shape of a logic-tree node as v1 RCA screens read it from `rca_templates.template_data.nodes`. The v1
 * builder is gone (templates are edited in Master Data → RCA templates, `src/features/master-data/rca`);
 * this type stays for the v1 RCA module until it is retired.
 */
export interface LogicTreeNode {
  id: string;
  name: string;
  code: string;
  category: string;
  description?: string;
  children?: LogicTreeNode[];
  note?: string;
  finding?: boolean;
}
