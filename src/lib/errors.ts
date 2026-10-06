import type { DictKey } from "@/lib/i18n";

/** Firebase errors carry a `code`, e.g. "auth/invalid-credential" or "permission-denied". */
function codeOf(error: unknown): string {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : "";
}

/** The visitor closed the Google window (or started another sign-in): nothing to report. */
export function isCancelled(error: unknown): boolean {
  const code = codeOf(error);
  return code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request";
}

const MESSAGES: Record<string, DictKey> = {
  "auth/invalid-credential": "auth.errInvalidCredential",
  "auth/wrong-password": "auth.errInvalidCredential",
  "auth/user-not-found": "auth.errInvalidCredential",
  "auth/invalid-email": "auth.errInvalidEmail",
  "auth/email-already-in-use": "auth.errEmailInUse",
  "auth/weak-password": "auth.errWeakPassword",
  "auth/user-disabled": "auth.errUserDisabled",
  "auth/too-many-requests": "auth.errTooManyRequests",
  "auth/popup-blocked": "auth.errPopupBlocked",
  "auth/account-exists-with-different-credential": "auth.errAccountExists",
  // Setup problems (provider not enabled, domain not authorised): for the developer, not the visitor.
  "auth/operation-not-allowed": "auth.errUnavailable",
  "auth/unauthorized-domain": "auth.errUnavailable",
  // A request that never gets an answer (offline, server down): the SDK only has a raw code.
  "auth/network-request-failed": "common.networkError",
  unavailable: "common.networkError",
  "deadline-exceeded": "common.networkError",
  "permission-denied": "common.permissionDenied",
};

/** Message to show for a failed Firebase call. Unknown errors are logged for the developer. */
export function errorMessage(error: unknown, t: (key: DictKey) => string): string {
  const key = MESSAGES[codeOf(error)];
  if (key) return t(key);
  console.error(error);
  return t("common.error");
}
