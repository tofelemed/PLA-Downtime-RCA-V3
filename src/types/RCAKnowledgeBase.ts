// RCA Knowledge Base Types
// Enables intelligent similarity detection and knowledge reuse

export interface RCAKnowledgeEntry {
  id: string;
  rcaId: string; // Reference to original RCA
  title: string;
  description: string;
  
  // Event context
  eventType: string;
  unitId: string;
  unitName: string;
  assetId?: string;
  assetName?: string;
  equipmentCategory?: string; // e.g., "Compressor", "Pump", "Furnace"
  
  // Problem definition
  problemStatement: string;
  symptoms: string[];
  impactCodes: string[];
  oeeCodes: string[];
  
  // Root cause
  rootCause: string;
  rootCauseCategory: string; // Equipment, Process, Human Error, External, etc.
  contributingFactors: string[];
  
  // Solution
  recommendations: {
    id: string;
    description: string;
    effectiveness: 'High' | 'Medium' | 'Low' | 'Unknown';
    implementationCost?: number;
    implementationTime?: number; // days
  }[];
  
  // Effectiveness tracking
  recurrenceCount: number; // How many times same issue happened after RCA
  effectiveness: number; // 0-100 score
  costSaved?: number;
  downtimeReduced?: number; // minutes
  
  // Metadata
  keywords: string[]; // For searchability
  tags: string[];
  relatedRcas?: string[];
  tenantId: string;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
  closedDate?: string;
  
  // Usage tracking
  timesReferenced: number; // How many times this knowledge was used
  helpfulVotes: number; // Upvotes from users who found it helpful
}

export interface RCASimilarityMatch {
  knowledgeEntry: RCAKnowledgeEntry;
  similarityScore: number; // 0-100
  matchReasons: string[]; // Why this is similar
  matchedFields: {
    equipment?: boolean;
    symptoms?: boolean;
    impactCodes?: boolean;
    keywords?: boolean;
    rootCauseCategory?: boolean;
  };
}

export interface RCAAnalysisConfig {
  id: string;
  name: string;
  description: string;
  
  // Enabled analysis tools
  enabledTools: {
    fiveWhy: boolean;
    fishbone: boolean;
    faultTree: boolean;
    fmea: boolean;
    rootCauseMatrix: boolean;
    timelineAnalysis: boolean;
    barrierAnalysis: boolean;
    changeAnalysis: boolean;
  };
  
  // Tool-specific configurations
  fiveWhyConfig: {
    minimumDepth: number; // Default: 5
    requireJustification: boolean; // Require explanation for each why
    suggestQuestions: boolean; // AI-suggested follow-up questions
  };
  
  fishboneConfig: {
    categories: string[]; // Default: 6M (Man, Machine, Material, Method, Measurement, Environment)
    requireMinimumCauses: number; // Per category
    allowCustomCategories: boolean;
  };
  
  fmeaConfig: {
    severityScale: number; // 1-10
    occurrenceScale: number; // 1-10
    detectionScale: number; // 1-10
    riskThreshold: number; // RPN threshold for action
  };
  
  faultTreeConfig: {
    useStandardSymbols: boolean;
    calculateProbabilities: boolean;
    minimumCutSets: boolean;
  };
  
  // Knowledge base settings
  knowledgeBaseConfig: {
    enableSimilarityDetection: boolean;
    similarityThreshold: number; // 0-100, minimum score to show matches
    autoSuggestEvidence: boolean; // Suggest evidence types from similar RCAs
    autoSuggestActions: boolean; // Suggest actions from similar RCAs
    maxSuggestions: number; // Max number of similar RCAs to show
  };
  
  // Required fields for RCA completion
  requiredFields: {
    rootCause: boolean;
    fiveWhyAnalysis: boolean;
    fishboneDiagram: boolean;
    minimumEvidence: number;
    minimumRecommendations: number;
    minimumFindings: number;
  };
  
  tenantId: string;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

// Industrial Standard Methodologies

export interface FiveWhyAnalysis {
  id: string;
  rcaId: string;
  problem: string;
  whyLevels: {
    level: number;
    question: string;
    answer: string;
    justification?: string;
    evidence?: string[];
  }[];
  rootCause: string; // Final root cause identified
  verifiedBy?: string; // User who verified the analysis
  verifiedDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FishboneDiagram {
  id: string;
  rcaId: string;
  effect: string; // The problem/effect being analyzed
  categories: {
    id: string;
    name: string; // Man, Machine, Material, etc.
    causes: {
      id: string;
      description: string;
      isPrimary: boolean; // Is this a primary or secondary cause?
      evidence?: string[];
      likelihood: 'High' | 'Medium' | 'Low';
    }[];
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface FMEAAnalysis {
  id: string;
  rcaId: string;
  failureMode: string;
  effects: {
    id: string;
    description: string;
    severity: number; // 1-10
    currentControls: string;
    detection: number; // 1-10
  }[];
  causes: {
    id: string;
    description: string;
    occurrence: number; // 1-10
    rpn: number; // Risk Priority Number (Severity × Occurrence × Detection)
    recommendedActions: string[];
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface FaultTreeAnalysis {
  id: string;
  rcaId: string;
  topEvent: string; // The undesired event
  nodes: {
    id: string;
    type: 'AND' | 'OR' | 'Event' | 'BasicEvent' | 'UndevelopedEvent';
    description: string;
    parentId?: string;
    probability?: number; // For quantitative analysis
    children?: string[]; // IDs of child nodes
  }[];
  minimumCutSets?: string[][]; // Sets of basic events that cause top event
  createdAt: string;
  updatedAt: string;
}

export interface BarrierAnalysis {
  id: string;
  rcaId: string;
  hazard: string;
  barriers: {
    id: string;
    type: 'Prevention' | 'Detection' | 'Mitigation' | 'Recovery';
    description: string;
    effectiveness: 'Strong' | 'Moderate' | 'Weak' | 'Failed';
    failureReason?: string;
    recommendations: string[];
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface ChangeAnalysis {
  id: string;
  rcaId: string;
  question: string; // "What changed?"
  changes: {
    id: string;
    category: 'People' | 'Equipment' | 'Process' | 'Materials' | 'Environment' | 'Management';
    description: string;
    changeDate: string;
    relatedToIncident: boolean;
    impactLevel: 'High' | 'Medium' | 'Low';
    evidence?: string[];
  }[];
  createdAt: string;
  updatedAt: string;
}

// Similarity Detection Algorithm
export function calculateRCASimilarity(
  currentRCA: Partial<RCAKnowledgeEntry>,
  pastRCA: RCAKnowledgeEntry,
  config: RCAAnalysisConfig
): RCASimilarityMatch | null {
  let score = 0;
  const matchReasons: string[] = [];
  const matchedFields: RCASimilarityMatch['matchedFields'] = {};
  
  // Weight factors
  const WEIGHTS = {
    exactEquipment: 30,
    sameEquipmentType: 15,
    sameUnit: 10,
    sameEventType: 15, // Added event type matching
    matchingSymptoms: 20,
    matchingImpactCodes: 15,
    matchingKeywords: 20, // Increased from 10 to 20
    titleSimilarity: 15, // Added title similarity
    sameRootCauseCategory: 15,
  };
  
  // 1. Title/Description similarity
  if (currentRCA.title && pastRCA.title) {
    const currentTitle = currentRCA.title.toLowerCase();
    const pastTitle = pastRCA.title.toLowerCase();
    const currentWords = currentTitle.split(/\s+/).filter(w => w.length > 2);
    const pastWords = pastTitle.split(/\s+/).filter(w => w.length > 2);
    const commonWords = currentWords.filter(w => pastWords.includes(w));
    
    if (commonWords.length >= 2) {
      const similarityScore = Math.min(WEIGHTS.titleSimilarity, commonWords.length * 4);
      score += similarityScore;
      matchReasons.push(`Similar title (${commonWords.length} common words: ${commonWords.join(', ')})`);
    }
  }
  
  // 2. Equipment matching
  if (currentRCA.assetId && currentRCA.assetId === pastRCA.assetId) {
    score += WEIGHTS.exactEquipment;
    matchReasons.push('Exact same equipment');
    matchedFields.equipment = true;
  } else if (currentRCA.equipmentCategory && currentRCA.equipmentCategory === pastRCA.equipmentCategory) {
    score += WEIGHTS.sameEquipmentType;
    matchReasons.push(`Same equipment type: ${currentRCA.equipmentCategory}`);
    matchedFields.equipment = true;
  }
  
  // 3. Unit matching
  if (currentRCA.unitId && currentRCA.unitId === pastRCA.unitId) {
    score += WEIGHTS.sameUnit;
    matchReasons.push('Same production unit');
  }
  
  // 4. Event type matching
  if (currentRCA.eventType && currentRCA.eventType === pastRCA.eventType) {
    score += WEIGHTS.sameEventType;
    matchReasons.push(`Same event type: ${currentRCA.eventType}`);
    matchedFields.eventType = true;
  }
  
  // 5. Symptom matching
  if (currentRCA.symptoms && pastRCA.symptoms) {
    const matchingSymptoms = currentRCA.symptoms.filter(s => 
      pastRCA.symptoms.some(ps => 
        s.toLowerCase().includes(ps.toLowerCase()) || 
        ps.toLowerCase().includes(s.toLowerCase())
      )
    );
    if (matchingSymptoms.length > 0) {
      score += Math.min(WEIGHTS.matchingSymptoms, matchingSymptoms.length * 5);
      matchReasons.push(`${matchingSymptoms.length} matching symptoms`);
      matchedFields.symptoms = true;
    }
  }
  
  // 6. Impact code matching
  if (currentRCA.impactCodes && pastRCA.impactCodes) {
    const matchingCodes = currentRCA.impactCodes.filter(c => pastRCA.impactCodes.includes(c));
    if (matchingCodes.length > 0) {
      score += Math.min(WEIGHTS.matchingImpactCodes, matchingCodes.length * 5);
      matchReasons.push(`${matchingCodes.length} matching impact codes`);
      matchedFields.impactCodes = true;
    }
  }
  
  // 7. Keyword matching
  if (currentRCA.keywords && pastRCA.keywords) {
    const matchingKeywords = currentRCA.keywords.filter(k => 
      pastRCA.keywords.some(pk => pk.toLowerCase() === k.toLowerCase())
    );
    if (matchingKeywords.length > 0) {
      score += Math.min(WEIGHTS.matchingKeywords, matchingKeywords.length * 3);
      matchReasons.push(`${matchingKeywords.length} matching keywords`);
      matchedFields.keywords = true;
    }
  }
  
  // 8. Root cause category matching
  if (currentRCA.rootCauseCategory && currentRCA.rootCauseCategory === pastRCA.rootCauseCategory) {
    score += WEIGHTS.sameRootCauseCategory;
    matchReasons.push(`Same root cause category: ${currentRCA.rootCauseCategory}`);
    matchedFields.rootCauseCategory = true;
  }
  
  // Only return if score meets threshold
  if (score >= config.knowledgeBaseConfig.similarityThreshold) {
    return {
      knowledgeEntry: pastRCA,
      similarityScore: score,
      matchReasons,
      matchedFields,
    };
  }
  
  return null;
}

// Extract keywords from text using simple NLP
export function extractKeywords(text: string): string[] {
  // Remove common words
  const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'was', 'is', 'are', 'been', 'being', 'have', 'has', 'had'];
  
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.includes(word)); // Changed from > 3 to > 2
  
  // Count frequency
  const frequency: { [key: string]: number } = {};
  words.forEach(word => {
    frequency[word] = (frequency[word] || 0) + 1;
  });
  
  // Sort by frequency and return top keywords
  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

// Default analysis configuration for different industries
export const DEFAULT_ANALYSIS_CONFIGS = {
  OilAndGas: {
    name: 'Oil & Gas Industry Standard',
    description: 'Comprehensive analysis tools for oil and gas operations',
    enabledTools: {
      fiveWhy: true,
      fishbone: true,
      faultTree: true,
      fmea: true,
      rootCauseMatrix: true,
      timelineAnalysis: true,
      barrierAnalysis: true,
      changeAnalysis: true,
    },
    fiveWhyConfig: {
      minimumDepth: 5,
      requireJustification: true,
      suggestQuestions: true,
    },
    fishboneConfig: {
      categories: ['Man (People)', 'Machine (Equipment)', 'Material', 'Method (Process)', 'Measurement', 'Environment'],
      requireMinimumCauses: 2,
      allowCustomCategories: true,
    },
    fmeaConfig: {
      severityScale: 10,
      occurrenceScale: 10,
      detectionScale: 10,
      riskThreshold: 100, // RPN > 100 requires action
    },
    faultTreeConfig: {
      useStandardSymbols: true,
      calculateProbabilities: false,
      minimumCutSets: false,
    },
    knowledgeBaseConfig: {
      enableSimilarityDetection: true,
      similarityThreshold: 40, // Show matches with 40%+ similarity
      autoSuggestEvidence: true,
      autoSuggestActions: true,
      maxSuggestions: 5,
    },
    requiredFields: {
      rootCause: true,
      fiveWhyAnalysis: true,
      fishboneDiagram: false,
      minimumEvidence: 3,
      minimumRecommendations: 2,
      minimumFindings: 1,
    },
  },
  Cement: {
    name: 'Cement Industry Standard',
    description: 'Analysis tools tailored for cement manufacturing',
    enabledTools: {
      fiveWhy: true,
      fishbone: true,
      faultTree: false,
      fmea: false,
      rootCauseMatrix: true,
      timelineAnalysis: true,
      barrierAnalysis: false,
      changeAnalysis: true,
    },
    fiveWhyConfig: {
      minimumDepth: 5,
      requireJustification: false,
      suggestQuestions: false,
    },
    fishboneConfig: {
      categories: ['Man', 'Machine', 'Material', 'Method', 'Measurement', 'Mother Nature'],
      requireMinimumCauses: 1,
      allowCustomCategories: true,
    },
    fmeaConfig: {
      severityScale: 5,
      occurrenceScale: 5,
      detectionScale: 5,
      riskThreshold: 50,
    },
    faultTreeConfig: {
      useStandardSymbols: true,
      calculateProbabilities: false,
      minimumCutSets: false,
    },
    knowledgeBaseConfig: {
      enableSimilarityDetection: true,
      similarityThreshold: 50,
      autoSuggestEvidence: false,
      autoSuggestActions: true,
      maxSuggestions: 3,
    },
    requiredFields: {
      rootCause: true,
      fiveWhyAnalysis: true,
      fishboneDiagram: false,
      minimumEvidence: 2,
      minimumRecommendations: 1,
      minimumFindings: 1,
    },
  },
};

