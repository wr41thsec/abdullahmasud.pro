/**
 * Every card on the arc lives here. Adding a business, product, idea or
 * quote means appending one object to `cards` — no component changes.
 *
 * Cards are polymorphic: a card with `media` renders that media, a card
 * with `quote` renders as type, and a card with neither falls back to its
 * `tint` gradient. That means art can be added later, one card at a time,
 * without touching any code.
 */

export type CardKind = 'business' | 'product' | 'idea' | 'quote' | 'contact';

export interface CardMedia {
  type: 'video' | 'image';
  /** Path under /media — e.g. '/media/orbit.mp4' */
  src: string;
  /** First-frame still. Always supply one for video: it's what shows
      before the clip loads and on connections that never load it. */
  poster?: string;
  /** Describe the content for screen readers. Empty string if purely
      decorative and the title already says everything. */
  alt?: string;
}

export interface CardDetail {
  body: string;
  meta?: { label: string; value: string }[];
  links?: { label: string; href: string }[];
}

export interface SocialLink {
  label: string;
  handle: string;
  href: string;
}

export interface Card {
  id: string;
  kind: CardKind;
  title: string;
  subtitle?: string;
  media?: CardMedia;
  /** Two-stop gradient used when there's no media yet. */
  tint: [string, string];
  /** Set when kind is 'quote'. */
  quote?: { text: string; attribution?: string };
  /** Set when kind is 'contact'. */
  contact?: { email: string; socials: SocialLink[] };
  detail?: CardDetail;
}

/**
 * PLACEHOLDER CONTENT — replace the copy, keep the shape.
 * The tints are drawn from the reference palette so the arc reads as a
 * deliberate set rather than a set of empty slots.
 */
export const cards: Card[] = [
  {
    id: 'venture-one',
    kind: 'business',
    title: 'Venture One',
    subtitle: 'Founded 2021',
    tint: ['#1d9bb8', '#e8622a'],
    detail: {
      body: 'Replace this with what the business does, who it serves, and what stage it is at. Two or three sentences is the right length — the arc is a doorway, not a case study.',
      meta: [
        { label: 'Role', value: 'Founder' },
        { label: 'Year', value: '2021' },
      ],
      links: [{ label: 'Visit site', href: 'https://example.com' }],
    },
  },
  {
    id: 'venture-two',
    kind: 'business',
    title: 'Venture Two',
    subtitle: 'Operating',
    tint: ['#16362a', '#3f7d5f'],
    detail: {
      body: 'A second business. Same shape as the first — swap the copy and the tint, or drop in a clip once you have one.',
      meta: [
        { label: 'Role', value: 'Co-founder' },
        { label: 'Year', value: '2022' },
      ],
    },
  },
  {
    id: 'product-one',
    kind: 'product',
    title: 'Product One',
    subtitle: 'Shipped',
    tint: ['#efe7dc', '#cbb9a4'],
    detail: {
      body: 'What the product is and who it is for. This is the card most likely to earn a video later — products demo well in three seconds.',
      meta: [{ label: 'Status', value: 'Live' }],
    },
  },
  {
    id: 'product-two',
    kind: 'product',
    title: 'Product Two',
    subtitle: 'In build',
    tint: ['#1a1410', '#c9821f'],
    detail: {
      body: 'Something still in progress. Saying so is a feature — in-flight work reads as momentum.',
      meta: [{ label: 'Status', value: 'Building' }],
    },
  },
  {
    id: 'idea-one',
    kind: 'idea',
    title: 'An Idea Worth Building',
    subtitle: 'Thinking out loud',
    tint: ['#cfd8bd', '#8fa06a'],
    detail: {
      body: 'Ideas cards are for the things you have not built yet but keep coming back to. They tell a visitor how you think, which is often more persuasive than what you have finished.',
    },
  },
  {
    id: 'idea-two',
    kind: 'idea',
    title: 'A Second Thesis',
    subtitle: 'Notes',
    tint: ['#1e2a44', '#5878a8'],
    detail: {
      body: 'Another open question. Keep these short and specific; a vague idea card reads as filler, a sharp one reads as a point of view.',
    },
  },
  {
    id: 'quote-one',
    kind: 'quote',
    title: 'On building',
    tint: ['#f0dcd0', '#c96f4a'],
    quote: {
      text: 'Replace this with something you actually believe. A quote in your own words beats a famous one.',
    },
    detail: {
      body: 'Quote cards can carry a little more context in the panel — where the thought came from, or what it changed about how you work.',
    },
  },
  {
    id: 'quote-two',
    kind: 'quote',
    title: 'On persistence',
    tint: ['#2b2b30', '#6b6b75'],
    quote: {
      text: 'A second short line. Keep quotes under about twenty words so they stay readable at card size.',
    },
  },
  {
    id: 'idea-three',
    kind: 'idea',
    title: 'What I Am Looking For',
    subtitle: 'Open to talk',
    tint: ['#3a1a5e', '#8e43e7'],
    detail: {
      body: 'A good final card before contact: name the kind of person, problem or partnership you want to hear about. It turns a portfolio into an invitation.',
    },
  },
  {
    id: 'contact',
    kind: 'contact',
    title: 'Get in touch',
    tint: ['#0f0f12', '#3a3a44'],
    contact: {
      // PLACEHOLDER — swap for the address you actually want public.
      email: 'hello@abdullahmasud.pro',
      socials: [
        { label: 'X', handle: '@phsycrow', href: 'https://x.com/phsycrow' },
        { label: 'GitHub', handle: '@wr41thsec', href: 'https://github.com/wr41thsec' },
      ],
    },
    detail: {
      body: 'The fastest way to reach me.',
    },
  },
];

/** Degrees of arc between adjacent cards. Measured from the reference. */
export const ARC_STEP = 7.2;

/** Seconds for the ring to advance by one card. Measured from the reference. */
export const SECONDS_PER_CARD = 2.0;
