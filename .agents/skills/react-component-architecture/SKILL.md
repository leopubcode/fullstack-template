---
name: react-component-architecture
description: Container/presentational React component architecture with co-location by default, including when global state (Context, Redux, Zustand, Jotai, global variables, or similar) is warranted and how it should flow through the tree. Use this whenever creating a new React page, feature, or component tree; scaffolding a page, form, layout, or reusable UI primitive; deciding where a new .tsx file should live; splitting a component that's grown too much logic; reviewing/reorganizing an existing component tree; or when the user proposes adding a Context provider, store, or other global state, or a component reaches into one directly — even if the user didn't explicitly ask about architecture or file placement.
---

# React Component Architecture

A container/presentational split, with **co-location as the default** for anything
that isn't genuinely shared. The goal: someone opening a page's folder can see
everything that page owns in one place, and the only things living outside it are
things actually reused elsewhere.

## The two kinds of component

**Container** — owns behavior. Fetches data, calls mutations, computes derived
values, holds the state a page actually needs to function, and wires callbacks.
Renders presentational components, passing them plain data and functions as props.
Containers are the seam where a query library, tRPC hooks, or similar handles
data-fetching — not raw side-effect wiring. Containers also handle the core of the
buiness logic.

**Presentational** — owns rendering. Mostly JSX plus the minimum TypeScript needed
to type its props. Takes everything it needs — data, callbacks, even loading/error
flags — as props. It does not reach out for data itself. This includes error and
loading rendering: the view is always the one deciding what the error or loading
UI looks like, driven by props a container or parent hands it (see Loading and
error states, below) — it never fetches, catches, or owns that state itself.

The one kind of state a presentational component _is_ allowed to hold locally is
state that is purely about its own interaction mechanics and that nothing outside
it will ever need to read: a dropdown's open/closed flag, whether an input has
focus, a tooltip's hover state. The test is simple: if a parent, sibling, or the
container would ever need to know this value, it isn't local — lift it to the
container and pass it down as a prop instead.

### Why split it this way

Presentational components that only render props are trivial to read, test, and
reuse — you can look at one without knowing anything about where its data comes
from. Containers stay few and thin because there's only one obvious place for
"how does this page get its data" to live. Keep the boundary honest: the moment a
presentational component starts calling a query hook or reaching into global
state, it has quietly become a container, and it's worth renaming/moving it to
make that visible rather than letting the categories blur.

## Loading and error states

The view renders both. A container (or parent presentational component) never
shows its own spinner or inline error markup — it resolves the loading/error
state and hands the presentational component `loading` and `error` props,
exactly like any other data, and the view decides what to render from there.
This keeps the same guarantee the rest of the props contract gives you: you
can tell what a component will show in every state just by reading its props,
without knowing whether a request is still in flight or why it failed.

**Errors** — don't let each page invent its own error rendering. Build a small
set of shared, reusable error components once (e.g. `common/units/ErrorBanner.tsx`,
`common/units/ErrorMessage.tsx`), and have presentational components render one
of those whenever their `error` prop is set. A container is still responsible
for turning a thrown error or a failed mutation into whatever shape the
presentational component's `error` prop expects — it just never renders the
error markup itself, so every error in the app looks and behaves the same way.

**Loading, page content** — when a page (or a region of one) is waiting on
data to appear for the first time, its presentational component takes a
`loading` prop and renders a skeleton in place of the real content, rather
than a bare spinner or blank space. Build the skeleton as its own small
component next to the content it mirrors — co-located like any other
presentational component, or promoted to `common/units/` once more than one
page needs the same shape — so it's easy to keep in sync with the real layout
as the content changes.

**Loading, submissions** — a form submitting (or any other user-triggered
mutation) is a different kind of loading: there's already content on screen,
and the user is waiting on one action to settle, not the whole page to
reappear. Use a button loader — the triggering button shows a spinning
indicator and disables itself — until the submission settles, rather than a
page-level skeleton. A `pending` prop (see the `SignUpFormProps` example under
Forms, below) is what feeds this.

Reuse `common/units/` components for skeletons, buttons (including their
loading state), and form elements the same way you would for anything else —
a second, slightly different `Button` or skeleton built from scratch is
exactly the duplication the Units category exists to prevent.

## Don't split a resolved value into two props

A container frequently resolves an id to the record it identifies — the selected
user's id and the matching `User`, the active tab's key and the tab object, and so
on. Once that resolution has happened, pass the presentational component the
resolved value alone, not the id and the value as two separate props.

The problem with passing both: the two props are only useful if they agree, but
nothing enforces that they do. Every child that receives `currentUserId` and
`currentUser` has to trust `currentUser.id === currentUserId`, and a small change
to either prop — in the container or in the child — can leave that assumption
silently broken, pointing the UI at a user other than the one whose id it thinks
is selected. A single resolved prop can't drift out of sync with itself.

```tsx
// Prefer — one resolved value, nothing to disagree with itself
<UserPicker currentUser={currentUser} onSelect={switchTo} />

// Over — currentUserId and currentUser are redundant and can disagree
<UserPicker currentUserId={knownUserId} currentUser={currentUser} onSelect={switchTo} />
```

Inside `UserPicker`, derive whatever scalar the markup actually needs (e.g. a
`<select>`'s `value`) straight from the resolved prop, such as
`currentUser?.id ?? ""`, rather than accepting it as its own prop.

This doesn't mean id props are never appropriate. When a presentational
component is reporting _which_ item was picked — a `<select>`, a clickable row in
a list — id is the natural currency for that: the component already has the list
of options and doesn't need to know anything else about the one that wasn't
picked. Report the id back through the callback (`onSelect(id)`) and let the
container do the id → record lookup, the same way it resolved the current
selection in the first place. The container is the one place that lookup
belongs; a presentational component should never need its own copy of "the list
of things this id can resolve to" just to turn an id back into a record.

## Containers are used sparingly

For most pages, there's no separate container file at all: the page component
itself fetches data, calls mutations, computes derived values, and renders the
presentational pieces below it with plain props. Splitting a dedicated
container out of the page is only worth doing once a page has genuinely become
unwieldy — e.g. two independently loading, independently interactive regions
that each want their own data-fetching lifecycle — not as a default way to
organize things. A container is never a place to "put things you're not sure
about"; if you're tempted to split one for that reason, the page probably just
needs another presentational component instead.

When a page does need one or more dedicated containers, they're always
co-located with the page (see below) — never promoted to a shared location. If
two pages seem to need the same fetching/orchestration logic, extract a shared
hook, not a shared container; the container itself stays specific to its page.
(See Custom hooks, below, for when — and how — to extract one.)

## Global state is the exception, not the default

Most values a component tree needs — even ones read several levels deep — don't
need a global store. A container can fetch or compute a value once and hand it
down as a prop, one level at a time, just like any other container-owned data.
Reach for global state (React Context, Redux, Zustand, Jotai, global variables, or similar) only
when a value is genuinely cross-cutting: read by components scattered across many
unrelated pages, where threading it through every intermediate component's props
would mean touching files that have nothing to do with the value itself. Current
user/session, theme, and locale are the usual legitimate cases. If a value is only
needed within one page's tree, it belongs in that page's container as ordinary
state, not in a global store — a store that only one page ever reads isn't doing
anything a container couldn't do more simply.

When global state is genuinely warranted, only the top-level component that owns
the page's data-fetching reads from it directly — the page component itself for
most pages, or its dedicated container(s) once a page has split one out. Call the hook or selector
(`useContext`, a Zustand/Redux selector, etc.) there, then pass the value down as
a prop exactly like any other piece of container-owned data. A presentational
component should never import a context or store hook itself, even for a value
it technically has access to. This preserves the reason the container/presentational
split exists in the first place: you can understand, test, and reuse a
presentational component by reading only its props, without needing to know
whether the data behind them came from a fetch, local state, or a global store.

If a deeply-nested component is reaching into a store directly because plumbing
the value through several layers of props feels tedious, that's usually a sign
the intermediate components should simply forward the prop — not that the leaf
component should quietly step outside the prop boundary. A little bit of prop
forwarding through components that don't otherwise use the value is a small,
visible cost; a component that can silently reach into global state is a cost
that stays hidden until someone tries to reuse or test it in isolation.

## Co-location is the default

Most presentational components should live inside the page (or feature) that uses
them, not in a project-wide components folder. Ask one question before placing a
new component: **will this be used by more than one page or feature?**

- No → co-locate it, in a folder named after the page that owns it, sitting right
  next to that page's file.
- Yes → it belongs in one of the three global categories below, under `common/`.

This isn't an absolute rule — if something is co-located today and a second page
genuinely needs it tomorrow, promote it then. Don't pre-emptively globalize
something just because it feels reusable in the abstract; wait until it's actually
reused.

```
src/
├── common/
│   ├── layouts/
│   │   └── SidebarLayout.tsx
│   ├── units/
│   │   ├── Button.tsx
│   │   ├── TextInput.tsx
│   │   └── Select.tsx
│   ├── forms/                        ← only forms reused across pages end up here
│   │   └── AddressForm.tsx
│   └── pages/
│       └── UserProfilePage/           ← co-located folder, named after the page
│           ├── UserProfilePage.tsx   ← the page component; also the container here
│           ├── AvatarUploader.tsx
│           ├── ActivityTimeline.tsx
│           └── DisplayNameForm.tsx    ← a form, co-located: only this page uses it
```

If a co-located piece under a page folder later turns out to be needed by another
page too, move it into the matching `common/` category (a generic input becomes a
`common/units/` component, a form reused elsewhere becomes a `common/forms/`
component) — and if it doesn't cleanly fit units, forms, or layouts, that's
usually a sign to decompose it into a unit plus composition rather than invent a
new global bucket.

## The three global categories

These three are the exceptions to co-location — they live under `common/` even on
their very first use, because their whole purpose is to be shared or to sit at a
fixed structural position:

**Layouts** (`common/layouts/`) — wrapper components that render a fixed page
shell (header/sidebar/footer arrangement, centered-column shell, etc.) and always
delegate their actual content via a `children` prop (or named slot props). A
layout never knows what page it's wrapping.

**Units** (`common/units/`) — the smallest reusable primitives: `Button`,
`TextInput`, `Select`, `Checkbox`, `RadioButton`, `TextArea`, loading skeletons,
and standardized error components, and similar. Almost no business logic — just
rendering, minimal style/interaction state, and prop types. These are the
building blocks other presentational components (including form fields,
skeletons, and error displays) are made from — reach for one of these before
building a bespoke button, skeleton, or error message for a single page.

**Pages** (`common/pages/`) — the route-level entry point, co-located in its own
folder alongside every other file it owns, not sitting one level above it. A
page always renders exactly one layout. For the common case of a single
container, the page component _is_ the container — it fetches data and renders
its presentational components directly inside the layout, rather than splitting
into a thin page file that only forwards to a separate container. Only
introduce a dedicated container file (or files) once the page's data-fetching
has genuinely outgrown one component (see Containers are used sparingly,
above).

## Forms

A form is a parent component that composes form elements — inputs, selects,
radio groups, etc., normally built from `common/units/` primitives — and owns
submission wiring (validation, calling the container's submit callback). Name the
parent file `<Name>Form.tsx`, e.g. `AddressForm.tsx`, `UserContactForm.tsx`.

Forms follow the same co-location rule as any other presentational component:
co-locate a form inside the page that uses it by default, and only promote it to
`common/forms/` once a second page genuinely needs the same form.

A form's submission wiring — field state, an uncommitted draft, calling the
container's mutation — is also the clearest recurring case for a custom hook.
See Custom hooks below.

## Custom hooks

All form components need a corresponding custom hook. A form's state (field
values, an uncommitted draft, the mutation that submits it) always needs to be part of the hook
the rest of the container doesn't need to know its internals, only
the finished shape it hands back at submit time. Whenever a page has a form (see
Forms, above) give it a matching
hook named after the form it belongs to: `UserForm.tsx` pairs with
`useUserForm.tsx`, `SignUpForm.tsx` pairs with `useSignUpForm.tsx`. The container
calls the hook and passes its return value straight through as the form's props
— the hook doesn't replace the container/presentational split, it just gives the
container a smaller, labeled place to keep one piece of its logic instead of
interleaving it with everything else in the container body. If you need to override
form props you would do it through the custom hook by passing those values to the hook instead.

### The form and its hook share one interface

A form component and its hook are two halves of the same contract, so they
should be typed as one. Declare the form's props as a named, exported
interface in the form's own file (`export interface SignUpFormProps { ... }`),
and give the hook that same interface as its explicit return type, imported
from the form file rather than redeclared:

```tsx
// SignUpForm.tsx
export interface SignUpFormProps {
  displayName: string;
  onDisplayNameChange: (value: string) => void;
  onSubmit: (displayName: string) => void;
  pending: boolean;
  error: boolean;
}

export function SignUpForm(props: SignUpFormProps) {
  /* ... */
}
```

```tsx
// useSignUpForm.tsx
import type { SignUpFormProps } from "./SignUpForm";

export function useSignUpForm(options: UseSignUpFormOptions): SignUpFormProps {
  // ...
  return { displayName, onDisplayNameChange, onSubmit, pending, error };
}
```

The point of naming and exporting the interface, rather than letting each side
infer its own shape, is that "the hook returns exactly what the form needs" stops
being something you have to check by reading both files side by side — the
compiler checks it on every change. Add a field the form needs and forget to
return it from the hook, or rename one on either side, and the mismatch is a
type error at the call site, not a bug you find by running the page. It also
means the container never needs to know the individual field names at all: it
calls the hook and passes the whole object through (`<SignUpForm {...signUpForm} />`
or `<SignUpForm signUpForm={signUpForm} />` if it's composed inside another
presentational component), so the props list only has to be kept in sync in
the two files that actually own it.

This only works one direction: the hook's return type should be exactly the
form's props type, not a superset or a lookalike. If the hook needs to return
something the form doesn't render (e.g. an internal id for the container's own
use), that value doesn't belong in the shared interface — return it alongside
the form props as a sibling field, not folded into the same object.

Hooks follow the same co-location rule as everything else in this skill: a hook
specific to one page's form lives in the same folder as that form and its
container, not in a project-wide `hooks/` directory. Promote it to `common/`
only once a second page genuinely needs the same hook — same rule as
presentational components and forms.

```
common/pages/UserProfilePage/
├── UserProfilePage.tsx            ← page/container: calls useDisplayNameForm(), passes the result down
├── DisplayNameForm.tsx            ← exports DisplayNameFormProps
└── useDisplayNameForm.tsx         ← co-located, returns DisplayNameFormProps
```

This isn't limited to forms — any other self-contained piece of container
behavior (a multi-step wizard's step state, a table's sort/filter state) is a
candidate for the same treatment if it passes the same test: name the shape as
an interface, export it from the component that consumes it, and have the hook
return exactly that type.

## Worked example

Building a "user profile" page where the user can view recent activity and edit
their display name:

1. **Page, acting as the container**: `common/pages/UserProfilePage/UserProfilePage.tsx`
   — renders `common/layouts/` (say, `SidebarLayout`), fetches the profile,
   fetches recent activity, holds the submit-in-flight state, and renders the
   presentational pieces below with plain props. No separate container file,
   since this page only needs the one.
2. **Co-located presentational components**, same folder: `AvatarUploader.tsx`,
   `ActivityTimeline.tsx` — page-specific, not reused elsewhere, so they stay
   put. Each takes `loading` and `error` props and renders a skeleton or a
   shared `common/units/` error component accordingly (see Loading and error
   states, above).
3. **Co-located form**, same folder: `DisplayNameForm.tsx` — built from
   `common/units/TextInput.tsx` and `common/units/Button.tsx`, receives the
   current name, a `pending` flag, and an `onSubmit` callback as props, holds
   no state of its own beyond perhaps an uncommitted draft value while typing
   (see Custom hooks, above). `Button` shows its loading spinner while
   `pending` is true.

If `ActivityTimeline` later turns out to be exactly what a "team activity" page
also needs, that's the moment it moves — not before. If this page later grows a
second, independently-loading region, that's the moment to split a dedicated
container out of `UserProfilePage.tsx` — not before.

## Quick reference

| Question                                                                                                      | Answer                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Does it fetch data or own business logic?                                                                     | The page component itself, unless the page has genuinely outgrown one — then a dedicated container, still co-located with its page                               |
| Is it a fixed page shell that only ever delegates to `children`?                                              | Layout — `common/layouts/`                                                                                                                                       |
| Is it a route-level entry point?                                                                              | Page — `common/pages/<PageName>/`, co-located in its own folder with every file it owns                                                                          |
| Does a page need more than one independently-loading region?                                                  | Split a dedicated container (or containers) out of the page component, still co-located                                                                          |
| Is it a small reusable primitive (button, input, select, skeleton, error display, ...)?                       | Unit — `common/units/`                                                                                                                                           |
| Is it a form, and is it used on more than one page?                                                           | Yes → `common/forms/`. No → co-locate with the page                                                                                                              |
| Does a container have a form (and its field state and submit wiring, etc.) that's a concern in its own right? | Extract a co-located custom hook named after what it powers (`UserForm.tsx` → `useUserForm.tsx`); the container calls it and passes the result through as props. |
| Do a form and its hook agree on props at runtime only, or does the compiler check it?                         | Export the form's props as a named interface and give the hook that exact interface as its return type — a mismatch should be a type error, not a bug            |
| Does a component need a value only its own page's tree uses?                                                  | Container state, passed down as a prop — no global store needed                                                                                                  |
| Does a component need a value read across many unrelated pages?                                               | Global state is warranted — but only the top-level component that owns the page's data reads it; everything else gets it as a prop                               |
| Do you have both an id and the record it resolves to?                                                         | Pass the resolved record alone; derive any id from it inline. Only pass a bare id when the component is reporting a selection back up                            |
| Does a presentational component need to show an error?                                                        | Render a shared `common/units/` error component, driven by an `error` prop passed down from the container/parent — never build error markup inline               |
| Is a page (or region) waiting on data to first appear?                                                        | Render a loading skeleton via a `loading` prop — co-located, or promoted to `common/units/` once more than one page reuses the same shape                        |
| Is a submission (form or otherwise) in flight?                                                                | Use a button loader (spinner + disabled) driven by a `pending` prop — not a page-level skeleton                                                                  |
| Anything else — is it used by more than one page/feature?                                                     | Yes → promote to the matching `common/` category. No → co-locate in that page's folder                                                                           |
