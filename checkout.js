// Checkout on the home page: prices, crypto and card checkout, renewals, card management.
(function () {
  var meta = document.querySelector('meta[name="isotunnel-api"]');
  var API = (meta && meta.content || "").replace(/\/+$/, "");
  var $ = function (id) { return document.getElementById(id); };
  var DOWN = "The payment service isn't answering. Try again in a minute.";

  function api(path, body) {
    return fetch(API + path, body === undefined ? {} : {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error(d.error || DOWN);
        return d;
      });
    }, function () { throw new Error(DOWN); });
  }

  function showError(msg) { var e = $("buy-error"); e.textContent = msg; e.hidden = !msg; }
  function money(amount, currency) {
    var sym = { USD: "US$", AUD: "A$", EUR: "€", GBP: "£" }[currency] || currency + " ";
    return sym + Number(amount).toFixed(2).replace(/\.00$/, "");
  }

  // Runs `go` with the button showing progress; restores it on failure.
  function busy(button, text, go) {
    showError("");
    var label = button.textContent;
    button.disabled = true; button.textContent = text;
    go().catch(function (err) {
      showError(err.message);
      button.disabled = false; button.textContent = label;
    });
  }
  function remember(fragment) { try { localStorage.setItem("isotunnel-last-order", fragment); } catch (e) {} }

  document.addEventListener("DOMContentLoaded", function () {
    var buy = $("buy"), card = $("buy-card"), manage = $("manage-card");
    if (!buy) return;

    api("/api/plan").then(function (p) {
      var line = money(p.priceUsd, "USD") + " a month with crypto";
      if (p.dataLimitGb > 0) line += ", " + p.dataLimitGb + " GB of data";
      $("price").textContent = line;
      if (p.card) {
        var cp = $("card-price");
        cp.textContent = "Or " + money(p.card.amount, p.card.currency) + " a month by card, renewing automatically until you cancel.";
        cp.hidden = card.hidden = manage.hidden = $("manage-note").hidden = false;
      }
      if (p.crypto === false && p.card) {
        // Cards only for now: lead with the card price, hide what needs crypto.
        var data = p.dataLimitGb > 0 ? ", " + p.dataLimitGb + " GB of data" : "";
        $("price").textContent = money(p.card.amount, p.card.currency) + " a month by card" + data;
        $("card-price").textContent = "Renews automatically until you cancel. Crypto payments are coming soon.";
        buy.hidden = true;
        $("renew-form").querySelector('button[type="submit"]').hidden = true;
        $("pay-note").hidden = true;
      }
    }).catch(function () {
      // The payment service isn't running (yet): say so up front instead of failing on a click.
      buy.disabled = true;
      $("renew-form").querySelector('button[type="submit"]').disabled = true;
      $("pay-note").textContent = "Buying opens soon. You can download the app now.";
    });

    buy.addEventListener("click", function () {
      busy(buy, "Creating invoice…", function () {
        return api("/api/checkout", {}).then(function (d) { remember(d.orderUrl.split("#")[1]); location.href = d.orderUrl; });
      });
    });

    card.addEventListener("click", function () {
      busy(card, "Opening checkout…", function () {
        return api("/api/card/checkout", {}).then(function (d) { remember("pay=card&o=" + d.nonce); location.href = d.url; });
      });
    });

    $("renew-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var b = e.target.querySelector('button[type="submit"]');
      busy(b, "Creating invoice…", function () {
        return api("/api/checkout", { renewKey: $("renew-key").value.trim() }).then(function (d) {
          remember(d.orderUrl.split("#")[1]); location.href = d.orderUrl;
        });
      });
    });

    manage.addEventListener("click", function () {
      var key = $("renew-key").value.trim();
      if (!key) { showError("Paste your access key first."); $("renew-key").focus(); return; }
      busy(manage, "Opening…", function () {
        return api("/api/card/portal", { key: key }).then(function (d) { location.href = d.url; });
      });
    });
  });
})();
