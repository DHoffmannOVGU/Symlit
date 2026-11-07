import { z } from 'zod';
import { insertProjectSchema, insertViewSchema, insertUserSchema, methodMetadataSchema, projects, views, nodes, users } from './schema';
import { aiMetamodelProposalSchema, aiMetamodelRequestSchema } from './ai-metamodel';

const nonBlankString = z.string().refine((value) => value.trim().length > 0, {
  message: "Value must not be blank",
});

export const flowPositionSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

export const flowNodeInputSchema = z.object({
  id: nonBlankString,
  type: z.string().min(1).optional(),
  position: flowPositionSchema,
  data: z.unknown(),
  parentId: nonBlankString.nullable().optional(),
});

export const flowEdgeSchema = z.object({
  id: nonBlankString,
  source: nonBlankString,
  target: nonBlankString,
  edgeType: z.string().min(1).optional(),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
  data: z.any().nullable().optional(),
});

const validateFlowIdentity = <
  TNode extends { id: string },
  TEdge extends { id: string; source: string; target: string },
>(
  flow: { nodes: TNode[]; edges: TEdge[] },
  context: z.RefinementCtx,
) => {
  const nodeIds = new Set<string>();
  flow.nodes.forEach((node, index) => {
    if (nodeIds.has(node.id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["nodes", index, "id"],
        message: `Duplicate node ID: ${node.id}`,
      });
    }
    nodeIds.add(node.id);
  });

  const edgeIds = new Set<string>();
  flow.edges.forEach((edge, index) => {
    if (edgeIds.has(edge.id)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["edges", index, "id"],
        message: `Duplicate edge ID: ${edge.id}`,
      });
    }
    edgeIds.add(edge.id);

    if (!nodeIds.has(edge.source)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["edges", index, "source"],
        message: `Edge source does not reference a node: ${edge.source}`,
      });
    }
    if (!nodeIds.has(edge.target)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["edges", index, "target"],
        message: `Edge target does not reference a node: ${edge.target}`,
      });
    }
  });
};

export const flowSyncInputSchema = z
  .object({
    nodes: z.array(flowNodeInputSchema),
    edges: z.array(flowEdgeSchema),
  })
  .superRefine(validateFlowIdentity);

const flowNodeRecordSchema = z.object({
  id: nonBlankString,
  projectId: z.number().int(),
  type: z.string().min(1),
  data: z.unknown(),
  createdAt: z.unknown(),
  position: flowPositionSchema,
  parentId: nonBlankString.nullable().optional(),
});

export const flowResponseSchema = z
  .object({
    nodes: z.array(flowNodeRecordSchema),
    edges: z.array(flowEdgeSchema),
  })
  .superRefine(validateFlowIdentity);

const flowRecoveryNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  position: z.unknown(),
  data: z.unknown(),
  parentId: z.string().nullable().optional(),
});

const flowRecoveryEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  edgeType: z.string(),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
  data: z.unknown().nullable().optional(),
});

export const flowRecoveryIssueSchema = z.object({
  type: z.enum(["node", "edge"]),
  id: z.string(),
  index: z.number().int().nonnegative(),
  field: z.string(),
  message: z.string(),
});

export const flowRecoveryResponseSchema = z.object({
  nodes: z.array(flowRecoveryNodeSchema),
  edges: z.array(flowRecoveryEdgeSchema),
  issues: z.array(flowRecoveryIssueSchema),
});

export type FlowRecoveryResponse = z.infer<typeof flowRecoveryResponseSchema>;

const starterViewSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  nodes: z.array(flowNodeInputSchema),
  edges: z.array(flowEdgeSchema),
});

const createStarterProjectSchema = insertProjectSchema.extend({
  views: z.array(starterViewSchema),
});

// ============================================
// SHARED ERROR SCHEMAS
// ============================================
export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const projectExportInputSchema = z.object({
  format: z.enum(["json", "elements-csv", "relationships-csv"]).default("json"),
  viewIds: z.array(z.number().int().positive()).optional(),
  includeProjectDetails: z.boolean().default(true),
  includeElements: z.boolean().default(true),
  includeRelationships: z.boolean().default(true),
  includePatterns: z.boolean().default(false),
  includeReferencedMetamodels: z.boolean().default(false),
});

export type ProjectExportInput = z.infer<typeof projectExportInputSchema>;

export const appConfigSchema = z.object({
  edition: z.literal("local"),
  version: z.string(),
  features: z.object({
    ai: z.boolean(),
    internalViews: z.boolean(),
  }),
});

export type AppConfig = z.infer<typeof appConfigSchema>;

// ============================================
// API CONTRACT
// ============================================
export const api = {
  ai: {
    proposeMetamodel: {
      method: 'POST' as const,
      path: '/api/projects/:projectId/views/:viewId/ai/metamodel',
      input: aiMetamodelRequestSchema,
      responses: {
        200: aiMetamodelProposalSchema,
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
        429: errorSchemas.internal,
        502: errorSchemas.internal,
        503: errorSchemas.internal,
        504: errorSchemas.internal,
        422: errorSchemas.internal,
      },
    },
  },
  config: {
    get: {
      method: 'GET' as const,
      path: '/api/config',
      responses: {
        200: appConfigSchema,
      },
    },
  },
  auth: {
    me: {
      method: 'GET' as const,
      path: '/api/auth/me',
      responses: {
        200: z.object({
          user: z.custom<typeof users.$inferSelect>(),
          role: z.string(),
          authKind: z.literal("local"),
          capabilities: z.record(z.boolean()),
        }),
      },
    },
  },
  projects: {
    list: {
      method: 'GET' as const,
      path: '/api/users/:userId/projects',
      responses: {
        200: z.array(z.custom<typeof projects.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/projects',
      input: insertProjectSchema,
      responses: {
        201: z.custom<typeof projects.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    createStarter: {
      method: 'POST' as const,
      path: '/api/projects/starter',
      input: createStarterProjectSchema,
      responses: {
        201: z.object({
          project: z.custom<typeof projects.$inferSelect>(),
          firstViewId: z.number().nullable(),
        }),
        400: errorSchemas.validation,
        500: errorSchemas.internal,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/projects/:id',
      responses: {
        200: z.custom<typeof projects.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/projects/:id',
      input: insertProjectSchema.partial().extend({
        referencedMetamodels: z.array(z.number()).optional(),
        methodMetadata: methodMetadataSchema.optional(),
      }),
      responses: {
        200: z.custom<typeof projects.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/projects/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
    export: {
      method: 'POST' as const,
      path: '/api/projects/:id/export',
      input: projectExportInputSchema,
      responses: {
        200: z.any(),
        404: errorSchemas.notFound,
      },
    },
    access: {
      method: 'GET' as const,
      path: '/api/projects/:id/access',
      responses: {
        200: z.object({
          role: z.string(),
          capabilities: z.record(z.boolean()),
        }),
        404: errorSchemas.notFound,
      },
    },
  },
  views: {
    list: {
      method: 'GET' as const,
      path: '/api/projects/:projectId/views',
      responses: {
        200: z.array(z.custom<typeof views.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/projects/:projectId/views',
      input: insertViewSchema.omit({ projectId: true }), // projectId from param
      responses: {
        201: z.custom<typeof views.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/views/:id',
      responses: {
        200: z.custom<typeof views.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/views/:id',
      input: insertViewSchema.partial(),
      responses: {
        200: z.custom<typeof views.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/views/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  nodes: {
    get: {
      method: 'GET' as const,
      path: '/api/nodes/:nodeId',
      responses: {
        200: z.custom<typeof nodes.$inferSelect>().nullable(),
        404: errorSchemas.notFound,
      },
    },
  },
  internalViews: {
    list: {
      method: 'GET' as const,
      path: '/api/projects/:projectId/internal-views',
      responses: {
        200: z.array(z.custom<typeof views.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/nodes/:nodeId/internal-view',
      responses: {
        200: z.custom<typeof views.$inferSelect>().nullable(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/nodes/:nodeId/internal-view',
      input: z.object({
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        parentViewId: z.number().optional(),
      }),
      responses: {
        200: z.custom<typeof views.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
  },
  patterns: {
    list: {
      method: 'GET' as const,
      path: '/api/projects/:projectId/patterns',
      responses: {
        200: z.array(z.custom<typeof views.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/projects/:projectId/patterns',
      input: z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        nodes: z.array(z.object({
          nodeId: z.string().min(1),
          type: z.string().min(1),
          position: z.object({ x: z.number(), y: z.number() }),
          data: z.any(),
        })),
        edges: z.array(z.object({
          source: z.string().min(1),
          target: z.string().min(1),
          sourceHandle: z.string().nullable().optional(),
          targetHandle: z.string().nullable().optional(),
          data: z.any().optional(),
        })),
      }),
      responses: {
        201: z.object({ success: z.boolean() }),
        400: errorSchemas.validation,
      },
    },
  },
  flow: {
    sync: {
      method: 'POST' as const,
      path: '/api/views/:viewId/sync',
      input: flowSyncInputSchema,
      responses: {
        200: z.object({ success: z.boolean() }),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/views/:viewId/flow',
      responses: {
        200: flowResponseSchema,
        404: errorSchemas.notFound,
        422: errorSchemas.validation,
      },
    },
    recovery: {
      method: 'GET' as const,
      path: '/api/views/:viewId/flow/recovery',
      responses: {
        200: flowRecoveryResponseSchema,
        404: errorSchemas.notFound,
      },
    },
    insertNode: {
      method: 'POST' as const,
      path: '/api/views/:viewId/nodes/:nodeId/insert',
      input: z.object({
        position: flowPositionSchema,
      }),
      responses: {
        200: z.object({ success: z.boolean() }),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    insertPattern: {
      method: 'POST' as const,
      path: '/api/views/:viewId/patterns/:patternId/insert',
      input: z.object({
        position: flowPositionSchema,
      }),
      responses: {
        200: z.object({ success: z.boolean() }),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    validate: {
      method: 'POST' as const,
      path: '/api/views/:viewId/validate',
      responses: {
        200: z.object({
          issues: z.array(z.object({
            type: z.enum(["node", "edge"]),
            id: z.string(),
            message: z.string(),
            relatedNodeIds: z.array(z.string()).optional(),
          })),
        }),
        404: errorSchemas.notFound,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
