// Use another app: turns an access key into the account's subscription link, here in the browser.
// The key never leaves the page; only an app that is given the link fetches it from the API.
(function () {
  var meta = document.querySelector('meta[name="isotunnel-api"]');
  var API = (meta && meta.content || "").replace(/\/+$/, "");
  var $ = function (id) { return document.getElementById(id); };
  var TOKEN = /^[A-Za-z0-9_.-]{20,200}$/; // the panel's subscription token, as the API accepts it

  /** The subscription token in an access key: the `k` of an it1. key, or a short key as it is. "" if neither. */
  function tokenOf(key) {
    key = key.trim();
    if (key.indexOf("it1.") === 0) {
      try {
        var b64 = key.slice(4).replace(/-/g, "+").replace(/_/g, "/");
        var bin = atob(b64 + "===".slice((b64.length + 3) % 4));
        var bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        var k = JSON.parse(new TextDecoder().decode(bytes)).k;
        return typeof k === "string" && TOKEN.test(k) ? k : "";
      } catch (e) {
        return "";
      }
    }
    return TOKEN.test(key) ? key : "";
  }

  document.addEventListener("DOMContentLoaded", function () {
    var form = $("sub-form"), out = $("sub-out"), err = $("sub-error"), link = $("sub-link");
    var copy = $("sub-copy"), open = $("sub-open"), show = $("sub-qr-show"), qr = $("sub-qr"), qrNote = $("sub-qr-note");
    var url = "";

    function reset() {
      url = ""; out.hidden = true; qr.hidden = qrNote.hidden = true; qr.textContent = "";
      show.textContent = "Show QR code"; copy.textContent = "Copy link";
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      reset();
      var token = tokenOf($("sub-key").value);
      err.hidden = !!token;
      if (!token) { err.textContent = "That doesn't look like an isotunnel access key. Copy the whole key, starting with it1."; return; }
      url = API + "/api/sub/" + token;
      link.value = url;
      open.href = "hiddify://import/" + url + "#isotunnel";
      out.hidden = false;
    });
    $("sub-key").addEventListener("input", function () { if (url) reset(); });

    copy.addEventListener("click", function () {
      navigator.clipboard.writeText(url).then(function () { copy.textContent = "Copied"; }, function () {
        link.focus(); link.select(); copy.textContent = "Press Ctrl+C";
      });
    });

    // Shown only on request: the code is the link, so anyone who can see the screen can use the account.
    show.addEventListener("click", function () {
      if (!qr.hidden) { qr.hidden = qrNote.hidden = true; qr.textContent = ""; show.textContent = "Show QR code"; return; }
      var code = qrcode(0, "M");
      code.addData(url);
      code.make();
      qr.innerHTML = code.createSvgTag({ cellSize: 4, margin: 4, scalable: true, title: "isotunnel subscription link" });
      qr.hidden = qrNote.hidden = false;
      show.textContent = "Hide QR code";
    });
  });
})();
