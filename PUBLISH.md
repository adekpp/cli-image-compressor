# Publishing img-compress-cli to npm

## Prerequisites

1. Create npm account at https://www.npmjs.com/signup
2. Login to npm in terminal:
   ```bash
   npm login
   ```

## Publishing Steps

### 1. First Time Setup

```bash
cd cli-package

# Install dependencies
npm install

# Test locally
npm link
img-compress --version

# Unlink after testing
npm unlink
```

### 2. Check Package Name Availability

```bash
npm view img-compress-cli

# If taken, update name in package.json
```

### 3. Update Version

```bash
# For first release
npm version 1.0.0

# For updates
npm version patch  # 1.0.0 -> 1.0.1
npm version minor  # 1.0.0 -> 1.1.0
npm version major  # 1.0.0 -> 2.0.0
```

### 4. Publish to npm

```bash
# Dry run first
npm publish --dry-run

# Publish publicly
npm publish --access public
```

### 5. Verify Installation

```bash
# Install globally
npm install -g img-compress-cli

# Test
img-compress --version
img-compress file test.jpg
```

## Updating the Package

1. Make changes
2. Update version: `npm version patch`
3. Publish: `npm publish`

## Maintenance

### View Package Info
```bash
npm info img-compress-cli
```

### Check Downloads
```bash
npm view img-compress-cli downloads
```

### Deprecate Old Versions
```bash
npm deprecate img-compress-cli@1.0.0 "Please upgrade to 1.1.0"
```

## Alternative: GitHub Package Registry

### Setup
```bash
# Add to package.json
"publishConfig": {
  "registry": "https://npm.pkg.github.com"
}

# Update package name
"name": "@yourusername/img-compress-cli"
```

### Publish to GitHub
```bash
npm login --registry=https://npm.pkg.github.com
npm publish
```

## Using Locally Without Publishing

### For Testing
```bash
cd cli-package
npm link

# Now use anywhere
img-compress file photo.jpg
```

### For Distribution
Share the `cli-package` folder and users can:

```bash
cd cli-package
npm install
npm link
```

Or install directly from GitHub:

```bash
npm install -g https://github.com/yourusername/img-compress-cli.git
```