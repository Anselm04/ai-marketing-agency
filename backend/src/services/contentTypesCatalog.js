/** Per-network content types for organic social (ported from PR #23). */

export const CONTENT_TYPES = {
  youtube: [
    { id: 'short', name: 'YouTube Short caption', hint: 'Hook + on-screen line, under 100 chars' },
    { id: 'community_post', name: 'Community post', hint: 'Conversation, not a dump of the same caption' },
    { id: 'video_description', name: 'Video description', hint: 'Search-friendly chapters and CTA' },
  ],
  tiktok: [
    { id: 'hook_caption', name: 'Hook caption', hint: 'First line must earn the watch' },
    { id: 'story', name: 'Story frame', hint: 'Ephemeral, casual' },
    { id: 'duet_prompt', name: 'Duet / stitch prompt', hint: 'Invite a reply, do not spam sounds' },
  ],
  instagram: [
    { id: 'reel_caption', name: 'Reel caption', hint: 'Visual, save-this CTA' },
    { id: 'carousel', name: 'Carousel copy', hint: 'Slide 1 hook, last slide CTA' },
    { id: 'story', name: 'Story sticker copy', hint: 'One idea, one sticker' },
    { id: 'feed_post', name: 'Feed post', hint: 'Caption-first, no identical blast' },
  ],
  facebook: [
    { id: 'page_post', name: 'Page post', hint: 'Story-led, community' },
    { id: 'group_value_post', name: 'Group value post', hint: 'Help first, no wall blast' },
    { id: 'event_blurb', name: 'Event blurb', hint: 'When / why / who it is for' },
  ],
  linkedin: [
    { id: 'thought_leadership', name: 'Thought-leadership note', hint: 'Insight, no hype' },
    { id: 'carousel_text', name: 'Carousel text', hint: 'One claim per slide' },
    { id: 'hiring_note', name: 'Hiring / maker note', hint: 'Professional, specific' },
  ],
  x: [
    { id: 'single_post', name: 'Single post', hint: 'Punchy, under 270' },
    { id: 'thread_opener', name: 'Thread opener', hint: 'Earn the next post' },
    { id: 'reply_cta', name: 'Reply CTA', hint: 'Ask a real question' },
  ],
  reddit: [
    { id: 'value_post', name: 'Value post', hint: 'Title is not an ad. Body teaches.' },
    { id: 'ama_intro', name: 'AMA intro', hint: 'Disclose who you are' },
    { id: 'comment_reply', name: 'Helpful comment', hint: 'Answer the thread, do not dump a link' },
  ],
  pinterest: [
    { id: 'idea_pin', name: 'Idea pin text', hint: 'Searchable, descriptive' },
    { id: 'product_pin', name: 'Product pin', hint: 'Alt text + who it is for' },
  ],
  threads: [
    { id: 'conversation_starter', name: 'Conversation starter', hint: 'Casual, short paragraphs' },
    { id: 'follow_up', name: 'Follow_up', hint: 'Reply energy, not a recap blast' },
  ],
  snapchat: [
    { id: 'story_frame', name: 'Story frame', hint: 'Friend-to-friend, ephemeral' },
    { id: 'spotlight_caption', name: 'Spotlight caption', hint: 'Short, native' },
  ],
  github: [
    { id: 'readme_ship_log', name: 'README ship log', hint: 'Technical, no growth-hack' },
    { id: 'release_notes', name: 'Release notes', hint: 'What changed, what did not' },
    { id: 'discussion', name: 'Discussion post', hint: 'Ask builders, do not spam Issues' },
  ],
  producthunt: [
    { id: 'launch_tagline', name: 'Launch tagline', hint: 'Maker energy, first-comment ready' },
    { id: 'first_comment', name: 'Maker first comment', hint: 'What it does not do' },
    { id: 'maker_update', name: 'Maker update', hint: 'Ship note, not a paid slot' },
  ],
  indiehackers: [
    { id: 'milestone_post', name: 'Milestone post', hint: 'Honest numbers, no fake ROAS' },
    { id: 'build_log', name: 'Build log', hint: 'What you shipped this week' },
  ],
  hackernews: [
    { id: 'show_hn', name: 'Show HN title', hint: 'Factual. No marketing-speak.' },
    { id: 'comment', name: 'HN comment', hint: 'Answer the question asked' },
  ],
  dev: [
    { id: 'dev_article_opener', name: 'DEV article opener', hint: 'Tutorial energy, useful first' },
    { id: 'til_post', name: 'TIL post', hint: 'One lesson, no dump' },
  ],
  hashnode: [
    { id: 'blog_opener', name: 'Blog opener', hint: 'Practical, community-first' },
    { id: 'newsletter_blurb', name: 'Newsletter blurb', hint: 'One idea, one CTA' },
  ],
  replit: [
    { id: 'repl_readme', name: 'Repl README', hint: 'Remixable, how to run' },
    { id: 'template_pitch', name: 'Template pitch', hint: 'What a builder gets' },
  ],
  discord: [
    { id: 'announcement', name: 'Channel announcement', hint: 'Use the right channel, no DM blast' },
    { id: 'helpful_thread', name: 'Helpful thread', hint: 'Answer, then optional link' },
  ],
  telegram: [
    { id: 'channel_update', name: 'Channel update', hint: 'Concise, link-first' },
    { id: 'pin_message', name: 'Pin message', hint: 'One fact they should keep' },
  ],
  whatsapp: [
    { id: 'opt_in_broadcast', name: 'Opt-in broadcast', hint: 'Only if they asked' },
    { id: 'one_to_one_followup', name: 'One-to-one follow-up', hint: 'Personal, permission-based' },
  ],
};

export default CONTENT_TYPES;
