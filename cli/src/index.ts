#!/usr/bin/env node
/**
 * SDL CLI — v0.4
 *
 * Commands:
 *   sdl validate <dir>        Validate SDL files in a directory (recursive by default)
 *   sdl init <service-name>   Scaffold a new layer_logic service directory
 *   sdl render <dir>          Generate a self-contained HTML renderer for SDL files
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { validateDir, validateDirRecursive } from './validator/validate.js';
import { initService } from './scaffolder/init.js';
import { readAll } from './renderer/reader.js';
import { generateHtml } from './renderer/html-renderer.js';
import type { ValidationIssue, ValidationResult } from './validator/types.js';

const program = new Command();

program
  .name('sdl')
  .description('SDL CLI — validate, scaffold, and render SDL files')
  .version('0.4.0');

// ── sdl validate ─────────────────────────────────────────────────────────────

program
  .command('validate <dir>')
  .description(
    'Validate *.sdl.json files against the SDL spec schemas.\n' +
    'By default searches the directory recursively for SDL directories.\n' +
    'Use --no-recursive to validate only the target directory.',
  )
  .option('--no-recursive', 'Validate only the specified directory, not subdirectories')
  .option(
    '--platform <path>',
    'Path to platform.sdl.json, used to resolve service_id references in service-flow files',
  )
  .option('--json', 'Output results as JSON (useful for CI integration)')
  .action((dir: string, opts: { recursive: boolean; platform?: string; json?: boolean }) => {
    const results: ValidationResult[] = opts.recursive
      ? validateDirRecursive(dir, opts.platform)
      : [validateDir(dir, opts.platform)];

    if (results.length === 0) {
      console.log(chalk.yellow('No SDL directories found in: ' + dir));
      process.exit(0);
    }

    if (opts.json) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      printResults(results);
    }

    const hasErrors = results.some((r) => r.issues.some((i) => i.severity === 'error'));
    process.exit(hasErrors ? 1 : 0);
  });

// ── sdl init ──────────────────────────────────────────────────────────────────

program
  .command('init <service-name>')
  .description(
    'Scaffold a layer_logic SDL directory for a new service.\n' +
    'Creates <service-name>/ in the current directory (or --out <dir>) with\n' +
    'stub files for all five primitives: manifest, entry-points, operations,\n' +
    'data-shapes, and dependencies.',
  )
  .option('--out <dir>', 'Output directory (default: current working directory)', process.cwd())
  .action((serviceName: string, opts: { out: string }) => {
    try {
      initService(serviceName, opts.out);
      const targetDir = opts.out + '/' + serviceName;
      console.log(chalk.green(`✓ Scaffolded ${serviceName}/ in ${opts.out}`));
      console.log('');
      console.log('  Files created:');
      console.log(`    ${targetDir}/manifest.sdl.json`);
      console.log(`    ${targetDir}/entry-points.sdl.json`);
      console.log(`    ${targetDir}/operations.sdl.json`);
      console.log(`    ${targetDir}/data-shapes.sdl.json`);
      console.log(`    ${targetDir}/dependencies.sdl.json`);
      console.log('');
      console.log('  Next steps:');
      console.log('  1. Edit manifest.sdl.json — fill in description, domain, exposes, consumes');
      console.log('  2. Edit operations.sdl.json — describe your business logic');
      console.log('  3. Edit entry-points.sdl.json — define your routes / event consumers');
      console.log('  4. Edit data-shapes.sdl.json — describe your payloads and events');
      console.log('  5. Edit dependencies.sdl.json — list external services and datastores');
      console.log('  6. Run: sdl validate ' + targetDir);
    } catch (err) {
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// ── sdl render ────────────────────────────────────────────────────────────────

program
  .command('render <dir>')
  .description(
    'Generate a self-contained HTML renderer for SDL files.\n' +
    'Walks <dir> recursively, collects all SDL data, and writes a single\n' +
    'HTML file with an interactive three-layer diagram viewer.',
  )
  .option('--out <file>', 'Output HTML file path (default: <dir>/sdl-renderer.html)')
  .option('--title <name>', 'Page title (default: derived from platform label)')
  .action((dir: string, opts: { out?: string; title?: string }) => {
    const absDir = resolve(dir);
    const outFile = opts.out ?? resolve(absDir, 'sdl-renderer.html');
    const data = readAll(absDir);
    const total = data.platforms.length + data.serviceFlowBundles.length + data.services.length;
    if (total === 0) {
      console.error(chalk.yellow('No SDL files found in: ' + absDir));
      process.exit(0);
    }
    const html = generateHtml(data, opts.title);
    writeFileSync(outFile, html, 'utf-8');
    console.log(chalk.green(`✓ Rendered to ${outFile}`));
    console.log(chalk.dim(`  ${data.platforms.length} platform(s), ${data.serviceFlowBundles.length} flow bundle(s), ${data.services.length} service(s)`));
    console.log(chalk.dim(`  Open in browser: file://${resolve(outFile)}`));
  });

program.parse(process.argv);

// ── Printer ───────────────────────────────────────────────────────────────────

function printResults(results: ValidationResult[]): void {
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const result of results) {
    const errors = result.issues.filter((i) => i.severity === 'error');
    const warnings = result.issues.filter((i) => i.severity === 'warning');
    totalErrors += errors.length;
    totalWarnings += warnings.length;

    if (errors.length === 0 && warnings.length === 0) {
      console.log(chalk.green(`✓ ${result.dir}`));
      if (result.foundFiles.length > 0) {
        console.log(chalk.dim(`  ${result.foundFiles.length} file(s) valid`));
      }
      continue;
    }

    console.log('');
    const statusIcon = errors.length > 0 ? chalk.red('✗') : chalk.yellow('⚠');
    console.log(`${statusIcon} ${chalk.bold(result.dir)}`);

    for (const issue of result.issues) {
      printIssue(issue);
    }
  }

  console.log('');
  console.log(chalk.bold('Summary'));

  if (totalErrors === 0 && totalWarnings === 0) {
    console.log(chalk.green(`  All ${results.length} SDL director${results.length === 1 ? 'y' : 'ies'} passed validation.`));
  } else {
    if (totalErrors > 0) {
      console.log(chalk.red(`  ${totalErrors} error${totalErrors === 1 ? '' : 's'}`));
    }
    if (totalWarnings > 0) {
      console.log(chalk.yellow(`  ${totalWarnings} warning${totalWarnings === 1 ? '' : 's'}`));
    }
    console.log(`  ${results.length} director${results.length === 1 ? 'y' : 'ies'} checked`);
  }
}

function printIssue(issue: ValidationIssue): void {
  const badge =
    issue.severity === 'error'
      ? chalk.red('  error  ')
      : chalk.yellow('  warn   ');
  const file = chalk.cyan(issue.file);
  const path = issue.path ? chalk.dim(` (${issue.path})`) : '';
  console.log(`${badge} ${file}${path}`);
  console.log(`           ${issue.message}`);
}
