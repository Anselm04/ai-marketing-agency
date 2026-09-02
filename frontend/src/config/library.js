const APPFORGE = 'https://appforge-unfurling-moon-9058.fly.dev'

export const APPFORGE_URL = APPFORGE
export const BRAND_URL = 'https://trillionaitech.com'

export const LIBRARY = [
  {
    kind: 'App',
    name: 'Quick Tasks',
    blurb: 'Add tasks, mark them done. Saved on this device.',
    price: 9,
    open: `${APPFORGE}/apps/2`,
    subscribe: 'https://buy.stripe.com/3cIbJ25LH4Aq8yD11Lao80e',
  },
  {
    kind: 'Game',
    name: 'Orb Catch',
    blurb: 'Move with the pointer. Collect 5 orbs to finish a round.',
    price: 5,
    open: `${APPFORGE}/apps/3`,
    subscribe: 'https://buy.stripe.com/cNi14o8XT2sig15eSBao80f',
  },
  {
    kind: 'Agent',
    name: 'Brief Agent',
    blurb: 'Ask a question. The agent replies from a product brief in your browser.',
    price: 15,
    open: `${APPFORGE}/apps/4`,
    subscribe: 'https://buy.stripe.com/7sY6oIca51oe3ej25Pao80g',
  },
  {
    kind: 'Tool',
    name: 'CaseCount',
    blurb: 'Paste text. Counts update live. Convert case with one click.',
    price: 5,
    open: `${APPFORGE}/apps/5`,
    subscribe: 'https://buy.stripe.com/eVq6oI4HD8QGcOT6m5ao80h',
  },
  {
    kind: 'Software',
    name: 'Quick Notes',
    blurb: 'Create a note, save it, open it again. Local-only software workspace.',
    price: 9,
    open: `${APPFORGE}/apps/6`,
    subscribe: 'https://buy.stripe.com/fZucN60rn2sidSXaClao80i',
  },
  {
    kind: 'Website',
    name: 'Northstar Waitlist',
    blurb: 'A marketing landing site. Join the waitlist with your work email.',
    price: 12,
    open: `${APPFORGE}/apps/7`,
    subscribe: 'https://buy.stripe.com/7sYbJ2fmhaYOdSX39Tao80j',
  },
]

export const libraryByKind = (kind) => LIBRARY.filter((item) => item.kind === kind)
