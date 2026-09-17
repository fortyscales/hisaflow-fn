function createAccountLedgerRepository(db) {
  const insert = db.prepare(`INSERT OR IGNORE INTO account_ledger
    (id,account_id,account_label,account_number,direction,amount,entry_type,reference_type,reference_id,description,date,created_at)
    VALUES (@id,@accountId,@accountLabel,@accountNumber,@direction,@amount,@entryType,@referenceType,@referenceId,@description,@date,@createdAt)`);
  return {
    record(e) {
      if (!e || !e.accountId || !(Number(e.amount) > 0)) return null;
      const row={...e,accountLabel:e.accountLabel||'',accountNumber:e.accountNumber||'',description:e.description||'',createdAt:e.createdAt||e.date};
      insert.run(row); return row;
    }
  };
}
module.exports={createAccountLedgerRepository};
