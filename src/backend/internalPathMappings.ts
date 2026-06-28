import type { PathMappingRule } from '../types';

export const INTERNAL_PATH_MAPPINGS: PathMappingRule[] = [
  {
    pattern: 'testcase_temp.cpp',
    team: 'DEMO_TEAM',
    component: 'DEMO_COMPONENT',
    priority: 100
  },
  {
    pattern: 'components/payment/',
    team: 'TRADE',
    component: 'PAYMENT',
    priority: 50
  }
];