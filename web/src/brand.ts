/** Product name and copy used across the UI, document title, and static HTML meta tags. */
export const APP_NAME = "Inference Console";
export const APP_TAGLINE = "Model API workspace";

export function pageTitleForPath(pathname: string): string {
  if (pathname.startsWith("/admin")) {
    return `Platform administration · ${APP_NAME}`;
  }
  if (pathname.startsWith("/portal")) {
    return `Client portal · ${APP_NAME}`;
  }
  return `Workspace · ${APP_NAME}`;
}
