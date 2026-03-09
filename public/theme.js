(function () {
  var KEY = "volopsTheme";
  var root = document.documentElement;

  function readStoredTheme() {
    try {
      var value = localStorage.getItem(KEY);
      if (value === "light" || value === "dark") return value;
    } catch (err) {
      // Ignore storage access issues and fall back to system/default theme.
    }
    return null;
  }

  function writeStoredTheme(theme) {
    try {
      localStorage.setItem(KEY, theme);
    } catch (err) {
      // Ignore storage failures.
    }
  }

  function resolveDefaultTheme() {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
      return "light";
    }
    return "dark";
  }

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    root.style.colorScheme = theme;
  }

  function setTheme(theme) {
    applyTheme(theme);
    writeStoredTheme(theme);
  }

  function toggleTheme() {
    var current = root.getAttribute("data-theme") || "dark";
    setTheme(current === "dark" ? "light" : "dark");
  }

  applyTheme(readStoredTheme() || resolveDefaultTheme());

  document.addEventListener("DOMContentLoaded", function () {
    var button = document.querySelector("[data-theme-toggle]");
    if (!button) return;

    function syncButton() {
      var current = root.getAttribute("data-theme") || "dark";
      var next = current === "dark" ? "light" : "dark";
      button.textContent = current === "dark" ? "Light Mode" : "Dark Mode";
      button.setAttribute("aria-label", "Switch to " + next + " mode");
      button.setAttribute("title", "Switch to " + next + " mode");
    }

    button.addEventListener("click", function () {
      toggleTheme();
      syncButton();
    });

    syncButton();
  });
})();
