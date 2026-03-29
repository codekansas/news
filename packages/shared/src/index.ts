export type RuntimeConfig = {
  apiBaseUrl: string;
  pushPublicKey: string;
  region: string;
  userPoolId: string;
  userPoolClientId: string;
};

export type FeedSource = {
  key: string;
  title: string;
  url: string;
  category: 'hacker-news' | 'rationalist' | 'tech-blog';
  autoTitle?: boolean;
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
  publishedAt: string;
  storyText: string | null;
  summary: string | null;
  commentCount: number;
  rankingScore: number;
};

export type StorySummary = Omit<Story, 'storyText' | 'summary'>;

export type StoryFeedMode = 'front' | 'past';

export type StoryFeedPage = {
  stories: StorySummary[];
  nextCursor: string | null;
  selectedDay: string | null;
};

export type SearchStoriesPage = {
  query: string;
  stories: StorySummary[];
  total: number;
  hasMore: boolean;
};

export type StoryListPage = {
  stories: StorySummary[];
  hasMore: boolean;
};

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

export type RecentCommentSummary = Pick<
  CommentRecord,
  'authorName' | 'commentId' | 'createdAt' | 'parentId' | 'storyId' | 'text'
> & {
  storyTitle: string;
};

export type RecentCommentsPage = {
  comments: RecentCommentSummary[];
  hasMore: boolean;
};

export type NotificationType = 'comment_reply';

export type NotificationRecord = {
  userId: string;
  notificationId: string;
  type: NotificationType;
  createdAt: string;
  isRead: boolean;
  readAt: string | null;
  actorUserId: string;
  actorUsername: string;
  storyId: string;
  storyTitle: string;
  parentCommentId: string;
  replyCommentId: string;
  excerpt: string;
};

export type MailboxNotification = Omit<NotificationRecord, 'userId'> & {
  url: string;
};

export type NotificationsPage = {
  notifications: MailboxNotification[];
  unreadCount: number;
};

export type FavoriteRecord = {
  userId: string;
  storyId: string;
  createdAt: string;
};

export type FavoriteStatusResponse = {
  isFavorite: boolean;
};

export type PushSubscriptionInput = {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    auth: string;
    p256dh: string;
  };
};

export type UserPreferenceSetting = 'yes' | 'no';

export type UserProfile = {
  userId: string;
  username: string;
  email: string;
  createdAt: string;
  name: string;
  bio: string;
  about: string;
  showdead: UserPreferenceSetting;
  noprocrast: UserPreferenceSetting;
  maxvisit: number;
  minaway: number;
  topcolor: string;
  delay: number;
  karma: number;
};

export type UpdateUserProfileInput = Pick<
  UserProfile,
  | 'username'
  | 'name'
  | 'about'
  | 'email'
  | 'showdead'
  | 'noprocrast'
  | 'maxvisit'
  | 'minaway'
  | 'topcolor'
  | 'delay'
>;

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

const baseFeedSources: FeedSource[] = [
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

const gistFeedUrls = [
  'https://antirez.com/rss',
  'https://aphyr.com/posts.atom',
  'https://arstechnica.com/science/feed/',
  'https://avc.com/feed/',
  'https://backreaction.blogspot.com/feeds/posts/default?alt=rss',
  'https://ben.bolte.cc/feed.xml',
  'https://blog.cloudflare.com/rss/',
  'https://blog.miguelgrinberg.com/feed',
  'https://blog.pragmaticengineer.com/feed',
  'https://blog.ycombinator.com/feed/',
  'https://buttondown.com/hillelwayne/rss',
  'https://ciechanow.ski/atom.xml',
  'https://danluu.com/atom.xml',
  'https://daringfireball.net/feeds/main',
  'https://dynomight.net/feed.xml',
  'https://eli.thegreenplace.net/feeds/all.atom.xml',
  'https://ericmigi.com/rss.xml',
  'https://evjang.com/feed.xml',
  'https://fabiensanglard.net/rss.xml',
  'https://github.blog/feed/',
  'https://go.dev/blog/feed.atom',
  'https://hacks.mozilla.org/feed/',
  'https://idiallo.com/feed.rss',
  'https://jvns.ca/atom.xml',
  'https://krebsonsecurity.com/feed/',
  'https://longform.asmartbear.com/index.xml',
  'https://lucumr.pocoo.org/feed.xml',
  'https://martinfowler.com/feed.atom',
  'https://matklad.github.io/feed.xml',
  'https://mitchellh.com/feed.xml',
  'https://mtlynch.io/posts/index.xml',
  'https://nullprogram.com/feed/',
  'https://overreacted.io/rss.xml',
  'https://rakhim.exotext.com/rss.xml',
  'https://research.swtch.com/feed.atom',
  'https://rss.arxiv.org/rss/chem-ph',
  'https://rss.arxiv.org/rss/cs.AI',
  'https://rss.arxiv.org/rss/cs.CL',
  'https://rss.arxiv.org/rss/cs.CR',
  'https://rss.arxiv.org/rss/cs.CV',
  'https://rss.arxiv.org/rss/cs.DC',
  'https://rss.arxiv.org/rss/cs.DS',
  'https://rss.arxiv.org/rss/cs.IR',
  'https://rss.arxiv.org/rss/cs.LG',
  'https://rss.arxiv.org/rss/cs.NE',
  'https://rss.arxiv.org/rss/cs.PL',
  'https://rss.arxiv.org/rss/cs.RO',
  'https://rss.arxiv.org/rss/eess',
  'https://rss.arxiv.org/rss/physics',
  'https://rss.arxiv.org/rss/q-bio',
  'https://rss.arxiv.org/rss/stat.ML',
  'https://simonwillison.net/atom/everything/',
  'https://slatestarcodex.com/feed/',
  'https://spectrum.ieee.org/rss/biomedical/fulltext',
  'https://spectrum.ieee.org/rss/robotics/fulltext',
  'https://spectrum.ieee.org/rss/semiconductors/fulltext',
  'https://steveblank.com/feed/',
  'https://stripe.com/blog/feed.rss',
  'https://tailscale.com/blog/index.xml',
  'https://thegradient.pub/rss/',
  'https://tonsky.me/atom.xml',
  'https://writings.stephenwolfram.com/feed/',
  'https://www.astralcodexten.com/feed',
  'https://www.construction-physics.com/feed',
  'https://www.hillelwayne.com/index.xml',
  'https://www.jeffgeerling.com/blog.xml',
  'https://www.johndcook.com/blog/feed/',
  'https://www.lesswrong.com/feed.xml',
  'https://www.overcomingbias.com/feed/',
  'https://www.righto.com/feeds/posts/default?alt=rss',
  'https://www.science.org/action/showFeed?jc=science&type=etoc&feed=rss',
  'https://www.sciencedaily.com/rss/computers_math.xml',
  'https://www.sciencedaily.com/rss/matter_energy/chemistry.xml',
  'https://www.sciencedaily.com/rss/matter_energy/physics.xml',
  'https://www.sciencedaily.com/rss/plants_animals/biology.xml',
  'https://www.seangoedecke.com/feed.xml',
  'https://www.tbray.org/ongoing/ongoing.atom',
  'https://www.troyhunt.com/rss/',
  'https://xeiaso.net/blog.rss',
] as const;

const rationalistFeedHosts = new Set([
  'astralcodexten.com',
  'lesswrong.com',
  'overcomingbias.com',
  'slatestarcodex.com',
]);

const hackerNewsFeedUrls = new Set([
  'http://www.aaronsw.com/2002/feeds/pgessays.rss',
  'https://blog.ycombinator.com/feed/',
  'https://hnrss.org/frontpage',
]);

const toTitleCase = (value: string) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) =>
      part.length <= 3 ? part.toUpperCase() : `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`,
    )
    .join(' ');

const normalizeFeedLabelPart = (value: string) =>
  value
    .replace(/\.(atom|feed|rss|xml)$/i, '')
    .replace(/[-_.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const buildFeedKey = (url: string) => {
  const parsed = new URL(url);
  const hostPart = parsed.hostname
    .replace(/^www\./, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .toLowerCase();
  const pathPart = `${parsed.pathname}${parsed.search}`
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 36);
  const suffix = hashString(url).toString(36).slice(0, 6);

  return [hostPart, pathPart, suffix].filter(Boolean).join('-');
};

const buildFeedTitleFallback = (url: string) => {
  const parsed = new URL(url);
  const hostname = parsed.hostname.replace(/^www\./, '');
  const pathSegments = parsed.pathname.split('/').filter(Boolean);
  const lastSegment = normalizeFeedLabelPart(pathSegments.at(-1) ?? '');

  if (hostname === 'rss.arxiv.org') {
    return `arXiv ${lastSegment || 'Feed'}`;
  }

  if (hostname === 'spectrum.ieee.org') {
    return `IEEE Spectrum ${toTitleCase(lastSegment || 'Feed')}`;
  }

  if (hostname === 'sciencedaily.com' || hostname === 'www.sciencedaily.com') {
    return `ScienceDaily ${toTitleCase(lastSegment || 'Feed')}`;
  }

  const hostLabel = normalizeFeedLabelPart(hostname.replace(/\.[^.]+$/, ''));
  const suffixLabel =
    lastSegment && !['atom', 'feed', 'index', 'main', 'rss'].includes(lastSegment.toLowerCase())
      ? ` ${toTitleCase(lastSegment)}`
      : '';

  return `${toTitleCase(hostLabel)}${suffixLabel}`.trim();
};

const inferFeedCategory = (url: string): FeedSource['category'] => {
  const parsed = new URL(url);
  const hostname = parsed.hostname.replace(/^www\./, '');

  if (hackerNewsFeedUrls.has(url)) {
    return 'hacker-news';
  }

  if (rationalistFeedHosts.has(hostname)) {
    return 'rationalist';
  }

  return 'tech-blog';
};

const buildGeneratedFeedSource = (url: string): FeedSource => ({
  key: buildFeedKey(url),
  title: buildFeedTitleFallback(url),
  url,
  category: inferFeedCategory(url),
  autoTitle: true,
});

const baseFeedUrls = new Set(baseFeedSources.map((source) => source.url));

export const FEED_SOURCES: FeedSource[] = [
  ...baseFeedSources,
  ...gistFeedUrls.filter((url) => !baseFeedUrls.has(url)).map(buildGeneratedFeedSource),
];

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
