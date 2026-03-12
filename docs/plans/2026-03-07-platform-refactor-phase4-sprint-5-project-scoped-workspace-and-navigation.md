# Platform Refactor Phase 4 Sprint 5 — Project-Scoped Workspace And Navigation

**Goal**

Make the project workspace actually behave as a project workspace, not as a launcher into global pages.

## Problems This Sprint Resolves

- the project cockpit loop still routes `Listen`, `Tips` and `Strategy` to global `/dashboard/insights`
- users can leave the project context while believing they are still in a project-scoped flow
- the new information architecture is visible in labels but not yet enforced in navigation

## Files To Modify

- `src/app/dashboard/projects/[projectId]/page.tsx`
- `src/app/dashboard/insights/page.tsx`
- optional new project-scoped wrappers or routes under `src/app/dashboard/projects/[projectId]/`

## Required Changes

### 1. Make project loop links project-scoped

Do not link project loop steps to global routes unless the route is explicitly project-aware.

Options:

- add project-scoped subroutes, or
- make the destination route accept and enforce project context directly

Pick one approach and apply it consistently.

### 2. Preserve project context during navigation

If the user enters from a project cockpit:

- the selected project context must remain stable
- the target page must not silently fall back to “all projects” or another selected project

### 3. Align global and project views deliberately

If a page supports both global and project modes:

- encode the mode explicitly
- make the breadcrumb and UI title reflect it

## Verification

1. Clicking `Listen`, `Tips` or `Strategy` from the project cockpit keeps the user in that project context.
2. Project-scoped pages cannot silently render another project or the all-projects view.
3. Breadcrumbs and titles reflect whether the user is in project mode or global mode.

## Done Criteria

- project workspace navigation is truly project-scoped
- the operating loop is reflected in behavior, not only labels
