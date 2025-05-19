# BizConnect AI Nexus

## Storage Configuration Guide
This guide explains how to set up the necessary storage configuration for profile image uploads.

### Setting up Supabase Storage for Profile Images

There are two ways to configure the required storage bucket and policies:

#### Option 1: Using SQL (requires admin privileges)
Run the `scripts/storage_profile_images_setup.sql` script in the Supabase SQL Editor with admin privileges (Service Role access).

#### Option 2: Using the Supabase Dashboard (recommended)
1. Log in to your Supabase dashboard
2. Navigate to Storage > Buckets
3. Create a new bucket named `profile_images` and set it to public
4. Navigate to Storage > Policies 
5. Select the `profile_images` bucket
6. Create the following policies:

   **Policy 1: Allow public read access**
   - Name: "profile_images_public_select"
   - Operation: SELECT
   - Using expression: `bucket_id = 'profile_images'`

   **Policy 2: Allow users to upload to their own folder**
   - Name: "profile_images_auth_insert"
   - Operation: INSERT
   - Using expression: `bucket_id = 'profile_images' AND auth.role() = 'authenticated' AND (split_part(name, '/', 1)) = auth.uid()::text`

   **Policy 3: Allow users to update their own files**
   - Name: "profile_images_auth_update"
   - Operation: UPDATE
   - Using expression: `bucket_id = 'profile_images' AND auth.role() = 'authenticated' AND (split_part(name, '/', 1)) = auth.uid()::text`

   **Policy 4: Allow users to delete their own files**
   - Name: "profile_images_auth_delete"
   - Operation: DELETE
   - Using expression: `bucket_id = 'profile_images' AND auth.role() = 'authenticated' AND (split_part(name, '/', 1)) = auth.uid()::text`

### Important Notes
- The file path format in the `AvatarUpload` component is `${user.id}/${randomString}-${timestamp}.${fileExt}`
- Users must be authenticated for uploads to work properly
- The bucket must be set to public for avatar images to be viewable


## HTTPS Development Setup for Web Crypto API

### Why HTTPS is Required

The Web Crypto API requires a secure context (HTTPS) to function properly. This is a security measure implemented by browsers to protect cryptographic operations from potential attacks. In development, you'll need to set up SSL certificates to enable HTTPS for the following features:

- End-to-end encrypted messaging
- Secure file sharing
- Key pair generation and management

### Setup Instructions

We've configured the application to support HTTPS in development mode. Here's how to use it:

1. **Certificate Generation**
   
   Certificates have been generated and placed in the `certs/` folder at the project root. These include:
   - `localhost.pem` (certificate)
   - `localhost-key.pem` (private key)

   If you need to regenerate these certificates, you can use one of the following methods:

   **Using OpenSSL:**
   ```sh
   # Create the certs directory if it doesn't exist
   mkdir -p certs
   
   # Generate self-signed certificates for localhost
   openssl req -x509 -newkey rsa:4096 -nodes -out certs/localhost.pem -keyout certs/localhost-key.pem -days 365 -subj "/CN=localhost"
   ```

   **Using mkcert (recommended for local development):**
   ```sh
   # Install mkcert (https://github.com/FiloSottile/mkcert)
   # Then run:
   mkcert -install
   mkcert -cert-file certs/localhost.pem -key-file certs/localhost-key.pem localhost 127.0.0.1 ::1
   ```

2. **Trusting the Certificates**
   
   - **macOS/Linux**: When using mkcert, certificates are automatically trusted by your system.
   - **Windows**: You may need to manually import `localhost.pem` into your Trusted Root Certification Authorities store.
   - **Browser-specific**: Some browsers maintain their own certificate stores and may require additional steps.

3. **Starting the Application in HTTPS Mode**

   The Vite configuration has been updated to use HTTPS by default. Simply start the development server as usual:
   ```sh
   npm run dev
   ```

   Then access the application at `https://localhost:8080`

### Troubleshooting

Common issues and their solutions:

1. **Certificate Not Trusted Warning**
   - In development, you can click "Advanced" and "Proceed" in most browsers
   - For a better experience, use mkcert to install properly trusted certificates

2. **Crypto Operations Failing**
   - Ensure you're accessing the site via HTTPS (not HTTP)
   - Check browser console for specific error messages
   - If using Chrome, ensure you're not in Incognito mode as it may restrict certain crypto features

3. **Permission Issues with Certificate Files**
   - Ensure the certificate files have appropriate read permissions
   - If regenerating, use `chmod 644 certs/localhost.pem certs/localhost-key.pem` to set proper permissions

### Development Fallback Implementation

For development convenience, the application includes fallback implementations when the Web Crypto API is not available:

- In development mode (localhost or NODE_ENV=development), the app will use mock crypto implementations that simulate encryption
- These mock implementations provide a development experience that mimics real encryption but **DO NOT provide actual security**
- The fallbacks are automatically disabled in production environments
- Clear console warnings will appear when the fallback is being used

**⚠️ IMPORTANT: Never use the development fallback implementations in production environments. They do not provide actual cryptographic security.**

# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/3096167e-d168-4290-9d79-8735262c4a08

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/3096167e-d168-4290-9d79-8735262c4a08) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/3096167e-d168-4290-9d79-8735262c4a08) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
# Lumio
