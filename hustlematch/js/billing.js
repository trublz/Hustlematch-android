/* HustleMatch billing — employer monetization.
   Model: job seekers free forever. Employers: first job post FREE,
   then $4.99 per extra post, or $19.99/month for unlimited posts.

   Two modes:
   - "live": Google Play Billing via cordova-plugin-purchase (Capacitor).
     Requires the Play Console products below to exist (created after the
     $25 Play developer account). Product IDs MUST match Play Console.
   - "demo": everything else (file preview, CI builds, pre-Play). Purchases
     are simulated instantly and clearly labeled. No real charges, ever.

   NOTE (launch-grade honesty): entitlements are verified on-device, no
   server. A determined user could spoof a purchase. Fine for launch at
   these prices; add server-side receipt validation before scaling.
*/
(function () {
  "use strict";

  var LS_KEY = "hm_billing_v1";

  /* ⚠️ THESE MUST MATCH THE PRODUCTS IN PLAY CONSOLE (created later) */
  var PRODUCTS = {
    SINGLE: "hm_single_post", // consumable, $4.99 — one extra job post
    MONTHLY: "hm_post_monthly", // subscription, $19.99/mo — unlimited posts
  };

  var DEMO_PRICES = {
    hm_single_post: "$4.99",
    hm_post_monthly: "$19.99/mo",
  };

  function load() {
    try {
      return (
        JSON.parse(localStorage.getItem(LS_KEY)) || {
          freeUsed: false,
          credits: 0,
          subUntil: 0,
        }
      );
    } catch (e) {
      return { freeUsed: false, credits: 0, subUntil: 0 };
    }
  }
  function save(s) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(s));
    } catch (e) {}
  }

  var pendingProduct = null;

  function grant(productId) {
    var s = load();
    if (productId === PRODUCTS.SINGLE) {
      s.credits = (s.credits || 0) + 1;
      toast("✅ +1 job post credit");
    } else if (productId === PRODUCTS.MONTHLY) {
      s.subUntil = Date.now() + 30 * 24 * 3600 * 1000;
      toast("✅ Unlimited posts for 30 days");
    }
    save(s);
    try {
      route();
    } catch (e) {}
  }

  function tryLiveInit() {
    /* Returns true if the native billing plugin is present. */
    try {
      var CdvP = window.CdvPurchase;
      if (!CdvP || !CdvP.store) return false;
      if (!(window.Capacitor && Capacitor.isNativePlatform())) return false;

      CdvP.store.register([
        {
          id: PRODUCTS.SINGLE,
          platform: CdvP.Platform.GOOGLE_PLAY,
          type: CdvP.ProductType.CONSUMABLE,
        },
        {
          id: PRODUCTS.MONTHLY,
          platform: CdvP.Platform.GOOGLE_PLAY,
          type: CdvP.ProductType.PAID_SUBSCRIPTION,
        },
      ]);

      CdvP.store
        .when()
        .approved(function (t) {
          /* No receipt-validation server in v1: grant on-device. */
          try {
            var pid =
              pendingProduct ||
              (t.products && t.products[0] && t.products[0].id);
            if (pid) grant(pid);
          } catch (e) {}
          try {
            t.finish();
          } catch (e2) {}
          pendingProduct = null;
        })
        .verified(function (receipt) {
          try {
            var pid = pendingProduct || (receipt && receipt.id);
            if (pid) grant(pid);
          } catch (e) {}
          try {
            receipt.finish();
          } catch (e2) {}
          pendingProduct = null;
        });

      CdvP.store.initialize([{ platform: CdvP.Platform.GOOGLE_PLAY }]);
      return true;
    } catch (e) {
      return false;
    }
  }

  window.Billing = {
    PRODUCTS: PRODUCTS,
    mode: "demo", // 'demo' | 'live'
    ready: false,

    init: function () {
      if (this.ready) return;
      this.ready = true;
      if (tryLiveInit()) {
        this.mode = "live";
      }
    },

    isDemo: function () {
      return this.mode !== "live";
    },

    status: function () {
      var s = load();
      return {
        freeUsed: !!s.freeUsed,
        freeAvailable: !s.freeUsed,
        credits: s.credits || 0,
        subActive: (s.subUntil || 0) > Date.now(),
        subUntil: s.subUntil || 0,
        mode: this.mode,
      };
    },

    /* Can this device post a job right now? */
    canPost: function () {
      var st = this.status();
      if (st.freeAvailable) return { ok: true, kind: "free" };
      if (st.credits > 0) return { ok: true, kind: "credit" };
      if (st.subActive) return { ok: true, kind: "sub" };
      return { ok: false, kind: "locked" };
    },

    /* Call AFTER a job post succeeds. Consumes free post or one credit. */
    consumePost: function () {
      var s = load();
      if (!s.freeUsed) {
        s.freeUsed = true;
      } else if ((s.credits || 0) > 0) {
        s.credits = s.credits - 1;
      }
      save(s);
    },

    priceFor: function (productId) {
      if (this.mode === "live") {
        try {
          var p = window.CdvPurchase.store.get(productId);
          if (p && p.pricing) return p.pricing;
        } catch (e) {}
      }
      return DEMO_PRICES[productId] || "";
    },

    buy: function (productId) {
      var self = this;
      if (this.mode === "live") {
        try {
          pendingProduct = productId;
          var product = window.CdvPurchase.store.get(productId);
          if (!product) {
            toast("Product not found — try again in a moment");
            pendingProduct = null;
            return Promise.resolve(false);
          }
          var offer =
            product.getOffer && product.getOffer
              ? product.getOffer()
              : product;
          var order = offer.order ? offer.order() : product.order();
          return Promise.resolve(order).then(function (err) {
            if (err) {
              pendingProduct = null;
              if (
                err.code ===
                (window.CdvPurchase.ErrorCode &&
                  window.CdvPurchase.ErrorCode.PAYMENT_CANCELLED)
              ) {
                toast("Purchase cancelled");
              } else {
                toast("Purchase failed — please try again");
              }
              return false;
            }
            return true; /* approved/verified callbacks grant it */
          });
        } catch (e) {
          pendingProduct = null;
          toast("Billing not available right now");
          return Promise.resolve(false);
        }
      }
      /* Demo mode: simulate the purchase instantly. */
      toast("💳 Demo purchase — no real charge");
      return new Promise(function (resolve) {
        setTimeout(function () {
          grant(productId);
          resolve(true);
        }, 900);
      });
    },

    restore: function () {
      if (this.mode === "live") {
        try {
          window.CdvPurchase.store.restorePurchases();
          toast("Restoring purchases…");
          return;
        } catch (e) {}
      }
      toast("Demo mode — nothing to restore 💳");
    },
  };
})();
