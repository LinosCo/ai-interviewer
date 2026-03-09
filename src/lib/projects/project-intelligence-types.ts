import {
  Prisma,
  ProjectMethodologyRole,
  ProjectTipOriginType,
  ProjectTipStatus,
  TipApprovalMode,
  TipDraftStatus,
  TipExecutionStatus,
  TipExecutionRunType,
  TipPublishStatus,
  TipRevisionEditorType,
  TipRouteDestinationType,
  TipRoutePolicyMode,
  TipRouteStatus,
  TipRoutingStatus,
} from '@prisma/client';
import type {
  DerivedTipSuggestions,
  RelatedActionSuggestion,
} from '@/lib/projects/project-tip-related-suggestions';

export type ProjectStrategySnapshot = {
  projectId: string;
  positioning: string | null;
  valueProposition: string | null;
  targetAudiences: Prisma.JsonValue | null;
  strategicGoals: Prisma.JsonValue | null;
  priorityKpis: Prisma.JsonValue | null;
  keyOffers: Prisma.JsonValue | null;
  constraints: Prisma.JsonValue | null;
  toneGuidelines: string | null;
  editorialPriorities: Prisma.JsonValue | null;
  channelPriorities: Prisma.JsonValue | null;
  updatedAt: string;
};

export type MethodologyProfileSnapshot = {
  id: string;
  organizationId: string;
  slug: string;
  name: string;
  category: string;
  role: ProjectMethodologyRole;
  knowledge: string;
  isDefault: boolean;
  status: string;
};

export type DataSourceBindingSnapshot = {
  bindingId: string;
  projectId: string;
  dataSourceId: string;
  sourceType: string;
  ownershipMode: string;
  bindingRole: string;
  label: string | null;
  status: string | null;
  channelIntent: string | null;
  relevanceScore: number | null;
  metadata: Prisma.JsonValue | null;
};

export type ProjectTipSnapshot = {
  id: string;
  organizationId: string;
  projectId: string;
  originType: ProjectTipOriginType;
  originId: string | null;
  originItemKey: string | null;
  originFingerprint: string | null;
  title: string;
  summary: string | null;
  status: ProjectTipStatus;
  priority: number | null;
  category: string | null;
  contentKind: string | null;
  executionClass: string | null;
  approvalMode: TipApprovalMode;
  draftStatus: TipDraftStatus;
  routingStatus: TipRoutingStatus;
  publishStatus: TipPublishStatus;
  starred: boolean;
  reasoning: string | null;
  strategicAlignment: string | null;
  methodologySummary: string | null;
  methodologyRefs: Prisma.JsonValue | null;
  sourceSnapshot: Prisma.JsonValue | null;
  recommendedActions: Prisma.JsonValue | null;
  suggestedRouting: Prisma.JsonValue | null;
  derivedSuggestions: DerivedTipSuggestions | null;
  relatedActionSuggestions: RelatedActionSuggestion[];
  relatedPromptSuggestions: string[];
  reviewerNotes: string | null;
  createdBy: string | null;
  lastEditedBy: string | null;
  evidenceCount?: number;
  routeCount?: number;
  executionCount?: number;
  createdAt: string;
  updatedAt: string;
};

export type ProjectTipRouteSnapshot = {
  id: string;
  tipId: string;
  destinationType: TipRouteDestinationType;
  destinationRefId: string | null;
  policyMode: TipRoutePolicyMode;
  status: TipRouteStatus;
  payloadPreview: Prisma.JsonValue | null;
  lastDispatchedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectTipEvidenceSnapshot = {
  id: string;
  tipId: string;
  sourceType: string;
  sourceEntityId: string | null;
  sourceLabel: string | null;
  detail: string;
  metricValue: number | null;
  metricUnit: string | null;
  sortOrder: number;
  createdAt: string;
};

export type ProjectTipRevisionSnapshot = {
  id: string;
  tipId: string;
  editorType: TipRevisionEditorType;
  editorUserId: string | null;
  changeSummary: string;
  snapshot: Prisma.JsonValue;
  createdAt: string;
};

export type ProjectTipExecutionSnapshot = {
  id: string;
  tipId: string;
  routeId: string | null;
  runType: TipExecutionRunType;
  status: TipExecutionStatus;
  requestPayload: Prisma.JsonValue | null;
  responsePayload: Prisma.JsonValue | null;
  errorMessage: string | null;
  executedBy: string | null;
  startedAt: string;
  completedAt: string | null;
};

export type TipExplainabilityBlock = {
  /** Short deterministic answer to "why does this tip exist?" */
  whyThisTip: string;
  /** What project inputs were used to generate this tip */
  projectInputsUsed: string[];
  /** Strategic context: derived from strategicAlignment */
  strategyContext: string | null;
  /** Methodology context: derived from methodologySummary */
  methodologyContext: string | null;
  /** Automation recommendation: derived from suggestedRouting + contentKind */
  automationRecommendation: string | null;
};

export type ProjectTipDetailSnapshot = ProjectTipSnapshot & {
  evidence: ProjectTipEvidenceSnapshot[];
  revisions: ProjectTipRevisionSnapshot[];
  routes: ProjectTipRouteSnapshot[];
  executions: ProjectTipExecutionSnapshot[];
  explainability: TipExplainabilityBlock;
  reviewerNotes: string | null;
};

export type RoutingCapabilitySnapshot = {
  kind: 'tip-routing-rule' | 'integration';
  projectId: string;
  destinationType: string;
  referenceId: string | null;
  label: string;
  enabled: boolean;
  metadata?: Prisma.JsonValue | null;
};

export type CrossProjectReference = {
  projectId: string;
  name: string;
  topTipTitles: string[];
  patterns: string[];
};

export type ProjectIntelligenceContext = {
  projectId: string;
  projectName: string;
  organizationId: string;
  strategy: ProjectStrategySnapshot | null;
  methodologies: MethodologyProfileSnapshot[];
  dataSources: DataSourceBindingSnapshot[];
  tips: ProjectTipSnapshot[];
  routingCapabilities: RoutingCapabilitySnapshot[];
  crossProjectContext: CrossProjectReference[];
};

export type ProjectTipGroundingEvidenceRow = {
  sourceType: string;
  sourceEntityId?: string | null;
  sourceLabel?: string | null;
  detail: string;
  metricValue?: number | null;
  metricUnit?: string | null;
  sortOrder: number;
};

export type ProjectTipGroundingPayload = {
  tip: {
    organizationId: string;
    projectId: string;
    originType: ProjectTipOriginType;
    originId: string | null;
    originItemKey: string | null;
    title: string;
    summary: string | null;
    status: ProjectTipStatus;
    priority: number | null;
    category: string | null;
    reasoning: string | null;
    strategicAlignment: string | null;
    sourceSnapshot: Prisma.JsonValue | null;
    recommendedActions: Prisma.JsonValue | null;
  };
  evidenceRows: ProjectTipGroundingEvidenceRow[];
  methodologyRefsSummary: string[];
  strategySummary: string | null;
  methodologySummary: string | null;
};
