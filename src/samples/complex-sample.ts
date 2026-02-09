import { defineReferences, type SourcesBuilderContext } from '../references.ts';
import type { RefFields, Resolve, SourceRegistry } from '../types.ts';

type Id = string;
type RefId = Id | null | undefined;
type RefIds = Array<RefId>;

type IsoDate = `${number}-${number}-${number}T${number}:${number}:${number}.${number}Z`;

interface Entity {
  id: Id;
  createdAt: IsoDate;
}

interface User extends Entity {
  kind: 'user';
  email: string;
  displayName: string | null;
  teamId: RefId;
  managerId: RefId;
  roleIds: RefIds;
  featureFlagIds: RefIds;
  profile: {
    avatarFileId: RefId;
    locale: 'en' | 'pl' | 'ja';
    contact: {
      primaryPhoneId: RefId;
      emergencyContactUserId: RefId;
    };
  };
}

interface Team extends Entity {
  kind: 'team';
  name: string;
  organizationId: RefId;
  leadUserId: RefId;
  memberUserIds: RefIds;
  policies: Array<{
    policyId: Id;
    enabled: boolean;
    approverUserIds: RefIds;
  }>;
}

interface Organization extends Entity {
  kind: 'org';
  name: string;
  parentorganizationId: RefId;
  billing: {
    invoiceIds: RefIds;
    paymentMethodId: RefId;
  };
}

interface Role extends Entity {
  kind: 'role';
  name: string;
  permissionIds: RefIds;
}

interface Permission extends Entity {
  kind: 'permission';
  scope: 'read' | 'write' | 'admin';
  code: string;
}

interface FeatureFlag extends Entity {
  kind: 'feature-flag';
  name: string;
  enabled: boolean;
}

interface File extends Entity {
  kind: 'file';
  path: string;
  sha256: string;
}

interface PaymentMethod extends Entity {
  kind: 'payment-method';
  provider: 'stripe' | 'adyen' | 'manual';
  last4: string | null;
}

interface Invoice extends Entity {
  kind: 'invoice';
  organizationId: RefId;
  lineItems: Array<{
    sku: string;
    quantity: number;
    attachmentFileIds: RefIds;
  }>;
}

type Actor =
  | { kind: 'user'; userId: RefId }
  | { kind: 'service'; serviceId: RefId }
  | { kind: 'system'; systemId: RefId };

interface AuditEvent extends Entity {
  kind: 'audit-event';
  actor: Actor;
  context: {
    organizationId: RefId;
    projectId: RefId;
    related: Array<{ label: string; fileId: RefId; userId: RefId }>;
  };
}

interface Project extends Entity {
  kind: 'project';
  organizationId: RefId;
  ownerUserId: RefId;
  teamId: RefId;
  featureFlagIds: RefIds;
  taskIds: RefIds;
  roadmap: Array<{
    milestoneId: Id;
    dueAt: IsoDate | null;
    ownerUserId: RefId;
    dependencies: Array<{ projectId: RefId; reason: string }>;
  }>;
}

interface Task extends Entity {
  kind: 'task';
  projectId: RefId;
  assigneeUserId: RefId;
  reviewerUserIds: RefIds;
  parentTaskId: RefId;
  blockerTaskIds: RefIds;
  tagIds: RefIds;
  commentIds: RefIds;
  attachments: Array<{
    fileId: RefId;
    uploadedByUserId: RefId;
  }>;
}

interface Comment extends Entity {
  kind: 'comment';
  taskId: RefId;
  authorUserId: RefId;
  thread: {
    parentCommentId: RefId;
    mentionedUserIds: RefIds;
  };
}

interface Tag extends Entity {
  kind: 'tag';
  name: string;
  relatedTagIds: RefIds;
}

interface ComplexPagePayload {
  userId: RefId;
  organizationId: RefId;
  project: {
    projectId: RefId;
    taskIds: RefIds;
    pinnedTaskIds: RefIds;
  };
  audit: {
    recentAuditEventIds: RefIds;
    snapshots: Array<null | {
      at: IsoDate;
      auditEventId: RefId;
      relatedFileIds: RefIds;
    }>;
  };
  ui: {
    sidebar: {
      teamIds: RefIds;
      quickLinks: Array<{ title: string; fileId: RefId; ownerUserId: RefId }>;
    };
    editor: {
      openFileId: RefId;
      recentFileIds: RefIds[];
    };
  };
}

const iso = (str: IsoDate): IsoDate => str as IsoDate;

const Resources = {
  users: [
    {
      id: 'u1',
      createdAt: iso('2020-01-01T00:00:00.000Z'),
      kind: 'user',
      email: 'u1@example.com',
      displayName: 'Alice',
      teamId: 't1',
      managerId: 'u2',
      roleIds: ['r1', 'r2', null, undefined],
      featureFlagIds: ['ff1', 'ff_missing'],
      profile: {
        avatarFileId: 'f1',
        locale: 'en',
        contact: { primaryPhoneId: undefined, emergencyContactUserId: 'u2' },
      },
    },
    {
      id: 'u2',
      createdAt: iso('2020-01-02T00:00:00.000Z'),
      kind: 'user',
      email: 'u2@example.com',
      displayName: null,
      teamId: 't1',
      managerId: 'u1',
      roleIds: ['r2'],
      featureFlagIds: [],
      profile: {
        avatarFileId: null,
        locale: 'pl',
        contact: { primaryPhoneId: null, emergencyContactUserId: null },
      },
    },
  ] satisfies User[],
  teams: [
    {
      id: 't1',
      createdAt: iso('2020-01-03T00:00:00.000Z'),
      kind: 'team',
      name: 'Core',
      organizationId: 'o1',
      leadUserId: 'u1',
      memberUserIds: ['u1', 'u2', 'u_missing'],
      policies: [
        { policyId: 'p1', enabled: true, approverUserIds: ['u1', null] },
        { policyId: 'p2', enabled: false, approverUserIds: [] },
      ],
    },
  ] satisfies Team[],
  orgs: [
    {
      id: 'o1',
      createdAt: iso('2020-01-04T00:00:00.000Z'),
      kind: 'org',
      name: 'Nimir',
      parentorganizationId: null,
      billing: { invoiceIds: ['i1', 'i_missing'], paymentMethodId: 'pm1' },
    },
  ] satisfies Organization[],
  roles: [
    {
      id: 'r1',
      createdAt: iso('2020-01-05T00:00:00.000Z'),
      kind: 'role',
      name: 'Reader',
      permissionIds: ['perm_read'],
    },
    {
      id: 'r2',
      createdAt: iso('2020-01-06T00:00:00.000Z'),
      kind: 'role',
      name: 'Writer',
      permissionIds: ['perm_read', 'perm_write', 'perm_missing'],
    },
  ] satisfies Role[],
  permissions: [
    { id: 'perm_read', createdAt: iso('2020-01-07T00:00:00.000Z'), kind: 'permission', scope: 'read', code: 'R' },
    {
      id: 'perm_write',
      createdAt: iso('2020-01-08T00:00:00.000Z'),
      kind: 'permission',
      scope: 'write',
      code: 'W',
    },
  ] satisfies Permission[],
  featureFlags: [
    { id: 'ff1', createdAt: iso('2020-01-09T00:00:00.000Z'), kind: 'feature-flag', name: 'new-ui', enabled: true },
  ] satisfies FeatureFlag[],
  files: [
    { id: 'f1', createdAt: iso('2020-01-10T00:00:00.000Z'), kind: 'file', path: '/a.png', sha256: '00' },
    { id: 'f2', createdAt: iso('2020-01-11T00:00:00.000Z'), kind: 'file', path: '/b.png', sha256: '11' },
  ] satisfies File[],
  paymentMethods: [
    {
      id: 'pm1',
      createdAt: iso('2020-01-12T00:00:00.000Z'),
      kind: 'payment-method',
      provider: 'stripe',
      last4: '4242',
    },
  ] satisfies PaymentMethod[],
  invoices: [
    {
      id: 'i1',
      createdAt: iso('2020-01-13T00:00:00.000Z'),
      kind: 'invoice',
      organizationId: 'o1',
      lineItems: [
        { sku: 's1', quantity: 1, attachmentFileIds: ['f2', 'f_missing', null] },
        { sku: 's2', quantity: 2, attachmentFileIds: [] },
      ],
    },
  ] satisfies Invoice[],
  projects: [
    {
      id: 'pr1',
      createdAt: iso('2020-01-14T00:00:00.000Z'),
      kind: 'project',
      organizationId: 'o1',
      ownerUserId: 'u1',
      teamId: 't1',
      featureFlagIds: ['ff1'],
      taskIds: ['ta1', 'ta2', null],
      roadmap: [
        {
          milestoneId: 'm1',
          dueAt: iso('2020-02-01T00:00:00.000Z'),
          ownerUserId: 'u2',
          dependencies: [{ projectId: 'pr_missing', reason: 'external' }],
        },
      ],
    },
  ] satisfies Project[],
  tasks: [
    {
      id: 'ta1',
      createdAt: iso('2020-01-15T00:00:00.000Z'),
      kind: 'task',
      projectId: 'pr1',
      assigneeUserId: 'u2',
      reviewerUserIds: ['u1', null],
      parentTaskId: null,
      blockerTaskIds: ['ta2', 'ta_missing'],
      tagIds: ['tg1'],
      commentIds: ['c1', 'c2'],
      attachments: [
        { fileId: 'f1', uploadedByUserId: 'u1' },
        { fileId: 'f_missing', uploadedByUserId: 'u2' },
      ],
    },
    {
      id: 'ta2',
      createdAt: iso('2020-01-16T00:00:00.000Z'),
      kind: 'task',
      projectId: 'pr1',
      assigneeUserId: 'u1',
      reviewerUserIds: [],
      parentTaskId: 'ta1',
      blockerTaskIds: [],
      tagIds: ['tg1', 'tg2'],
      commentIds: [],
      attachments: [],
    },
  ] satisfies Task[],
  comments: [
    {
      id: 'c1',
      createdAt: iso('2020-01-17T00:00:00.000Z'),
      kind: 'comment',
      taskId: 'ta1',
      authorUserId: 'u1',
      thread: { parentCommentId: null, mentionedUserIds: ['u2'] },
    },
    {
      id: 'c2',
      createdAt: iso('2020-01-18T00:00:00.000Z'),
      kind: 'comment',
      taskId: 'ta1',
      authorUserId: 'u2',
      thread: { parentCommentId: 'c1', mentionedUserIds: ['u_missing', null] },
    },
  ] satisfies Comment[],
  tags: [
    { id: 'tg1', createdAt: iso('2020-01-19T00:00:00.000Z'), kind: 'tag', name: 'bug', relatedTagIds: ['tg2'] },
    { id: 'tg2', createdAt: iso('2020-01-20T00:00:00.000Z'), kind: 'tag', name: 'urgent', relatedTagIds: ['tg1'] },
  ] satisfies Tag[],
  auditEvents: [
    {
      id: 'ae1',
      createdAt: iso('2020-01-21T00:00:00.000Z'),
      kind: 'audit-event',
      actor: { kind: 'user', userId: 'u1' },
      context: {
        organizationId: 'o1',
        projectId: 'pr1',
        related: [
          { label: 'file', fileId: 'f2', userId: 'u2' },
          { label: 'missing', fileId: 'f_missing', userId: 'u_missing' },
        ],
      },
    },
  ] satisfies AuditEvent[],
} as const;

const sources = (c: SourcesBuilderContext) =>
  ({
    User: c.source<User>({
      fetchAll: () => Resources.users,
    }),
    Team: c.source<Team>({
      fetchAll: () => Resources.teams,
    }),
    Org: c.source<Organization>({
      fetchAll: () => Resources.orgs,
    }),
    Role: c.source<Role>({
      fetchByIds: (ids: string[]) => Resources.roles.filter(r => ids.includes(r.id)),
      batchSize: 1,
    }),
    Permission: c.source<Permission>({
      fetchByIds: (ids: string[]) => Resources.permissions.filter(p => ids.includes(p.id)),
      batchSize: 2,
    }),
    FeatureFlag: c.source<FeatureFlag>({
      fetchAll: () => Resources.featureFlags,
    }),
    File: c.source<File>({
      fetchByIds: (ids: string[]) => Resources.files.filter(f => ids.includes(f.id)),
      batchSize: 50,
    }),
    PaymentMethod: c.source<PaymentMethod>({
      fetchAll: () => Resources.paymentMethods,
    }),
    Invoice: c.source<Invoice>({
      fetchAll: () => Resources.invoices,
    }),
    Project: c.source<Project>({
      fetchAll: () => Resources.projects,
    }),
    Task: c.source<Task>({
      fetchAll: () => Resources.tasks,
    }),
    Comment: c.source<Comment>({
      fetchAll: () => Resources.comments,
    }),
    Tag: c.source<Tag>({
      fetchAll: () => Resources.tags,
    }),
    AuditEvent: c.source<AuditEvent>({
      fetchAll: () => Resources.auditEvents,
    }),
  }) satisfies SourceRegistry;

type TSources = ReturnType<typeof sources>;

const refs = defineReferences(sources);

const page: ComplexPagePayload = {
  organizationId: 'o1',
  userId: 'u1',
  project: {
    projectId: 'pr1',
    taskIds: ['ta1', 'ta2', null, undefined],
    pinnedTaskIds: ['ta2', 'ta_missing'],
  },
  audit: {
    recentAuditEventIds: ['ae1', 'ae_missing'],
    snapshots: [
      null,
      {
        at: iso('2021-01-01T00:00:00.000Z'),
        auditEventId: 'ae1',
        relatedFileIds: ['f1', null, 'f_missing'],
      },
    ],
  },
  ui: {
    sidebar: {
      teamIds: ['t1', 't_missing', null],
      quickLinks: [
        { title: 'logo', fileId: 'f1', ownerUserId: 'u1' },
        { title: 'missing', fileId: 'f_missing', ownerUserId: 'u_missing' },
      ],
    },
    editor: {
      openFileId: 'f2',
      recentFileIds: [['f1', null, 'f_missing'], []],
    },
  },
};

const fields = {
  organizationId: {
    source: 'Org',
    fields: {
      parentorganizationId: 'Org',
      billing: {
        invoiceIds: {
          source: 'Invoice',
          fields: {
            organizationId: 'Org',
            lineItems: {
              attachmentFileIds: 'File',
            },
          },
        },
        paymentMethodId: 'PaymentMethod',
      },
    },
  },
  userId: {
    source: 'User',
    fields: {
      teamId: {
        source: 'Team',
        fields: {
          organizationId: 'Org',
          leadUserId: {
            source: 'User',
            fields: {
              managerId: {
                source: 'User',
                fields: {
                  managerId: 'User',
                },
              },
            },
          },
          memberUserIds: 'User',
          policies: {
            approverUserIds: 'User',
          },
        },
      },
      managerId: 'User',
      roleIds: {
        source: 'Role',
        fields: {
          permissionIds: 'Permission',
        },
      },
      featureFlagIds: 'FeatureFlag',
      profile: {
        avatarFileId: 'File',
        contact: {
          emergencyContactUserId: 'User',
        },
      },
    },
  },
  project: {
    projectId: {
      source: 'Project',
      fields: {
        organizationId: 'Org',
        ownerUserId: 'User',
        teamId: 'Team',
        featureFlagIds: 'FeatureFlag',
        taskIds: {
          source: 'Task',
          fields: {
            projectId: 'Project',
            assigneeUserId: 'User',
            reviewerUserIds: 'User',
            parentTaskId: {
              source: 'Task',
              fields: {
                parentTaskId: {
                  source: 'Task',
                  fields: {
                    parentTaskId: 'Task',
                  },
                },
              },
            },
            blockerTaskIds: 'Task',
            tagIds: {
              source: 'Tag',
              fields: {
                relatedTagIds: {
                  source: 'Tag',
                  fields: {
                    relatedTagIds: 'Tag',
                  },
                },
              },
            },
            commentIds: {
              source: 'Comment',
              fields: {
                taskId: 'Task',
                authorUserId: 'User',
                thread: {
                  parentCommentId: 'Comment',
                  mentionedUserIds: 'User',
                },
              },
            },
            attachments: {
              fileId: 'File',
              uploadedByUserId: 'User',
            },
          },
        },
        roadmap: {
          ownerUserId: 'User',
          dependencies: {
            projectId: 'Project',
          },
        },
      },
    },
    taskIds: 'Task',
    pinnedTaskIds: 'Task',
  },
  audit: {
    recentAuditEventIds: {
      source: 'AuditEvent',
      fields: {
        actor: {
          userId: 'User',
          serviceId: 'User',
          systemId: 'User',
        },
        context: {
          organizationId: 'Org',
          projectId: 'Project',
          related: {
            fileId: 'File',
            userId: 'User',
          },
        },
      },
    },
    snapshots: {
      auditEventId: 'AuditEvent',
      relatedFileIds: 'File',
    },
  },
  ui: {
    sidebar: {
      teamIds: 'Team',
      quickLinks: {
        fileId: 'File',
        ownerUserId: 'User',
      },
    },
    editor: {
      openFileId: 'File',
      recentFileIds: 'File',
    },
  },
} satisfies RefFields<ComplexPagePayload, TSources>;

type ResolvedPage = Resolve<ComplexPagePayload, TSources, typeof fields>;

declare const resolvedValue: ResolvedPage;
const _resolvedPageCheck: ResolvedPage = resolvedValue;

async function compileOnlyExercise() {
  const resolved = await refs.inline(page, { fields });
  const justIds = await refs.inline(page, {
    fields,
    transform: ({ organizationId, userId, organizationIdT, userIdT, project }) => ({
      organizationId,
      userId,
      org: organizationIdT?.name ?? null,
      user: userIdT?.email ?? null,
      projectOwner: project.projectIdT?.ownerUserIdT?.displayName ?? null,
      firstTaskAssignee: project.projectIdT?.taskIdsTs?.[0]?.assigneeUserIdT?.email ?? null,
    }),
  });

  const load = refs.fn(
    async (seed: number) =>
      ({
        ...page,
        userId: seed % 2 === 0 ? 'u1' : 'u2',
      }) satisfies ComplexPagePayload,
    { fields },
  );
  const resolved2 = await load(123);

  refs.invalidate('User', ['u1', 'u2', 'u_missing']);
  refs.invalidate('Role');
  await refs.clear();

  const unsafeFields = { userId: 'NonExistentSource' as any } as any;
  const resolvedUnsafe = await refs.inline(page, { fields: unsafeFields });

  return { resolved, resolved2, justIds, resolvedUnsafe };
}

void compileOnlyExercise;
