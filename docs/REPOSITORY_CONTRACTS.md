# Repository and Command/Query Contracts (v1.3)

HisaFlow's domain/application layer must not grow new ad-hoc SQL. SQLite-specific statements belong in `electron/repositories/`. Domain services receive repository contracts and a transaction runner. This keeps transaction ownership explicit while making PostgreSQL adapters possible later.

## Initial write contracts
- `products.findById(id)`, `products.findStockById(id)`, `products.exists(id)`
- `sales.insert(sale)`
- `orders.findStatus(id)`, `orders.markFulfilled(id,date)`
- `expenses.insert(row)`, `expenses.findById(id)`, `expenses.deleteById(id)`
- `activities.append(event)`
- `receipts.find(operationId)`, `receipts.save(receipt)`

## Application boundary
Commands mutate state and execute inside `transactionRunner.run(...)`. Queries are read-only repository methods. Domain code validates business rules and coordinates repositories; repositories do not decide business policy.

This is an incremental isolation boundary. Inventory, credit and purchase still contain legacy direct SQLite access and are explicitly the next extraction targets. New domain functionality should use repositories rather than adding SQL to those services.
