#!/usr/bin/env node

const { Command } = require('commander');
const fs = require('fs').promises;
const path = require('path');
const { glob } = require('glob');
const chalk = require('chalk');
const ora = require('ora');
const Table = require('cli-table3');
const ImageCompressor = require('../lib/compressor');

const program = new Command();

program
  .name('img-compress')
  .description('Compress images - single file or directory')
  .version('1.0.0')
  .argument('[path]', 'Image file or directory path')
  .option('-q, --quality <number>', 'General compression quality (1-100)', '80')
  .option('--jpg-quality <number>', 'JPEG quality (1-100, default: 80)')
  .option('--png-quality <number>', 'PNG quality (1-100, default: 90)')
  .option('--webp-quality <number>', 'WebP quality (1-100, default: 80)')
  .option('-f, --format <format>', 'Output format (jpg, png, webp, avif)')
  .option('-w, --width <pixels>', 'Resize to width (maintains aspect ratio)')
  .option('-h, --height <pixels>', 'Resize to height (maintains aspect ratio)')
  .option('-o, --output <path>', 'Output directory or file')
  .option('--replace', 'Replace original files (use with caution!)')
  .option('--dry-run', 'Preview what would be compressed')
  .option('--keep-structure', 'Maintain directory structure in output')
  .option('--min-size <kb>', 'Only compress files larger than this (in KB)', '0')
  .option('--max-size <kb>', 'Only compress files smaller than this (in KB)')
  .option('--no-rotate', 'Disable auto-rotation based on EXIF orientation')
  .option('--keep-metadata', 'Preserve all EXIF metadata (default: strip metadata)')
  .option('-v, --verbose', 'Show detailed error messages')
  .action(async (inputPath, options) => {
    // If no path provided, show help
    if (!inputPath) {
      program.outputHelp();
      console.log(chalk.yellow('\nExamples:'));
      console.log('  img-compress image.jpg                    # Compress single image');
      console.log('  img-compress .                            # Compress all images in current directory');
      console.log('  img-compress ./images                     # Compress all images in directory');
      console.log('  img-compress . -q 90 -f webp              # Convert to WebP with quality 90');
      return;
    }

    const spinner = ora('Checking input...').start();

    try {
      // Check if input exists
      const stats = await fs.stat(inputPath).catch(() => null);

      if (!stats) {
        // Maybe it's a pattern or the path doesn't exist
        const files = await glob(inputPath);
        if (files.length === 0) {
          spinner.fail(chalk.red(`Path not found: ${inputPath}`));
          process.exit(1);
        }
        // Process as pattern match
        await processFiles(files, options, spinner);
      } else if (stats.isDirectory()) {
        // Process directory
        await processDirectory(inputPath, options, spinner);
      } else if (stats.isFile()) {
        // Process single file
        await processSingleFile(inputPath, options, spinner);
      } else {
        spinner.fail(chalk.red('Invalid input path'));
        process.exit(1);
      }

    } catch (error) {
      spinner.fail(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

// Add batch command for processing from a list file
program
  .command('batch <listFile>')
  .description('Compress images from a text file list (one path per line)')
  .option('-q, --quality <number>', 'General compression quality (1-100)', '80')
  .option('--jpg-quality <number>', 'JPEG quality (1-100, default: 80)')
  .option('--png-quality <number>', 'PNG quality (1-100, default: 90)')
  .option('--webp-quality <number>', 'WebP quality (1-100, default: 80)')
  .option('-f, --format <format>', 'Output format (jpg, png, webp, avif)')
  .option('-w, --width <pixels>', 'Max width')
  .option('-h, --height <pixels>', 'Max height')
  .option('-o, --output <dir>', 'Output directory for all images')
  .action(async (listFile, options) => {
    const spinner = ora('Reading file list...').start();

    try {
      const content = await fs.readFile(listFile, 'utf-8');
      const files = content.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));

      if (files.length === 0) {
        spinner.warn('No files in list');
        return;
      }

      await processFiles(files, options, spinner);

    } catch (error) {
      spinner.fail(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

// Add stats command for analyzing without compression
program
  .command('stats [path]')
  .description('Analyze images without compressing (default: current directory)')
  .action(async (inputPath = '.', options) => {
    const spinner = ora('Analyzing images...').start();

    try {
      const compressor = new ImageCompressor();
      const analysis = await compressor.analyzeImages(inputPath, options);

      spinner.succeed('Analysis complete');

      const table = new Table({
        head: ['File', 'Size', 'Dimensions', 'Format'],
        style: { head: ['cyan'] }
      });

      analysis.files.forEach(file => {
        table.push([
          path.relative(process.cwd(), file.path),
          file.size,
          file.dimensions,
          file.format
        ]);
      });

      console.log(table.toString());
      console.log(chalk.bold(`\nTotal: ${analysis.totalFiles} files, ${analysis.totalSize}`));
      console.log(chalk.gray(`Average size: ${analysis.averageSize}`));

      // Show potential savings estimate
      const estimatedSavings = analysis.files.reduce((sum, f) => sum + f.sizeBytes, 0) * 0.3;
      console.log(chalk.green(`Estimated savings with compression: ~${formatBytes(estimatedSavings)}`));

    } catch (error) {
      spinner.fail(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

// Process single file
async function processSingleFile(filePath, options, spinner) {
  spinner.text = 'Compressing image...';

  const compressor = new ImageCompressor(options);

  // Check file size filters
  if (options.minSize || options.maxSize) {
    const stats = await fs.stat(filePath);
    const sizeKB = stats.size / 1024;

    if (options.minSize && sizeKB < parseFloat(options.minSize)) {
      spinner.info(`Skipped (smaller than ${options.minSize}KB): ${path.basename(filePath)}`);
      return;
    }

    if (options.maxSize && sizeKB > parseFloat(options.maxSize)) {
      spinner.info(`Skipped (larger than ${options.maxSize}KB): ${path.basename(filePath)}`);
      return;
    }
  }

  if (options.dryRun) {
    const stats = await fs.stat(filePath);
    spinner.succeed(chalk.blue(`Would compress: ${filePath} (${formatBytes(stats.size)})`));
    return;
  }

  const outputPath = options.replace ? filePath : options.output || null;
  const result = await compressor.compressFile(filePath, outputPath);

  if (result.success) {
    spinner.succeed(chalk.green(`✓ Compressed ${path.basename(filePath)} - saved ${result.savedPercent}%`));
    console.log(chalk.gray(`  Original: ${result.originalSize}`));
    console.log(chalk.gray(`  Compressed: ${result.compressedSize}`));
    console.log(chalk.gray(`  Output: ${result.outputPath}`));
  } else {
    spinner.warn(chalk.yellow(`Skipped ${path.basename(filePath)} - ${result.reason}`));
  }
}

// Process directory
async function processDirectory(directory, options, spinner) {
  spinner.text = 'Scanning for images...';

  // Resolve directory path (handles '.' properly)
  const resolvedDir = path.resolve(directory);

  // Use simpler glob patterns that work better cross-platform
  const extensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'JPG', 'JPEG', 'PNG', 'WEBP', 'GIF', 'AVIF'];
  let allFiles = [];

  // Search for each extension separately for better compatibility
  for (const ext of extensions) {
    // Current directory files
    const pattern1 = `${resolvedDir.replace(/\\/g, '/')}/*.${ext}`;
    // Subdirectory files
    const pattern2 = `${resolvedDir.replace(/\\/g, '/')}/**/*.${ext}`;

    const files1 = await glob(pattern1);
    const files2 = await glob(pattern2);

    allFiles = allFiles.concat(files1, files2);
  }

  // Remove duplicates
  const files = [...new Set(allFiles)];

  if (files.length === 0) {
    spinner.warn(chalk.yellow(`No images found in ${directory}`));

    // Debug: Show what we're looking for
    if (options.minSize || options.maxSize) {
      console.log(chalk.gray(`  Note: Size filters applied (min: ${options.minSize || 0}KB, max: ${options.maxSize || 'unlimited'}KB)`));
    }
    return;
  }

  spinner.succeed(`Found ${files.length} image${files.length > 1 ? 's' : ''}`);

  // Pre-filter files by size if needed
  const minSizeKB = options.minSize ? parseFloat(options.minSize) : 0;
  const maxSizeKB = options.maxSize ? parseFloat(options.maxSize) : Infinity;

  if (minSizeKB > 0 || maxSizeKB < Infinity) {
    let filteredFiles = [];
    for (const file of files) {
      try {
        const stats = await fs.stat(file);
        const sizeKB = stats.size / 1024;

        if (sizeKB < minSizeKB || sizeKB > maxSizeKB) {
          continue; // Skip files outside size range
        }

        filteredFiles.push(file);
      } catch (err) {
        // File might not exist or be accessible
      }
    }

    if (filteredFiles.length === 0) {
      spinner.warn(chalk.yellow(`No images match size criteria (${minSizeKB}KB - ${maxSizeKB === Infinity ? 'unlimited' : maxSizeKB + 'KB'})`));
      return;
    }

    if (filteredFiles.length < files.length) {
      console.log(chalk.gray(`  Filtered to ${filteredFiles.length} images by size (${minSizeKB}KB - ${maxSizeKB === Infinity ? 'unlimited' : maxSizeKB + 'KB'})`));
    }
    await processFiles(filteredFiles, options);
  } else {
    await processFiles(files, options);
  }
}

// Process multiple files
async function processFiles(files, options, existingSpinner = null) {
  const spinner = existingSpinner || ora('Processing images...').start();
  const compressor = new ImageCompressor(options);
  const results = [];

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    spinner.text = `Processing (${i + 1}/${files.length}): ${path.basename(file)}`;

    try {
      // Check if file exists
      const stats = await fs.stat(file).catch(() => null);
      if (!stats) {
        results.push({ input: file, error: 'File not found' });
        errors++;
        continue;
      }

      // Check file size filters
      const sizeKB = stats.size / 1024;
      if (options.minSize && sizeKB < parseFloat(options.minSize)) {
        results.push({ input: file, skipped: true, reason: `Smaller than ${options.minSize}KB` });
        skipped++;
        continue;
      }
      if (options.maxSize && sizeKB > parseFloat(options.maxSize)) {
        results.push({ input: file, skipped: true, reason: `Larger than ${options.maxSize}KB` });
        skipped++;
        continue;
      }

      if (options.dryRun) {
        results.push({
          input: file,
          originalSize: formatBytes(stats.size),
          status: 'Would compress'
        });
        processed++;
      } else {
        const outputPath = options.replace ? file : compressor.getOutputPath(file, path.dirname(file), options);
        const result = await compressor.compressFile(file, outputPath);

        if (result.success) {
          processed++;
        } else {
          skipped++;
        }
        results.push(result);
      }

    } catch (error) {
      const errorMsg = error.message || 'Unknown error';
      results.push({ input: file, error: errorMsg });
      errors++;

      // Show detailed error in verbose mode
      if (options.verbose) {
        console.log(chalk.red(`\n  ✗ ${path.basename(file)}: ${errorMsg}`));
      }
    }
  }

  spinner.succeed(`Completed: ${processed} processed, ${skipped} skipped, ${errors} errors`);

  // Display results table
  if (results.length > 0) {
    displayResults(results);
  }

  // Show hint about verbose mode if there were errors
  if (errors > 0 && !options.verbose) {
    console.log(chalk.gray('\nHint: Use -v or --verbose flag to see detailed error messages'));
  }
}

// Display results in a table
function displayResults(results) {
  const table = new Table({
    head: ['File', 'Original', 'Compressed', 'Saved', 'Status'],
    style: { head: ['cyan'] },
    colWidths: [30, 12, 12, 10, 35],
    wordWrap: true
  });

  let totalOriginalBytes = 0;
  let totalCompressedBytes = 0;
  let successCount = 0;
  let copiedCount = 0;
  let compressedCount = 0;

  results.forEach(r => {
    const fileName = path.basename(r.input || r.outputPath || 'unknown');

    if (r.error) {
      table.push([
        fileName,
        '-',
        '-',
        '-',
        chalk.red(`✗ ${r.error}`)
      ]);
    } else if (r.skipped) {
      table.push([
        fileName,
        r.originalSize || '-',
        '-',
        '-',
        chalk.yellow(r.reason || 'Skipped')
      ]);
    } else if (r.status === 'Would compress') {
      table.push([
        fileName,
        r.originalSize,
        '-',
        '-',
        chalk.blue('Dry run')
      ]);
    } else if (r.success) {
      if (r.copied) {
        // File was copied, not compressed
        table.push([
          fileName,
          r.originalSize,
          r.originalSize,
          chalk.gray('0%'),
          chalk.blue('↗ Copied')
        ]);
        copiedCount++;
      } else {
        // File was compressed
        const savedColor = parseFloat(r.savedPercent) > 0 ? chalk.green : chalk.red;

        table.push([
          fileName,
          r.originalSize,
          r.compressedSize,
          savedColor(`${r.savedPercent}%`),
          chalk.green('✓ Compressed')
        ]);
        compressedCount++;
      }
      successCount++;

      // Parse sizes for total calculation
      const origBytes = parseBytes(r.originalSize);
      const compBytes = parseBytes(r.compressedSize);
      if (origBytes && compBytes) {
        totalOriginalBytes += origBytes;
        totalCompressedBytes += compBytes;
      }
    }
  });

  console.log('\n' + table.toString());

  // Summary
  if (successCount > 0) {
    const totalSaved = totalOriginalBytes - totalCompressedBytes;
    const savedPercent = totalOriginalBytes > 0
      ? ((totalSaved / totalOriginalBytes) * 100).toFixed(1)
      : 0;

    console.log(chalk.bold('\nSummary:'));
    if (compressedCount > 0) {
      console.log(chalk.green(`  ✓ ${compressedCount} images compressed`));
    }
    if (copiedCount > 0) {
      console.log(chalk.blue(`  ↗ ${copiedCount} images copied (no compression benefit)`));
    }
    console.log(`  Total saved: ${chalk.green(formatBytes(totalSaved))} (${savedPercent}%)`);
    console.log(`  Original total: ${formatBytes(totalOriginalBytes)}`);
    console.log(`  Final total: ${formatBytes(totalCompressedBytes)}`);
  }
}

// Helper to parse bytes from formatted string
function parseBytes(str) {
  if (!str || typeof str !== 'string') return 0;

  const match = str.match(/^([\d.]+)\s*([KMGT]?B)$/i);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();

  const multipliers = { B: 1, KB: 1024, MB: 1024*1024, GB: 1024*1024*1024 };
  return value * (multipliers[unit] || 1);
}

// Helper to format bytes
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Parse and execute
program.parse(process.argv);

// If no arguments provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
  console.log(chalk.yellow('\nExamples:'));
  console.log('  img-compress image.jpg                    # Compress single image');
  console.log('  img-compress .                            # Compress all images in current directory');
  console.log('  img-compress ./images                     # Compress all images in directory');
  console.log('  img-compress . --jpg-quality 85 --png-quality 95  # Different quality per format');
  console.log('  img-compress . -q 90 -f webp              # Convert to WebP with quality 90');
  console.log('  img-compress photo.png --replace          # Replace original file');
}