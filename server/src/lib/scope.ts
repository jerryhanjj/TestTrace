import type { PathMappingRule, ScopeMatch } from './types';
import { normalizePath } from './utils';

export function resolveScope(sourceRelativePath: string, rules: PathMappingRule[], autoDetectScope: boolean): {
  team?: ScopeMatch;
  component?: ScopeMatch;
  warnings: string[];
} {
  if (!autoDetectScope) {
    return { warnings: [] };
  }
  const normalizedPath = normalizePath(sourceRelativePath);
  const normalizedRules = rules
    .map((rule) => ({
      ...rule,
      normalizedPattern: normalizePath(rule.pattern).replace(/\*\*$/u, '')
    }))
    .filter((rule) => rule.normalizedPattern.length > 0)
    .sort((left, right) => {
      if (right.normalizedPattern.length !== left.normalizedPattern.length) {
        return right.normalizedPattern.length - left.normalizedPattern.length;
      }
      return (right.priority ?? 0) - (left.priority ?? 0);
    });

  const match = normalizedRules.find((rule) => normalizedPath.startsWith(rule.normalizedPattern));
  if (!match) {
    return { warnings: ['scope_not_detected'] };
  }
  return {
    team: {
      code: match.team,
      confidence: 92,
      source: 'service'
    },
    component: {
      code: match.component,
      confidence: 92,
      source: 'service'
    },
    warnings: []
  };
}