# Supabase + GitHub setup for "Connect GitHub"

Audience: the **Supabase / GitHub organization admin**. No code knowledge needed.
Context: [github-account-linking.md](./github-account-linking.md)

Time: about 10 minutes. Nothing changes for existing users.

You need admin access to the Supabase project and to the GitHub organization that will own the app.

## Step 1: Create a GitHub OAuth App

1. In GitHub, open the organization's **Settings → Developer settings → OAuth Apps → New OAuth App**. Using the org account means the app does not depend on one person's account.
2. Fill in:
   - **Application name:** BetterGovPH Volunteers Portal
   - **Homepage URL:** `https://volunteers.bettergov.ph`
   - **Authorization callback URL:** `https://<PROJECT-REF>.supabase.co/auth/v1/callback`
     - Supabase shows this URL in Step 2. It must match exactly.
3. Click **Register application**.
4. Click **Generate a new client secret**. Copy the **Client ID** and the **Client Secret** now, because GitHub shows the secret only once.

## Step 2: Turn on the GitHub provider in Supabase

1. Open the Supabase dashboard, select the project, then go to **Authentication → Sign In / Providers**.
2. Open **GitHub** and switch **Enable** on.
3. Paste in the **Client ID** and **Client Secret** from Step 1.
4. Check that the callback URL Supabase displays matches what you entered in GitHub. If it does not, fix it in GitHub.
5. Click **Save**.

## Step 3: Allow manual linking

1. Under **Authentication → Sign In / Providers**, find **Allow manual linking**. Depending on the dashboard version it is at the top of the page or under **Authentication → Settings**.
2. Switch it **on** and save.

This lets an existing Google-signed-in member add GitHub to their account. Without it, "Connect GitHub" fails with a "manual linking disabled" error.

## Step 4: Allow the redirect URLs

Supabase rejects any redirect URL that is not allow-listed, so skipping this breaks the flow.

1. Go to **Authentication → URL Configuration**.
2. Set **Site URL** to `https://volunteers.bettergov.ph`.
3. Under **Redirect URLs**, add:
   - `https://volunteers.bettergov.ph/profile`
   - `https://volunteers.bettergov.ph/register`
   - `http://localhost:3000/profile`
   - `http://localhost:3000/register`
   - If Vercel previews are used, a wildcard such as `https://*-<team>.vercel.app/**`
4. Save.

## Step 5: Check the database (read-only)

The `users` table's Row Level Security policies are not in the repo, and they must be reviewed before new GitHub columns are added.

1. Open **Table Editor → users → RLS policies** (or **Authentication → Policies**).
2. Send the list of policies on the `users` table (a screenshot is fine).

## Step 6: Send back

- Confirmation that Steps 1-4 are done.
- The policy list from Step 5.
- **Do not send the Client Secret in chat.** It lives only in Supabase.

## Optional: local development

Create a second OAuth App named **BetterGovPH Local Dev** with callback URL `http://127.0.0.1:54321/auth/v1/callback`. Developers put its Client ID and Secret in their local environment for `supabase/config.toml` (`[auth.external.github]`, plus `enable_manual_linking = true`). Never reuse the production secret locally.

## Quick check

In Supabase, **Authentication → Providers → GitHub** should show as enabled with no warnings.

> Dashboard labels were written from memory of the Supabase UI and may differ slightly in your version. Follow the setting names if menu paths have moved.
