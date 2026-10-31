// Download buttons: kept pointing at the newest release. updates/latest.json is the file installed
// apps check for updates, so the site offers exactly what they would install. Without it (or
// without JavaScript) the links written in index.html stay as they are.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var PLATFORMS = { "dl-x64": "windows-x86_64", "dl-arm64": "windows-aarch64" };

  document.addEventListener("DOMContentLoaded", function () {
    if (!$("download")) return;
    fetch("updates/latest.json", { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("no release yet");
      return r.json();
    }).then(function (rel) {
      var live = 0;
      for (var id in PLATFORMS) {
        var p = rel.platforms && rel.platforms[PLATFORMS[id]];
        if (!p || !p.url) { $(id).hidden = true; continue; }
        $(id).href = p.url.replace(/^https:\/\/(www\.)?isotunnel\.com\//, "");
        $(id).removeAttribute("aria-disabled");
        live++;
      }
      if (!live) return;
      $("dl-note").textContent = $("dl-note").textContent.replace(/\d+\.\d+\.\d+/, rel.version);
      // On a Windows on ARM PC, offer its installer first.
      var ua = navigator.userAgentData;
      if (ua && ua.getHighEntropyValues) {
        ua.getHighEntropyValues(["architecture"]).then(function (v) {
          var arm = $("dl-arm64");
          if (v.architecture === "arm" && !arm.hidden) arm.parentNode.insertBefore(arm, $("dl-x64"));
        }).catch(function () {});
      }
    }).catch(function () {}); // not released yet: the buttons stay disabled
  });
})();
