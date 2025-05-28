// pages/api/webhooks/stripe.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { buffer } from 'micro';
import Stripe from 'stripe';
import { stripe } from '../../../lib/stripe';
import { db } from '../../../lib/db';
import { users } from '../../../lib/db/schema';
import { eq } from 'drizzle-orm';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature']!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).send('Webhook signature verification failed');
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        
        await updateUserSubscription(session.customer as string, subscription);
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await updateUserSubscription(subscription.customer as string, subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
          await updateUserSubscription(invoice.customer as string, subscription);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await db
          .update(users)
          .set({
            subscriptionStatus: 'past_due',
            updatedAt: new Date(),
          })
          .where(eq(users.stripeCustomerId, invoice.customer as string));
        break;
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
}

async function updateUserSubscription(customerId: string, subscription: Stripe.Subscription) {
  const priceId = subscription.items.data[0]?.price.id;
  
  let tier: 'free' | 'pro' | 'team' = 'free';
  let status: 'active' | 'inactive' | 'past_due' | 'canceled' = 'inactive';

  // Map Stripe statuses to our statuses
  switch (subscription.status) {
    case 'active':
      status = 'active';
      break;
    case 'past_due':
      status = 'past_due';
      break;
    case 'canceled':
    case 'unpaid':
      status = 'canceled';
      break;
    default:
      status = 'inactive';
  }

  // Map price IDs to tiers
  if (priceId?.includes('pro')) {
    tier = 'pro';
  } else if (priceId?.includes('team')) {
    tier = 'team';
  }

  await db
    .update(users)
    .set({
      subscriptionStatus: status,
      subscriptionTier: tier,
      subscriptionEndDate: new Date(subscription.current_period_end * 1000),
      updatedAt: new Date(),
    })
    .where(eq(users.stripeCustomerId, customerId));
}
