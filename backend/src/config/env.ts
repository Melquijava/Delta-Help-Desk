import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3333),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(1).default('change-me'),
  ACCESS_TOKEN_EXPIRES_IN: z.string().min(1).default('15m'),
  REFRESH_TOKEN_EXPIRES_DAYS: z.coerce.number().int().positive().default(7)
}).superRefine((value, context) => {
  if (value.NODE_ENV === 'production' && (value.JWT_SECRET === 'change-me' || value.JWT_SECRET.length < 32)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['JWT_SECRET'],
      message: 'JWT_SECRET deve ter pelo menos 32 caracteres e nao pode usar o valor padrao em producao'
    });
  }
});

export const env = envSchema.parse(process.env);
