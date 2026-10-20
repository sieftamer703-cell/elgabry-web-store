EL GABRY STORE — ADMIN SETUP
1. Open supabase-config.js and paste the Project URL and publishable (or legacy anon) key. Never paste secret/service_role key.
2. Ensure the previous SQL admin policies and is_store_admin() function were executed.
3. Run the folder using a local web server (VS Code Live Server or python -m http.server 5500).
4. Open http://localhost:5500/admin.html and sign in with the admin email/password created in Supabase Auth.
5. Add a product and verify it in Supabase Table Editor.
IMPORTANT: index.html still uses demo products; it is NOT yet connected to Supabase. The website checkout does NOT yet store orders. Do not use it for real online sales yet.
