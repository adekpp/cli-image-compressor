# cli-image-compressor

Standalone CLI tool for batch image compression and optimization.

## Key Features

- 📦 **Batch Processing** - Compress single files, entire directories, or use file lists
- 🎨 **Multiple Formats** - Support for JPEG, PNG, WebP, GIF, AVIF
- 🔄 **Format Conversion** - Convert between formats while compressing
- 📐 **Smart Resizing** - Resize images while maintaining aspect ratio
- 🎯 **Format-Specific Quality** - Set different quality levels
- 📊 **Real-time Progress** - Visual feedback with progress indicators and tables
- 🛡️ **Safe by Default** - Never overwrites originals unless explicitly told to
- 🎛️ **Metadata Control** - Strip or preserve EXIF data as needed

## Installation

### Global Installation (Recommended)

```bash
npm install -g img-compress-cli
```

Or using Yarn:

```bash
yarn global add img-compress-cli
```

### Local Installation

```bash
npm install img-compress-cli
```

Then use with npx:

```bash
npx img-compress image.jpg
```

## Quick Start

```bash
# Compress a single image
img-compress photo.jpg

# Compress all images in current directory (includes subdirectories)
img-compress .

# Compress all images in a specific directory (includes subdirectories)
img-compress ./images

# Compress with custom quality
img-compress photo.jpg -q 90

# Convert to WebP format
img-compress photo.jpg -f webp

# Resize and compress
img-compress photo.jpg -w 1920 -q 85
```

## Usage Overview

The CLI automatically detects input types and processes them intelligently:

```bash
# Single file compression
img-compress photo.jpg

# Directory compression (includes all subdirectories)
img-compress ./images

# Current directory
img-compress .

# With options
img-compress photo.jpg -q 90 -f webp
```

## Commands

### Main Command - Smart Detection

```bash
img-compress [path] [options]
```

The CLI automatically detects whether the input is a file or directory:

- **No path** - Shows help and usage examples
- **`.`** - Compresses all images in current directory and subdirectories
- **File path** - Compresses single image
- **Directory path** - Compresses all images in that directory and subdirectories
- **Glob pattern** - Processes matching files

**Options:**
- `-q, --quality <1-100>` - General compression quality (default: 80)
- `--jpg-quality <1-100>` - JPEG specific quality (default: 80)
- `--png-quality <1-100>` - PNG specific quality (default: 90)
- `--webp-quality <1-100>` - WebP specific quality (default: 80)
- `-f, --format <format>` - Output format (jpg, png, webp, avif)
- `-w, --width <pixels>` - Max width (maintains aspect ratio)
- `-h, --height <pixels>` - Max height (maintains aspect ratio)
- `-o, --output <path>` - Output directory or file
- `--replace` - Replace original files (use with caution!)
- `--dry-run` - Preview what would be compressed
- `--keep-structure` - Maintain directory structure in output
- `--min-size <kb>` - Only compress files larger than this
- `--max-size <kb>` - Only compress files smaller than this
- `--no-rotate` - Disable auto-rotation based on EXIF orientation
- `--keep-metadata` - Preserve all EXIF metadata (default: strip)
- `-v, --verbose` - Show detailed error messages

**Examples:**

```bash
# Compress single image
img-compress photo.jpg

# Compress all in current directory
img-compress .

# Compress specific directory (includes all subdirectories)
img-compress ./images

# Convert to WebP with quality 90
img-compress image.png -f webp -q 90

# Resize to max width 1920px
img-compress photo.jpg -w 1920

# Replace originals (careful!)
img-compress . --replace

# Dry run to preview
img-compress ./images --dry-run

# Only compress large files
img-compress . --min-size 100  # Only files > 100KB

# Use glob pattern
img-compress "**/*.png" -f webp

# Different quality for different formats
img-compress . --jpg-quality 85 --png-quality 95

# High quality for JPEGs, moderate for PNGs
img-compress ./photos --jpg-quality 90 --png-quality 70
```

### `batch` - Process images from a list file

```bash
img-compress batch <listFile> [options]
```

Create a text file with image paths (one per line):

```txt
# images.txt
/path/to/image1.jpg
/path/to/image2.png
# Comments are supported
/path/to/image3.webp
```

**Options:**
- `-q, --quality <1-100>` - Compression quality
- `-f, --format <format>` - Output format
- `-w, --width <pixels>` - Max width
- `-h, --height <pixels>` - Max height
- `--output-dir <dir>` - Output directory for all images

**Examples:**

```bash
# Process list
img-compress batch images.txt

# Output all to specific directory
img-compress batch images.txt --output-dir ./compressed

# Batch convert to WebP
img-compress batch images.txt -f webp -q 85
```

### `stats` - Analyze images without compressing

```bash
img-compress stats [path]
```

Analyzes images to show size, dimensions, and potential compression savings without actually compressing files. Defaults to current directory if no path specified.

**Examples:**

```bash
# Analyze current directory
img-compress stats

# Analyze single image
img-compress stats photo.jpg

# Analyze specific directory
img-compress stats ./images
```

## Supported Formats

### Input Formats
- JPEG/JPG
- PNG
- WebP
- GIF
- AVIF
- TIFF
- BMP

### Output Formats
- **JPEG** - Best for photos
- **PNG** - Best for images with transparency
- **WebP** - Best overall compression
- **AVIF** - Next-gen format with excellent compression

## Quality Guidelines

### General Recommendations

| Quality | Use Case | File Size |
|---------|----------|-----------|
| 100 | Lossless / Archive | Largest |
| 90-95 | High quality / Print | Large |
| 80-89 | Web images (default) | Balanced |
| 70-79 | Social media | Small |
| 60-69 | Thumbnails | Smaller |
| <60 | Low quality | Smallest |

### Format-Specific Recommendations

**JPEG** (Lossy compression, best for photos):
- 85-95: Professional photography, print
- 75-84: General web use (default: 80)
- 65-74: Social media
- 50-64: Thumbnails

**PNG** (Lossless option, best for graphics with transparency):
- 95-100: Lossless or near-lossless (default: 90)
- 80-94: High quality with some optimization
- 60-79: Balanced compression
- <60: Maximum compression (may lose quality)

**WebP** (Modern format, best overall):
- 85-95: High quality
- 75-84: General web use (default: 80)
- 65-74: Good balance
- 50-64: Small file sizes

## Advanced Examples

### Web Optimization

```bash
# Optimize images for web (1920px max, 85% quality, WebP)
img-compress ./uploads -w 1920 -q 85 -f webp -o ./public/images

# Create responsive image sizes
img-compress hero.jpg -w 640 -o hero-sm.jpg
img-compress hero.jpg -w 1024 -o hero-md.jpg
img-compress hero.jpg -w 1920 -o hero-lg.jpg
```

### Batch Processing

```bash
# Find and compress all large images
find . -type f -size +1M \( -iname "*.jpg" -o -iname "*.png" \) > large-images.txt
img-compress batch large-images.txt -q 85
```

### CI/CD Integration

```bash
#!/bin/bash
# compress-assets.sh

# Compress all images before deployment (automatically includes subdirectories)
img-compress ./src/assets -o ./dist/assets -q 85

# Check if successful
if [ $? -eq 0 ]; then
  echo "✓ Images compressed successfully"
else
  echo "✗ Compression failed"
  exit 1
fi
```

### Directory Watch (with external tools)

```bash
# Using with nodemon
nodemon --watch ./uploads --ext jpg,png,webp --exec "img-compress dir ./uploads -o ./public"

# Using with chokidar-cli
chokidar "**/*.{jpg,png}" -c "img-compress file {path}"
```

## Performance Tips

1. **Use WebP or AVIF** for best compression ratios
2. **Quality 80-85** provides best balance
3. **Resize large images** before compressing
4. **Process in batches** for large collections
5. **Use format-specific quality** for optimal results per format

## Troubleshooting

### Installation Issues

If you encounter Sharp installation issues:

```bash
# Clear npm cache
npm cache clean --force

# Reinstall
npm install -g img-compress-cli
```

### Memory Issues

For large images or batches:

```bash
# Increase Node memory limit
NODE_OPTIONS="--max-old-space-size=4096" img-compress dir ./images
```

### Permission Errors

On macOS/Linux:

```bash
# Use sudo for global installation
sudo npm install -g img-compress-cli

# Or change npm prefix
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Technical Details

### Architecture
- **CLI Interface**: Built with Commander.js for robust command-line parsing
- **Image Processing**: Sharp library for high-performance image manipulation
- **Progress Feedback**: Ora spinner and CLI-Table3 for visual feedback
- **File Handling**: Glob patterns for flexible file selection

### Key Features Implementation
- **Smart Compression**: Automatically skips if compressed size is larger than original
- **Safe Operations**: Creates temporary files before replacing originals
- **EXIF Handling**: Auto-rotation based on orientation metadata
- **Batch Processing**: Efficient sequential processing with progress tracking

## License

MIT © Adrian Pietryga

## Support

For issues and feature requests, please visit:
[GitHub Issues](https://github.com/adekpp/cli-image-compressor/issues)