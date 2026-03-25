export type RuntimeConfig = {
  apiBaseUrl: string;
  region: string;
  userPoolId: string;
  userPoolClientId: string;
};

export type FeedSource = {
  key: string;
  title: string;
  url: string;
  category: 'hacker-news' | 'rationalist' | 'tech-blog';
};

export type Story = {
  id: string;
  title: string;
  url: string;
  siteLabel: string;
  siteUrl: string;
  sourceKey: string;
  sourceTitle: string;
  sourceCategory: FeedSource['category'];
  submittedBy: string;
  points: number;
  publishedAt: string;
  storyText: string | null;
  summary: string | null;
  commentCount: number;
  rankingScore: number;
};

export type StorySummary = Omit<Story, 'storyText' | 'summary'>;

export type CommentRecord = {
  storyId: string;
  commentId: string;
  parentId: string | null;
  path: string;
  depth: number;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
};

export type CommentTreeNode = CommentRecord & {
  children: CommentTreeNode[];
};

export type UserProfile = {
  userId: string;
  username: string;
  email: string;
  createdAt: string;
};

export const FEED_SOURCES: FeedSource[] = [
  {
    key: 'hn-frontpage',
    title: 'Hacker News Front Page',
    url: 'https://hnrss.org/frontpage',
    category: 'hacker-news',
  },
  {
    key: 'lesswrong',
    title: 'LessWrong',
    url: 'https://www.lesswrong.com/feed.xml?view=curated-rss',
    category: 'rationalist',
  },
  {
    key: 'astral-codex-ten',
    title: 'Astral Codex Ten',
    url: 'https://www.astralcodexten.com/feed',
    category: 'rationalist',
  },
  {
    key: 'paul-graham',
    title: 'Paul Graham',
    url: 'http://www.aaronsw.com/2002/feeds/pgessays.rss',
    category: 'hacker-news',
  },
  {
    key: 'stripe',
    title: 'Stripe Engineering',
    url: 'https://stripe.com/blog/feed.rss',
    category: 'tech-blog',
  },
  {
    key: 'cloudflare',
    title: 'Cloudflare Blog',
    url: 'https://blog.cloudflare.com/rss/',
    category: 'tech-blog',
  },
  {
    key: 'openai',
    title: 'OpenAI',
    url: 'https://openai.com/news/rss.xml',
    category: 'tech-blog',
  },
  {
    key: 'aws-news',
    title: 'AWS News Blog',
    url: 'https://aws.amazon.com/blogs/aws/feed/',
    category: 'tech-blog',
  },
];

const submitterAdjectives = [
  'latent',
  'turing',
  'vector',
  'quine',
  'orange',
  'kernel',
  'monoid',
  'trace',
  'lambda',
  'sable',
  'graph',
  'logic',
  'theory',
  'cortex',
];

const submitterNouns = [
  'array',
  'owl',
  'forge',
  'node',
  'pilot',
  'sparrow',
  'index',
  'atlas',
  'field',
  'quartz',
  'lemma',
  'byte',
  'circuit',
  'relay',
];

export const hashString = (value: string): number => {
  let hash = 2166136261;

  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

export const mulberry32 = (seed: number): (() => number) => {
  let current = seed;

  return () => {
    current |= 0;
    current = (current + 0x6d2b79f5) | 0;
    let result = Math.imul(current ^ (current >>> 15), 1 | current);
    result ^= result + Math.imul(result ^ (result >>> 7), 61 | result);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
};

export const pickRandomSubmitter = (seedInput: string): string => {
  const random = mulberry32(hashString(seedInput));
  const adjective = submitterAdjectives[Math.floor(random() * submitterAdjectives.length)];
  const noun = submitterNouns[Math.floor(random() * submitterNouns.length)];
  const suffix = Math.floor(random() * 90 + 10);
  return `${adjective}${noun}${suffix}`;
};

export const pickRandomPoints = (seedInput: string): number => {
  const random = mulberry32(hashString(`${seedInput}:points`));
  return Math.floor(random() * 480) + 20;
};

export const buildStoryId = (sourceKey: string, canonicalUrl: string): string =>
  `${sourceKey}_${hashString(canonicalUrl).toString(16)}`;

export const buildSiteLabel = (url: string): { siteLabel: string; siteUrl: string } => {
  const parsed = new URL(url);
  const hostname = parsed.hostname.replace(/^www\./, '');
  return {
    siteLabel: hostname,
    siteUrl: `${parsed.protocol}//${parsed.host}`,
  };
};

export const stripHtml = (value: string): string =>
  value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const buildCommentTree = (comments: CommentRecord[]): CommentTreeNode[] => {
  const nodes = comments
    .slice()
    .sort((left, right) => left.path.localeCompare(right.path))
    .map<CommentTreeNode>((comment) => ({ ...comment, children: [] }));

  const nodeById = new Map(nodes.map((node) => [node.commentId, node]));
  const roots: CommentTreeNode[] = [];

  for (const node of nodes) {
    if (!node.parentId) {
      roots.push(node);
      continue;
    }

    const parent = nodeById.get(node.parentId);
    if (!parent) {
      roots.push(node);
      continue;
    }

    parent.children.push(node);
  }

  return roots;
};
