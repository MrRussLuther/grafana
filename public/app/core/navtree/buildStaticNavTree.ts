import { type NavModelItem } from '@grafana/data';
import { config } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { alertingNavEntry } from 'app/features/alerting/unified/navigation/alerting.navEntry';

import { adminNavEntry } from './sections/admin.navEntry';
import { connectionsNavEntry } from './sections/connections.navEntry';
import { dashboardsNavEntry } from './sections/dashboards.navEntry';
import { drilldownNavEntry, exploreNavEntry } from './sections/explore.navEntry';
import { helpNavEntry } from './sections/help.navEntry';
import { getHomeNode } from './sections/home.navEntry';
import { notebooksNavEntry } from './sections/notebooks.navEntry';
import { profileNavEntry } from './sections/profile.navEntry';
import { bookmarksNavEntry, starredNavEntry } from './sections/savedItems.navEntry';
import { applyAppSubUrl, buildEntries, type NavEntryBuilder, pruneEmptyNavSections, sortNavTree } from './utils';

/**
 * The client-built nav tree also requires plugins.useMTPlugins: without it the
 * pluginMeta service never fetches metas, so plugin nav would always be
 * missing. (The metas API itself additionally depends on
 * pluginStoreServiceLoading and pluginInstallAPISync server-side; if those are
 * off the fetch fails or returns nothing and the menu falls back to the
 * static-only tree.)
 *
 * Must be kept in sync with the skip condition in pkg/api/index.go
 * (setIndexViewData), which stops building the server tree when this is on.
 *
 * Known gap (fix parked): app.ts skips OpenFeature init for signed-out and
 * anonymous sessions, so both flags read false there and getInitialNavTree
 * falls back to the bootdata tree — which the server left empty when it
 * evaluated the flags as on. Those sessions need the decision passed at boot
 * time rather than re-evaluated here.
 */
function isClientNavTreeEnabled(): boolean {
  return (
    getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaMultiTenantNavTree, false) &&
    getFeatureFlagClient().getBooleanValue(FlagKeys.PluginsUseMTPlugins, false)
  );
}

/**
 * The entry point used by the redux slices: returns the client-built static
 * tree when the flag is on, or the server-provided tree otherwise.
 */
export function getInitialNavTree(): NavModelItem[] {
  if (!isClientNavTreeEnabled()) {
    return config.bootData?.navTree ?? [];
  }

  const staticTree = applyAppSubUrl(buildStaticNavTree());
  // Empty sections (connections, cfg/access without children) are pruned like
  // the server prunes them after its enterprise hooks run.
  return pruneEmptyNavSections(staticTree);
}

/**
 * The static sections of the nav tree: each entry declares the gate that makes
 * it visible and how to build it. Home is not listed — it is unconditional and
 * seeds the tree. The entries are defined in ./sections (and by the owning
 * feature, e.g. alerting); this module only composes them.
 */
const STATIC_NAV_ENTRIES: NavEntryBuilder[] = [
  starredNavEntry,
  dashboardsNavEntry,
  exploreNavEntry,
  drilldownNavEntry,
  notebooksNavEntry,
  profileNavEntry,
  alertingNavEntry,
  connectionsNavEntry,
  adminNavEntry,
  helpNavEntry,
  bookmarksNavEntry,
];

/**
 * Builds the static (non-plugin) portion of the nav tree, sorted, with urls
 * app-sub-url relative: callers apply the prefix once via applyAppSubUrl at
 * the end of their pipeline.
 */
export function buildStaticNavTree(): NavModelItem[] {
  return sortNavTree([getHomeNode(), ...buildEntries(STATIC_NAV_ENTRIES)]);
}
