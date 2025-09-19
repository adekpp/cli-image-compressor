let sharp;
try {
  sharp = require('sharp');
} catch (error) {
  console.error('\n⚠️  Sharp module is not installed or incompatible with your platform.');
  console.error('\nTo fix this issue, please run one of the following commands:');
  console.error('\n  For Windows:');
  console.error('  npm install --os=win32 --cpu=x64 sharp');
  console.error('\n  For macOS:');
  console.error('  npm install --os=darwin sharp');
  console.error('\n  For Linux:');
  console.error('  npm install --os=linux sharp');
  console.error('\n  Or try reinstalling with optional dependencies:');
  console.error('  npm install --include=optional sharp');
  console.error('\nFor more information, visit: https://sharp.pixelplumbing.com/install\n');
  process.exit(1);
}
const fs = require('fs').promises;
const path = require('path');
const { glob } = require('glob');
const chalk = require('chalk');
const Table = require('cli-table3');

class ImageCompressor {
  constructor(options = {}) {
    // Set default qualities for each format
    const defaultQuality = parseInt(options.quality) || 80;

    this.options = {
      quality: defaultQuality, // Fallback for formats not listed below
      jpgQuality: parseInt(options.jpgQuality) || parseInt(options.quality) || 80,
      pngQuality: parseInt(options.pngQuality) || parseInt(options.quality) || 90,
      webpQuality: parseInt(options.webpQuality) || parseInt(options.quality) || 80,
      format: options.format,
      width: options.width ? parseInt(options.width) : null,
      height: options.height ? parseInt(options.height) : null,
      optimize: options.optimize !== false,
      rotate: options.rotate !== false, // Auto-rotate by default
      keepMetadata: options.keepMetadata === true // Strip metadata by default
    };
  }

  async compressFile(inputPath, outputPath) {
    try {
      // Check if input exists
      await fs.access(inputPath);
      const stats = await fs.stat(inputPath);
      const originalSize = stats.size;

      // Generate output path if not provided
      if (!outputPath) {
        const dir = path.dirname(inputPath);
        const ext = path.extname(inputPath);
        const name = path.basename(inputPath, ext);
        outputPath = path.join(dir, `${name}_compressed${ext}`);
      }

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });

      // Build Sharp pipeline
      let pipeline = sharp(inputPath);

      // Check if sharp is available
      if (!sharp) {
        throw new Error('Sharp module is not available');
      }

      // Get metadata first
      const metadata = await sharp(inputPath).metadata();

      // Auto-rotate based on EXIF orientation (if enabled)
      // This ensures the image displays correctly regardless of EXIF data
      if (this.options.rotate) {
        pipeline = pipeline.rotate();
      }

      // Resize if specified
      if (this.options.width || this.options.height) {
        pipeline = pipeline.resize(
          this.options.width,
          this.options.height,
          {
            withoutEnlargement: true,
            fit: 'inside'
          }
        );
      }

      // Determine output format
      const outputFormat = this.options.format || this.getFormatFromPath(outputPath) || metadata.format;

      // Handle metadata
      if (!this.options.keepMetadata) {
        // Strip all metadata except color profile
        pipeline = pipeline.withMetadata({
          orientation: undefined // Remove orientation since we've already rotated
        });
      } else {
        // Keep all metadata but update orientation if rotated
        pipeline = pipeline.withMetadata({
          orientation: this.options.rotate ? undefined : metadata.orientation
        });
      }

      // Apply format-specific optimization with format-specific quality
      switch (outputFormat) {
        case 'jpeg':
        case 'jpg':
          pipeline = pipeline.jpeg({
            quality: this.options.jpgQuality,
            mozjpeg: this.options.optimize,
            progressive: true
          });
          break;

        case 'png':
          pipeline = pipeline.png({
            quality: this.options.pngQuality,
            compressionLevel: this.options.optimize ? 9 : 6,
            palette: this.options.optimize,
            effort: this.options.optimize ? 10 : 7
          });
          break;

        case 'webp':
          pipeline = pipeline.webp({
            quality: this.options.webpQuality,
            effort: this.options.optimize ? 6 : 4,
            lossless: this.options.webpQuality === 100
          });
          break;

        case 'avif':
          pipeline = pipeline.avif({
            quality: this.options.quality, // Uses general quality as AVIF doesn't have specific option
            effort: this.options.optimize ? 9 : 5
          });
          break;

        default:
          pipeline = pipeline.toFormat(outputFormat, {
            quality: this.options.quality
          });
      }

      // Save to buffer first to check size
      const buffer = await pipeline.toBuffer();
      const compressedSize = buffer.length;

      // Calculate savings
      const savedBytes = originalSize - compressedSize;
      const savedPercent = ((savedBytes / originalSize) * 100).toFixed(1);

      // Check if we're replacing the original file
      const isReplacing = outputPath === inputPath;

      // Only save compressed version if we achieved compression (or if replacing)
      if (savedBytes > 0 || isReplacing) {
        if (isReplacing) {
          // For replace mode, write to a temporary file first
          const tempPath = `${outputPath}.tmp${Date.now()}`;
          await fs.writeFile(tempPath, buffer);

          // Then rename to replace the original
          try {
            // On Windows, we need to delete the original first
            await fs.unlink(outputPath);
            await fs.rename(tempPath, outputPath);
          } catch (error) {
            // Try to clean up temp file if rename failed
            try {
              await fs.unlink(tempPath);
            } catch (e) {}
            throw error;
          }
        } else {
          // Normal save to different file
          await fs.writeFile(outputPath, buffer);
        }

        return {
          input: inputPath,
          outputPath,
          originalSize: this.formatBytes(originalSize),
          compressedSize: this.formatBytes(compressedSize),
          savedBytes: this.formatBytes(savedBytes),
          savedPercent,
          success: true
        };
      } else {
        // Compression made file bigger, copy original instead
        if (outputPath !== inputPath) {
          // Copy original file to output location
          await fs.copyFile(inputPath, outputPath);
        }
        // If replacing and no benefit, just leave the original as-is

        return {
          input: inputPath,
          outputPath,
          originalSize: this.formatBytes(originalSize),
          compressedSize: this.formatBytes(originalSize), // Keep original size
          savedBytes: this.formatBytes(0),
          savedPercent: '0.0',
          success: true,
          copied: true, // Flag to indicate file was copied, not compressed
          reason: 'Copied original (no compression benefit)'
        };
      }

    } catch (error) {
      // Provide more detailed error information
      const errorMsg = error.code === 'ENOENT' ? 'File not found' :
                       error.code === 'EACCES' ? 'Permission denied' :
                       error.code === 'EISDIR' ? 'Path is a directory' :
                       error.message || 'Unknown error';
      throw new Error(`Failed to compress ${path.basename(inputPath)}: ${errorMsg}`);
    }
  }

  getOutputPath(inputFile, baseDir, options) {
    const relativePath = path.relative(baseDir, inputFile);
    const dir = path.dirname(relativePath);
    const ext = path.extname(inputFile);
    const name = path.basename(inputFile, ext);

    let outputDir;
    if (options.output) {
      if (options.keepStructure) {
        outputDir = path.join(options.output, dir);
      } else {
        outputDir = options.output;
      }
    } else {
      outputDir = path.join(baseDir, 'compressed', dir);
    }

    const outputExt = options.format ? `.${options.format}` : ext;
    return path.join(outputDir, `${name}${outputExt}`);
  }

  async analyzeImages(inputPath, options = {}) {
    const stats = await fs.stat(inputPath);
    let files = [];

    if (stats.isDirectory()) {
      // Always scan recursively - use forward slashes for glob (works on all platforms)
      const pattern = path.join(inputPath, '**/*.{jpg,jpeg,png,webp,gif,avif,JPG,JPEG,PNG,WEBP,GIF,AVIF}')
        .replace(/\\/g, '/'); // Convert Windows backslashes to forward slashes for glob
      files = await glob(pattern);
    } else {
      files = [inputPath];
    }

    const fileStats = [];
    let totalSize = 0;

    for (const file of files) {
      const fileStat = await fs.stat(file);
      // Check if sharp is available
      if (!sharp) {
        throw new Error('Sharp module is not available');
      }

      const metadata = await sharp(file).metadata();

      totalSize += fileStat.size;

      fileStats.push({
        path: file,
        size: this.formatBytes(fileStat.size),
        sizeBytes: fileStat.size,
        dimensions: `${metadata.width}x${metadata.height}`,
        format: metadata.format
      });
    }

    return {
      files: fileStats,
      totalFiles: files.length,
      totalSize: this.formatBytes(totalSize),
      averageSize: this.formatBytes(Math.round(totalSize / files.length))
    };
  }

  displayResults(results) {
    const table = new Table({
      head: ['File', 'Original', 'Compressed', 'Saved', 'Status'],
      style: { head: ['cyan'] }
    });

    let totalOriginal = 0;
    let totalCompressed = 0;
    let successCount = 0;
    let errorCount = 0;

    results.forEach(r => {
      if (r.error) {
        table.push([
          path.basename(r.input),
          '-',
          '-',
          '-',
          chalk.red(`✗ ${r.error}`)
        ]);
        errorCount++;
      } else if (r.status === 'Would compress') {
        table.push([
          path.basename(r.input),
          r.originalSize,
          '-',
          '-',
          chalk.yellow('Dry run')
        ]);
      } else {
        table.push([
          path.basename(r.input),
          r.originalSize,
          r.compressedSize,
          chalk.green(`${r.savedPercent}%`),
          chalk.green('✓')
        ]);
        successCount++;
      }
    });

    console.log('\n' + table.toString());

    if (successCount > 0) {
      console.log(chalk.green(`\n✓ Successfully compressed ${successCount} images`));
    }
    if (errorCount > 0) {
      console.log(chalk.red(`✗ Failed to compress ${errorCount} images`));
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getFormatFromPath(filePath) {
    const ext = path.extname(filePath).toLowerCase().slice(1);
    const formatMap = {
      'jpg': 'jpeg',
      'jpeg': 'jpeg',
      'png': 'png',
      'webp': 'webp',
      'avif': 'avif',
      'gif': 'gif'
    };
    return formatMap[ext];
  }
}

module.exports = ImageCompressor;