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
    var buy = $("buy"), card = $("buy-card"), manage = $("manage-card"), tested = $("tested"), plan = $("plan");
    if (!buy) return;

    // Pay stays dim until the buyer says Test this network got through (a back-navigation can restore the tick).
    function syncTested() { plan.classList.toggle("tested", tested.checked); if (tested.checked) showError(""); }
    tested.addEventListener("change", syncTested);
    syncTested();
    function untested() {
      if (tested.checked) return false;
      showError("Run Test this network in the app first, then tick the box above.");
      tested.focus();
      return true;
    }

    // The page starts card-first (Stripe); the plan says what's really on offer. Prices come from the API:
    // the card price is Stripe's own.
    api("/api/plan").then(function (p) {
      var data = p.dataLimitGb > 0 ? ", " + p.dataLimitGb + " GB of data" : "";
      var devices = p.deviceLimit > 0 ? " Up to " + p.deviceLimit + " devices." : "";
      var crypto = p.crypto !== false;
      if (p.card) {
        var cardMoney = money(p.card.amount, p.card.currency);
        $("price").textContent = cardMoney + " a month by card" + data;
        $("card-price").textContent = "Renews every month until you cancel." + devices +
          (crypto ? " Or " + money(p.priceUsd, "USD") + " a month with crypto, which doesn't renew by itself." : "");
        if ($("hero-price")) $("hero-price").textContent = "Check it gets through your network before you pay. Then " + cardMoney + " a month" + (p.dataLimitGb > 0 ? ", " + p.dataLimitGb + " GB" : "") + ".";
      } else {
        // No card payments: crypto leads.
        $("price").textContent = money(p.priceUsd, "USD") + " a month with crypto" + data;
        $("card-price").textContent = devices.trim();
        card.hidden = manage.hidden = $("manage-note").hidden = true;
        buy.classList.add("go"); buy.classList.remove("quiet");
        if ($("hero-price")) $("hero-price").textContent = "Check it gets through your network before you pay. Then " + money(p.priceUsd, "USD") + " a month with crypto.";
      }
      buy.hidden = $("renew-crypto").hidden = !crypto;
      if (p.emailKeys && p.card) $("forgot-form").hidden = false;
      if (crypto && !p.card) $("pay-note").textContent = "Pay in USDT, Bitcoin or another major coin. Your access key appears on the next page as soon as the payment confirms.";
    }).catch(function () {
      // The payment service isn't answering: say so up front instead of failing on a click.
      card.disabled = buy.disabled = manage.disabled = true;
      $("pay-note").textContent = "Buying opens soon. You can download the app now.";
    });

    buy.addEventListener("click", function () {
      if (untested()) return;
      busy(buy, "Creating invoice…", function () {
        return api("/api/checkout", {}).then(function (d) { remember(d.orderUrl.split("#")[1]); location.href = d.orderUrl; });
      });
    });

    card.addEventListener("click", function () {
      if (untested()) return;
      busy(card, "Opening checkout…", function () {
        return api("/api/card/checkout", {}).then(function (d) {
          // The session ID is in Stripe's checkout address; without it the order page can't find a card order.
          var s = (/\/(cs_(?:live|test)_[A-Za-z0-9]+)/.exec(d.url) || [])[1];
          remember("pay=card&o=" + d.nonce + (s ? "&s=" + s : ""));
          location.href = d.url;
        });
      });
    });

    $("renew-form").addEventListener("submit", function (e) {
      e.preventDefault();
      // Enter in the key box: with crypto off, the only thing to do with a key is manage the card subscription.
      if ($("renew-crypto").hidden) { manage.click(); return; }
      var b = $("renew-crypto");
      busy(b, "Creating invoice…", function () {
        return api("/api/checkout", { renewKey: $("renew-key").value.trim() }).then(function (d) {
          remember(d.orderUrl.split("#")[1]); location.href = d.orderUrl;
        });
      });
    });

    $("forgot-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var send = $("forgot-send"), note = $("forgot-note");
      note.textContent = "";
      busy(send, "Sending…", function () {
        return api("/api/card/forgot", { email: $("forgot-email").value.trim() }).then(function (d) {
          note.textContent = d.message || "If a purchase used that address, the key is on its way.";
          send.disabled = false; send.textContent = "Email me my key";
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
