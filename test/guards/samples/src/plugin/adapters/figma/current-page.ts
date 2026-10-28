// Planted: a sync page switch, which throws under documentAccess "dynamic-page". Refused by the Figma plugin rule
// ban-deprecated-sync-prop-setters.
export function showPage(page: PageNode): void {
  figma.currentPage = page;
}
