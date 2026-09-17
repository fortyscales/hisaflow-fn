# HisaFlow Application Contracts — v1.5

The renderer, Electron IPC, future NestJS controllers, and future mobile clients should talk in **commands and queries**, not persistence functions.

## Commands
Commands represent business intent and use object-shaped DTOs: `completeSale`, `completeCartSale`, `completeCreditSale`, `addStock`, `completeRestockCart`, `recordCreditPayment`, `deleteCreditSale`, `adjustInventory`, `addExpense`, and `deleteExpense`.

The application boundary validates/normalizes DTOs before dispatching to the existing domain/query facade. Operation IDs are preserved when supplied and generated for legacy callers when absent. Network-capable clients should generate and retain an operation ID across retries.

## Queries
Queries are read-only application contracts. v1.5 begins with `salesPage`, `dashboard`, `inventorySummary`, `receivablesSummary`, `staffSales`, and `overdueReceivables`.

## Boundary rule
React -> DataService -> preload -> app:command/app:query -> application bus -> domain/repository layer.

A future NestJS controller should call the same command/query vocabulary. It must not expose SQL-shaped repository methods to clients.
