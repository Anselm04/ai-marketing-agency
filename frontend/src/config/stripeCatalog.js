// Public Stripe catalog for TrillionAI Marketing.
// amount is in cents (USD). Display dollars with amount / 100.
// Price IDs and buy.stripe.com payment links are public. No secrets.

export const CATALOG = {
  plans: [
    {
      id: 'starter',
      name: 'Starter',
      lookup_key: 'marketing_starter_monthly',
      priceId: 'price_1UB3YfKFfiU4ONpqJ3oZyeSc',
      amount: 14900,
      currency: 'usd',
      interval: 'month',
      credits: null,
      paymentLink: 'https://buy.stripe.com/fZucN6ca51oe3ejaClao807',
      features: { agents: 3, campaigns: 2, postsPerDay: 10, teamSeats: 1 },
    },
    {
      id: 'growth',
      name: 'Growth',
      lookup_key: 'marketing_growth_monthly',
      priceId: 'price_1UB3YgKFfiU4ONpq0GFVZV6I',
      amount: 39900,
      currency: 'usd',
      interval: 'month',
      credits: null,
      paymentLink: 'https://buy.stripe.com/eVqeVegql1oe027dOxao808',
      features: { agents: 8, campaigns: 10, postsPerDay: 50, teamSeats: 3 },
    },
    {
      id: 'agency',
      name: 'Agency',
      lookup_key: 'marketing_agency_monthly',
      priceId: 'price_1UB3YiKFfiU4ONpqfHY5KTgd',
      amount: 99900,
      currency: 'usd',
      interval: 'month',
      credits: null,
      paymentLink: 'https://buy.stripe.com/00wcN6gqlaYO5mrbGpao809',
      features: { agents: 14, campaigns: 25, postsPerDay: 100, teamSeats: 10 },
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      lookup_key: 'marketing_enterprise_monthly',
      priceId: 'price_1UB3YkKFfiU4ONpqcAVcHfGQ',
      amount: 249900,
      currency: 'usd',
      interval: 'month',
      credits: null,
      paymentLink: 'https://buy.stripe.com/00wdRafmhd6Wg15bGpao80a',
      features: { agents: 50, campaigns: 100, postsPerDay: 500, teamSeats: 25 },
    },
  ],
  credits: [
    {
      id: 'credits_100',
      name: '100 credits',
      lookup_key: 'marketing_credits_100',
      priceId: 'price_1UB3YmKFfiU4ONpqNO8DGn4i',
      amount: 7900,
      currency: 'usd',
      interval: null,
      credits: 100,
      paymentLink: 'https://buy.stripe.com/28E4gA7TPeb0bKPh0Jao80b',
    },
    {
      id: 'credits_300',
      name: '300 credits',
      lookup_key: 'marketing_credits_300',
      priceId: 'price_1UB3YoKFfiU4ONpqfinLmIwy',
      amount: 19900,
      currency: 'usd',
      interval: null,
      credits: 300,
      paymentLink: 'https://buy.stripe.com/14AdRa7TPgj83ej9yhao80c',
    },
    {
      id: 'credits_750',
      name: '750 credits',
      lookup_key: 'marketing_credits_750',
      priceId: 'price_1UB3YqKFfiU4ONpq9DQaEKyr',
      amount: 44900,
      currency: 'usd',
      interval: null,
      credits: 750,
      paymentLink: 'https://buy.stripe.com/00wdRaeid1oebKP8udao80d',
    },
  ],
};

export const PLANS = CATALOG.plans;
export const CREDITS = CATALOG.credits;
