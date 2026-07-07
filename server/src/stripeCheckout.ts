// src/stripeCheckout.ts
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-06-30.basil",
});

const ff =
  process.env.APP_STATE === "dev"
    ? process.env.CLIK_URL_L
    : process.env.CLIK_URL!;

/**
 * product â†’ pixels lookup
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
  console.log("ðŸ”” [Checkout] createCheckoutSession called");
  try {
    const { productId, userId } = req.body as {
      productId?: string;
      userId?: string | number;
    };
    console.log("ðŸ“¥ Request body:", { productId, userId });

    if (!productId || !userId) {
      console.warn("âš ï¸  Missing productId or userId");
      return res.status(400).json({ error: "productId and userId required" });
    }

    // 1ï¸âƒ£  Retrieve the product to grab its default_price
    console.log("1ï¸âƒ£  Retrieving product:", productId);
    const product = await stripe.products.retrieve(productId);
    const priceId =
      typeof product.default_price === "string"
        ? product.default_price
        : product.default_price?.id;
    console.log("ðŸ”– Retrieved priceId:", priceId);

    if (!priceId) {
      console.error("âŒ Price not found on product");
      return res.status(500).json({ error: "Price not found on product" });
    }

    // 2ï¸âƒ£  Create an embedded Checkout Session
    console.log("2ï¸âƒ£  Creating embedded Checkout Session");
    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded",
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      payment_method_types: ["card"],
      metadata: { userId: String(userId), productId },
      redirect_on_completion: "if_required",
      return_url: `${ff}/?session_id={CHECKOUT_SESSION_ID}`,
    });
    console.log("âœ… Session created:", session.id);

    // 3ï¸âƒ£  Send the client secret and session ID to the client
    console.log("3ï¸âƒ£  Returning clientSecret and sessionId");
    res.json({
      clientSecret: session.client_secret,
      sessionId: session.id,
    });
  } catch (err: any) {
    console.error("âŒ createCheckoutSession error:", err);
    next(err);
  }
}
