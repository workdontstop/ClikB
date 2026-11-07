// src/stripeCheckout.ts
import Stripe from "stripe";
import { authenticatedOwnerId } from "./requestAuth";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-06-30.basil",
});

const ff =
  process.env.APP_STATE === "dev"
    ? process.env.CLIK_URL_L
    : process.env.CLIK_URL!;

/**
 * product → pixels lookup
 */
export const PIXELS_BY_PRODUCT: Record<string, number> = {
  prod_SgRHlPzSmK19L5: 333,
  prod_SgRI7R2pq9ryAx: 959,
  prod_SgRJqckGBSRksM: 1838,
  prod_SgRKfBZkvl1mDv: 3516,
  prod_SgRLCe0Fl7ZNPl: 6713,
};

/**
 * POST /create-checkout-session
 */
export async function createCheckoutSession(req: any, res: any, next: any) {
  console.log("🔔 [Checkout] createCheckoutSession called");
  try {
    const { productId, userId: requestedUserId } = req.body as {
      productId?: string;
      userId?: string | number;
    };
    const userId = authenticatedOwnerId(req);
    console.log("📥 Request body:", { productId, requestedUserId });

    if (!userId) {
      return res.status(401).json({ error: "Your session has expired. Please sign in again." });
    }
    if (userId === "1") {
      return res.status(403).json({ error: "You must log in first to buy pixels." });
    }
    if (requestedUserId != null && String(requestedUserId) !== userId) {
      return res.status(403).json({ error: "You cannot purchase pixels for another member." });
    }
    if (!productId || !Object.prototype.hasOwnProperty.call(PIXELS_BY_PRODUCT, productId)) {
      console.warn("⚠️  Missing or unsupported productId");
      return res.status(400).json({ error: "Unsupported pixel package" });
    }

    // 1️⃣  Retrieve the product to grab its default_price
    console.log("1️⃣  Retrieving product:", productId);
    const product = await stripe.products.retrieve(productId);
    const priceId =
      typeof product.default_price === "string"
        ? product.default_price
        : product.default_price?.id;
    console.log("🔖 Retrieved priceId:", priceId);

    if (!priceId) {
      console.error("❌ Price not found on product");
      return res.status(500).json({ error: "Price not found on product" });
    }

    // 2️⃣  Create an embedded Checkout Session
    console.log("2️⃣  Creating embedded Checkout Session");
    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded",
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      payment_method_types: ["card"],
      metadata: { userId: String(userId), productId },
      redirect_on_completion: "if_required",
      return_url: `${ff}/?session_id={CHECKOUT_SESSION_ID}`,
    });
    console.log("✅ Session created:", session.id);

    // 3️⃣  Send the client secret and session ID to the client
    console.log("3️⃣  Returning clientSecret and sessionId");
    res.json({
      clientSecret: session.client_secret,
      sessionId: session.id,
    });
  } catch (err: any) {
    console.error("❌ createCheckoutSession error:", err);
    next(err);
  }
}
