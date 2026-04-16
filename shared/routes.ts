
import { z } from 'zod';
import {
  authLoginSchema,
  authOtpRequestSchema,
  authOtpVerifySchema,
  authRegisterSchema,
  changePasswordSchema,
  insertNoteSchema,
  notes,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  userProfileSchema,
  userIdentityUpdateSchema,
  users,
  verifyEmailSchema,
  verifyMobileSchema,
} from './schema';
import { studyRoomSchema } from "./study";

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  forbidden: z.object({
    message: z.string(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

export const api = {
  auth: {
    register: {
      method: 'POST' as const,
      path: '/api/register',
      input: authRegisterSchema,
      responses: {
        201: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    login: {
      method: 'POST' as const,
      path: '/api/login',
      input: authLoginSchema,
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
        400: errorSchemas.validation,
      },
    },
    loginCodeRequest: {
      method: "POST" as const,
      path: "/api/login/code/request",
      input: authOtpRequestSchema,
      responses: {
        200: z.object({ message: z.string(), devCode: z.string().optional() }),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
        429: errorSchemas.validation,
      },
    },
    loginCodeVerify: {
      method: "POST" as const,
      path: "/api/login/code/verify",
      input: authOtpVerifySchema,
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/logout',
      responses: {
        200: z.object({ message: z.string() }),
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/user',
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    updateProfile: {
      method: "PATCH" as const,
      path: "/api/user",
      input: userProfileSchema,
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
    passwordResetRequest: {
      method: "POST" as const,
      path: "/api/password/reset/request",
      input: passwordResetRequestSchema,
      responses: {
        200: z.object({ message: z.string(), devCode: z.string().optional() }),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
        429: errorSchemas.validation,
      },
    },
    passwordResetConfirm: {
      method: "POST" as const,
      path: "/api/password/reset/confirm",
      input: passwordResetConfirmSchema,
      responses: {
        200: z.object({ message: z.string() }),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
      },
    },
    changePassword: {
      method: "PUT" as const,
      path: "/api/user/password",
      input: changePasswordSchema,
      responses: {
        200: z.object({ message: z.string() }),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
  },
  user: {
    profile: {
      method: "GET" as const,
      path: "/api/user/profile",
      responses: {
        200: z.any(),
        401: errorSchemas.unauthorized,
      },
    },
    updateProfile: {
      method: "PUT" as const,
      path: "/api/user/profile",
      input: userIdentityUpdateSchema,
      responses: {
        200: z.any(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
    verifyEmail: {
      method: "POST" as const,
      path: "/api/user/verify-email",
      input: verifyEmailSchema,
      responses: {
        200: z.object({ message: z.string(), devCode: z.string().optional() }),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
        429: errorSchemas.validation,
      },
    },
    verifyMobile: {
      method: "POST" as const,
      path: "/api/user/verify-mobile",
      input: verifyMobileSchema,
      responses: {
        200: z.object({ message: z.string(), devCode: z.string().optional() }),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
        429: errorSchemas.validation,
      },
    },
  },
  me: {
    uploads: {
      method: "GET" as const,
      path: "/api/me/uploads",
      responses: {
        200: z.array(z.custom<typeof notes.$inferSelect & { author: string; authorBranch: string | null; authorYear: number | null }>()),
        401: errorSchemas.unauthorized,
      },
    },
    downloads: {
      method: "GET" as const,
      path: "/api/me/downloads",
      responses: {
        200: z.array(
          z.custom<
            typeof notes.$inferSelect & { author: string; downloadedAt: Date | null }
          >(),
        ),
        401: errorSchemas.unauthorized,
      },
    },
  },
  notes: {
    list: {
      method: 'GET' as const,
      path: '/api/notes',
      input: z.object({
        search: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof notes.$inferSelect & { author: string; authorBranch: string | null; authorYear: number | null }>()),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
    all: {
      method: "GET" as const,
      path: "/api/notes/all",
      input: z
        .object({
          search: z.string().optional(),
        })
        .optional(),
      responses: {
        200: z.array(z.custom<typeof notes.$inferSelect & { author: string; authorBranch: string | null; authorYear: number | null }>()),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
    byDate: {
      method: "GET" as const,
      path: "/api/notes/by-date",
      input: z
        .object({
          date: z.string(),
          search: z.string().optional(),
        })
        .optional(),
      responses: {
        200: z.array(z.custom<typeof notes.$inferSelect & { author: string; authorBranch: string | null; authorYear: number | null }>()),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/notes',
      // input is FormData, not JSON, handled specially in frontend
      responses: {
        201: z.custom<typeof notes.$inferSelect>(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
    remove: {
      method: "DELETE" as const,
      path: "/api/notes/:id",
      responses: {
        204: z.any(),
        401: errorSchemas.unauthorized,
        403: errorSchemas.forbidden,
        404: errorSchemas.notFound,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/notes/:id',
      responses: {
        200: z.custom<typeof notes.$inferSelect & { author: string; authorBranch: string | null; authorYear: number | null }>(),
        404: errorSchemas.notFound,
      },
    },
    download: {
      method: "POST" as const,
      path: "/api/notes/:id/download",
      responses: {
        204: z.any(),
        401: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
      },
    },
  },
  study: {
    rooms: {
      method: "GET" as const,
      path: "/api/study/rooms",
      responses: {
        200: z.array(studyRoomSchema),
        401: errorSchemas.unauthorized,
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
