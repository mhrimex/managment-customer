/** What can be checked before deleting, and what the "still in use" message shows. */
export type UsageKind = "company" | "solution" | "server" | "deployment" | "employee" | "account";

export interface UsageItem {
  label: string;
  detail?: string | null;
  /** page where this item can be changed or deleted */
  href?: string;
}

export interface UsageGroup {
  title: string;
  /** what to do with these items so the delete can go ahead */
  hint: string;
  items: UsageItem[];
}

export interface ItemUsage {
  kind: UsageKind;
  name: string;
  /** empty = nothing uses it, safe to delete */
  groups: UsageGroup[];
}
