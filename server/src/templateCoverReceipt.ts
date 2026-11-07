import jwt from 'jsonwebtoken';
import { TEMPLATE_COVER_MODELS, type TemplateCoverQuality } from './templateCoverModels';

export type TemplateCoverReceipt = {
  purpose: 'template-cover'; userId: string; imageUrl: string; quality: TemplateCoverQuality;
  target: string;
};
const secret = () => {
  if (!process.env.SECRET_KEYY) throw new Error('Missing signing configuration.');
  return process.env.SECRET_KEYY;
};
/** Issued only after successful provider work and the server's media charge. */
export const signTemplateCoverReceipt = (receipt: Omit<TemplateCoverReceipt, 'purpose'>) =>
  jwt.sign({ ...receipt, purpose: 'template-cover' }, secret(), { expiresIn: '2h', audience: 'template-cover' });

export function verifyTemplateCoverReceipt(token: unknown, userId: string, imageUrl: string, target: string): TemplateCoverReceipt {
  const value = jwt.verify(String(token || ''), secret(), { audience: 'template-cover' }) as TemplateCoverReceipt;
  if (value.purpose !== 'template-cover' || value.userId !== userId || value.imageUrl !== imageUrl ||
      value.target !== target || !Object.hasOwn(TEMPLATE_COVER_MODELS, value.quality)) throw new Error('Cover generation receipt does not match this update.');
  return value;
}
