import { z } from 'zod';

export const retailCustomerInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  enterpriseName: z.string().trim().max(200).optional().default(''),
  industry: z.string().trim().min(1).max(200),
  cashflow: z.string().trim().max(100).optional().default(''),
  loan: z.string().trim().max(100).optional().default(''),
  followup: z.string().trim().max(100).optional().default(''),
  priority: z.string().trim().max(100).optional().default(''),
  segment: z
    .enum(['all', 'priority', 'maturity', 'unfollowed'])
    .optional()
    .default('all'),
  notes: z.string().trim().max(2000).optional().default(''),
});

export const retailCustomerUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    enterpriseName: z.string().trim().max(200).optional(),
    industry: z.string().trim().min(1).max(200).optional(),
    cashflow: z.string().trim().max(100).optional(),
    loan: z.string().trim().max(100).optional(),
    followup: z.string().trim().max(100).optional(),
    priority: z.string().trim().max(100).optional(),
    segment: z.enum(['all', 'priority', 'maturity', 'unfollowed']).optional(),
    notes: z.string().trim().max(2000).optional(),
    version: z.number().int().positive().optional(),
  })
  .refine((value) => Object.keys(value).some((key) => key !== 'version'), {
    message: '至少提供一个需要修改的字段',
  });

export const retailCustomerImportSchema = z.object({
  rows: z.array(retailCustomerInputSchema).min(1).max(500),
});

export const retailTeamMemberInputSchema = z.object({
  email: z.email().trim().toLowerCase(),
});

const retailFieldSchema = z.object({
  label: z.string().trim().min(1).max(100),
  value: z.string().trim().max(2000),
});

const retailMaterialSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500),
  complete: z.boolean(),
});

const retailFollowupTaskSchema = z.object({
  id: z.string().trim().max(100).optional(),
  title: z.string().trim().min(1).max(500),
  reminderDate: z.string().trim().max(40).optional().default(''),
  status: z.enum(['pending', 'done']).optional().default('pending'),
});

const retailVersionSchema = z.number().int().nonnegative().optional();

export const retailBusinessUpdateSchema = z.discriminatedUnion('module', [
  z.object({
    module: z.literal('interview'),
    version: retailVersionSchema,
    data: z.object({ notes: z.string().trim().min(1).max(20000) }),
  }),
  z.object({
    module: z.literal('document'),
    version: retailVersionSchema,
    data: z.object({
      fileName: z.string().trim().max(500).optional().default(''),
      fields: z.array(retailFieldSchema).max(100),
      profileFields: z.array(retailFieldSchema).max(100).optional().default([]),
      reviewed: z.boolean(),
    }),
  }),
  z.object({
    module: z.literal('profile'),
    version: retailVersionSchema,
    data: z.object({ fields: z.array(retailFieldSchema).min(1).max(100) }),
  }),
  z.object({
    module: z.literal('matching'),
    version: retailVersionSchema,
    data: z.object({ recalculate: z.boolean().optional().default(true) }),
  }),
  z.object({
    module: z.literal('scripts'),
    version: retailVersionSchema,
    data: z.object({
      scenarioIndex: z.number().int().min(0).max(20),
      title: z.string().trim().min(1).max(200),
      content: z.string().trim().min(1).max(10000),
    }),
  }),
  z.object({
    module: z.literal('materials'),
    version: retailVersionSchema,
    data: z.object({
      items: z.array(retailMaterialSchema).max(100),
      tasks: z.array(retailFollowupTaskSchema).max(200),
    }),
  }),
  z.object({
    module: z.literal('summary'),
    version: retailVersionSchema,
    data: z.object({ regenerate: z.boolean().optional().default(true) }),
  }),
]);

export type RetailBusinessUpdate = z.infer<typeof retailBusinessUpdateSchema>;
