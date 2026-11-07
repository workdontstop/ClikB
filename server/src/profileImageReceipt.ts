import jwt from 'jsonwebtoken';
import { TEMPLATE_COVER_MODELS, type TemplateCoverQuality } from './templateCoverModels';

export type ProfileImageKind = 'avatar' | 'cover';
export type ProfileImageTarget = { memberId: string; kind: ProfileImageKind };
export type ProfileImageQuality = TemplateCoverQuality | 'direct' | 'current';
type ProfileImageReceipt = ProfileImageTarget & {
  purpose: 'profile-image'; ownerId: string; imageUrl: string; quality: ProfileImageQuality;
};

export function profileImageTarget(input: unknown, activeId: string | null): ProfileImageTarget {
  const value = input as Record<string, unknown> | undefined;
  const memberId = String(value?.memberId ?? '');
  if (!activeId || memberId !== activeId || !/^[1-9]\d{0,14}$/.test(memberId))
    throw new Error('Switch to this profile before changing its image.');
  if (value?.kind !== 'avatar' && value?.kind !== 'cover') throw new Error('Choose a profile picture or cover.');
  return { memberId, kind: value.kind };
}

const secret = () => {
  if (!process.env.SECRET_KEYY) throw new Error('Missing signing configuration.');
  return process.env.SECRET_KEYY;
};

export const signProfileImageReceipt = (receipt: Omit<ProfileImageReceipt, 'purpose'>) =>
  jwt.sign({ ...receipt, purpose: 'profile-image' }, secret(), { expiresIn: '2h', audience: 'profile-image' });

export function verifyProfileImageReceipt(token: unknown, ownerId: string, target: ProfileImageTarget, imageUrl: string) {
  const value = jwt.verify(String(token || ''), secret(), { audience: 'profile-image' }) as ProfileImageReceipt;
  if (value.purpose !== 'profile-image' || value.ownerId !== ownerId || value.memberId !== target.memberId ||
      value.kind !== target.kind || value.imageUrl !== imageUrl ||
      (value.quality !== 'direct' && value.quality !== 'current' && !Object.hasOwn(TEMPLATE_COVER_MODELS, value.quality)))
    throw new Error('This image belongs to a different profile image request.');
  return value;
}
