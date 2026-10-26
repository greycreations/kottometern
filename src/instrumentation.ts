export async function register() {
  const { rules, validateRules } = await import("./config/grill-rules");
  validateRules(rules);
}
