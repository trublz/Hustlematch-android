/* HustleMatch Firebase sync (optional).
   Shares the employer job board across all devices via Firestore.

   Does NOTHING unless window.FIREBASE_CONFIG is set (see js/firebase-config.js).
   Google Sign-In is intentionally not wired here — it needs the Play Console
   SHA-1 certificate fingerprint, which only exists after the Play developer
   account + first upload. Local profiles remain the sign-in method until then. */
(function () {
  "use strict";

  var COLLECTION = "jobs";

  window.HMFirebase = {
    ready: false,
    db: null,

    init: function () {
      if (!window.FIREBASE_CONFIG || !window.firebase || !window.firebase.firestore) return;
      try {
        if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
        this.db = firebase.firestore();
        this.ready = true;
        this.pullJobs();
      } catch (e) {
        if (window.console) console.warn("[HMFirebase] init failed:", e);
      }
    },

    /* Fetch every posted job and merge the ones we don't have yet. */
    pullJobs: function () {
      if (!this.ready) return;
      this.db
        .collection(COLLECTION)
        .get()
        .then(function (snap) {
          var added = 0;
          snap.forEach(function (doc) {
            var job = doc.data();
            job.id = doc.id;
            if (
              !GIGS.find(function (g) {
                return g.id === job.id;
              })
            ) {
              GIGS.push(jobToGig(job, false));
              added++;
            }
          });
          if (added > 0) {
            try {
              route();
            } catch (e) {}
            toast("📥 " + added + " employer job" + (added === 1 ? "" : "s") + " synced");
          }
        })
        .catch(function (e) {
          if (window.console) console.warn("[HMFirebase] pull failed:", e);
        });
    },

    /* Publish a locally-posted job to Firestore. */
    pushJob: function (job) {
      if (!this.ready) return;
      var data = JSON.parse(JSON.stringify(job));
      this.db
        .collection(COLLECTION)
        .doc(job.id)
        .set(data)
        .catch(function (e) {
          if (window.console) console.warn("[HMFirebase] push failed:", e);
        });
    },

    /* Remove a job from Firestore. */
    deleteRemoteJob: function (id) {
      if (!this.ready) return;
      this.db
        .collection(COLLECTION)
        .doc(id)
        .delete()
        .catch(function (e) {
          if (window.console) console.warn("[HMFirebase] delete failed:", e);
        });
    },
  };
})();
