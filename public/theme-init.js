// Runs before paint without requiring inline JavaScript in the security policy.
try {
  document.documentElement.dataset.theme =
    localStorage.getItem("rods-leet-theme") === "light" ? "light" : "dark";
} catch {
  document.documentElement.dataset.theme = "dark";
}
