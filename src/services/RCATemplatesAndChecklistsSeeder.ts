import { masterDataService } from './MasterDataService';

/**
 * Seed comprehensive RCA Templates with Logic Trees and Verification Checklists
 * for ADNOC Oil & Gas operations
 */
export async function seedRCATemplatesWithLogicTrees(tenantId: string): Promise<void> {
  console.log('📝 Seeding Oil & Gas RCA templates with logic trees...');
  
  // Fetch verification checklists for linking
  const checklists = await masterDataService.getVerificationStatusCodes({ tenantId });
  
  const templates = [
    {
      name: 'Equipment Failure Investigation',
      description: 'Comprehensive template for mechanical equipment failures in oil & gas operations',
      category: 'Equipment',
      sections: [
        {
          title: 'Event Description',
          fields: ['What happened?', 'When did it occur?', 'Who was affected?', 'Where did it happen?']
        },
        {
          title: 'Immediate Actions',
          fields: ['Emergency response taken', 'Equipment isolated?', 'Safety measures implemented']
        },
        {
          title: '5 Whys Analysis',
          fields: ['Why 1', 'Why 2', 'Why 3', 'Why 4', 'Why 5']
        },
        {
          title: 'Root Cause',
          fields: ['Identified root cause', 'Contributing factors', 'Equipment history review']
        },
        {
          title: 'Corrective Actions',
          fields: ['Short-term actions', 'Long-term actions', 'Preventive measures']
        }
      ],
      logicTreeStructure: {
        nodes: [
          {
            id: 'root',
            name: 'Equipment Failure Root Cause',
            type: 'root',
            children: ['mech', 'ops', 'maint'],
            notes: 'Primary investigation node'
          },
          {
            id: 'mech',
            name: 'Mechanical Causes',
            type: 'cause',
            children: ['wear', 'defect', 'design'],
            notes: 'Mechanical failure modes'
          },
          {
            id: 'wear',
            name: 'Normal Wear & Tear',
            type: 'cause',
            children: [],
            notes: 'End of equipment life cycle'
          },
          {
            id: 'defect',
            name: 'Material Defect',
            type: 'cause',
            children: [],
            notes: 'Manufacturing or material quality issue'
          },
          {
            id: 'design',
            name: 'Design Inadequacy',
            type: 'cause',
            children: [],
            notes: 'Equipment not suitable for service conditions'
          },
          {
            id: 'ops',
            name: 'Operational Causes',
            type: 'cause',
            children: ['exceed', 'procedure'],
            notes: 'Operation-related factors'
          },
          {
            id: 'exceed',
            name: 'Operating Beyond Design Limits',
            type: 'cause',
            children: [],
            notes: 'Pressure, temperature, or flow exceeded'
          },
          {
            id: 'procedure',
            name: 'Procedure Deviation',
            type: 'cause',
            children: [],
            notes: 'Did not follow SOP'
          },
          {
            id: 'maint',
            name: 'Maintenance Causes',
            type: 'cause',
            children: ['pm', 'quality'],
            notes: 'Maintenance-related factors'
          },
          {
            id: 'pm',
            name: 'PM Not Performed',
            type: 'cause',
            children: [],
            notes: 'Preventive maintenance overdue'
          },
          {
            id: 'quality',
            name: 'Poor Maintenance Quality',
            type: 'cause',
            children: [],
            notes: 'Incorrect repair or parts used'
          }
        ]
      },
      verificationChecklist: checklists.filter(c => 
        c.code === 'EQUIP_VERIFY' || c.code === 'GENERAL_VERIFY'
      ).map(c => c.code),
      tenantId,
      organizationId: '',
      isActive: true
    },
    {
      name: 'Process Upset Investigation',
      description: 'Template for investigating process deviations, upsets, and abnormal operations',
      category: 'Process',
      sections: [
        {
          title: 'Process Conditions',
          fields: ['Operating parameters before upset', 'Deviation observed', 'Process trend analysis']
        },
        {
          title: 'Impact Assessment',
          fields: ['Production impact', 'Quality impact', 'Safety implications']
        },
        {
          title: 'Cause Analysis',
          fields: ['Process variables reviewed', 'Control system check', 'Operator actions review']
        },
        {
          title: 'Root Cause',
          fields: ['Primary cause', 'Secondary causes', 'Systemic issues']
        },
        {
          title: 'Recommendations',
          fields: ['Process modifications', 'Control improvements', 'Training needs']
        }
      ],
      logicTreeStructure: {
        nodes: [
          {
            id: 'root',
            name: 'Process Upset Root Cause',
            type: 'root',
            children: ['feed', 'control', 'utility'],
            notes: 'Investigation starting point'
          },
          {
            id: 'feed',
            name: 'Feedstock Issues',
            type: 'cause',
            children: ['quality', 'composition', 'contamination'],
            notes: 'Feed-related causes'
          },
          {
            id: 'quality',
            name: 'Off-Spec Feedstock',
            type: 'cause',
            children: [],
            notes: 'Crude quality outside specifications'
          },
          {
            id: 'composition',
            name: 'Unexpected Composition',
            type: 'cause',
            children: [],
            notes: 'Different crude blend than expected'
          },
          {
            id: 'contamination',
            name: 'Feedstock Contamination',
            type: 'cause',
            children: [],
            notes: 'Water, salt, or chemical contamination'
          },
          {
            id: 'control',
            name: 'Control System Issues',
            type: 'cause',
            children: ['instrument', 'logic', 'operator'],
            notes: 'Control-related factors'
          },
          {
            id: 'instrument',
            name: 'Instrument Malfunction',
            type: 'cause',
            children: [],
            notes: 'Transmitter or analyzer failure'
          },
          {
            id: 'logic',
            name: 'Control Logic Error',
            type: 'cause',
            children: [],
            notes: 'DCS or PLC programming issue'
          },
          {
            id: 'operator',
            name: 'Operator Action',
            type: 'cause',
            children: [],
            notes: 'Manual intervention caused upset'
          },
          {
            id: 'utility',
            name: 'Utility Disruption',
            type: 'cause',
            children: ['steam', 'power', 'cooling'],
            notes: 'Utility supply issues'
          },
          {
            id: 'steam',
            name: 'Steam Supply Loss',
            type: 'cause',
            children: [],
            notes: 'Boiler trip or steam header issue'
          },
          {
            id: 'power',
            name: 'Power Fluctuation',
            type: 'cause',
            children: [],
            notes: 'Electrical supply instability'
          },
          {
            id: 'cooling',
            name: 'Cooling Water Issue',
            type: 'cause',
            children: [],
            notes: 'Cooling tower or pumps malfunction'
          }
        ]
      },
      verificationChecklist: checklists.filter(c => 
        c.code === 'PROCESS_VERIFY' || c.code === 'GENERAL_VERIFY'
      ).map(c => c.code),
      tenantId,
      organizationId: '',
      isActive: true
    },
    {
      name: 'Safety Incident Investigation',
      description: 'HSE-compliant template for investigating safety incidents and near-misses',
      category: 'Safety',
      sections: [
        {
          title: 'Incident Details',
          fields: ['Incident type', 'Personnel involved', 'Injuries sustained', 'Environmental impact']
        },
        {
          title: 'Immediate Response',
          fields: ['Emergency response', 'Medical treatment', 'Area secured', 'Reporting completed']
        },
        {
          title: 'Investigation',
          fields: ['Witness statements', 'Physical evidence', 'Procedures review', 'Training records check']
        },
        {
          title: 'Root Cause Analysis',
          fields: ['Direct causes', 'Indirect causes', 'Management system factors']
        },
        {
          title: 'Action Plan',
          fields: ['Immediate corrective actions', 'Long-term improvements', 'Communication plan']
        }
      ],
      logicTreeStructure: {
        nodes: [
          {
            id: 'root',
            name: 'Safety Incident Root Cause',
            type: 'root',
            children: ['unsafe_act', 'unsafe_cond', 'mgmt'],
            notes: 'Safety investigation framework'
          },
          {
            id: 'unsafe_act',
            name: 'Unsafe Acts',
            type: 'cause',
            children: ['training', 'awareness', 'shortcut'],
            notes: 'Human factors'
          },
          {
            id: 'training',
            name: 'Inadequate Training',
            type: 'cause',
            children: [],
            notes: 'Personnel not properly trained'
          },
          {
            id: 'awareness',
            name: 'Lack of Hazard Awareness',
            type: 'cause',
            children: [],
            notes: 'Risk not recognized'
          },
          {
            id: 'shortcut',
            name: 'Taking Shortcuts',
            type: 'cause',
            children: [],
            notes: 'Procedure not followed to save time'
          },
          {
            id: 'unsafe_cond',
            name: 'Unsafe Conditions',
            type: 'cause',
            children: ['equip', 'enviro', 'design'],
            notes: 'Physical hazards'
          },
          {
            id: 'equip',
            name: 'Faulty Equipment',
            type: 'cause',
            children: [],
            notes: 'Equipment defect or failure'
          },
          {
            id: 'enviro',
            name: 'Environmental Factors',
            type: 'cause',
            children: [],
            notes: 'Heat, noise, lighting, weather'
          },
          {
            id: 'design',
            name: 'Design Deficiency',
            type: 'cause',
            children: [],
            notes: 'Poor ergonomics or layout'
          },
          {
            id: 'mgmt',
            name: 'Management System Gaps',
            type: 'cause',
            children: ['procedure', 'supervision', 'culture'],
            notes: 'Organizational factors'
          },
          {
            id: 'procedure',
            name: 'Inadequate Procedures',
            type: 'cause',
            children: [],
            notes: 'SOP missing or incomplete'
          },
          {
            id: 'supervision',
            name: 'Lack of Supervision',
            type: 'cause',
            children: [],
            notes: 'Insufficient oversight'
          },
          {
            id: 'culture',
            name: 'Safety Culture Issue',
            type: 'cause',
            children: [],
            notes: 'Complacency or normalized deviance'
          }
        ]
      },
      verificationChecklist: checklists.filter(c => 
        c.code === 'SAFETY_VERIFY' || c.code === 'GENERAL_VERIFY'
      ).map(c => c.code),
      tenantId,
      organizationId: '',
      isActive: true
    },
    {
      name: 'Environmental Incident Investigation',
      description: 'Template for environmental spills, emissions, and regulatory exceedances',
      category: 'Environment',
      sections: [
        {
          title: 'Incident Description',
          fields: ['Type of release', 'Material released', 'Estimated quantity', 'Environmental media affected']
        },
        {
          title: 'Response Actions',
          fields: ['Spill containment', 'Cleanup methods', 'Regulatory notifications', 'Sampling performed']
        },
        {
          title: 'Investigation',
          fields: ['Source identification', 'Timeline reconstruction', 'Equipment inspection', 'Records review']
        },
        {
          title: 'Root Cause',
          fields: ['Equipment failure', 'Process upset', 'Operational error', 'Design flaw']
        },
        {
          title: 'Corrective Actions',
          fields: ['Immediate repairs', 'Process modifications', 'Monitoring enhancements', 'Training updates']
        }
      ],
      logicTreeStructure: {
        nodes: [
          {
            id: 'root',
            name: 'Environmental Incident Root Cause',
            type: 'root',
            children: ['release', 'detection', 'response'],
            notes: 'Environmental investigation'
          },
          {
            id: 'release',
            name: 'Release Mechanism',
            type: 'cause',
            children: ['leak', 'overfill', 'vent'],
            notes: 'How material was released'
          },
          {
            id: 'leak',
            name: 'Equipment Leak',
            type: 'cause',
            children: [],
            notes: 'Corrosion, crack, or seal failure'
          },
          {
            id: 'overfill',
            name: 'Tank Overfill',
            type: 'cause',
            children: [],
            notes: 'Level control failure'
          },
          {
            id: 'vent',
            name: 'Uncontrolled Venting',
            type: 'cause',
            children: [],
            notes: 'Pressure relief or flare system issue'
          },
          {
            id: 'detection',
            name: 'Detection Failure',
            type: 'cause',
            children: ['monitor', 'alarm'],
            notes: 'Why was release not detected early'
          },
          {
            id: 'monitor',
            name: 'Monitoring Gap',
            type: 'cause',
            children: [],
            notes: 'No sensor or inspection in area'
          },
          {
            id: 'alarm',
            name: 'Alarm Not Functional',
            type: 'cause',
            children: [],
            notes: 'Gas detector or level alarm failed'
          },
          {
            id: 'response',
            name: 'Response Delay',
            type: 'cause',
            children: ['awareness', 'procedure_missing'],
            notes: 'Why response was slow'
          },
          {
            id: 'awareness',
            name: 'Operators Not Aware',
            type: 'cause',
            children: [],
            notes: 'Communication breakdown'
          },
          {
            id: 'procedure_missing',
            name: 'No Response Procedure',
            type: 'cause',
            children: [],
            notes: 'Emergency response plan inadequate'
          }
        ]
      },
      verificationChecklist: checklists.filter(c => 
        c.code === 'ENV_VERIFY' || c.code === 'GENERAL_VERIFY'
      ).map(c => c.code),
      tenantId,
      organizationId: '',
      isActive: true
    }
  ];

  for (const template of templates) {
    await masterDataService.createRCATemplate(template);
    console.log(`   ✅ Created: ${template.name} (with logic tree & ${template.verificationChecklist?.length || 0} checklists)`);
  }
  
  console.log(`✅ Created ${templates.length} comprehensive RCA templates with logic trees`);
}

/**
 * Seed Verification Checklists for ADNOC Oil & Gas operations
 */
export async function seedVerificationChecklists(tenantId: string): Promise<void> {
  console.log('📋 Seeding Verification Checklists for Oil & Gas...');
  
  const checklists = [
    {
      code: 'GENERAL_VERIFY',
      name: 'General RCA Verification',
      description: 'Standard verification checklist for all RCA investigations',
      color: '#3B82F6',
      items: [
        'Event description is clear and complete',
        'Timeline of events is documented',
        'All personnel involved are identified',
        'Evidence is collected and documented',
        'Root cause is identified and verified',
        'Corrective actions are defined',
        'Responsibilities are assigned',
        'Target completion dates are set',
        'Management approval is obtained',
        'Lessons learned are documented'
      ],
      tenantId,
      organizationId: '',
      isActive: true
    },
    {
      code: 'EQUIP_VERIFY',
      name: 'Equipment Failure Verification',
      description: 'Specialized checklist for equipment failure investigations',
      color: '#F59E0B',
      items: [
        'Equipment nameplate data verified',
        'Maintenance history reviewed',
        'Operating conditions checked',
        'Failed component identified',
        'Failure mode determined',
        'Metallurgical analysis performed (if needed)',
        'Vibration/temperature data reviewed',
        'Manufacturer recommendations checked',
        'Spare parts availability confirmed',
        'Predictive maintenance updated',
        'Similar equipment inspected',
        'Design review completed (if applicable)'
      ],
      tenantId,
      organizationId: '',
      isActive: true
    },
    {
      code: 'PROCESS_VERIFY',
      name: 'Process Upset Verification',
      description: 'Checklist for process deviation and upset investigations',
      color: '#8B5CF6',
      items: [
        'Process flow diagram reviewed',
        'Operating parameters documented',
        'Trending data analyzed',
        'Control system logic checked',
        'Instrument calibration verified',
        'Feedstock quality confirmed',
        'Utility supply checked',
        'Operator actions reviewed',
        'Process simulation performed (if needed)',
        'P&ID updated (if needed)',
        'Operating procedures reviewed',
        'Training requirements identified'
      ],
      tenantId,
      organizationId: '',
      isActive: true
    },
    {
      code: 'SAFETY_VERIFY',
      name: 'Safety Incident Verification',
      description: 'HSE-compliant checklist for safety incident investigations',
      color: '#EF4444',
      items: [
        'Incident scene secured and documented',
        'Witnesses interviewed',
        'Photos and videos taken',
        'PPE usage verified',
        'Permit to work reviewed',
        'LOTO procedures checked',
        'Risk assessment reviewed',
        'JSA/Job plan checked',
        'Emergency response evaluated',
        'First aid/medical treatment documented',
        'Regulatory notifications completed',
        'Management of change reviewed',
        'Training records verified',
        'Behavior-based safety factors considered',
        'Near-miss history reviewed'
      ],
      tenantId,
      organizationId: '',
      isActive: true
    },
    {
      code: 'ENV_VERIFY',
      name: 'Environmental Incident Verification',
      description: 'Checklist for environmental spills and emissions investigations',
      color: '#10B981',
      items: [
        'Release quantity estimated',
        'Environmental media identified (air/water/soil)',
        'Spill containment verified',
        'Cleanup completion confirmed',
        'Samples collected and analyzed',
        'Regulatory reporting completed',
        'Permits reviewed',
        'Environmental monitoring data checked',
        'Disposal records verified',
        'Root cause identified',
        'Prevention measures implemented',
        'Equipment inspections scheduled'
      ],
      tenantId,
      organizationId: '',
      isActive: true
    },
    {
      code: 'QUALITY_VERIFY',
      name: 'Quality Deviation Verification',
      description: 'Checklist for product quality and off-spec investigations',
      color: '#EC4899',
      items: [
        'Product specifications reviewed',
        'Lab analysis results verified',
        'Sampling procedures checked',
        'Process conditions reviewed',
        'Feedstock quality confirmed',
        'Blending ratios verified',
        'Additives checked',
        'Storage conditions reviewed',
        'Customer complaints documented',
        'Corrective blending performed (if applicable)',
        'Product disposition determined',
        'Quality system updated'
      ],
      tenantId,
      organizationId: '',
      isActive: true
    },
    {
      code: 'MAINT_VERIFY',
      name: 'Maintenance Work Verification',
      description: 'Checklist for maintenance-related RCA investigations',
      color: '#F97316',
      items: [
        'Work order history reviewed',
        'PM schedule checked',
        'Parts used verified',
        'Work quality inspected',
        'Technician qualifications confirmed',
        'Procedures followed verified',
        'Tools and equipment checked',
        'Lockout/tagout confirmed',
        'Post-maintenance testing completed',
        'Run-in period monitored',
        'Spare parts inventory updated',
        'PM schedule adjusted (if needed)'
      ],
      tenantId,
      organizationId: '',
      isActive: true
    }
  ];

  for (const checklist of checklists) {
    await masterDataService.createVerificationStatusCode(checklist);
    console.log(`   ✅ Created: ${checklist.name} (${checklist.items.length} items)`);
  }
  
  console.log(`✅ Created ${checklists.length} verification checklists`);
}

