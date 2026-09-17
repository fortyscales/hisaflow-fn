# HisaFlow v2.0 Production Readiness Gate

v2.0 is a validation gate, not a claim that every target machine has been certified. A release candidate is production-ready only after the checks below pass in a clean environment.

## Automated gate

Run `npm ci`, then `npm run test:production`. The gate performs Electron/shared JavaScript syntax checks, all architecture contracts, failure-injection tests, the v2.0 readiness contract, and a Vite production build.

## Native SQLite / Electron gate

`better-sqlite3` must be rebuilt for the exact Electron major used by the app (`npm run postinstall` / electron-rebuild). Then launch Electron and exercise a real SQLite database: create product, restock, FIFO sale, credit sale/payment, expense, reversal, snapshot backup, snapshot validation, restore, restart, and integrity/reconciliation checks.

## Packaging gate

Run `npm run package` on the intended packaging host. Verify the packaged Electron application starts without native-module ABI errors and can read/write SQLite after installation.

## Windows acceptance gate

On a clean supported Windows machine, install the generated package and test first launch, restart, offline operation, abrupt process termination followed by restart, backup/restore, printer/export paths used by the product, and upgrade from the previous released database schema. Confirm user data remains outside the application installation directory.

## Data-safety gate

Before release, verify database `integrity_check`, foreign keys, inventory reconciliation, idempotency retries, sync lease recovery, corrupted-backup rejection, and failure-injection rollback behavior. Never accept a release merely because the UI compiles.

## Current validation status

The repository contains the automated gate and dependency-free suites. In the ChatGPT build workspace, dependency installation was attempted but did not complete within the environment time limit, so the Vite production build, native `better-sqlite3` Electron rebuild, packaged Electron launch, and Windows acceptance gate remain environment-dependent checks rather than claimed passes.
