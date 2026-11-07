import type { Express, Request, Response } from 'express';
import { withTransaction } from './execQuery';
import { authenticatedOwnerId, authenticatedUserId } from './requestAuth';
import { assertStoredTemplateImage, postMediaStorageUrl, storeNormalizedImage, deleteCloudImageUrl } from './S3Routes';
import { queueTemplateAssetCleanup, drainTemplateAssetCleanup, startTemplateAssetCleanup, TEMPLATE_ASSET_CLEANUP } from './templateAssetCleanup';
import { profileImageTarget, signProfileImageReceipt, verifyProfileImageReceipt } from './profileImageReceipt';
import { validateProfileImageUpload } from './profileImageUpload';

function managedProfileAsset(url: unknown) {
  const canonical = postMediaStorageUrl(url);
  return canonical && /^s3:\/\/[^/]+\/(?:profile-image-\d+-(?:avatar|cover)-[a-f0-9]+\.|hd-[a-f0-9]{32}\.png(?:$|\?))/.test(canonical);
}

export function registerProfileImageRoutes(app: Express) {
  startTemplateAssetCleanup();
  app.post('/profile-image/current', async (req: Request, res: Response) => {
    res.set('Cache-Control', 'private, no-store');
    const ownerId = authenticatedOwnerId(req);
    if (!ownerId) { res.status(401).json({ message: 'Please sign in.' }); return; }
    try {
      const target = profileImageTarget(req.body, authenticatedUserId(req));
      const member = await withTransaction(async query => {
        const [row] = await query('SELECT profile_image,profile_image_thumb,billboard1,billboardthumb1 FROM members WHERE id=?', [target.memberId]);
        return row;
      });
      if (!member) throw new Error('This profile is unavailable.');
      const imageUrl = String((target.kind === 'avatar' ? member.profile_image : member.billboard1) || '');
      const profileImageReceipt = imageUrl ? signProfileImageReceipt({ ...target, ownerId, imageUrl, quality: 'current' }) : null;
      res.json({ memberId: Number(target.memberId), kind: target.kind, imageUrl, profileImageReceipt });
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Could not load this profile image.' });
    }
  });
  app.post('/profile-image/remove', async (req: Request, res: Response) => {
    res.set('Cache-Control', 'private, no-store');
    const ownerId = authenticatedOwnerId(req);
    if (!ownerId) { res.status(401).json({ message: 'Please sign in.' }); return; }
    try {
      const target = profileImageTarget(req.body, authenticatedUserId(req));
      const imageUrl = typeof req.body?.imageUrl === 'string' ? req.body.imageUrl : '';
      verifyProfileImageReceipt(req.body?.receipt, ownerId, target, imageUrl);
      await withTransaction(async query => {
        const [member] = await query('SELECT profile_image,profile_image_thumb,billboard1,billboardthumb1 FROM members WHERE id=? FOR UPDATE', [target.memberId]);
        if (!member) throw new Error('This profile is unavailable.');
        const avatar = target.kind === 'avatar';
        if (!imageUrl || (avatar ? member.profile_image : member.billboard1) !== imageUrl)
          throw new Error('This profile image has changed. Reopen the launcher to remove the current image.');
        await query(avatar
          ? 'UPDATE members SET profile_image=?,profile_image_thumb=? WHERE id=?'
          : 'UPDATE members SET billboard1=?,billboardthumb1=? WHERE id=?', ['', '', target.memberId]);
        const oldImages = avatar ? [member.profile_image, member.profile_image_thumb] : [member.billboard1, member.billboardthumb1];
        for (const oldUrl of new Set(oldImages)) {
          if (managedProfileAsset(oldUrl)) await queueTemplateAssetCleanup(oldUrl, query);
        }
      });
      res.json({ memberId: Number(target.memberId), kind: target.kind, imageUrl: '', thumbnailUrl: '' });
      void drainTemplateAssetCleanup();
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Could not remove this profile image.' });
    }
  });
  const route = (apply: boolean) => async (req: Request, res: Response) => {
    res.set('Cache-Control', 'private, no-store');
    const ownerId = authenticatedOwnerId(req);
    if (!ownerId) { res.status(401).json({ message: 'Please sign in.' }); return; }
    try {
      const target = profileImageTarget(req.body, authenticatedUserId(req));
      const imageUrl = typeof req.body?.imageUrl === 'string' ? req.body.imageUrl : '';
      verifyProfileImageReceipt(req.body?.receipt, ownerId, target, imageUrl);
      if (apply) {
        await withTransaction(async query => {
          await query('SELECT id FROM templates4prompt WHERE title=? AND template_prompt=? FOR UPDATE', [TEMPLATE_ASSET_CLEANUP, JSON.stringify({ url: imageUrl })]);
          await assertStoredTemplateImage(imageUrl);
          const [member] = await query('SELECT profile_image,profile_image_thumb,billboard1,billboardthumb1 FROM members WHERE id=? FOR UPDATE', [target.memberId]);
          if (!member) throw new Error('This profile is unavailable.');
          const avatar = target.kind === 'avatar';
          await query(avatar
            ? 'UPDATE members SET profile_image=?,profile_image_thumb=? WHERE id=?'
            : 'UPDATE members SET billboard1=?,billboardthumb1=? WHERE id=?', [imageUrl, imageUrl, target.memberId]);
          const oldImages = avatar ? [member.profile_image, member.profile_image_thumb] : [member.billboard1, member.billboardthumb1];
          for (const oldUrl of new Set(oldImages)) {
            if (oldUrl !== imageUrl && managedProfileAsset(oldUrl)) await queueTemplateAssetCleanup(oldUrl, query);
          }
        });
        res.json({ memberId: Number(target.memberId), kind: target.kind, imageUrl, thumbnailUrl: imageUrl });
      } else {
        await queueTemplateAssetCleanup(imageUrl);
        res.json({ ok: true });
      }
      void drainTemplateAssetCleanup();
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Could not update this profile image.' });
    }
  };
  app.post('/profile-image/use', route(true));
  app.post('/profile-image/discard', route(false));
  app.post('/profile-image/upload', async (req: Request, res: Response) => {
    res.set('Cache-Control', 'private, no-store');
    const ownerId = authenticatedOwnerId(req);
    if (!ownerId) { res.status(401).json({ message: 'Please sign in.' }); return; }
    let imageUrl: string | undefined;
    try {
      const target = profileImageTarget(req.body, authenticatedUserId(req));
      const image = await validateProfileImageUpload(req.body?.imageBase64);
      imageUrl = (await storeNormalizedImage(image, `profile-image-${target.memberId}-${target.kind}`, true, async (url, upload) => {
        imageUrl = url;
        await queueTemplateAssetCleanup(url, undefined, 2 * 60 * 60);
        await upload();
      })).imageUrl;
      const profileImageReceipt = signProfileImageReceipt({ ...target, ownerId, imageUrl, quality: 'direct' });
      res.json({ imageUrl, profileImageReceipt });
    } catch (error) {
      if (imageUrl) await deleteCloudImageUrl(imageUrl).catch(() => {});
      res.status(400).json({ message: error instanceof Error ? error.message : 'Could not upload this profile image.' });
    }
  });
}
