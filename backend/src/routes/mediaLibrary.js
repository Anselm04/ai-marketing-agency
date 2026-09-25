import express from 'express';
import store from '../utils/store.js';
import { uploadMemory } from '../middleware/upload.js';
import { isS3Configured, uploadPrivateToS3, getPrivateSignedDownloadUrl } from '../services/uploadService.js';
import mediaComposerService from '../services/mediaComposerService.js';

const router = express.Router();

function ownerId(req) {
  return req.user?.id || req.userId;
}

function mediaType(mimetype = '') {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  return 'other';
}

router.get('/', async (req, res) => {
  const owner = ownerId(req);
  const records = (await store.getContentByOwner(owner))
    .filter((item) => ['media_asset', 'generated_video'].includes(item.kind))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const assets = await Promise.all(records.map(async (item) => {
    if (item.kind === 'media_asset' && item.storageKey) {
      return {
        ...item,
        url: await getPrivateSignedDownloadUrl(item.storageKey, 15 * 60),
        urlExpiresInSeconds: 15 * 60,
      };
    }
    return item;
  }));
  res.json({ assets });
});

router.post('/upload', uploadMemory.array('files', 20), async (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'Choose at least one photo or video' });
  if (!isS3Configured()) return res.status(503).json({ error: 'Durable S3-compatible storage is required for the media library' });

  const owner = ownerId(req);
  const created = [];

  for (const file of req.files) {
    const type = mediaType(file.mimetype);
    if (!['image', 'video'].includes(type)) continue;

    const safeName = String(file.originalname || 'media')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .slice(-120);
    const key = `media-library/${owner}/${Date.now()}-${store._id()}-${safeName}`;
    await uploadPrivateToS3(key, file.buffer, file.mimetype);

    const item = await store.createContent({
      kind: 'media_asset',
      owner,
      mediaType: type,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url: null,
      storageKey: key,
      storageVisibility: 'private',
      source: 'user_album_picker',
      createdAt: new Date().toISOString(),
    });
    created.push(item);
  }

  if (!created.length) return res.status(400).json({ error: 'No supported photo or video files were selected' });
  res.status(201).json({ assets: created });
});

router.post('/compose', async (req, res) => {
  const owner = ownerId(req);
  const assetIds = Array.isArray(req.body?.assetIds) ? req.body.assetIds.map(String) : [];
  if (!assetIds.length) return res.status(400).json({ error: 'assetIds must be a non-empty array' });

  const all = await store.getContentByOwner(owner);
  const assets = assetIds
    .map((id) => all.find((item) => String(item.id) === id && item.owner === owner && item.kind === 'media_asset'))
    .filter(Boolean);

  if (assets.length !== assetIds.length) {
    return res.status(404).json({ error: 'One or more selected media assets were not found' });
  }

  try {
    const output = await mediaComposerService.compose({
      ownerId: owner,
      assets,
      aspectRatio: req.body?.aspectRatio || '9:16',
      secondsPerImage: req.body?.secondsPerImage,
      maxVideoSeconds: req.body?.maxVideoSeconds,
    });

    const generated = await store.createContent({
      kind: 'generated_video',
      owner,
      mediaType: 'video',
      originalName: 'TrillionAI-generated-video.mp4',
      mimetype: output.mimetype,
      size: output.size,
      url: output.url,
      storageKey: output.key,
      aspectRatio: output.aspectRatio,
      sourceAssetIds: output.sourceAssetIds,
      source: 'media_composer',
      createdAt: output.generatedAt,
    });

    res.status(201).json({ video: generated });
  } catch (error) {
    res.status(422).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  const owner = ownerId(req);
  const asset = (await store.getContentByOwner(owner)).find(
    (item) => String(item.id) === String(req.params.id)
      && item.owner === owner
      && ['media_asset', 'generated_video'].includes(item.kind),
  );
  if (!asset) return res.status(404).json({ error: 'Media asset not found' });

  await store.deleteContent(asset.id);
  res.json({ success: true });
});

export default router;
