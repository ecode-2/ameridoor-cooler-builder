# Security Guide - Removing Secrets from Git

## If You Haven't Pushed Yet (Easiest)

1. **Check what's in your commits:**
   ```bash
   git log --patch | grep -i "shopify\|token\|key\|secret"
   ```

2. **Reset and recommit without secrets:**
   ```bash
   # Remove all commits (keeps files)
   rm -rf .git
   git init
   git add .
   git commit -m "Initial commit"
   ```

3. **Create environment file:**
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your actual secrets
   ```

## If You Already Pushed to GitHub (More Complex)

### Method 1: Using BFG Repo-Cleaner (Recommended)

1. **Download BFG:**
   ```bash
   brew install bfg  # macOS
   # or download from: https://rtyley.github.io/bfg-repo-cleaner/
   ```

2. **Clone a fresh copy:**
   ```bash
   git clone --mirror https://github.com/ecode-2/ameridoor-cooler-builder.git
   ```

3. **Remove secrets:**
   ```bash
   # Replace YOUR_SECRET with actual secret value
   bfg --replace-text passwords.txt ameridoor-cooler-builder.git
   ```

4. **Clean up:**
   ```bash
   cd ameridoor-cooler-builder.git
   git reflog expire --expire=now --all
   git gc --prune=now --aggressive
   git push --force
   ```

### Method 2: Using git filter-branch

```bash
# Remove specific file from entire history
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch backend/.env" \
  --prune-empty --tag-name-filter cat -- --all

# Force push
git push origin --force --all
```

### Method 3: Delete and Recreate (Simplest if repository is new)

1. **Delete the GitHub repository**
2. **Create a new repository**
3. **Follow "If You Haven't Pushed Yet" steps above**
4. **Push to new repository**

## Secrets to Remove

Look for these patterns in your code:

- `SHOPIFY_ADMIN_TOKEN=shpat_*`
- `SHOPIFY_DOMAIN=*.myshopify.com`
- `IMGBB_API_KEY=*`
- API keys, passwords, tokens
- Email addresses (if sensitive)
- Database connection strings

## How to Find Secrets in Your Commits

```bash
# Search entire git history for sensitive data
git log -p | grep -i "password\|secret\|token\|key\|shopify"

# Search for specific patterns
git log -p | grep -E "shpat_[a-zA-Z0-9]+"

# Check specific files
git log -p -- backend/app.py | grep -i "token\|key"
```

## Rotate Compromised Secrets

After cleaning git history, **you must rotate all exposed secrets:**

### Shopify Tokens
1. Go to Shopify Admin → Settings → Apps and sales channels
2. Find your custom app
3. Delete and recreate the access token
4. Update your `.env` file with new token

### ImgBB API Key
1. Go to ImgBB API settings
2. Regenerate your API key
3. Update your `.env` file

## Prevention (Setup Now)

1. **Use .gitignore** (already created)
   ```bash
   # .gitignore includes:
   .env
   *.key
   secrets.json
   ```

2. **Use environment variables:**
   ```python
   # Good ✅
   SHOPIFY_TOKEN = os.environ.get("SHOPIFY_ADMIN_TOKEN")

   # Bad ❌
   SHOPIFY_TOKEN = "shpat_abc123..."
   ```

3. **Use pre-commit hooks:**
   ```bash
   # Install git-secrets
   brew install git-secrets
   git secrets --install
   git secrets --register-aws
   ```

4. **Scan before committing:**
   ```bash
   # Check for secrets before commit
   git diff --cached | grep -i "token\|key\|password\|secret"
   ```

## GitHub Secret Scanning

GitHub automatically scans for exposed secrets. If detected:

1. **Check your email** for alerts from GitHub
2. **Rotate the compromised secret immediately**
3. **Clean git history** using methods above
4. **Review access logs** for unauthorized usage

## Quick Checklist

- [ ] Secrets removed from all commits
- [ ] `.gitignore` includes `.env` and secret files
- [ ] `.env.example` created (without real secrets)
- [ ] All secrets rotated/regenerated
- [ ] Environment variables used in code
- [ ] Git history cleaned (if already pushed)
- [ ] New secrets added to deployment platform (Netlify/Railway)

## Safe Deployment with Secrets

### Netlify (Frontend)
```bash
# Set environment variables in Netlify dashboard
Site Settings → Environment variables → Add variable
```

### Railway (Backend)
```bash
# Set environment variables in Railway dashboard
Project → Variables tab → Add variables
```

### Local Development
```bash
# Create .env file (never commit this!)
cd backend
cp .env.example .env
nano .env  # Add your real secrets
```

## Emergency Response

If you accidentally commit secrets:

1. **STOP** - Don't push if you haven't yet
2. **Amend the commit:**
   ```bash
   git reset --soft HEAD~1
   # Remove the secret
   git add .
   git commit -m "Your message"
   ```

3. **If already pushed:**
   - Rotate secrets IMMEDIATELY
   - Follow "If You Already Pushed" section above
   - Force push cleaned history

## Verify Secrets Are Gone

```bash
# Check current files
grep -r "shpat_" .
grep -r "SHOPIFY_ADMIN_TOKEN.*=.*['\"]" .

# Check git history
git log -p | grep -i "shpat_"
git log -p | grep "SHOPIFY_ADMIN_TOKEN.*=.*['\"]"
```

## Resources

- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)
- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)
- [git-secrets](https://github.com/awslabs/git-secrets)
- [Remove Sensitive Data from Git](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
