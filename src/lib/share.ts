import { z } from "zod";

export const createShareSchema = z.object({
  ciphertext: z.string().min(1),
  iv: z.string().min(1),
  expiresAt: z.string().datetime().nullable().optional()
});

export const shareResponseSchema = z.object({
  shareId: z.string().min(1),
  ciphertext: z.string().min(1),
  iv: z.string().min(1),
  expiresAt: z.string().datetime().nullable()
});

export const createPlainShareSchema = z
  .object({
    content: z.string().min(1).optional(),
    text: z.string().min(1).optional(),
    plaintext: z.string().min(1).optional(),
    markdown: z.string().min(1).optional(),
    expiresAt: z.string().datetime().nullable().optional()
  })
  .refine(
    (data) => Boolean(data.content || data.text || data.plaintext || data.markdown),
    { message: "Either 'text', 'content', 'plaintext', or 'markdown' must be provided" }
  );

export function extractPlainContent(data: {
  content?: string;
  text?: string;
  plaintext?: string;
  markdown?: string;
}): string {
  return data.text ?? data.content ?? data.plaintext ?? data.markdown ?? "";
}

export const updateShareSchema = z.object({
  ciphertext: z.string().min(1).optional(),
  iv: z.string().min(1).optional(),
  text: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  plaintext: z.string().min(1).optional(),
  markdown: z.string().min(1).optional(),
  key: z.string().min(1).optional(),
  expiresAt: z.string().datetime().nullable().optional()
}).refine(
  (data) => Boolean((data.ciphertext && data.iv) || data.text || data.content || data.plaintext || data.markdown || data.expiresAt !== undefined),
  { message: "Must provide either (ciphertext + iv), text content, or expiresAt" }
);

export const updatePlainShareSchema = z
  .object({
    content: z.string().min(1).optional(),
    text: z.string().min(1).optional(),
    plaintext: z.string().min(1).optional(),
    markdown: z.string().min(1).optional(),
    key: z.string().min(1).optional(),
    expiresAt: z.string().datetime().nullable().optional()
  })
  .refine(
    (data) => Boolean(data.content || data.text || data.plaintext || data.markdown || data.expiresAt !== undefined),
    { message: "Must provide text content or expiresAt to update" }
  );


