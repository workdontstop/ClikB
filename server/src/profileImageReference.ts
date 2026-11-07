import { withTransaction } from './execQuery';
import { assertStoredTemplateImage, storeNormalizedImage, deleteCloudImageUrl } from './S3Routes';
import { queueTemplateAssetCleanup, drainTemplateAssetCleanup, TEMPLATE_ASSET_CLEANUP } from './templateAssetCleanup';
import type { ProfileImageTarget } from './profileImageReceipt';

/** Give the provider its own input copy. Closing the editor may discard the
 * visible preview while this request is still running. */
export async function prepareProfileImageReference(target: ProfileImageTarget, sourceUrl: string) {
  let imageUrl: string | undefined;
  try {
    imageUrl = (await storeNormalizedImage(sourceUrl, `profile-image-ref-${target.memberId}-${target.kind}`, true, async (url, upload) => {
      imageUrl = url;
      // Commit this before the copy transaction: a crash after S3 COPY must not
      // roll back the only cleanup record for the provider's input.
      await queueTemplateAssetCleanup(url, undefined, 2 * 60 * 60);
      await withTransaction(async query => {
        await query('SELECT id FROM templates4prompt WHERE title=? AND template_prompt=? FOR UPDATE',
          [TEMPLATE_ASSET_CLEANUP, JSON.stringify({ url: sourceUrl })]);
        await assertStoredTemplateImage(sourceUrl);
        await upload();
      });
    })).imageUrl;
    const url = imageUrl!;
    return { imageUrl: url, release: async () => {
      await queueTemplateAssetCleanup(url);
      void drainTemplateAssetCleanup();
    } };
  } catch (error) {
    if (imageUrl) await deleteCloudImageUrl(imageUrl).catch(() => {});
    throw error;
  }
}
