// src/stripeWebhook.ts
import Stripe from "stripe";
import { PIXELS_BY_PRODUCT } from "./stripeCheckout";
import { addpixelsx } from "./PostDatabase";
import dotenv from "dotenv";
dotenv.config();

const webhookSecret =
  process.env.APP_STATE === "dev"
    ? process.env.STRIPE_WEBHOOK_SECRET_L
    : process.env.STRIPE_WEBHOOK_SECRET!;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-06-30.basil",
});

async function addPixelsToUserAccount(userId: string, pixelsToAdd: number) {
  console.log(
    `  ðŸ“¦ [DB] Preparing to add ${pixelsToAdd} pixels to user ${userId}.`
  );

  try {
    await addpixelsx(userId, pixelsToAdd);
    console.log(`  âœ… [DB] Successfully added pixels for user ${userId}.`);
  } catch (err) {
    console.error(`  âŒ [DB] Failed to add pixels for user ${userId}:`, err);
  }
}

export const handleStripeWebhook = async (req: any, res: any) => {
  console.log("\n---");
  console.log("ðŸ”” [Webhook] Stripe webhook request received!");

  const sig = req.headers["stripe-signature"];
  if (!sig || !webhookSecret) {
    console.warn("âš ï¸ [AUTH] Webhook signature or secret is missing.");
    return res.status(400).send("Webhook Error: Missing signature or secret.");
  }
  console.log("âœ… [AUTH] Found signature and secret. Verifyingâ€¦");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    console.log(`âœ… [AUTH] Signature verified. Event ID: ${event.id}`);
  } catch (err: any) {
    console.error("âŒ [AUTH] Signature verification FAILED:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case "checkout.session.completed":
      console.log("âœ… [EVENT] Handling checkout.session.completed");
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const productId = session.metadata?.productId;
      console.log(`[METADATA] userId=${userId}, productId=${productId}`);

      if (userId && productId) {
        const pixels = PIXELS_BY_PRODUCT[productId];
        if (pixels) {
          console.log(`[LOOKUP] Granting ${pixels} pixels for ${productId}`);
          await addPixelsToUserAccount(userId, pixels);
        } else {
          console.warn(`ðŸ¤·â€â™€ï¸ No pixels configured for productId ${productId}`);
        }
      } else {
        console.warn(`ðŸš¨ Missing metadata on session ${session.id}`);
      }
      break;

    default:
      console.log(`ðŸ¤·â€â™€ï¸ Unhandled event type: ${event.type}`);
  }

  console.log("âž¡ï¸ [RESPONSE] Webhook complete; returning 200 OK");
  console.log("---\n");
  res.status(200).json({ received: true });
};
