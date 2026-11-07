// src/stripeWebhook.ts
import Stripe from "stripe";
import { PIXELS_BY_PRODUCT } from "./stripeCheckout";
import { withTransaction } from "./execQuery";
import dotenv from "dotenv";
dotenv.config();

const webhookSecret =
  process.env.APP_STATE === "dev"
    ? process.env.STRIPE_WEBHOOK_SECRET_L
    : process.env.STRIPE_WEBHOOK_SECRET!;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-06-30.basil",
});

async function addPixelsToUserAccount(args: {
  eventId: string;
  sessionId: string;
  userId: string;
  productId: string;
  pixelsToAdd: number;
}): Promise<boolean> {
  const { eventId, sessionId, userId, productId, pixelsToAdd } = args;
  console.log(
    `  📦 [DB] Preparing to add ${pixelsToAdd} pixels to user ${userId}.`
  );

  const credited = await withTransaction(async (query) => {
    const claim = await query(
      `INSERT IGNORE INTO stripe_pixel_grants
         (session_id, event_id, user_id, product_id, pixels)
       VALUES (?, ?, ?, ?, ?)`,
      [sessionId, eventId, userId, productId, pixelsToAdd]
    );
    if (Number(claim?.affectedRows) !== 1) return false;

    const update = await query(
      `UPDATE members
       SET pixels = COALESCE(pixels, 0) + ?
       WHERE id = ?`,
      [pixelsToAdd, userId]
    );
    if (Number(update?.affectedRows) !== 1) {
      throw new Error("Purchased-pixel member was not found");
    }
    return true;
  });

  if (!credited) {
    console.log(`  ℹ️ [DB] Stripe session ${sessionId} was already credited.`);
    return false;
  }
  console.log(`  ✅ [DB] Successfully added pixels for user ${userId}.`);
  return true;
}

export const handleStripeWebhook = async (req: any, res: any) => {
  console.log("\n---");
  console.log("🔔 [Webhook] Stripe webhook request received!");

  const sig = req.headers["stripe-signature"];
  if (!sig || !webhookSecret) {
    console.warn("⚠️ [AUTH] Webhook signature or secret is missing.");
    return res.status(400).send("Webhook Error: Missing signature or secret.");
  }
  console.log("✅ [AUTH] Found signature and secret. Verifying…");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    console.log(`✅ [AUTH] Signature verified. Event ID: ${event.id}`);
  } catch (err: any) {
    console.error("❌ [AUTH] Signature verification FAILED:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case "checkout.session.completed":
      console.log("✅ [EVENT] Handling checkout.session.completed");
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const productId = session.metadata?.productId;
      console.log(`[METADATA] userId=${userId}, productId=${productId}`);

      if (session.payment_status !== "paid") {
        console.warn(`🚨 Checkout session ${session.id} completed without paid status.`);
        break;
      }

      if (userId && productId) {
        const pixels = PIXELS_BY_PRODUCT[productId];
        if (pixels) {
          console.log(`[LOOKUP] Granting ${pixels} pixels for ${productId}`);
          try {
            await addPixelsToUserAccount({
              eventId: event.id,
              sessionId: session.id,
              userId,
              productId,
              pixelsToAdd: pixels,
            });
          } catch (error) {
            console.error(`❌ Pixel credit failed for Stripe session ${session.id}:`, error);
            // A non-2xx response asks Stripe to retry instead of silently losing
            // a successful customer's purchased pixels.
            return res.status(500).json({ received: false });
          }
        } else {
          console.warn(`🤷‍♀️ No pixels configured for productId ${productId}`);
        }
      } else {
        console.warn(`🚨 Missing metadata on session ${session.id}`);
      }
      break;

    default:
      console.log(`🤷‍♀️ Unhandled event type: ${event.type}`);
  }

  console.log("➡️ [RESPONSE] Webhook complete; returning 200 OK");
  console.log("---\n");
  res.status(200).json({ received: true });
};
