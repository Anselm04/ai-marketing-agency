import autoPostingService from './autoPostingService.js';
import { generateAgentResponse } from './openaiService.js';

function metadataError(message) {
  const error = new Error(message);
  error.code = 'auto_post_metadata_generation_failed';
  error.statusCode = 503;
  return error;
}

export function parseAutoPostMetadata(content) {
  if (!content || typeof content !== 'string') return null;
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : content;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    const title = String(parsed.title || '').trim().slice(0, 100);
    const caption = String(parsed.caption || '').trim().slice(0, 1800);
    const hashtags = Array.isArray(parsed.hashtags)
      ? parsed.hashtags.map((tag) => String(tag).replace(/^#/, '').trim()).filter(Boolean).slice(0, 15)
      : [];
    if (!title || !caption) return null;
    return { title, caption, hashtags };
  } catch {
    return null;
  }
}

export function installAutoPostingTruthPatch(service = autoPostingService) {
  if (!service || service.__metadataTruthPatchApplied) return service;

  service.generateMetadata = async function generateVerifiedAutoPostMetadata(plan, selectedAssets) {
    const result = await generateAgentResponse(
      'social-media',
      [
        'Create metadata for one social video post from the supplied user-selected media.',
        'Return JSON only with title, caption, hashtags.',
        'Do not invent product claims or quotes.',
        'Keep the caption concise and vary the angle so recurring posts do not feel repetitive.',
        'Campaign brief: ' + (plan.campaignBrief || 'No additional brief supplied'),
        'Source media names: ' + selectedAssets.map((asset) => asset.originalName).join(', '),
        'Previous post count: ' + (Number(plan.completedPosts) || 0),
      ].join('\n'),
      { userId: plan.owner },
    );

    if (result?.fallback === true) {
      throw metadataError('Autonomous posting stopped because the AI provider did not complete metadata generation. Generic marketing copy was not substituted.');
    }
    const metadata = parseAutoPostMetadata(result?.content);
    if (!metadata) {
      throw metadataError('Autonomous posting stopped because the AI provider returned invalid metadata. Nothing was published.');
    }
    return metadata;
  };

  Object.defineProperty(service, '__metadataTruthPatchApplied', {
    value: true,
    enumerable: false,
  });
  return service;
}

export default installAutoPostingTruthPatch;
