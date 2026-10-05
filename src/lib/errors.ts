import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import type { DictKey } from "@/lib/i18n";

/**
 * Message to show for a failed Supabase call. When a request never gets a response
 * (offline, server down), supabase-js only has the browser's raw "Failed to fetch",
 * so show a translated explanation instead. Auth calls report that case as an
 * AuthRetryableFetchError; database calls report it as HTTP `status` 0.
 */
export function errorMessage(
  error: { message: string },
  t: (key: DictKey) => string,
  status?: number
): string {
  if (status === 0 || isAuthRetryableFetchError(error)) return t("common.networkError");
  return error.message;
}
