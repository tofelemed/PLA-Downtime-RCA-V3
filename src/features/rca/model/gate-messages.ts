import type { RcaGateIssue } from '@/api/v2/types/rca-workflow';
import type { AnalysisToolSlug } from './analysis-tools';

/** Where a gate message can send the user in this case's workspace. */
export interface GateLinks {
  /** the Analysis tools (`<case>/analysis`) */
  analysis: string;
  /** the Definition editor (`<case>/definition`) */
  definition: string;
  /** the Causes panel of the Analysis page */
  causes: string;
}

export interface GateMessageLink {
  label: string;
  to: string;
  testId: string;
}

export interface GateMessage {
  text: string;
  links: GateMessageLink[];
}

/** Server analysis-method keys → the Analysis tool that records them (the timeline is the event diagram). */
const METHOD_TOOLS: Readonly<Record<string, { slug: AnalysisToolSlug; name: string }>> = {
  five_why: { slug: 'five-why', name: '5-Why' },
  fishbone: { slug: 'fishbone', name: 'Fishbone' },
  fmea: { slug: 'fmea', name: 'FMEA' },
  fault_tree: { slug: 'fault-tree', name: 'Fault tree' },
  logic_tree: { slug: 'logic-tree', name: 'Logic tree' },
  timeline: { slug: 'event-diagram', name: 'Event diagram' },
  barrier: { slug: 'barrier', name: 'Barrier analysis' },
  change: { slug: 'change', name: 'Change analysis' },
};

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const orList = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;

function methodMessage(issue: RcaGateIssue, links: GateLinks): GateMessage {
  const tools = (issue.methods ?? []).flatMap((method) => (METHOD_TOOLS[method] ? [METHOD_TOOLS[method]] : []));
  if (tools.length === 0) return { text: sentence(issue.message), links: [{ label: 'Open the analysis tools', to: links.analysis, testId: 'gate-link-analysis' }] };
  return {
    text: `This consequence class needs a ${orList(tools.map((tool) => tool.name))} with content.`,
    links: tools.map((tool) => ({ label: `Open ${tool.name}`, to: `${links.analysis}/${tool.slug}`, testId: `gate-link-${tool.slug}` })),
  };
}

const definitionLink = (links: GateLinks): GateMessageLink => ({ label: 'Edit the definition', to: links.definition, testId: 'gate-link-definition' });

/**
 * A gate blocker or advice in our words, with links to where it is fixed (D-T4 depth codes, item 7 coded
 * cause, the consequence class); other codes keep the server's message.
 */
export function gateMessage(issue: RcaGateIssue, links: GateLinks): GateMessage {
  switch (issue.code) {
    case 'METHOD_REQUIRED':
      return methodMessage(issue, links);
    case 'TEAM_CHARTER_REQUIRED':
      return { text: 'Write the team charter (objective, scope and the team’s roles); this consequence class needs one.', links: [definitionLink(links)] };
    case 'CODED_CAUSE_REQUIRED':
      return { text: 'This consequence class needs at least one root cause with a cause code.', links: [{ label: 'Open the causes', to: links.causes, testId: 'coded-cause-link' }] };
    case 'CODED_ROOT_CAUSE_MISSING':
      return { text: 'At least one root cause with a cause code is required.', links: [{ label: 'Open the causes', to: links.causes, testId: 'coded-root-cause-link' }] };
    case 'CONSEQUENCE_CLASS_MISSING':
      return { text: 'Classify the consequence (minor, significant, major or critical): it sets the analyses, charter and coded causes the investigation needs.', links: [definitionLink(links)] };
    default:
      return { text: sentence(issue.message), links: [] };
  }
}
