// Order page: shows payment status, then the access key (new purchase) or the new expiry (renewal).
// The link's #o=…&t=… part is the buyer's receipt; it never reaches our web server.
(function () {
  var meta = document.querySelector('meta[name="isotunnel-api"]');
  var API = (meta && meta.content || "").replace(/\/+$/, "");
  var view, title, timer;

  function params() {
    var h = location.hash.slice(1);
    if (!h) { try { h = localStorage.getItem("isotunnel-last-order") || ""; } catch (e) {} }
    var p = new URLSearchParams(h);
    // Stripe's return link is the only place a card order's session ID shows up, so keep the whole link.
    if (location.hash && /^[0-9a-f]{32}$/.test(p.get("o") || "")) { try { localStorage.setItem("isotunnel-last-order", h); } catch (e) {} }
    if (h && !location.hash) history.replaceState(null, "", "#" + h);
    return { card: p.get("pay") === "card", o: p.get("o") || "", t: p.get("t") || "", s: p.get("s") || "", pay: p.get("p") || "" };
  }

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) {
      if (k === "text") e.textContent = attrs[k]; else if (k === "class") e.className = attrs[k]; else e.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { e.appendChild(c); });
    return e;
  }
  function render(heading, nodes) {
    title.textContent = heading;
    view.replaceChildren.apply(view, nodes);
  }
  function longDate(iso) {
    var d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  }
  function payButton(url) {
    var ok = /^https:\/\//.test(url || "") || (location.hostname === "localhost" && /^http:\/\/localhost[:/]/.test(url || ""));
    return ok
      ? el("a", { class: "btn", href: url, target: "_blank", rel: "noopener noreferrer", text: "Open payment page" })
      : el("span");
  }

  // "Email me this key": only offered when the server has email set up, and it only ever sends to the address
  // the card payment used. The reply says where it went (first letter and domain only).
  function offerEmail(p, row, note) {
    fetch(API + "/api/plan").then(function (r) { return r.json(); }).then(function (plan) {
      if (!plan.emailKeys) return;
      var btn = el("button", { class: "btn quiet", type: "button", text: "Email me this key" });
      btn.addEventListener("click", function () {
        btn.disabled = true; note.textContent = "";
        fetch(API + "/api/card/email-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ o: p.o, s: p.s }) })
          .then(function (r) { return r.json().catch(function () { return {}; }).then(function (x) { if (!r.ok) throw new Error(x.error || "Couldn't send it. Try again in a minute."); return x; }); })
          .then(function (x) { note.textContent = "Sent to " + x.to + ". It can take a minute; check spam too."; btn.disabled = false; })
          .catch(function (err) { note.textContent = err.message; btn.disabled = false; });
      });
      row.appendChild(btn); row.hidden = false;
    }).catch(function () {});
  }

  function show(d, p) {
    var keep = el("p", { class: "note", text: "Keep this page's link. It's your receipt, and it will show your key again if you need it." });
    switch (d.state) {
      case "waiting":
        if (d.card) {
          render("Not paid yet", [
            el("p", { text: "The card checkout wasn't finished. You can go back to it, or start again from the home page." }),
            payButton(d.paymentUrl),
          ]);
          return true;
        }
        render("Waiting for payment", [
          el("p", { text: "Pay on OxaPay's page. Choose any coin; USDT on TRON has the lowest fees. This page updates by itself once the payment arrives." }),
          payButton(d.paymentUrl || p.pay),
          el("p", { class: "note", text: "The invoice expires after 60 minutes." }),
        ]);
        return true;
      case "confirming":
        render("Payment seen", [el("p", { text: "Your payment has arrived and is waiting for the network to confirm it. This usually takes a minute or two. You can leave this page open." }), keep]);
        return true;
      case "paid":
        if (d.renewal) {
          render("Renewed", [el("p", { text: "Thanks. Your account now runs until " + longDate(d.expire) + ". There's nothing else to do; the app picks it up automatically." })]);
          return false;
        }
        var key = el("code", { class: "key", text: d.key || "" });
        var copy = el("button", { class: "btn", type: "button", text: "Copy key" });
        copy.addEventListener("click", function () {
          navigator.clipboard.writeText(d.key).then(function () { copy.textContent = "Copied"; }, function () {
            var r = document.createRange(); r.selectNodeContents(key);
            var s = getSelection(); s.removeAllRanges(); s.addRange(r); copy.textContent = "Press Ctrl+C";
          });
        });
        var mailRow = el("div", { class: "keybox" });
        var mailNote = el("p", { class: "note" });
        mailRow.hidden = true;
        if (d.card) offerEmail(p, mailRow, mailNote);
        render("You're in", [
          el("p", { text: "Here's your access key. Paste it into the isotunnel app to sign in." }),
          el("div", { class: "keybox" }, [key, copy]),
          mailRow,
          mailNote,
          el("p", { class: "dim", text: d.card
            ? "Your card subscription renews each month. You can change the card or cancel any time under \"Renew or manage\" on the home page."
            : "Your account runs until " + longDate(d.expire) + "." }),
          el("p", { class: "note", text: "Treat the key like a password: anyone who has it can use your account." }),
          keep,
        ]);
        return false;
      case "underpaid":
        render("Not quite enough", [
          el("p", { text: "The payment came in below the invoice amount, often because of network fees. Open the payment page to send the rest." }),
          payButton(p.pay),
        ]);
        return true;
      case "expired":
        render("Invoice expired", [
          el("p", { text: d.card ? "This card checkout timed out without a payment." : "No payment arrived within 60 minutes, so this invoice closed. If you did send money, contact us with this page's link." }),
          el("a", { class: "btn", href: "./#get", text: "Start again" }),
        ]);
        return false;
      case "refunded":
        render("Refunded", [el("p", { text: "This payment was refunded." })]);
        return false;
    }
    return true;
  }

  function check(p) {
    var q = p.card
      ? "/api/card/order?o=" + encodeURIComponent(p.o) + "&s=" + encodeURIComponent(p.s)
      : "/api/order?o=" + encodeURIComponent(p.o) + "&t=" + encodeURIComponent(p.t);
    fetch(API + q)
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || "Order not found."); return d; }); })
      .then(function (d) {
        if (show(d, p)) timer = setTimeout(function () { check(p); }, d.state === "confirming" ? 5000 : 8000);
      })
      .catch(function (err) {
        if (/not found|incomplete/i.test(err.message)) {
          render("Order not found", [el("p", { text: "This link doesn't match an order. Check you copied the whole link." })]);
        } else {
          render("Can't reach the payment service", [el("p", { text: "Retrying… Your order is safe; payments are recorded even while this page can't connect." })]);
          timer = setTimeout(function () { check(p); }, 10000);
        }
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    view = document.getElementById("view"); title = document.getElementById("title");
    var p = params();
    if (!/^[0-9a-f]{32}$/.test(p.o) || !(p.card ? p.s : p.t)) {
      render("No order here", [el("p", { text: "This page shows an order after you pay. " }), el("a", { class: "btn", href: "./#get", text: "Go to checkout" })]);
      return;
    }
    check(p);
  });
})();
