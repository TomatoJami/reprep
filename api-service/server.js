require("dotenv").config();

const express = require("express");
const app = express();
const { auth } = require("express-openid-connect");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const supabase = require("./supabase");

const PORT = process.env.PORT || 3000;
const TEAM_NAME = process.env.TEAM_NAME || "Unknown team";
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

app.post(
  "/stripe-webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.log("Webhook signature error:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      console.log("Checkout completed. client_reference_id:", session.client_reference_id);

      const auth0_id = session.client_reference_id;

      if (auth0_id) {
        console.log("Activating PRO for:", auth0_id);

        const { error } = await supabase
          .from("users")
          .update({ pro: true })
          .eq("auth0_id", auth0_id);

        if (error) console.log("Supabase update error:", error);
        else console.log("PRO activated successfully");
      } else {
        console.log("No client_reference_id in session — PRO not activated");
      }
    }

    res.json({ received: true });
  }
);

app.use(express.json());

const config = {
  authRequired: false,
  auth0Logout: true,
  secret: process.env.AUTH_SECRET || "saltedstring",
  baseURL: BASE_URL,
  clientID: process.env.CLIENT_ID,
  issuerBaseURL: process.env.ISSUER_BASE_URL,
};

app.use(auth(config));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

app.get("/api/info", (req, res) => {
  res.json({ team: TEAM_NAME });
});

app.get("/payment-link", async (req, res) => {

  if (!req.oidc.isAuthenticated()) {
    return res.status(401).json({ error: "Not logged in" });
  }

  const auth0_id = req.oidc.user.sub;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    client_reference_id: auth0_id,
    success_url: `${BASE_URL}/?success=true`,
    cancel_url: `${BASE_URL}/`,
  });

  res.json({ url: session.url });

});

app.get("/auth-status", async (req, res) => {

  if (!req.oidc.isAuthenticated()) {
    return res.json({ loggedIn: false });
  }

  const auth0_id = req.oidc.user.sub;

  const { error } = await supabase
    .from("users")
    .upsert({ auth0_id }, { onConflict: "auth0_id" });

  if (error) console.log(error);

  res.json({ loggedIn: true });

});

app.get("/pro-status", async (req, res) => {

  if (!req.oidc.isAuthenticated()) {
    return res.json({ pro: false });
  }

  const auth0_id = req.oidc.user.sub;

  const { data } = await supabase
    .from("users")
    .select("pro")
    .eq("auth0_id", auth0_id)
    .single();

  res.json({
    pro: data?.pro || false
  });

});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});