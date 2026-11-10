import { z } from 'zod';
import { emailSchema } from './auth';

// Mesma regra de e-mail do login e do cadastro.
export const inviteSchema = z.object({ email: emailSchema });

export type InviteFormValues = z.infer<typeof inviteSchema>;
